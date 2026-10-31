// Optional real-VM integration: load the shipped plugin.js in a VM context and
// connect it to a plain-WebSocket bridge that fronts the E64 VM's TLS WSS.
//   E64_VM_TOKEN=... node test/vm-integration.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../plugin.js', import.meta.url), 'utf8');
const token = process.env.E64_VM_TOKEN;
if (!token) throw new Error('E64_VM_TOKEN is required');
const port = Number(process.env.E64_VM_PORT || 19997);

const sandbox = {setTimeout, clearTimeout, Promise, Map, Set, JSON, Object, Number, Array, Error, encodeURIComponent};
vm.runInNewContext(`globalThis.createPlugin = (${source}\n);`, sandbox);
const registrations = [];
const host = {devices: {register(definition, handlers) {registrations.push({definition, handlers}); return Promise.resolve({deviceId: `plugin:mahlkoenig-e64.reaplugin:e64:${definition.instanceId}`});}}};
const plugin = sandbox.createPlugin(host);
await plugin.onLoad({
  InstancesJson: JSON.stringify([{id: 'vm', name: 'QEMU E64', host: '127.0.0.1', port, scheme: 'ws', pollMs: 0}]),
  TokensJson: JSON.stringify({vm: token})
});

let published;
let disconnected = false;
const wsTransport = {
  async open({url}) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {ws.onopen = resolve; ws.onerror = () => reject(new Error('websocket open failed'));});
    return {handle: ws, url};
  },
  onEvent(handle, callback) {
    handle.onmessage = (event) => callback({type: 'data', dataType: 'text', data: String(event.data)});
    handle.onclose = () => callback({type: 'close'});
    handle.onerror = () => callback({type: 'error'});
  },
  async send(handle, payload) { handle.send(payload.data); },
  async close(handle) { try { handle.close(); } catch {} }
};
const context = {transport: wsTransport, publish: async value => {published = value;}, reportDisconnected: async () => {disconnected = true;}};
await registrations[0].handlers.connect(context);
for (let i = 0; i < 50 && !published; i++) await new Promise(r => setTimeout(r, 100));
assert.ok(published, 'no published state');
console.log('published', JSON.stringify(published));
assert.ok(['idle', 'grinding', 'error', 'unknown'].includes(published.state));
const deviceId = registrations[0].definition.instanceId;
const diag = await plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {deviceId: `plugin:mahlkoenig-e64.reaplugin:e64:${deviceId}`, read: 'machineInfo'}});
console.log('machineInfo', diag.status, diag.body.slice(0, 240));
assert.equal(diag.status, 200);
const config = await plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {deviceId: `plugin:mahlkoenig-e64.reaplugin:e64:${deviceId}`, read: 'config'}});
console.log('config', config.status, config.body.slice(0, 120));
assert.equal(config.status, 200);
await plugin.onUnload();
console.log('ok disconnected=' + disconnected);
