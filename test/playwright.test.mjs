import {test, expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../plugin.js', import.meta.url), 'utf8');
let mock;
let bridge;
let baseUrl;
let plugin;
let registration;

function reply(res, status, value, headers = {'content-type': 'application/json'}) {
  res.writeHead(status, headers);
  res.end(typeof value === 'string' ? value : JSON.stringify(value));
}

test.beforeAll(async () => {
  mock = spawn(process.execPath, [new URL('../tools/e64-mock-server.mjs', import.meta.url).pathname, '--id', 'one', '--port', '0', '--token', 'token-one'], {stdio: ['ignore', 'pipe', 'inherit']});
  let port;
  await Promise.race([new Promise((resolve, reject) => {
    mock.stdout.on('data', chunk => {
      const match = chunk.toString().match(/listening on .*:(\d+)/);
      if (match) { port = Number(match[1]); resolve(); }
    });
    mock.on('error', reject);
    mock.on('exit', code => reject(new Error(`E64 mock exited before startup (${code})`)));
  }), new Promise((_, reject) => setTimeout(() => reject(new Error('E64 mock startup timed out')), 10_000))]);
  const registrations = [];
  const host = {devices: {register(definition, handlers) {
    const device = {deviceId: `plugin:mahlkoenig-e64.reaplugin:e64:${definition.instanceId}`};
    registrations.push({definition, handlers, device});
    return Promise.resolve(device);
  }}};
  const sandbox = {setTimeout, clearTimeout, Promise, Map, Set, JSON, Object, Number, Array, Error, encodeURIComponent};
  vm.runInNewContext(`globalThis.createPlugin = (${source}\n);`, sandbox);
  plugin = sandbox.createPlugin(host);
  await plugin.onLoad({InstancesJson: JSON.stringify([{id: 'one', name: 'E64', host: '127.0.0.1', port, pollMs: 100}]), TokensJson: JSON.stringify({one: 'token-one'})});
  registration = registrations[0];
  const context = {transport: {
    async open({url}) { const socket = new WebSocket(url); await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, {once: true}); socket.addEventListener('error', reject, {once: true}); }); return {handle: socket}; },
    onEvent(handle, callback) { handle.addEventListener('message', event => callback({type: 'data', dataType: 'text', data: event.data})); },
    send(handle, payload) { handle.send(payload.data); return Promise.resolve(); },
    close(handle) { handle.close(); return Promise.resolve(); },
  }, publish: async state => { context.state = state; }, reportDisconnected: async error => { context.disconnected = String(error); }};
  await registration.handlers.connect(context);
  bridge = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/control') {
      let body = ''; for await (const chunk of req) body += chunk;
      await fetch(`http://127.0.0.1:${port}/control`, {method: 'POST', headers: {'content-type': 'application/json'}, body});
      return reply(res, 200, {ok: true});
    }
    if (url.pathname !== '/diagnostics') return reply(res, 404, {error: 'not found'});
    const result = await plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: req.method, query: Object.fromEntries(url.searchParams)});
    reply(res, result.status, result.body, result.headers);
  });
  await new Promise(resolve => bridge.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${bridge.address().port}`;
});

test.afterAll(async () => {
  await plugin?.onUnload();
  await new Promise(resolve => bridge?.close(resolve));
  mock?.kill('SIGTERM');
});

test('publishes idle and transitions to grinding through the E64 HTTP contract', async ({request}) => {
  expect(await (await request.get(`${baseUrl}/diagnostics?deviceId=${encodeURIComponent(registration.device.deviceId)}`)).json()).toMatchObject({state: {state: 'idle'}});
  await request.post(`${baseUrl}/control`, {data: {state: 'grinding'}});
  await expect.poll(() => request.get(`${baseUrl}/diagnostics?deviceId=${encodeURIComponent(registration.device.deviceId)}`).then(response => response.json())).toMatchObject({state: {state: 'grinding'}});
});

test('serves live diagnostics and rejects unsupported controls through HTTP', async ({request}) => {
  const info = await request.get(`${baseUrl}/diagnostics?deviceId=${encodeURIComponent(registration.device.deviceId)}&read=machineInfo`);
  expect(info.status()).toBe(200);
  expect(info.headers()['x-e64-observation-state']).toBe('live');
  expect(await info.json()).toMatchObject({model: 'E64S'});
  const rejected = await request.get(`${baseUrl}/diagnostics?deviceId=${encodeURIComponent(registration.device.deviceId)}&read=startMotor`);
  expect(rejected.status()).toBe(400);
});
