import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

async function startMock(t, id) {
  const child = spawn(process.execPath, [fileURLToPath(new URL('../tools/e64-mock-server.mjs', import.meta.url)), '--id', id, '--port', '0', '--token', 'synthetic']);
  t.after(() => child.kill());
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('mock startup timeout')), 5000);
    let output = '';
    child.stdout.on('data', data => {
      output += data;
      const match = /127\.0\.0\.1:(\d+)/.exec(output);
      if (match) { clearTimeout(timer); resolve(Number(match[1])); }
    });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`mock exited: ${code}`)); });
  });
  const base = `http://127.0.0.1:${port}`;
  return {
    port,
    health: async () => (await fetch(`${base}/health`)).json(),
    control: async value => {
      const response = await fetch(`${base}/control`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(value)});
      assert.equal(response.status, 200);
    },
  };
}

async function connect(t, port, token = 'synthetic') {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/?token=${encodeURIComponent(token)}`);
  t.after(() => socket.close());
  const messages = [], pending = [];
  let closed = false;
  let resolveClose;
  const closeEvent = new Promise(resolve => { resolveClose = resolve; });
  socket.addEventListener('message', event => {
    const waiter = pending.shift();
    if (waiter) waiter.resolve(event.data); else messages.push(event.data);
  });
  socket.addEventListener('close', () => { closed = true; resolveClose(); });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket open timeout')), 2000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, {once: true});
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('WebSocket upgrade rejected')); }, {once: true});
  });
  return {
    send: value => socket.send(JSON.stringify(value)),
    next: (timeoutMs = 1000) => {
      if (messages.length) return Promise.resolve(messages.shift());
      return new Promise((resolve, reject) => {
        const waiter = {resolve: value => { clearTimeout(timer); resolve(value); }};
        const timer = setTimeout(() => {
          pending.splice(pending.indexOf(waiter), 1);
          reject(new Error('message timeout'));
        }, timeoutMs);
        pending.push(waiter);
      });
    },
    closed: async () => {
      if (closed) return;
      let timer;
      try { await Promise.race([closeEvent, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('close timeout')), 1000); })]); }
      finally { clearTimeout(timer); }
    },
  };
}

test('public mock authenticates and correlates read replies', async t => {
  const mock = await startMock(t, 'test');
  const socket = await connect(t, mock.port);
  for (const [index, type] of ['RequestDriverState', 'RequestDriverConfig', 'RequestNachineInfo', 'RequestLogMessages'].entries()) {
    socket.send({type, msgId: index + 17});
    const response = JSON.parse(await socket.next());
    assert.equal(response.type, `${type}Result`);
    assert.equal(response.refId, index + 17);
    assert.equal(typeof response.data, 'object');
    if (type === 'RequestNachineInfo') assert.equal(response.data.serial, 'MOCK-test');
  }
  socket.send({type: 'StartMotor', msgId: 99});
  assert.deepEqual(JSON.parse(await socket.next()), {type: 'Error', refId: 99, error: 'unsupported read command'});
  const health = await mock.health();
  assert.equal(health.rejectedCommands, 1);
  assert.deepEqual(Object.values(health.counts), [1, 1, 1, 1]);
  assert.ok(!JSON.stringify(health).includes('synthetic'));
});

test('public mock rejects bad auth and exercises drop, delay, duplicate, malformed, and close controls', async t => {
  const mock = await startMock(t, 'controls');
  await assert.rejects(connect(t, mock.port, 'wrong'), /upgrade rejected/);
  const socket = await connect(t, mock.port);
  await mock.control({dropReplies: true});
  socket.send({type: 'RequestDriverState', msgId: 1});
  await assert.rejects(socket.next(80), /message timeout/);
  assert.equal((await mock.health()).counts.RequestDriverState, 1);
  await mock.control({dropReplies: false, delayMs: 80, duplicateReplies: true, state: 'grinding'});
  socket.send({type: 'RequestDriverState', msgId: 2});
  await assert.rejects(socket.next(20), /message timeout/);
  const first = JSON.parse(await socket.next());
  assert.equal(first.refId, 2);
  assert.equal(first.data.state, 'grinding');
  assert.deepEqual(JSON.parse(await socket.next()), first);
  await mock.control({duplicateReplies: false, delayMs: 0, action: 'malformed'});
  const malformed = await socket.next();
  assert.throws(() => JSON.parse(malformed), SyntaxError);
  await mock.control({action: 'close'});
  await socket.closed();
});
