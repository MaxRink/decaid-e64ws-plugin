import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';

function wsFrame(text) { const body = Buffer.from(text); const key = Buffer.from([1, 2, 3, 4]); const out = Buffer.alloc(2 + 4 + body.length); out[0] = 0x81; out[1] = 0x80 | body.length; key.copy(out, 2); for (let i = 0; i < body.length; i++) out[6 + i] = body[i] ^ key[i % 4]; return out; }
function readFrame(socket) { return new Promise((resolve, reject) => { const onData = chunk => { socket.off('error', reject); const length = chunk[1] & 127; resolve(chunk.subarray(2, 2 + length).toString()); }; socket.once('data', onData); socket.once('error', reject); }); }
function connect(port, token) { return new Promise((resolve, reject) => { const socket = net.connect(port, '127.0.0.1'); socket.once('error', reject); socket.once('connect', () => { const key = Buffer.from('mock-key').toString('base64'); socket.write(`GET /?token=${encodeURIComponent(token)} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`); socket.once('data', header => { if (!/101 Switching Protocols/.test(header.toString())) { socket.destroy(); reject(new Error('websocket upgrade rejected')); return; } resolve(socket); }); }); }); }
function control(port, value) { return fetch(`http://127.0.0.1:${port}/control`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(value)}); }
function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

test('public mock authenticates and correlates read replies', async t => {
  const port = 19000 + Math.floor(Math.random() * 500);
  const child = spawn(process.execPath, ['tools/e64-mock-server.mjs', '--id', 'test', '--port', String(port), '--token', 'synthetic'], {stdio: 'ignore'});
  t.after(() => child.kill());
  let socket;
  for (let attempt = 0; attempt < 20 && !socket; attempt += 1) {
    try { socket = await connect(port, 'synthetic'); } catch { await new Promise(resolve => setTimeout(resolve, 25)); }
  }
  assert.ok(socket, 'mock server did not accept a connection');
  t.after(() => socket.destroy());
  socket.write(wsFrame(JSON.stringify({type: 'RequestNachineInfo', msgId: 17})));
  assert.deepEqual(JSON.parse(await readFrame(socket)), {type: 'RequestNachineInfoResult', refId: 17, data: {model: 'E64S', serial: 'MOCK-test'}});
});

test('public mock rejects bad auth and exercises drop, delay, duplicate, malformed, and close controls', async t => {
  const port = 19500 + Math.floor(Math.random() * 400);
  const child = spawn(process.execPath, ['tools/e64-mock-server.mjs', '--id', 'controls', '--port', String(port), '--token', 'synthetic'], {stdio: 'ignore'});
  t.after(() => child.kill());
  let probe;
  for (let attempt = 0; attempt < 20 && !probe; attempt += 1) { try { probe = await connect(port, 'synthetic'); } catch { await wait(25); } }
  assert.ok(probe, 'mock server did not start');
  probe.destroy();
  await assert.rejects(Promise.race([connect(port, 'wrong'), wait(500).then(() => { throw new Error('auth timeout'); })]));
  const socket = await connect(port, 'synthetic');
  t.after(() => socket.destroy());
  await control(port, {dropReplies: true});
  assert.equal((await (await fetch(`http://127.0.0.1:${port}/health`)).json()).counts.RequestDriverState, 0);
  await control(port, {dropReplies: false, delayMs: 10, duplicateReplies: true});
  socket.write(wsFrame(JSON.stringify({type: 'RequestDriverState', msgId: 2})));
  assert.equal(JSON.parse(await readFrame(socket)).refId, 2);
  assert.equal((await (await fetch(`http://127.0.0.1:${port}/health`)).json()).counts.RequestDriverState, 1);
  await control(port, {duplicateReplies: false, action: 'malformed'});
  await control(port, {action: 'close'});
  await Promise.race([new Promise(resolve => socket.once('close', resolve)), wait(500).then(() => { throw new Error('close timeout'); })]);
});
