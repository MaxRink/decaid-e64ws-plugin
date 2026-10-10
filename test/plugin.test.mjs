import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../mahlkoenig-e64.reaplugin/plugin.js', import.meta.url), 'utf8');
function load(settings, fixture) {
  const registrations = [];
  const host = {devices: {register(definition, handlers) { registrations.push({definition, handlers}); return Promise.resolve({deviceId: `plugin:mahlkoenig-e64.reaplugin:e64:${definition.instanceId}`}); }}};
  const sandbox = {setTimeout, clearTimeout, Promise, Map, Set, JSON, Object, Number, Array, Error, encodeURIComponent};
  vm.runInNewContext(`globalThis.createPlugin = (${source}\n);`, sandbox);
  const plugin = sandbox.createPlugin(host);
  return plugin.onLoad(settings).then(() => ({plugin, registrations}));
}
function transport(fixture) {
  return {
    open: async ({url}) => { fixture.url = url; fixture.events = []; return {handle: 1}; },
    onEvent: (_handle, callback) => { fixture.events.push(callback); },
    send: async (_handle, payload) => { fixture.sent.push(JSON.parse(payload.data)); },
    close: async () => {}
  };
}
function answer(fixture, index, data) {
  const request = fixture.sent[index];
  fixture.events[0]({type: 'data', dataType: 'text', data: JSON.stringify({type: request.type + 'Result', refId: request.msgId, data})});
}

test('registers a read-only Grinder and correlates state', async () => {
  const fixture = {sent: [], events: []};
  const loaded = await load({InstancesJson: JSON.stringify([{id: 'one', name: 'E64', host: '127.0.0.1', port: 9997, pollMs: 0}]), TokensJson: JSON.stringify({one: 'secret'})}, fixture);
  assert.equal(loaded.registrations[0].definition.driverId, 'e64');
  const context = {transport: transport(fixture), publish: async (state) => { fixture.published = state; }, reportDisconnected: async () => {}};
  const connected = loaded.registrations[0].handlers.connect(context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(fixture.url, /^ws:\/\/127\.0\.0\.1:9997/);
  answer(fixture, 0, {state: 'running', rpm: 1200});
  await connected;
  assert.equal(JSON.stringify(fixture.published), JSON.stringify({state: 'grinding'}));
  assert.equal(loaded.registrations[0].handlers.start, undefined);
  assert.equal(loaded.registrations[0].handlers.setRpm, undefined);
});

test('diagnostics uses the host deviceId and validates read response shapes', async () => {
  const fixture = {sent: [], events: []};
  const loaded = await load({InstancesJson: JSON.stringify([{id: 'one', name: 'E64', host: '127.0.0.1', port: 9997, pollMs: 0}]), TokensJson: JSON.stringify({one: 'secret'})}, fixture);
  const context = {transport: transport(fixture), publish: async () => {}, reportDisconnected: async () => {}};
  const connected = loaded.registrations[0].handlers.connect(context);
  await new Promise((resolve) => setImmediate(resolve));
  answer(fixture, 0, {state: 'idle'});
  await connected;
  const read = loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:one', read: 'machineInfo'}});
  await new Promise((resolve) => setImmediate(resolve));
  answer(fixture, 1, {model: 'E64'});
  assert.equal((await read).status, 200);
  const invalid = loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:one', read: 'logs'}});
  await new Promise((resolve) => setImmediate(resolve));
  const wrong = fixture.sent[2];
  fixture.events[0]({type: 'data', dataType: 'text', data: JSON.stringify({type: 'RequestLogMessagesResult', refId: wrong.msgId, data: []})});
  assert.equal((await invalid).status, 503);
  assert.equal((await loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {deviceId: 'one'}})).status, 404);
});

test('rejects unknown token ids before registration', async () => {
  await assert.rejects(async () => load({InstancesJson: JSON.stringify([{id: 'one', name: 'E64', host: '127.0.0.1', port: 1}]), TokensJson: JSON.stringify({one: 'x', two: 'y'})}, {sent: [], events: []}));
});

test('omitted and empty settings use the empty configuration defaults', async () => {
  const omitted = await load(undefined, {sent: [], events: []});
  const empty = await load({}, {sent: [], events: []});
  assert.equal(omitted.registrations.length, 0);
  assert.equal(empty.registrations.length, 0);
});

test('keeps instances isolated and ignores stale responses', async () => {
  const fixture = {sent: [], events: []};
  const loaded = await load({InstancesJson: JSON.stringify([{id: 'one', name: 'One', host: '127.0.0.1', port: 1, pollMs: 0}, {id: 'two', name: 'Two', host: '127.0.0.1', port: 2, pollMs: 0}]), TokensJson: JSON.stringify({one: 'a', two: 'b'})}, fixture);
  assert.equal(loaded.registrations.length, 2);
  assert.notEqual(loaded.registrations[0].handlers, loaded.registrations[1].handlers);
});

test('correlates concurrent responses independently across two sessions', async () => {
  const first = {sent: [], events: []}, second = {sent: [], events: []};
  const loaded = await load({InstancesJson: JSON.stringify([{id: 'one', name: 'One', host: '127.0.0.1', port: 1, pollMs: 0}, {id: 'two', name: 'Two', host: '127.0.0.1', port: 2, pollMs: 0}]), TokensJson: JSON.stringify({one: 'a', two: 'b'})}, first);
  const contexts = [first, second].map((fixture) => ({transport: transport(fixture), publish: async (state) => { fixture.published = state; }, reportDisconnected: async () => {}}));
  const connections = loaded.registrations.map((registration, index) => registration.handlers.connect(contexts[index]));
  await new Promise((resolve) => setImmediate(resolve));
  // The second session is deliberately answered first; each has its own refId map.
  const secondRequest = second.sent[0];
  second.events[0]({type: 'data', dataType: 'text', data: JSON.stringify({type: 'RequestDriverStateResult', refId: secondRequest.msgId, data: {state: 'running'}})});
  const firstRequest = first.sent[0];
  first.events[0]({type: 'data', dataType: 'text', data: JSON.stringify({type: 'RequestDriverStateResult', refId: firstRequest.msgId, data: {state: 'idle'}})});
  await Promise.all(connections);
  assert.equal(JSON.stringify(first.published), JSON.stringify({state: 'idle'}));
  assert.equal(JSON.stringify(second.published), JSON.stringify({state: 'grinding'}));
});

test('old socket events cannot publish into a replacement session', async () => {
  const fixture = {sent: [], events: []};
  const loaded = await load({InstancesJson: JSON.stringify([{id: 'one', name: 'One', host: '127.0.0.1', port: 1, pollMs: 0}]), TokensJson: JSON.stringify({one: 'a'})}, fixture);
  const published = [];
  const context = {transport: transport(fixture), publish: async (state) => published.push(state), reportDisconnected: async () => {}};
  const first = loaded.registrations[0].handlers.connect(context);
  first.catch(() => {});
  await new Promise((resolve) => setImmediate(resolve));
  const oldEvent = fixture.events[0];
  await loaded.registrations[0].handlers.disconnect({});
  const second = loaded.registrations[0].handlers.connect(context);
  await new Promise((resolve) => setImmediate(resolve));
  oldEvent({type: 'data', dataType: 'text', data: JSON.stringify({type: 'RequestDriverStateResult', refId: 1, data: {state: 'running'}})});
  const current = fixture.sent[fixture.sent.length - 1];
  fixture.events[fixture.events.length - 1]({type: 'data', dataType: 'text', data: JSON.stringify({type: current.type + 'Result', refId: current.msgId, data: {state: 'idle'}})});
  await second;
  await assert.rejects(first);
  assert.equal(published.length, 1);
  assert.equal(JSON.stringify(published[0]), JSON.stringify({state: 'idle'}));
});

test('malformed ready notification reports disconnection and clears observations', async () => {
  const fixture = {sent: [], events: []};
  const loaded = await load({InstancesJson: JSON.stringify([{id: 'one', name: 'One', host: '127.0.0.1', port: 1, pollMs: 0}]), TokensJson: JSON.stringify({one: 'a'})}, fixture);
  let disconnected = 0;
  const context = {transport: transport(fixture), publish: async () => {}, reportDisconnected: async () => { disconnected++; }};
  const connect = loaded.registrations[0].handlers.connect(context);
  await new Promise((resolve) => setImmediate(resolve));
  answer(fixture, 0, {state: 'idle'});
  await connect;
  fixture.events[0]({type: 'data', dataType: 'text', data: JSON.stringify({type: 'RequestDriverConfigResult', refId: 99, data: {setting: 'old'}})});
  await loaded.registrations[0].handlers.disconnect({});
  const reconnect = loaded.registrations[0].handlers.connect(context);
  await new Promise((resolve) => setImmediate(resolve));
  answer(fixture, 1, {state: 'idle'});
  await reconnect;
  const diagnostics = await loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:one'}});
  assert.deepEqual(Object.keys(JSON.parse(diagnostics.body)), ['state']);
  const malformed = fixture.events[fixture.events.length - 1]({type: 'data', dataType: 'text', data: '{'});
  await malformed;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(disconnected, 1);
});

test('late open handles are closed after disconnect wins the race', async () => {
  const fixture = {sent: [], events: [], closes: 0};
  let resolveOpen;
  const delayed = {
    open: () => new Promise((resolve) => { resolveOpen = resolve; }),
    onEvent: () => {}, send: async () => {}, close: async () => { fixture.closes++; }
  };
  const loaded = await load({InstancesJson: JSON.stringify([{id: 'one', name: 'One', host: '127.0.0.1', port: 1, pollMs: 0}]), TokensJson: JSON.stringify({one: 'a'})}, fixture);
  const context = {transport: delayed, publish: async () => {}, reportDisconnected: async () => {}};
  const connecting = loaded.registrations[0].handlers.connect(context);
  await new Promise((resolve) => setImmediate(resolve));
  await loaded.registrations[0].handlers.disconnect({});
  resolveOpen({handle: 7});
  await connecting;
  assert.equal(fixture.closes, 1);
});
