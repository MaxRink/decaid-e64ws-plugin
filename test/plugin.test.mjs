import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {decaidApi, hostFetch} from './support/sim-host.mjs';

const source = fs.readFileSync(new URL('../plugin.js', import.meta.url), 'utf8');
function load(settings, fixture, timers = {}, fetchImpl = null) {
  const registrations = [];
  const host = {devices: {register(definition, handlers) { registrations.push({definition, handlers}); return Promise.resolve({deviceId: `plugin:mahlkoenig-e64.reaplugin:e64:${definition.instanceId}`}); }}};
  const sandbox = {setTimeout, clearTimeout, Promise, Map, Set, JSON, Object, Number, Array, Error, encodeURIComponent, btoa: globalThis.btoa, ...(fetchImpl ? {fetch: fetchImpl} : {}), ...timers};
  vm.runInNewContext(`globalThis.createPlugin = (${source}\n);`, sandbox);
  const plugin = sandbox.createPlugin(host);
  // Inventory sync has its own tests; elsewhere it would add a RequestNachineInfo to every connect.
  const effective = settings && !('PopulateGrinderRecord' in settings) ? {...settings, PopulateGrinderRecord: 'false'} : settings;
  // Invalid configuration no longer throws; it loads in "needs setup". Surface it as an
  // error here so the validation tests keep asserting the exact message.
  return plugin.onLoad(effective).then(() => {
    const status = JSON.parse(plugin.handleHttpRequest({endpoint: 'setup', method: 'GET', query: {status: '1'}}).body);
    if (status.needsSetup && settings && settings.InstancesJson && settings.InstancesJson !== '[]') throw new Error('E64 configuration error: ' + status.message);
    return {plugin, registrations};
  });
}

test('publishes only sensor-valid raw setting observations from native state responses', async () => {
  for (const [data, expected] of [
    [{grindState: 'Grinding', ddValueDum: 501, ddSensorFailed: false, fan1TachoRpm: 900}, {state: 'grinding', observedSetting: '50'}],
    [{grindState: 'Idle', ddValueDum: 0, ddSensorFailed: false}, {state: 'idle', observedSetting: '0'}],
    ...[[4, '0'], [5, '1'], [824, '82'], [825, '83'], [827, '83'], [829, '83'], [835, '84']].map(([dd, shown]) => [{grindState: 'Idle', ddValueDum: dd, ddSensorFailed: false}, {state: 'idle', observedSetting: shown}]),
    [{grindState: 'unrecognized', state: 'idle', ddValueDum: 500}, {state: 'unknown'}],
    [{grindState: 'Grinding', grindFailure: true, ddValueDum: 500, ddSensorFailed: true}, {state: 'error'}],
    ...[null, '500', -1, 1.5, Number.MAX_SAFE_INTEGER + 1].map(value => [{grindState: 'Idle', ddValueDum: value, ddSensorFailed: false}, {state: 'idle'}]),
  ]) {
    const fixture = {sent: [], events: []};
    const loaded = await load({InstancesJson: JSON.stringify([{id: 'one', name: 'E64', host: '127.0.0.1', port: 9997, pollMs: 0}]), TokensJson: '{"one":{"host":"127.0.0.1","token":"synthetic"}}'}, fixture);
    try {
      const connected = loaded.registrations[0].handlers.connect({transport: transport(fixture), publish: async value => {fixture.published = value;}, reportDisconnected: async () => {}});
      await new Promise(resolve => setImmediate(resolve));
      assert.deepEqual(fixture.sent[0], {type: 'RequestDriverState', msgId: 1, data: {}});
      answer(fixture, 0, data);
      await connected;
      assert.deepEqual(JSON.parse(JSON.stringify(fixture.published)), expected);
    } finally { await loaded.plugin.onUnload(); }
  }
});

test('polls replace observations and expiry cannot revive a retired session', async () => {
  const pending = new Map(); let nextTimer = 0;
  const timers = {setTimeout: (callback, delay) => {const id = ++nextTimer; pending.set(id, {callback, delay}); return id;}, clearTimeout: id => pending.delete(id)};
  const fixture = {sent: [], events: []}, published = [];
  const loaded = await load({InstancesJson: JSON.stringify([{id: 'one', name: 'E64', host: '127.0.0.1', port: 9997, pollMs: 100}]), TokensJson: '{"one":{"host":"127.0.0.1","token":"synthetic"}}'}, fixture, timers);
  const context = {transport: transport(fixture), publish: async value => {published.push(JSON.parse(JSON.stringify(value)));}, reportDisconnected: async () => {}};
  const connected = loaded.registrations[0].handlers.connect(context);
  await new Promise(resolve => setImmediate(resolve));
  answer(fixture, 0, {grindState: 'Idle', ddValueDum: 501, ddSensorFailed: false});
  await connected;
  const retiredExpiry = [...pending.values()].find(timer => timer.delay === 5000).callback;
  const poll = [...pending.entries()].find(([, timer]) => timer.delay === 100);
  pending.delete(poll[0]); poll[1].callback();
  answer(fixture, 1, {grindState: 'Grinding', ddSensorFailed: true});
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(published.at(-1), {state: 'grinding'});
  retiredExpiry();
  assert.deepEqual(published.at(-1), {state: 'grinding'});
  await loaded.plugin.onUnload();
  retiredExpiry();
  assert.equal(published.length, 2);
  assert.equal(pending.size, 0);
});

test('one-shot readings expire even when polling is disabled', async () => {
  const pending = new Map(); let nextTimer = 0;
  const timers = {setTimeout: (callback, delay) => {const id = ++nextTimer; pending.set(id, {callback, delay}); return id;}, clearTimeout: id => pending.delete(id)};
  const fixture = {sent: [], events: []}, published = [];
  const loaded = await load({InstancesJson: JSON.stringify([{id: 'one', name: 'E64', host: '127.0.0.1', port: 9997, pollMs: 0}]), TokensJson: '{"one":{"host":"127.0.0.1","token":"synthetic"}}'}, fixture, timers);
  const connected = loaded.registrations[0].handlers.connect({transport: transport(fixture), publish: async value => published.push(JSON.parse(JSON.stringify(value))), reportDisconnected: async () => {}});
  await new Promise(resolve => setImmediate(resolve));
  answer(fixture, 0, {grindState: 'Idle', ddValueDum: 501, ddSensorFailed: false});
  await connected;
  [...pending.values()].find(timer => timer.delay === 5000).callback();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(published, [{state: 'idle', observedSetting: '50'}, {state: 'idle'}]);
  await loaded.plugin.onUnload();
});
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
  const loaded = await load({InstancesJson: JSON.stringify([{id: 'one', name: 'E64', host: '127.0.0.1', port: 9997, pollMs: 0}]), TokensJson: JSON.stringify({one: {host: '127.0.0.1', token: 'secret'}})}, fixture);
  assert.equal(loaded.registrations[0].definition.driverId, 'e64');
  const context = {transport: transport(fixture), publish: async (state) => { fixture.published = state; }, reportDisconnected: async () => {}};
  const connected = loaded.registrations[0].handlers.connect(context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(fixture.url, /^wss:\/\/127\.0\.0\.1:9997/, 'scheme defaults to wss');
  answer(fixture, 0, {state: 'running', rpm: 1200});
  await connected;
  assert.equal(JSON.stringify(fixture.published), JSON.stringify({state: 'grinding'}));
  assert.equal(loaded.registrations[0].handlers.start, undefined);
  assert.equal(loaded.registrations[0].handlers.setRpm, undefined);
});

test('diagnostics uses the host deviceId and validates read response shapes', async () => {
  const fixture = {sent: [], events: []};
  const loaded = await load({InstancesJson: JSON.stringify([{id: 'one', name: 'E64', host: '127.0.0.1', port: 9997, pollMs: 0}]), TokensJson: JSON.stringify({one: {host: '127.0.0.1', token: 'secret'}})}, fixture);
  const context = {transport: transport(fixture), publish: async () => {}, reportDisconnected: async () => {}};
  const connected = loaded.registrations[0].handlers.connect(context);
  await new Promise((resolve) => setImmediate(resolve));
  answer(fixture, 0, {state: 'idle'});
  await connected;
  const read = loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:one', read: 'machineInfo'}});
  await new Promise((resolve) => setImmediate(resolve));
  answer(fixture, 1, {model: 'E64'});
  assert.equal((await read).status, 200);
  assert.equal((await read).headers['X-E64-Observation-State'], 'live');
  const receivedAt = (await read).headers['X-E64-Observation-Time'];
  const invalid = loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:one', read: 'config'}});
  await new Promise((resolve) => setImmediate(resolve));
  const wrong = fixture.sent[2];
  fixture.events[0]({type: 'data', dataType: 'text', data: JSON.stringify({type: 'RequestDriverConfigResult', refId: wrong.msgId, data: []})});
  assert.equal((await invalid).status, 503);
  assert.equal((await invalid).headers['X-E64-Observation-Time'], receivedAt);
  assert.equal((await loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {deviceId: 'one'}})).status, 404);
  assert.equal((await loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:one', read: 'startMotor'}})).status, 400);
  assert.equal((await loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'POST', query: {deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:one'}})).status, 405);
  assert.equal(fixture.sent.length, 3, 'rejected diagnostics must not send device commands');
});

test('rejects unknown token ids before registration', async () => {
  await assert.rejects(async () => load({InstancesJson: JSON.stringify([{id: 'one', name: 'E64', host: '127.0.0.1', port: 1}]), TokensJson: JSON.stringify({one: {host: '127.0.0.1', token: 'x'}, two: {host: '127.0.0.1', token: 'y'}})}, {sent: [], events: []}));
});

test('omitted and empty settings use the empty configuration defaults', async () => {
  const omitted = await load(undefined, {sent: [], events: []});
  const empty = await load({}, {sent: [], events: []});
  assert.equal(omitted.registrations.length, 0);
  assert.equal(empty.registrations.length, 0);
});

test('keeps instances isolated and ignores stale responses', async () => {
  const fixture = {sent: [], events: []};
  const loaded = await load({InstancesJson: JSON.stringify([{id: 'one', name: 'One', host: '127.0.0.1', port: 1, pollMs: 0}, {id: 'two', name: 'Two', host: '127.0.0.1', port: 2, pollMs: 0}]), TokensJson: JSON.stringify({one: {host: '127.0.0.1', token: 'a'}, two: {host: '127.0.0.1', token: 'b'}})}, fixture);
  assert.equal(loaded.registrations.length, 2);
  assert.notEqual(loaded.registrations[0].handlers, loaded.registrations[1].handlers);
});

test('correlates concurrent responses independently across two sessions', async () => {
  const first = {sent: [], events: []}, second = {sent: [], events: []};
  const loaded = await load({InstancesJson: JSON.stringify([{id: 'one', name: 'One', host: '127.0.0.1', port: 1, pollMs: 0}, {id: 'two', name: 'Two', host: '127.0.0.1', port: 2, pollMs: 0}]), TokensJson: JSON.stringify({one: {host: '127.0.0.1', token: 'a'}, two: {host: '127.0.0.1', token: 'b'}})}, first);
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
  const loaded = await load({InstancesJson: JSON.stringify([{id: 'one', name: 'One', host: '127.0.0.1', port: 1, pollMs: 0}]), TokensJson: JSON.stringify({one: {host: '127.0.0.1', token: 'a'}})}, fixture);
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
  const loaded = await load({InstancesJson: JSON.stringify([{id: 'one', name: 'One', host: '127.0.0.1', port: 1, pollMs: 0}]), TokensJson: JSON.stringify({one: {host: '127.0.0.1', token: 'a'}})}, fixture);
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
  assert.equal(diagnostics.headers['X-E64-Observation-State'], 'last-known');
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
  const loaded = await load({InstancesJson: JSON.stringify([{id: 'one', name: 'One', host: '127.0.0.1', port: 1, pollMs: 0}]), TokensJson: JSON.stringify({one: {host: '127.0.0.1', token: 'a'}})}, fixture);
  const context = {transport: delayed, publish: async () => {}, reportDisconnected: async () => {}};
  const connecting = loaded.registrations[0].handlers.connect(context);
  await new Promise((resolve) => setImmediate(resolve));
  await loaded.registrations[0].handlers.disconnect({});
  resolveOpen({handle: 7});
  await connecting;
  assert.equal(fixture.closes, 1);
});

test('replays the live 2026-11-18 state and config capture', async () => {
  const fixture = {sent: [], events: []};
  const state = JSON.parse(fs.readFileSync(new URL('./fixtures/live-driver-state.json', import.meta.url), 'utf8'));
  const config = JSON.parse(fs.readFileSync(new URL('./fixtures/live-driver-config.json', import.meta.url), 'utf8'));
  const machineInfo = JSON.parse(fs.readFileSync(new URL('./fixtures/live-machine-info.json', import.meta.url), 'utf8'));
  const loaded = await load({InstancesJson: JSON.stringify([{id: 'live', name: 'Live E64', host: '127.0.0.1', port: 9997, pollMs: 0}]), TokensJson: JSON.stringify({live: {host: '127.0.0.1', token: 'synthetic'}})}, fixture);
  const context = {transport: transport(fixture), publish: async (value) => { fixture.published = value; }, reportDisconnected: async () => {}};
  const connected = loaded.registrations[0].handlers.connect(context);
  await new Promise((resolve) => setImmediate(resolve));
  answer(fixture, 0, state);
  await connected;
  assert.deepEqual(JSON.parse(JSON.stringify(fixture.published)), {state: 'idle', observedSetting: '85'});
  const deviceId = 'plugin:mahlkoenig-e64.reaplugin:e64:live';
  const info = loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {deviceId, read: 'machineInfo'}});
  await new Promise((resolve) => setImmediate(resolve));
  answer(fixture, 1, machineInfo);
  assert.equal((await info).status, 200);
  assert.deepEqual(JSON.parse((await info).body), {grinderType: 'E64 WS'});
  const cfg = loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {deviceId, read: 'config'}});
  await new Promise((resolve) => setImmediate(resolve));
  answer(fixture, 2, config);
  assert.equal((await cfg).status, 200);
  const cfgBody = JSON.parse((await cfg).body);
  assert.equal(cfgBody.configVersion, 27);
  for (const secret of ['grinderSn', 'productionWifiPassword', 'productionWifiSsid', 'cloudBaseUrl', 'mobileAppPairingUrl']) assert.equal(Object.hasOwn(cfgBody, secret), false, secret);
  const known = JSON.parse((await loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {deviceId}})).body);
  assert.equal(known.state.ddValueDum, 854);
  assert.equal(Object.hasOwn(known.state, 'sessionId'), false);
  assert.equal(Object.hasOwn(known.machineInfo, 'sessionId'), false);
  assert.equal((await loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {deviceId, read: 'logs'}})).status, 400);
  await loaded.plugin.onUnload();
});


test('mints a token from a configured Owner password', async () => {
  let request;
  const fetchImpl = async (url, init) => {
    request = {url, init};
    return {ok: true, status: 200, headers: {get: () => 'Bearer minted-token'}, text: async () => ''};
  };
  const fixture = {sent: [], events: []};
  const loaded = await load({
    InstancesJson: JSON.stringify([{id: 'one', name: 'One', host: '127.0.0.1', port: 9997, pollMs: 0}]),
    TokensJson: '{}', MintTokens: 'true', PasswordsJson: JSON.stringify({one: {host: '127.0.0.1', password: 'pw'}})
  }, fixture, {}, fetchImpl);
  const connected = loaded.registrations[0].handlers.connect({transport: transport(fixture), publish: async value => {fixture.published = value;}, reportDisconnected: async () => {}});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(request.url, 'https://127.0.0.1/rest_api/login');
  assert.equal(JSON.parse(request.init.body).userRole, 'Owner');
  assert.equal(JSON.parse(request.init.body).password, 'pw');
  assert.match(fixture.url, /token=minted-token$/);
  answer(fixture, 0, {grindState: 'Idle', ddValueDum: 854, ddSensorFailed: false});
  await connected;
  assert.deepEqual(JSON.parse(JSON.stringify(fixture.published)), {state: 'idle', observedSetting: '85'});
  await loaded.plugin.onUnload();
});

test('mints through the gated no-password workaround', async () => {
  let body;
  const fetchImpl = async (_url, init) => {
    body = JSON.parse(init.body);
    return {ok: true, status: 200, headers: {get: () => 'Bearer workaround-token'}, text: async () => ''};
  };
  const fixture = {sent: [], events: []};
  const loaded = await load({
    InstancesJson: JSON.stringify([{id: 'one', name: 'One', host: '127.0.0.1', port: 9997, pollMs: 0}]),
    TokensJson: '{}', MintTokens: 'true', AllowNoPasswordWorkaround: 'true'
  }, fixture, {}, fetchImpl);
  const connected = loaded.registrations[0].handlers.connect({transport: transport(fixture), publish: async () => {}, reportDisconnected: async () => {}});
  await new Promise(resolve => setImmediate(resolve));
  assert.match(body.userRole, /^x" UNION SELECT "1\$1000\$/);
  assert.ok(body.password.length >= 32);
  assert.match(fixture.url, /token=workaround-token$/);
  answer(fixture, 0, {grindState: 'Idle', ddValueDum: 854, ddSensorFailed: false});
  await connected;
  await loaded.plugin.onUnload();
});

test('static tokens do not call fetch', async () => {
  let calls = 0;
  const fixture = {sent: [], events: []};
  const loaded = await load({
    InstancesJson: JSON.stringify([{id: 'one', name: 'One', host: '127.0.0.1', port: 9997, pollMs: 0}]),
    TokensJson: JSON.stringify({one: {host: '127.0.0.1', token: 'static-token'}})
  }, fixture, {}, async () => { calls++; throw new Error('must not fetch'); });
  const connected = loaded.registrations[0].handlers.connect({transport: transport(fixture), publish: async () => {}, reportDisconnected: async () => {}});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 0);
  assert.match(fixture.url, /token=static-token$/);
  answer(fixture, 0, {grindState: 'Idle'});
  await connected;
  await loaded.plugin.onUnload();
});

test('minting needs a password or the workaround', async () => {
  await assert.rejects(async () => load({
    InstancesJson: JSON.stringify([{id: 'one', name: 'One', host: '127.0.0.1', port: 9997, pollMs: 0}]),
    TokensJson: '{}', MintTokens: 'true'
  }, {sent: [], events: []}, {}, async () => { throw new Error('must not fetch'); }));
});

test('re-mints a fresh token after a disconnect', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return {ok: true, status: 200, headers: {get: () => `Bearer token-${calls}`}, text: async () => ''};
  };
  const fixture = {sent: [], events: []};
  const loaded = await load({
    InstancesJson: JSON.stringify([{id: 'one', name: 'One', host: '127.0.0.1', port: 9997, pollMs: 0}]),
    TokensJson: '{}', MintTokens: 'true', PasswordsJson: JSON.stringify({one: {host: '127.0.0.1', password: 'pw'}})
  }, fixture, {}, fetchImpl);
  const context = {transport: transport(fixture), publish: async () => {}, reportDisconnected: async () => {}};
  const first = loaded.registrations[0].handlers.connect(context);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(fixture.url, /token=token-1$/);
  answer(fixture, 0, {grindState: 'Idle'});
  await first;
  fixture.events[0]({type: 'close'});
  await new Promise(resolve => setImmediate(resolve));
  const second = loaded.registrations[0].handlers.connect(context);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(fixture.url, /token=token-2$/);
  answer(fixture, 1, {grindState: 'Idle'});
  await second;
  assert.equal(calls, 2);
  await loaded.plugin.onUnload();
});

test('connection diagnostics report the token source without secrets', async () => {
  const fetchImpl = async () => ({ok: true, status: 200, headers: {get: () => 'Bearer secret-token'}, text: async () => ''});
  const fixture = {sent: [], events: []};
  const loaded = await load({
    InstancesJson: JSON.stringify([{id: 'one', name: 'One', host: '127.0.0.1', port: 9997, pollMs: 0}]),
    TokensJson: '{}', MintTokens: 'true', PasswordsJson: JSON.stringify({one: {host: '127.0.0.1', password: 'pw'}})
  }, fixture, {}, fetchImpl);
  const connected = loaded.registrations[0].handlers.connect({transport: transport(fixture), publish: async () => {}, reportDisconnected: async () => {}});
  await new Promise(resolve => setImmediate(resolve));
  answer(fixture, 0, {grindState: 'Idle'});
  await connected;
  const response = await loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:one', read: 'connection'}});
  assert.equal(response.status, 200);
  assert.equal(response.body.includes('secret-token'), false);
  assert.equal(response.body.includes('pw'), false);
  const body = JSON.parse(response.body);
  assert.equal(body.tokenSource, 'password');
  assert.equal(body.lastMintError, null);
  assert.equal(typeof body.lastMintAt, 'string');
  assert.equal(body.staticToken, false);
  await loaded.plugin.onUnload();
});

test('mint failure is reported without the password', async () => {
  const fetchImpl = async () => ({ok: false, status: 400, headers: {get: () => null}, text: async () => '{"console":"Wrong password!"}'});
  const fixture = {sent: [], events: []};
  const loaded = await load({
    InstancesJson: JSON.stringify([{id: 'one', name: 'One', host: '127.0.0.1', port: 9997, pollMs: 0}]),
    TokensJson: '{}', MintTokens: 'true', PasswordsJson: JSON.stringify({one: {host: '127.0.0.1', password: 'super-secret-password'}})
  }, fixture, {}, fetchImpl);
  await assert.rejects(async () => loaded.registrations[0].handlers.connect({transport: transport(fixture), publish: async () => {}, reportDisconnected: async () => {}}), (error) => {
    assert.match(error.message, /login HTTP 400/);
    assert.equal(error.message.includes('super-secret-password'), false);
    return true;
  });
  const response = await loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:one', read: 'connection'}});
  const body = JSON.parse(response.body);
  assert.equal(body.tokenSource, 'none');
  assert.equal(body.lastMintError, 'login HTTP 400', 'device response text is not echoed');
  assert.equal(response.body.includes('super-secret-password'), false);
  await loaded.plugin.onUnload();
});

test('xenia mode maps machine state and acks the E64 routes', async () => {
  const fixture = {sent: [], events: []};
  const loaded = await load({
    InstancesJson: JSON.stringify([{id: 'one', name: 'One', host: '127.0.0.1', port: 9997, pollMs: 0}]),
    TokensJson: JSON.stringify({one: {host: '127.0.0.1', token: 'synthetic'}})
  }, fixture);
  loaded.plugin.onEvent({name: 'stateUpdate', payload: {
    state: {state: 'espresso', substate: 'pouring'},
    flow: 2.5, groupTemperature: 93.2, targetGroupTemperature: 94.0
  }});
  const mako = await loaded.plugin.handleHttpRequest({endpoint: 'xenia-mako', method: 'GET', query: {}});
  assert.equal(mako.status, 200);
  const makoBody = JSON.parse(mako.body);
  assert.equal(makoBody.MA_STATUS, 3);
  assert.equal(makoBody.PU_SENS_FLOW_METER_FLOWRATE, 2.5);
  assert.equal(makoBody.BG_SET_TEMP, 94);
  assert.equal(makoBody.BG_SENS_TEMP, 93.2);
  assert.equal(makoBody.TANK_LEVEL, 1);
  assert.equal(typeof makoBody.REAL_EXTRACTION_TIME_MS, 'number');
  const machine = await loaded.plugin.handleHttpRequest({endpoint: 'xenia-machine', method: 'GET', query: {}});
  assert.equal(JSON.parse(machine.body).MA_TYPE, 'Xenia');
  const brew = await loaded.plugin.handleHttpRequest({endpoint: 'xenia-brewratio', method: 'POST', query: {}, body: {SYNC_BEVERAGE_WEIGHT: 18.4, SYNC_FILTER: 1}});
  assert.deepEqual(JSON.parse(brew.body), {MA_SYNC_BEVERAGE_WEIGHT: 18, MA_SYNC_FILTER: 1});
  const script = await loaded.plugin.handleHttpRequest({endpoint: 'xenia-scripts-execute', method: 'POST', query: {}, body: {ID: 9}});
  assert.equal(script.status, 200);
  assert.equal(JSON.parse(script.body).started, false);
  const diagnostics = await loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:one', read: 'xenia'}});
  assert.equal(diagnostics.status, 200);
  assert.equal(JSON.parse(diagnostics.body).mako.MA_STATUS, 3);
  loaded.plugin.onEvent({name: 'stateUpdate', payload: {state: {state: 'espresso', substate: 'pouringDone'}, flow: 0, groupTemperature: 93.1, targetGroupTemperature: 94}});
  const finishing = JSON.parse((await loaded.plugin.handleHttpRequest({endpoint: 'xenia-mako', method: 'GET', query: {}})).body);
  assert.equal(finishing.MA_STATUS, 4);
  loaded.plugin.onEvent({name: 'stateUpdate', payload: {state: {state: 'idle', substate: 'idle'}, flow: 0}});
  const idle = JSON.parse((await loaded.plugin.handleHttpRequest({endpoint: 'xenia-mako', method: 'GET', query: {}})).body);
  assert.equal(idle.MA_STATUS, 1);
  await loaded.plugin.onUnload();
});

test('connect failure detail redacts the token echoed by host WebSocket errors', async () => {
  const fixture = {sent: [], events: []};
  const loaded = await load({InstancesJson: JSON.stringify([{id: 'one', name: 'One', host: '127.0.0.1', port: 9997, pollMs: 0}]), TokensJson: JSON.stringify({one: {host: '127.0.0.1', token: 'secret-token'}})}, fixture);
  const failing = {...transport(fixture), open: async () => { throw new Error("WebSocketException: Connection to 'http://127.0.0.1:9997/?token=secret-token#' was not upgraded to websocket, HTTP status code: 401"); }};
  await assert.rejects(async () => loaded.registrations[0].handlers.connect({transport: failing, publish: async () => {}, reportDisconnected: async () => {}}), (error) => {
    assert.equal(error.message.includes('secret-token'), false);
    assert.match(error.message, /token=\[redacted\].*not upgraded/);
    return true;
  });
  await loaded.plugin.onUnload();
});

test('a full diagnostics queue cannot starve the state poll', async () => {
  const pending = new Map(); let nextTimer = 0, disconnected = 0;
  const timers = {setTimeout: (callback, delay) => {const id = ++nextTimer; pending.set(id, {callback, delay}); return id;}, clearTimeout: id => pending.delete(id)};
  const fixture = {sent: [], events: []};
  const loaded = await load({InstancesJson: JSON.stringify([{id: 'one', name: 'One', host: '127.0.0.1', port: 9997, pollMs: 100}]), TokensJson: '{"one":{"host":"127.0.0.1","token":"synthetic"}}'}, fixture, timers);
  const connected = loaded.registrations[0].handlers.connect({transport: transport(fixture), publish: async () => {}, reportDisconnected: async () => { disconnected++; }});
  await new Promise(resolve => setImmediate(resolve));
  answer(fixture, 0, {grindState: 'Idle'});
  await connected;
  const query = {deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:one', read: 'config'};
  for (let i = 0; i < 32; i++) loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query});
  assert.equal((await loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query})).status, 503);
  const poll = [...pending.entries()].find(([, timer]) => timer.delay === 100);
  pending.delete(poll[0]); poll[1].callback();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(disconnected, 0);
  assert.equal(fixture.sent.at(-1).type, 'RequestDriverState');
  await loaded.plugin.onUnload();
});

test('a token minted for a superseded connect is neither used nor kept', async () => {
  let calls = 0, release;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) await new Promise(resolve => { release = resolve; });
    return {ok: true, status: 200, headers: {get: () => `Bearer token-${calls}`}, text: async () => ''};
  };
  const fixture = {sent: [], events: []};
  const loaded = await load({
    InstancesJson: JSON.stringify([{id: 'one', name: 'One', host: '127.0.0.1', port: 9997, pollMs: 0}]),
    TokensJson: '{}', MintTokens: 'true', PasswordsJson: JSON.stringify({one: {host: '127.0.0.1', password: 'pw'}})
  }, fixture, {}, fetchImpl);
  const context = {transport: transport(fixture), publish: async () => {}, reportDisconnected: async () => {}};
  const stale = loaded.registrations[0].handlers.connect(context);
  await new Promise(resolve => setImmediate(resolve));
  await loaded.registrations[0].handlers.disconnect();
  release();
  await stale;
  assert.equal(fixture.url, undefined);
  const fresh = loaded.registrations[0].handlers.connect(context);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(fixture.url, /token=token-2$/);
  answer(fixture, 0, {grindState: 'Idle'});
  await fresh;
  await loaded.plugin.onUnload();
});

test('xenia brew ratio accepts numbers or numeric strings only', async () => {
  const loaded = await load({InstancesJson: JSON.stringify([{id: 'one', name: 'One', host: '127.0.0.1', port: 9997, pollMs: 0}]), TokensJson: '{"one":{"host":"127.0.0.1","token":"synthetic"}}'}, {sent: [], events: []});
  const post = body => loaded.plugin.handleHttpRequest({endpoint: 'xenia-brewratio', method: 'POST', query: {}, body});
  assert.deepEqual(JSON.parse(post({SYNC_BEVERAGE_WEIGHT: '36.4', SYNC_FILTER: '2'}).body), {MA_SYNC_BEVERAGE_WEIGHT: 36, MA_SYNC_FILTER: 2});
  for (const bad of [null, '', ' ', true, [5], {}]) {
    assert.equal(post({SYNC_BEVERAGE_WEIGHT: bad, SYNC_FILTER: 1}).status, 400);
    assert.equal(post({SYNC_BEVERAGE_WEIGHT: 18, SYNC_FILTER: bad}).status, 400);
  }
  await loaded.plugin.onUnload();
});

const one = (host, extra = {}) => JSON.stringify([{id: 'one', name: 'One', host, port: 9997, pollMs: 0, ...extra}]);

test('instance hosts are limited to loopback, private, link-local and .local addresses', async () => {
  for (const host of ['127.0.0.1', 'localhost', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.200.103', '169.254.1.1', '[::1]', '[fd12:3456::1]', '[fe80::1]', 'e64.local', 'E64.Local']) {
    const loaded = await load({InstancesJson: one(host), TokensJson: JSON.stringify({one: {host, token: 't'}})}, {sent: [], events: []});
    await loaded.plugin.onUnload();
  }
  for (const host of ['8.8.8.8', '172.32.0.1', '192.169.0.1', '010.0.0.1', '192.168.1.256', 'e64.example.com', 'e64', '2130706433', '[2001:db8::1]', '[fc::1]', '[::ffff:192.168.1.1]']) {
    await assert.rejects(async () => load({InstancesJson: one(host), TokensJson: JSON.stringify({one: {host, token: 't'}})}, {sent: [], events: []}), /instance host must be/, host);
  }
});

test('stored secrets are bound to the host they were saved for', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw new Error('must not fetch'); };
  const settings = (host, passwordHost) => ({InstancesJson: one(host), TokensJson: '{}', MintTokens: 'true', PasswordsJson: JSON.stringify({one: {host: passwordHost, password: 'pw'}})});
  await assert.rejects(async () => load(settings('192.168.1.66', '192.168.200.103'), {sent: [], events: []}, {}, fetchImpl), /saved for another host; re-enter it/);
  await assert.rejects(async () => load({InstancesJson: one('192.168.1.66'), TokensJson: JSON.stringify({one: {host: '192.168.200.103', token: 't'}})}, {sent: [], events: []}), /saved for another host/);
  await assert.rejects(async () => load({InstancesJson: one('127.0.0.1'), TokensJson: JSON.stringify({one: 'unbound'})}, {sent: [], events: []}), /must be an object with host and token/);
  await assert.rejects(async () => load({...settings('127.0.0.1', '127.0.0.1'), PasswordsJson: JSON.stringify({one: 'pw'})}, {sent: [], events: []}, {}, fetchImpl), /must be an object with host and password/);
  const loaded = await load(settings('E64.local', 'e64.local'), {sent: [], events: []}, {}, fetchImpl);
  await loaded.plugin.onUnload();
  assert.equal(calls, 0);
});

test('explicit ws instances keep working', async () => {
  const fixture = {sent: [], events: []};
  const loaded = await load({InstancesJson: one('127.0.0.1', {scheme: 'ws'}), TokensJson: JSON.stringify({one: {host: '127.0.0.1', token: 't'}})}, fixture);
  const connected = loaded.registrations[0].handlers.connect({transport: transport(fixture), publish: async () => {}, reportDisconnected: async () => {}});
  await new Promise(resolve => setImmediate(resolve));
  assert.match(fixture.url, /^ws:\/\/127\.0\.0\.1:9997\/\?token=t$/);
  answer(fixture, 0, {grindState: 'Idle'});
  await connected;
  await loaded.plugin.onUnload();
});

test('failed logins back off before the next attempt', async () => {
  let now = Date.parse('2026-11-23T12:00:00Z'), calls = 0;
  class FakeDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const fetchImpl = async () => { calls++; return {ok: false, status: 401, headers: {get: () => null}, text: async () => 'nope'}; };
  const fixture = {sent: [], events: []};
  const loaded = await load({InstancesJson: one('127.0.0.1'), TokensJson: '{}', MintTokens: 'true', PasswordsJson: JSON.stringify({one: {host: '127.0.0.1', password: 'pw'}})}, fixture, {Date: FakeDate}, fetchImpl);
  const connect = () => loaded.registrations[0].handlers.connect({transport: transport(fixture), publish: async () => {}, reportDisconnected: async () => {}});
  const connection = async () => JSON.parse((await loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:one', read: 'connection'}})).body);
  await assert.rejects(connect(), /login HTTP 401/);
  await assert.rejects(connect(), /login backoff/);
  assert.equal(calls, 1);
  assert.equal((await connection()).mintBackoffUntil, '2026-11-23T12:00:05.000Z');
  now += 5000;
  await assert.rejects(connect(), /login HTTP 401/);
  assert.equal(calls, 2);
  assert.equal((await connection()).mintBackoffUntil, '2026-11-23T12:00:15.000Z');
  assert.equal(fixture.url, undefined);
  await loaded.plugin.onUnload();
});

test('xenia sync state is kept per instance', async () => {
  const instances = JSON.stringify([{id: 'one', name: 'One', host: '127.0.0.1', port: 1, pollMs: 0}, {id: 'two', name: 'Two', host: '127.0.0.1', port: 2, pollMs: 0}]);
  const loaded = await load({InstancesJson: instances, TokensJson: JSON.stringify({one: {host: '127.0.0.1', token: 'a'}, two: {host: '127.0.0.1', token: 'b'}})}, {sent: [], events: []});
  const post = (query, body) => loaded.plugin.handleHttpRequest({endpoint: 'xenia-brewratio', method: 'POST', query, body});
  assert.equal(post({instance: 'one'}, {SYNC_BEVERAGE_WEIGHT: 18, SYNC_FILTER: 1}).status, 200);
  assert.equal(post({instance: 'two'}, {SYNC_BEVERAGE_WEIGHT: 40, SYNC_FILTER: 2}).status, 200);
  assert.equal(post({}, {SYNC_BEVERAGE_WEIGHT: 1, SYNC_FILTER: 1}).status, 400);
  assert.equal(post({instance: 'three'}, {SYNC_BEVERAGE_WEIGHT: 1, SYNC_FILTER: 1}).status, 404);
  const sync = async id => JSON.parse((await loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {deviceId: `plugin:mahlkoenig-e64.reaplugin:e64:${id}`, read: 'xenia'}})).body).sync;
  assert.deepEqual(await sync('one'), {SYNC_BEVERAGE_WEIGHT: 18, SYNC_FILTER: 1});
  assert.deepEqual(await sync('two'), {SYNC_BEVERAGE_WEIGHT: 40, SYNC_FILTER: 2});
  await loaded.plugin.onUnload();
});

test('unknown endpoints are 404 and the manifest holds only used permissions', async () => {
  const loaded = await load({}, {sent: [], events: []});
  assert.equal(loaded.plugin.handleHttpRequest({endpoint: 'nope', method: 'GET', query: {}}).status, 404);
  const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.permissions, ['api', 'network.websocket', 'events.machine', 'events.shots', 'notifications']);
  for (const key of ['MintTokens', 'AllowNoPasswordWorkaround']) assert.deepEqual([manifest.settings[key].type, manifest.settings[key].values, manifest.settings[key].default], ['enum', ['false', 'true'], 'false']);
  assert.equal(/host\.log/.test(source), false);
});

test('a failed device registration drops only that instance', async () => {
  const registered = [];
  const host = {devices: {register(definition) {
    if (definition.instanceId === 'two') return Promise.reject(new Error('registration refused'));
    registered.push(definition.instanceId);
    return Promise.resolve({deviceId: `plugin:mahlkoenig-e64.reaplugin:e64:${definition.instanceId}`});
  }}};
  const sandbox = {setTimeout, clearTimeout, Promise, Map, Set, JSON, Object, Number, Array, Error, encodeURIComponent};
  vm.runInNewContext(`globalThis.createPlugin = (${source}\n);`, sandbox);
  const plugin = sandbox.createPlugin(host);
  const instances = JSON.stringify([{id: 'one', name: 'One', host: '127.0.0.1', port: 1, pollMs: 0}, {id: 'two', name: 'Two', host: '127.0.0.1', port: 2, pollMs: 0}]);
  await plugin.onLoad({InstancesJson: instances, TokensJson: JSON.stringify({one: {host: '127.0.0.1', token: 'a'}, two: {host: '127.0.0.1', token: 'b'}})});
  assert.deepEqual(registered, ['one']);
  const read = id => plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {deviceId: `plugin:mahlkoenig-e64.reaplugin:e64:${id}`, read: 'connection'}});
  assert.equal((await read('one')).status, 200);
  assert.equal(plugin.handleHttpRequest({endpoint: 'xenia-brewratio', method: 'POST', query: {}, body: {SYNC_BEVERAGE_WEIGHT: 18, SYNC_FILTER: 1}}).status, 200, 'the single remaining instance is the default');
  await plugin.onUnload();
});

test('certSha256 pins the login fetch and the wss transport only when set', async () => {
  const pin = '91:B4:12:EE:01:4F:21:C3:BB:24:45:43:0B:6A:3D:77:90:33:34:A1:30:0A:D8:4F:19:80:AB:2C:5F:53:62:0B';
  const hex = pin.replace(/:/g, '').toLowerCase();
  for (const [extra, expected] of [[{certSha256: pin}, hex], [{}, undefined]]) {
    let init;
    const fetchImpl = async (_url, value) => { init = value; return {ok: true, status: 200, headers: {get: () => 'Bearer minted'}, text: async () => ''}; };
    const fixture = {sent: [], events: []};
    const loaded = await load({InstancesJson: one('192.168.200.103', extra), TokensJson: '{}', MintTokens: 'true', PasswordsJson: JSON.stringify({one: {host: '192.168.200.103', password: 'pw'}})}, fixture, {}, fetchImpl);
    let options;
    const pinned = {...transport(fixture), open: async (value) => { options = value; fixture.url = value.url; fixture.events = []; return {handle: 1}; }};
    const connected = loaded.registrations[0].handlers.connect({transport: pinned, publish: async () => {}, reportDisconnected: async () => {}});
    await new Promise(resolve => setImmediate(resolve));
    answer(fixture, 0, {grindState: 'Idle'});
    await connected;
    assert.equal(init.tlsPinSha256, expected);
    assert.equal(options.tlsPinSha256, expected);
    assert.equal(Object.hasOwn(init, 'tlsPinSha256'), expected !== undefined);
    assert.equal(Object.hasOwn(options, 'tlsPinSha256'), expected !== undefined);
    await loaded.plugin.onUnload();
  }
  for (const bad of ['abc', 'zz'.repeat(32), 42, hex + '00']) {
    await assert.rejects(async () => load({InstancesJson: one('127.0.0.1', {certSha256: bad}), TokensJson: JSON.stringify({one: {host: '127.0.0.1', token: 't'}})}, {sent: [], events: []}), /certSha256 must be 64 hex/);
  }
});

test('firmware grind labels map to grinding', async () => {
  for (const [grindState, expected] of [['Grind', 'grinding'], ['ManualStartGrind', 'grinding'], ['GbtStartGrind', 'grinding'], ['GbwPostGrind', 'unknown'], ['Idle', 'idle']]) {
    const fixture = {sent: [], events: []};
    const loaded = await load({InstancesJson: one('127.0.0.1'), TokensJson: JSON.stringify({one: {host: '127.0.0.1', token: 't'}})}, fixture);
    const connected = loaded.registrations[0].handlers.connect({transport: transport(fixture), publish: async value => { fixture.published = value; }, reportDisconnected: async () => {}});
    await new Promise(resolve => setImmediate(resolve));
    answer(fixture, 0, {grindState, ddValueDum: 819, ddSensorFailed: false});
    await connected;
    assert.equal(fixture.published.state, expected, grindState);
    await loaded.plugin.onUnload();
  }
});

test('login uses restPort and raises a notice until a login succeeds', async () => {
  const urls = [], notices = [];
  let ok = false;
  const fetchImpl = async (url) => { urls.push(url); return ok ? {ok: true, status: 200, headers: {get: () => 'Bearer t'}, text: async () => ''} : {ok: false, status: 400, headers: {get: () => null}, text: async () => 'Wrong password!'}; };
  let now = 0;
  class FakeDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const fixture = {sent: [], events: []};
  const notify = {notify: (value) => { notices.push(['notify', JSON.parse(JSON.stringify(value))]); return 'r1'; }, dismissNotification: (id) => { notices.push(['dismiss', id]); }};
  const registrations = [];
  const host = {...notify, devices: {register(definition, handlers) { registrations.push({definition, handlers}); return Promise.resolve({deviceId: `plugin:mahlkoenig-e64.reaplugin:e64:${definition.instanceId}`}); }}};
  const sandbox = {setTimeout, clearTimeout, Promise, Map, Set, JSON, Object, Number, Array, Error, encodeURIComponent, btoa: globalThis.btoa, fetch: fetchImpl, Date: FakeDate};
  vm.runInNewContext(`globalThis.createPlugin = (${source}\n);`, sandbox);
  const plugin = sandbox.createPlugin(host);
  await plugin.onLoad({InstancesJson: one('127.0.0.1', {restPort: 8443}), TokensJson: '{}', MintTokens: 'true', PasswordsJson: JSON.stringify({one: {host: '127.0.0.1', password: 'pw'}})});
  assert.deepEqual(notices.splice(0), [['dismiss', 'setup']], 'a valid configuration clears the setup notice');
  const connect = () => registrations[0].handlers.connect({transport: transport(fixture), publish: async () => {}, reportDisconnected: async () => {}});
  await assert.rejects(connect(), /login HTTP 400/);
  assert.deepEqual(urls, ['https://127.0.0.1:8443/rest_api/login']);
  assert.equal(notices[0][0], 'notify');
  assert.equal(notices[0][1].id, 'login-one');
  assert.match(notices[0][1].message, /^E64 One: login HTTP 400\./);
  assert.equal(notices[0][1].message.includes('pw'), false);
  assert.equal(notices[0][1].action.type, 'openExternalUrl');
  now += 5000; ok = true;
  const connected = connect();
  await new Promise(resolve => setImmediate(resolve));
  answer(fixture, 0, {grindState: 'Idle'});
  await connected;
  assert.deepEqual(notices.at(-1), ['dismiss', 'login-one']);
  await assert.rejects(async () => load({InstancesJson: one('127.0.0.1', {restPort: 0}), TokensJson: '{}'}, {sent: [], events: []}), /restPort is invalid/);
  await plugin.onUnload();
});

test('every event the plugin handles is covered by a declared permission', async () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  const eventPermission = {stateUpdate: 'events.machine', shotStored: 'events.shots', shotUpdated: 'events.shots', workflowUpdated: 'events.workflow',
    decentAccountChanged: 'proxy.decent_api', notificationAction: 'notifications', notificationResult: 'notifications'};
  const handled = [...source.matchAll(/event\.name === "([A-Za-z]+)"/g)].map((match) => match[1]);
  assert.ok(handled.includes('stateUpdate'));
  for (const name of handled) assert.ok(manifest.permissions.includes(eventPermission[name] ?? 'unknown event ' + name), name);
  assert.equal(manifest.permissions.includes('events.workflow'), false, 'workflow events are not used');
  const loaded = await load({}, {sent: [], events: []});
  loaded.plugin.onEvent({name: 'workflowUpdated', payload: {}});
  loaded.plugin.onEvent({name: 'notificationResult', payload: {requestId: 'r', status: 'accepted'}});
  await loaded.plugin.onUnload();
});

test('the plugin can only ever send allowlisted grinder actions', async () => {
  const allowed = ['StartGrindGbw', 'Stop', 'SetAgsaTargetDdValue', 'AddBrewEvent', 'SetBacklightBrightness'];
  assert.deepEqual(JSON.parse(source.match(/const ALLOWED_ACTIONS = (\[[^\]]*\]);/)[1]), allowed);
  const forbidden = ['StartGrindManual', 'StartGrindGbt', 'StartCalibration', 'CalibrateDdSensor', 'StartTara', 'SaveLog', 'ResetLog', 'SetFan1Duty', 'SetFan2Duty',
    'SetFanTemperatureCtrlEnabled', 'CalibrateFan1', 'CalibrateFan2', 'ToggleBacklightPower', 'EspFlashApp', 'EspEraseFlash', 'EspReset', 'ResetDriverConfig',
    'StopAgsa', 'GbsCreateReport', 'SetLanguage', 'SetSetupWizardState', 'StartEnduranceTest', 'StopEnduranceTest', 'NozzleLightRunStandby', 'NozzleLightStop',
    'UpdateDriverConfig', 'UpdateCpuConfig', 'WifiStaConfig', 'WifiConfigChanged', 'CustomSignal1', 'CustomSignal2', 'RequestOnboarding', 'RequestAdcConfig',
    'RequestConfigManagerSettings'];
  for (const name of forbidden) assert.equal(source.includes(name), false, name);
  assert.equal(/"Rc[A-Z]/.test(source), false, 'no remote-control input injection');
  for (const literal of source.matchAll(/action\(instance, "([A-Za-z]+)"/g)) assert.ok(allowed.includes(literal[1]), literal[1]);
});

test('control settings are validated and default to read-only', async () => {
  const base = {InstancesJson: one('127.0.0.1'), TokensJson: JSON.stringify({one: {host: '127.0.0.1', token: 't'}})};
  await assert.rejects(async () => load({...base, AdjustmentOwner: 'everyone'}, {sent: [], events: []}), /AdjustmentOwner must be/);
  await assert.rejects(async () => load({...base, AllowControl: 'yes'}, {sent: [], events: []}), /invalid JSON|must be true or false/);
  const loaded = await load(base, {sent: [], events: []});
  assert.equal(loaded.registrations[0].definition.driverId, 'e64');
  assert.equal(loaded.registrations[0].handlers.start, undefined);
  const control = JSON.parse((await loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:one', read: 'control'}})).body);
  assert.deepEqual([control.allowControl, control.debugMode, control.owner], [false, 'disabled', 'off']);
  await loaded.plugin.onUnload();
  const statics = await load({...base, AllowControl: 'true'}, {sent: [], events: []});
  assert.equal(statics.registrations[0].definition.driverId, 'e64', 'a static single-connection token is never spent on a probe');
  await statics.plugin.onUnload();
});

test('completed grinds become grind events without a uuid', async () => {
  const pending = new Map(); let nextTimer = 0;
  const timers = {setTimeout: (callback, delay) => {const id = ++nextTimer; pending.set(id, {callback, delay}); return id;}, clearTimeout: id => pending.delete(id)};
  const fixture = {sent: [], events: []};
  const loaded = await load({InstancesJson: one('127.0.0.1', {pollMs: 100}), TokensJson: JSON.stringify({one: {host: '127.0.0.1', token: 't'}})}, fixture, timers);
  const connected = loaded.registrations[0].handlers.connect({transport: transport(fixture), publish: async () => {}, reportDisconnected: async () => {}});
  await new Promise(resolve => setImmediate(resolve));
  answer(fixture, 0, {grindState: 'Grind', ddValueDum: 819, ddSensorFailed: false});
  await connected;
  const states = [{grindState: 'GbwPostGrind', ddValueDum: 819, ddSensorFailed: false},
    {grindState: 'Idle', ddValueDum: 819, ddSensorFailed: false, grindTargetWeightGr: 18, grindResultWeightGr: 18.07, grindStartWeightGr: 486.604, motorRunTimeMs: 8300, sessionId: 'secret'}];
  for (const [index, state] of states.entries()) {
    const poll = [...pending.entries()].find(([, timer]) => timer.delay === 100);
    pending.delete(poll[0]); poll[1].callback();
    answer(fixture, index + 1, state);
    await new Promise(resolve => setImmediate(resolve));
  }
  const query = {deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:one'};
  const events = JSON.parse(loaded.plugin.handleHttpRequest({endpoint: 'grind-events', method: 'GET', query}).body).events;
  assert.equal(events.length, 1);
  assert.deepEqual({...events[0], completedAt: typeof events[0].completedAt},
    {grindUuid: null, completedAt: 'string', targetWeightGr: 18, resultWeightGr: 18.07, motorRunTimeMs: 8300, overshootWeightGr: null, mode: 'GbW', portafilterWeightGr: 486.6, setting: '82', linkedShotId: null});
  const diagnostics = JSON.parse((await loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query})).body);
  assert.equal(diagnostics.grindEvents.length, 1);
  assert.equal(JSON.stringify(diagnostics).includes('secret'), false);
  await loaded.plugin.onUnload();
});

const plain = (value) => JSON.parse(JSON.stringify(value));
const codec = async () => (await load({}, {sent: [], events: []})).plugin.codec;
function zipOf(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const {name, data, method} of entries) {
    const raw = Buffer.from(data), body = method === 8 ? zlib.deflateRawSync(raw) : raw, fileName = Buffer.from(name);
    const fields = (signature, size) => { const b = Buffer.alloc(size); b.writeUInt32LE(signature, 0); return b; };
    const local = fields(0x04034b50, 30);
    local.writeUInt16LE(20, 4); local.writeUInt16LE(method, 8); local.writeUInt32LE(zlib.crc32(raw), 14);
    local.writeUInt32LE(body.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(fileName.length, 26);
    const central = fields(0x02014b50, 46);
    central.writeUInt16LE(20, 6); central.writeUInt16LE(method, 10); central.writeUInt32LE(zlib.crc32(raw), 16);
    central.writeUInt32LE(body.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(fileName.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, fileName, body); centrals.push(central, fileName);
    offset += local.length + fileName.length + body.length;
  }
  const directory = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

test('inflate matches zlib for stored, fixed and dynamic blocks', async () => {
  const {inflate} = await codec();
  let seed = 7;
  const random = (n) => Buffer.from(Array.from({length: n}, () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) & 255));
  const csvLike = Buffer.from(Array.from({length: 4000}, (_, i) => `${i},${crypto.randomUUID()},2026-11-23 10:${String(i % 60).padStart(2, '0')}:00,1,18000,"Espresso, double",500\n`).join(''));
  const samples = [Buffer.alloc(0), Buffer.from('a'), random(1), random(70000), Buffer.alloc(100000, 65), csvLike, Buffer.concat([random(40000), random(40000)])];
  for (const raw of samples) {
    for (const options of [{level: 0}, {strategy: zlib.constants.Z_FIXED}, {level: 9}, {level: 1}]) {
      const packed = zlib.deflateRawSync(raw, options);
      assert.deepEqual(Buffer.from(inflate(new Uint8Array(packed), 1 << 24)), raw, `${raw.length} bytes ${JSON.stringify(options)}`);
    }
  }
  assert.throws(() => inflate(new Uint8Array(zlib.deflateRawSync(Buffer.alloc(5000, 1))), 1000), /exceeds limit/);
  assert.throws(() => inflate(new Uint8Array([0xff, 0xff]), 1000), /inflate/);
  assert.throws(() => inflate(new Uint8Array(zlib.deflateRawSync(csvLike)).subarray(0, 200), 1 << 24), /truncated/);
});

test('zip reader extracts stored and deflated entries and enforces limits', async () => {
  const {readZip, fromBase64, utf8} = await codec();
  const text = 'grind_id,recipe_type\n1,"Müller, café ☕"\n';
  const zip = zipOf([{name: 'HemroE64WSServiceLogs_SN1_x.csv', data: 'a,b\n', method: 0},
    {name: 'HemroE64WSGrindLogs_SN1_x.csv', data: text, method: 8}, {name: 'plain.txt', data: 'stored', method: 0}]);
  const bytes = fromBase64(zip.toString('base64'));
  assert.deepEqual(Buffer.from(bytes), zip);
  assert.equal(utf8(readZip(bytes, (name) => /GrindLogs.*\.csv$/.test(name), 1 << 20)), text);
  assert.equal(utf8(readZip(bytes, (name) => name === 'plain.txt', 1 << 20)), 'stored');
  assert.equal(readZip(bytes, () => false, 1 << 20), null);
  assert.throws(() => readZip(bytes, (name) => name === 'plain.txt', 3), /exceeds limit/);
  assert.throws(() => readZip(new Uint8Array(30), () => true, 100), /no end of central directory/);
});

test('csv parser handles quotes, escaped quotes, CRLF and semicolons', async () => {
  const {parseCsv} = await codec();
  assert.deepEqual(plain(parseCsv('a,b,c\r\n1,"x, ""y""",\n2,"multi\nline",z')), [['a', 'b', 'c'], ['1', 'x, "y"', ''], ['2', 'multi\nline', 'z']]);
  assert.deepEqual(plain(parseCsv('﻿a;b\n1;2\n')), [['a', 'b'], ['1', '2']]);
});

async function logHarness({zip, failDownloads = false, binary = true, refuse = () => false, hang = () => false,
  route = () => null, extraSettings = {}, apiToken = null, abort = false} = {}) {
  let now = Date.parse('2026-11-23T12:00:00Z');
  class FakeDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const pending = new Map(); let nextTimer = 0;
  const aborts = [];
  // The sandbox supplies no AbortController unless a test injects one through the
  // timers spread, which is how the abort branch gets exercised.
  const fakeAbort = {AbortController: class { constructor() { this.signal = {aborted: false}; } abort() { this.signal.aborted = true; aborts.push(this.signal); } }};
  const timers = {setTimeout: (callback, delay) => {const id = ++nextTimer; pending.set(id, {callback, delay, at: now + delay}); return id;}, clearTimeout: id => pending.delete(id), Date: FakeDate, ...(abort ? fakeAbort : {})};
  const calls = [];
  const failing = () => typeof failDownloads === 'function' ? failDownloads() : failDownloads;
  const fetchImpl = async (url, init) => {
    calls.push({url, init});
    if (hang(url, init)) return new Promise(() => {});
    const custom = route(url, init);
    if (custom) return custom;
    if (url.endsWith('/login')) return {ok: true, status: 200, headers: {get: (name) => name === 'authorization' ? `Bearer t${calls.length}` : 'PHPSESSID=abc; path=/'}, text: async () => ''};
    if (failing()) return {ok: false, status: 503, headers: {get: () => null}, base64: async () => ''};
    if (refuse(init)) return {ok: false, status: 400, headers: {get: () => null}, base64: async () => ''};
    if (/\/rest_api\/(grind_log|service_log)$/.test(url)) return localJson({success: true, data: {rows: []}});
    return {ok: true, status: 200, headers: {get: () => null}, ...(binary ? {base64: async () => zip.toString('base64')} : {})};
  };
  const fixture = {sent: [], events: []};
  const loaded = await load({InstancesJson: one('127.0.0.1', {pollMs: 100, restPort: 8443}), TokensJson: '{}', MintTokens: 'true', PasswordsJson: JSON.stringify({one: {host: '127.0.0.1', password: 'pw'}}),
    ...(apiToken ? {UseLocalApi: 'true', ApiTokensJson: JSON.stringify({one: {host: '127.0.0.1', token: apiToken}})} : {}), ...extraSettings}, fixture, timers, fetchImpl);
  const settle = async () => {
    for (let i = 0; i < 8; i++) {
      await new Promise(resolve => setImmediate(resolve));
      for (const [id, timer] of [...pending.entries()]) if (timer.delay !== 100 && timer.delay !== 5000 && timer.at <= now) { pending.delete(id); timer.callback(); }
    }
  };
  let answered = 0;
  const connect = async () => {
    fixture.sent = []; answered = 0;
    const connected = loaded.registrations[0].handlers.connect({transport: transport(fixture), publish: async () => {}, reportDisconnected: async () => {}});
    await settle();
    answer(fixture, answered++, {grindState: 'Idle', ddValueDum: 819, ddSensorFailed: false, grindTargetWeightGr: 18});
    await connected;
  };
  const poll = async (grindState) => {
    const entry = [...pending.entries()].find(([, timer]) => timer.delay === 100);
    pending.delete(entry[0]); entry[1].callback();
    answer(fixture, answered++, {grindState, ddValueDum: 819, ddSensorFailed: false, grindTargetWeightGr: 18});
    await settle();
  };
  const grind = async () => { await poll('Grind'); await poll('Idle'); };
  const logTimers = () => [...pending.entries()].filter(([, timer]) => timer.delay !== 100 && timer.delay !== 5000);
  const advance = async (ms) => {
    now += ms;
    for (const [id, timer] of logTimers()) if (timer.at <= now) { pending.delete(id); timer.callback(); }
    await settle();
  };
  const downloads = () => calls.filter((call) => call.url.endsWith('/download_machine_logs')).length;
  const localCalls = (name) => calls.filter((call) => call.url.endsWith('/rest_api/' + name));
  const requests = () => calls.map((call) => call.url.replace('https://127.0.0.1:8443/rest_api/', ''));
  const logins = () => calls.filter((call) => call.url.endsWith('/login')).length;
  const query = {deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:one'};
  const events = () => JSON.parse(loaded.plugin.handleHttpRequest({endpoint: 'grind-events', method: 'GET', query}).body);
  const service = (extra = {}) => loaded.plugin.handleHttpRequest({endpoint: 'service-log', method: 'GET', query: extra});
  return {loaded, connect, grind, advance, downloads, localCalls, requests, logins, events, service, logTimers, calls, aborts,
    disconnect: () => loaded.registrations[0].handlers.disconnect()};
}
// A Local API v1 response: the plugin reads .ok, .status, .headers.get() and .json().
const localJson = (payload, status = 200, headers = {}) => ({ok: status >= 200 && status < 300, status,
  headers: {get: (name) => headers[name.toLowerCase()] ?? null}, json: async () => payload});
const stampAt = (ms) => { const d = new Date(ms), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
const grindHeader = 'grind_id,grind_uuid,grind_date_time,grind_ddd,grind_duration,grind_weight,grind_successfull,recipe_index,recipe_uuid,recipe_mode,recipe_amount,recipe_type,recipe_coarseness,recipe_brew_time,recipe_brew_weight';
const serviceHeader = 'event_id,event_type_id,event_type,event_date_time,event_details';

test('grind logs are matched by dose and time, coalesced, and fetched with the connection session', async () => {
  const at = Date.parse('2026-11-23T12:00:00Z');
  const grinds = [grindHeader, `3,uuid-other-dose,${stampAt(at)},820,8000,20100,1,2,r2,GbW,20000,Lungo,600,30000,40000`,
    `2,uuid-match,${stampAt(at)},819,8300,18070,1,1,r1,GbW,18000,"Espresso, double",500,27000,36000`,
    `1,uuid-too-old,${stampAt(at - 3600000)},819,8300,18000,1,1,r1,GbW,18000,Espresso,500,27000,36000`].join('\n');
  const services = [serviceHeader, '1,7,PowerOn,2026-11-23 11:00:00,Firmware V01.16 started',
    '2,8,WifiConnected,2026-11-23 11:00:05,"SSID HomeNet ip 192.168.1.23 mac aa:bb:cc:dd:ee:ff password=hunter2"',
    '3,9,SerialNumberRead,2026-11-23 11:00:06,Device SN 000000123456 session 0123456789abcdef0123456789abcdef'].join('\n');
  const zip = zipOf([{name: 'HemroE64WSGrindLogs_SN1_x.csv', data: grinds, method: 8}, {name: 'HemroE64WSServiceLogs_SN1_x.csv', data: services, method: 8}]);
  const h = await logHarness({zip});
  await h.connect();
  assert.equal(h.logins(), 1);
  assert.equal(h.downloads(), 0, 'no download at connect itself');
  await h.grind();
  assert.equal(h.downloads(), 1, 'a completed grind downloads at once');
  assert.equal(h.logins(), 1, 'the connection session is reused');
  const download = h.calls.find((call) => call.url.endsWith('/download_machine_logs'));
  assert.equal(download.url, 'https://127.0.0.1:8443/rest_api/download_machine_logs');
  assert.deepEqual([download.init.method, download.init.responseType, download.init.headers.Cookie, download.init.headers.Authorization], ['POST', 'base64', 'PHPSESSID=abc', 'Bearer t1']);
  const [event] = h.events().events;
  assert.equal(event.grindUuid, 'uuid-match', 'the target weight rules out the newer 20 g row');
  assert.deepEqual(event.recipe, {index: 1, uuid: 'r1', mode: 'GbW', type: 'Espresso, double', amountGr: 18, setting: '50', brewTimeMs: 27000, brewWeightGr: 36, icon: null, gbsEnabled: null});
  assert.deepEqual(event.log, {grindWeightGr: 18.07, grindDurationMs: 8300, setting: '82', successful: true});
  const service = JSON.parse(h.service().body);
  assert.equal(service.instance, 'one');
  assert.deepEqual(service.rows.map((row) => row.id), [1, 2, 3]);
  assert.equal(service.rows[1].details, 'SSID <redacted> ip <ip> mac <mac> password=<redacted>');
  assert.equal(service.rows[2].details, 'Device SN<redacted> session <redacted>');
  assert.deepEqual(JSON.parse(h.service({instance: 'one', after: '2'}).body).rows.map((row) => row.id), [3]);
  assert.equal(h.service({after: 'x'}).status, 400);
  assert.equal(h.service({instance: 'nope'}).status, 404);
  assert.deepEqual(JSON.parse(h.service({deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:nope'}).body), {error: 'unknown instance'});
  await h.grind(); await h.advance(60000); await h.grind();
  assert.equal(h.downloads(), 1, 'grinds within 10 minutes are coalesced');
  assert.equal(h.logTimers().length, 1);
  await h.advance(9 * 60000);
  assert.equal(h.downloads(), 2, 'one batched download 10 minutes after the last');
  await h.advance(5 * 3600000);
  assert.equal(h.downloads(), 2);
  await h.advance(3600000);
  assert.equal(h.downloads(), 3, 'one idle refresh after 6 hours');
  await h.loaded.plugin.onUnload();
});

test('log downloads respect old hosts, suspend after repeated failures and stay bounded', async () => {
  const old = await logHarness({zip: Buffer.alloc(0), binary: false});
  await old.connect(); await old.grind();
  assert.equal(old.events().log.status, 'unsupported-host');
  await old.advance(7 * 3600000); await old.grind();
  assert.equal(old.downloads(), 1, 'an older host is not asked again');
  await old.loaded.plugin.onUnload();

  const failing = await logHarness({failDownloads: true});
  await failing.connect();
  for (let i = 0; i < 6; i++) { await failing.grind(); await failing.advance(10 * 60000); }
  assert.equal(failing.downloads(), 3, 'three failures, at least 10 minutes apart, then suspended');
  assert.equal(failing.events().log.status, 'suspended');
  const attempts = failing.calls.filter((call) => call.url.endsWith('/download_machine_logs')).length;
  assert.equal(attempts, 3);
  await failing.disconnect(); await failing.connect();
  await failing.grind();
  assert.equal(failing.downloads(), 4, 'a new connection lifts the suspension');
  assert.equal(failing.logins(), 2, 'one Owner login per connection');
  await failing.loaded.plugin.onUnload();

  const rows = [serviceHeader, ...Array.from({length: 700}, (_, i) => `${i + 1},1,LogIn,2026-11-23 10:00:00,Role Owner logged in`)].join('\n');
  const big = await logHarness({zip: zipOf([{name: 'HemroE64WSServiceLogs_SN1_x.csv', data: rows, method: 8}])});
  await big.connect();
  for (let i = 0; i < 30; i++) await big.grind();
  await big.advance(60000);
  const kept = JSON.parse(big.service().body).rows;
  assert.equal(kept.length, 500);
  assert.deepEqual([kept[0].id, kept.at(-1).id], [201, 700]);
  assert.equal(big.events().events.length, 20);
  await big.loaded.plugin.onUnload();
});

test('a log request that never resolves cannot leave the log downloading', async () => {
  const stalled = await logHarness({zip: Buffer.alloc(0), hang: (url) => url.endsWith('/download_machine_logs')});
  await stalled.connect();
  await stalled.grind();
  assert.equal(stalled.downloads(), 1, 'the grind starts the download');
  assert.equal(stalled.events().log.status, 'downloading');
  await stalled.advance(20001);
  const log = stalled.events().log;
  assert.equal(log.status, 'failed', 'the bounded deadline ends the download');
  assert.equal(log.failures, 1);
  assert.equal(log.lastError, 'grind log timeout');
  assert.deepEqual(stalled.logTimers().map(([, timer]) => timer.delay), [6 * 3600000], 'the finally block still rescheduled');
  await stalled.loaded.plugin.onUnload();

  const local = await logHarness({zip: Buffer.alloc(0), apiToken: 'owner-token', failDownloads: true,
    hang: (url) => url.endsWith('/rest_api/grind_log')});
  await local.connect();
  await local.grind();
  assert.equal(local.localCalls('grind_log').length, 1, 'the local API is asked first');
  assert.equal(local.events().log.status, 'downloading');
  await local.advance(20001);
  const localLog = local.events().log;
  assert.equal(localLog.status, 'failed', 'the local API deadline ends the download');
  assert.equal(localLog.failures, 1);
  assert.equal(localLog.lastError, 'local api timeout');
  await local.loaded.plugin.onUnload();
});

test('a Local API failure still tries the vendor ZIP once before counting a failure', async () => {
  const zip = zipOf([{name: 'HemroE64WSServiceLogs_SN1_x.csv', data: [serviceHeader, '1,1,PowerOn,2026-11-23 11:00:00,Firmware started'].join('\n'), method: 8}]);
  const h = await logHarness({zip, apiToken: 'owner-token',
    route: (url) => url.endsWith('/rest_api/grind_log') ? localJson({success: false, error: 'token rejected'}, 401) : null});
  await h.connect();
  await h.grind();
  assert.equal(h.localCalls('grind_log').length, 1, 'the Local API is asked first');
  assert.equal(h.downloads(), 1, 'the vendor ZIP is tried once after the Local API refused');
  const log = h.events().log;
  assert.equal(log.status, 'ok', 'the fallback succeeded');
  assert.equal(log.failures, 0, 'a successful fallback is not a failure');
  assert.equal(JSON.parse(h.service().body).rows.length, 1, 'the fallback still fills the service log');
  await h.loaded.plugin.onUnload();
});

test('a Local API and ZIP failure together count one failure', async () => {
  const h = await logHarness({zip: Buffer.alloc(0), apiToken: 'owner-token', failDownloads: true,
    route: (url) => url.endsWith('/rest_api/grind_log') ? localJson({success: false, error: 'nope'}, 401) : null});
  await h.connect();
  await h.grind();
  assert.equal(h.localCalls('grind_log').length, 1);
  assert.equal(h.downloads(), 1, 'the ZIP is still tried');
  const log = h.events().log;
  assert.equal(log.failures, 1, 'one attempt is one failure, not two');
  assert.equal(log.status, 'unauthorized');
  assert.equal(log.errorClass, 'unauthorized');
  await h.loaded.plugin.onUnload();
});

test('a suspended log recovers on a later successful attempt', async () => {
  let failing = true;
  const zip = zipOf([{name: 'HemroE64WSServiceLogs_SN1_x.csv', data: [serviceHeader, '1,1,PowerOn,2026-11-23 11:00:00,Firmware started'].join('\n'), method: 8}]);
  const h = await logHarness({zip, failDownloads: () => failing});
  await h.connect();
  for (let i = 0; i < 3; i++) { await h.grind(); await h.advance(10 * 60000); }
  assert.equal(h.events().log.failures, 3);
  assert.equal(h.events().log.status, 'suspended');
  const before = h.downloads();
  failing = false;
  await h.grind();
  assert.equal(h.downloads(), before, 'a suspended log is not retried on every grind');
  await h.advance(6 * 3600000);
  assert.equal(h.downloads(), before + 1, 'the suspended log probes once per idle refresh');
  const log = h.events().log;
  assert.equal(log.status, 'ok', 'a success lifts the suspension without a new connection');
  assert.equal(log.failures, 0, 'a successful request resets the counter');
  await h.loaded.plugin.onUnload();
});

test('Local API statuses are classified and a refusal is marked non-retryable', async () => {
  for (const [status, errorClass, retryable] of [[401, 'unauthorized', false], [403, 'forbidden', false], [409, 'conflict', true],
    [422, 'unprocessable', true], [429, 'rate-limited', true], [503, 'unavailable', true]]) {
    const h = await logHarness({zip: Buffer.alloc(0), apiToken: 'owner-token', failDownloads: true,
      route: (url) => url.endsWith('/rest_api/grind_log') ? localJson({success: false, error: 'device says no'}, status) : null});
    await h.connect();
    await h.grind();
    const log = h.events().log;
    assert.equal(log.errorClass, errorClass, `HTTP ${status} class`);
    assert.equal(log.retryable, retryable, `HTTP ${status} retryable`);
    assert.equal(log.status, retryable ? 'failed' : errorClass, `HTTP ${status} status`);
    assert.equal(log.lastError, `local api grind_log HTTP ${status}`, `HTTP ${status} message`);
    await h.loaded.plugin.onUnload();
  }
});

test('a refused Local API token stops the log until the next connection', async () => {
  const h = await logHarness({zip: Buffer.alloc(0), apiToken: 'owner-token', failDownloads: true,
    route: (url) => url.endsWith('/rest_api/grind_log') ? localJson({success: false, error: 'no'}, 401) : null});
  await h.connect();
  await h.grind();
  assert.equal(h.localCalls('grind_log').length, 1);
  assert.equal(h.events().log.retryable, false);
  await h.grind();
  await h.advance(24 * 3600000);
  assert.equal(h.localCalls('grind_log').length, 1, 'a refused token is not retried in the same session');
  await h.disconnect();
  await h.connect();
  await h.grind();
  assert.equal(h.localCalls('grind_log').length, 2, 'the next connection retries once');
  await h.loaded.plugin.onUnload();
});

test('a 429 honours Retry-After instead of the 6-hour idle refresh', async () => {
  const h = await logHarness({zip: Buffer.alloc(0), apiToken: 'owner-token', failDownloads: true,
    route: (url) => url.endsWith('/rest_api/grind_log') ? localJson({success: false, error: 'busy'}, 429, {'retry-after': '1800'}) : null});
  await h.connect();
  await h.grind();
  const log = h.events().log;
  assert.equal(log.errorClass, 'rate-limited');
  assert.equal(log.retryAfterMs, 30 * 60000);
  await h.grind();
  await h.advance(29 * 60000);
  assert.equal(h.localCalls('grind_log').length, 1, 'a grind does not jump the Retry-After queue');
  await h.advance(2 * 60000);
  assert.equal(h.localCalls('grind_log').length, 2, 'one retry once Retry-After has passed');
  await h.loaded.plugin.onUnload();
});

test('an HTTP-date Retry-After is honoured, and an unparsable one is ignored', async () => {
  const at = Date.parse('2026-11-23T12:00:00Z');
  const httpDate = new Date(at + 45 * 60000).toUTCString(); // IMF-fixdate
  const h = await logHarness({zip: Buffer.alloc(0), apiToken: 'owner-token', failDownloads: true,
    route: (url) => url.endsWith('/rest_api/grind_log') ? localJson({success: false, error: 'busy'}, 429, {'retry-after': httpDate}) : null});
  await h.connect();
  await h.grind();
  const log = h.events().log;
  assert.equal(log.retryAfterMs, 45 * 60000, `Date.parse understood ${httpDate}`);
  assert.deepEqual(h.logTimers().map(([, timer]) => timer.delay), [45 * 60000], 'the next attempt follows the date');
  await h.advance(44 * 60000);
  assert.equal(h.localCalls('grind_log').length, 1, 'not before the date');
  await h.advance(2 * 60000);
  assert.equal(h.localCalls('grind_log').length, 2, 'one retry after the date');
  await h.loaded.plugin.onUnload();
});

test('Retry-After is capped and an unusable value falls back to the idle refresh', async () => {
  for (const [header, expected] of [['999999', 3600000], ['soon', null], ['', null]]) {
    const h = await logHarness({zip: Buffer.alloc(0), apiToken: 'owner-token', failDownloads: true,
      route: (url) => url.endsWith('/rest_api/grind_log') ? localJson({success: false, error: 'busy'}, 429, {'retry-after': header}) : null});
    await h.connect();
    await h.grind();
    assert.equal(h.events().log.retryAfterMs, expected, `Retry-After ${JSON.stringify(header)}`);
    assert.deepEqual(h.logTimers().map(([, timer]) => timer.delay), [expected === null ? 6 * 3600000 : expected],
      `next attempt after ${JSON.stringify(header)}`);
    await h.loaded.plugin.onUnload();
  }
});

test('device error text is capped and sanitised before it reaches lastError', async () => {
  // C0 + DEL + C1 (NEL, CSI), bidi override and zero width, then astral padding so
  // the cap lands in the middle of surrogate pairs.
  const hostile = 'password=pw SSID HomeNet ip 192.168.1.23 secret=hunter2\n\u0007\u0085\u009b\u202e\u200b' + '😀'.repeat(200);
  const h = await logHarness({zip: Buffer.alloc(0), apiToken: 'owner-token', failDownloads: true,
    route: (url) => url.endsWith('/rest_api/grind_log') ? localJson({success: false, error: hostile}) : null});
  await h.connect();
  await h.grind();
  const log = h.events().log;
  assert.ok(log.lastError.startsWith('local api grind_log: '), log.lastError);
  assert.ok(!/[\u0000-\u001f\u007f-\u009f]/.test(log.lastError), 'C0, DEL and C1 controls collapsed');
  assert.ok(!/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/.test(log.lastError), 'zero-width and bidi dropped');
  assert.equal(Buffer.from(log.lastError, 'utf8').toString('utf8'), log.lastError, 'no lone surrogate survived the cap');
  assert.ok(Array.from(log.lastError).length <= 160, `capped by code point, got ${Array.from(log.lastError).length}`);
  assert.ok(log.lastError.includes('😀'), 'astral characters survive intact');
  assert.ok(!log.lastError.includes('hunter2'), 'secrets redacted');
  assert.ok(!log.lastError.includes('pw'), 'passwords redacted');
  assert.ok(!log.lastError.includes('192.168.1.23'), 'addresses redacted');
  assert.ok(!log.lastError.includes('HomeNet'), 'network names redacted');
  await h.loaded.plugin.onUnload();
});

test('a rejected log download is caught instead of left as an unhandled rejection', async () => {
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  try {
    // A malformed host error: reading .message throws, so even the catch block fails.
    const hostile = {get message() { throw new TypeError('hostile error object'); }};
    const h = await logHarness({zip: Buffer.alloc(0), route: (url) => {
      if (url.endsWith('/download_machine_logs')) throw hostile;
      return null;
    }});
    await h.connect();
    await h.grind();
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    const log = h.events().log;
    assert.equal(log.status, 'failed', 'the status is not left at downloading');
    assert.equal(log.lastError, 'grind log download failed');
    assert.equal(unhandled.length, 0, 'the rejection was caught');
    await h.loaded.plugin.onUnload();
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

test('the Local API fills the grind log and the service log from its two routes', async () => {
  const at = Date.parse('2026-11-23T12:00:00Z');
  const grindRows = [
    {grind_id: 2, grind_uuid: 'local-uuid', grind_date_time: stampAt(at), grind_ddd: 819, grind_duration: 8300, grind_weight: 18070,
      grind_successfull: 1, grind_trigger: 'GrindByWeight', recipe_index: 1, recipe_uuid: 'r1', recipe_mode: 'GbW', recipe_type: 'Espresso',
      recipe_amount: 18000, recipe_coarseness: 500, recipe_brew_time: 27000, recipe_brew_weight: 36000, recipe_icon: 'espresso', recipe_gbs_enabled: 1},
    {grind_id: 3, grind_uuid: 'other-dose', grind_date_time: stampAt(at), grind_ddd: 820, grind_duration: 8000, grind_weight: 20100,
      grind_successfull: 1, recipe_amount: 20000}];
  const serviceRows = [
    {event_id: 1, event_type_id: 7, event_type: 'PowerOn', event_date_time: '2026-11-23 11:00:00', event_details: 'Firmware V01.16 started'},
    {event_id: 2, event_type_id: 8, event_type: 'WifiConnected', event_date_time: '2026-11-23 11:00:05',
      event_details: 'SSID HomeNet ip 192.168.1.23 mac aa:bb:cc:dd:ee:ff password=hunter2'}];
  const h = await logHarness({zip: Buffer.alloc(0), apiToken: 'owner-token', route: (url) => {
    if (url.endsWith('/rest_api/grind_log')) return localJson({success: true, data: {rows: grindRows}});
    if (url.endsWith('/rest_api/service_log')) return localJson({success: true, data: {rows: serviceRows}});
    return null;
  }});
  await h.connect();
  await h.grind();
  assert.equal(h.downloads(), 0, 'the vendor ZIP is not used when the Local API answers');
  const [grindCall] = h.localCalls('grind_log');
  assert.equal(grindCall.url, 'https://127.0.0.1:8443/rest_api/grind_log');
  assert.equal(grindCall.init.method, 'POST');
  assert.equal(grindCall.init.headers['X-E64-Local-Token'], 'owner-token');
  assert.equal(grindCall.init.headers.Cookie, 'PHPSESSID=abc');
  assert.deepEqual(JSON.parse(grindCall.init.body), {limit: 5000});
  assert.deepEqual(JSON.parse(h.localCalls('service_log')[0].init.body), {limit: 500});
  const [event] = h.events().events;
  assert.equal(event.grindUuid, 'local-uuid', 'the target weight rules out the 20 g row');
  assert.equal(event.trigger, 'GrindByWeight');
  assert.deepEqual(event.log, {grindWeightGr: 18.07, grindDurationMs: 8300, setting: '82', successful: true});
  assert.deepEqual(event.recipe, {index: 1, uuid: 'r1', mode: 'GbW', type: 'Espresso', amountGr: 18, setting: '50',
    brewTimeMs: 27000, brewWeightGr: 36, icon: 'espresso', gbsEnabled: true});
  const service = JSON.parse(h.service().body);
  assert.deepEqual(service.rows.map((row) => [row.id, row.eventType]), [[1, 'PowerOn'], [2, 'WifiConnected']]);
  assert.equal(service.rows[1].details, 'SSID <redacted> ip <ip> mac <mac> password=<redacted>');
  const query = {deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:one'};
  const html = await h.loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {...query, ui: '1'}});
  assert.equal(html.body.includes('owner-token'), false, 'the Local API token never reaches the page');
  assert.equal(JSON.stringify(h.events()).includes('owner-token'), false, 'nor the log payload');
  assert.equal(JSON.stringify(await h.loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query})).includes('owner-token'), false,
    'nor the diagnostics JSON');
  await h.loaded.plugin.onUnload();
});

test('a Local API payload error names its route, is sanitised and still falls back', async () => {
  const h = await logHarness({zip: Buffer.alloc(0), apiToken: 'owner-token', failDownloads: true, route: (url) => {
    if (url.endsWith('/rest_api/grind_log')) return localJson({success: true, data: {rows: []}});
    if (url.endsWith('/rest_api/service_log')) return localJson({success: false, error: 'table locked\nby writer'});
    return null;
  }});
  await h.connect();
  await h.grind();
  assert.equal(h.localCalls('grind_log').length, 1);
  assert.equal(h.localCalls('service_log').length, 1);
  assert.equal(h.downloads(), 1, 'the ZIP is still tried once after a payload error');
  const log = h.events().log;
  assert.equal(log.lastError, 'local api service_log: table locked by writer', 'newlines collapsed');
  assert.equal(log.failures, 1);
  assert.equal(log.status, 'failed');
  await h.loaded.plugin.onUnload();
});

test('a Local API error body that is not an object is reported without throwing', async () => {
  const h = await logHarness({zip: Buffer.alloc(0), apiToken: 'owner-token', failDownloads: true,
    route: (url) => url.endsWith('/rest_api/grind_log') ? localJson(null) : null});
  await h.connect();
  await h.grind();
  const log = h.events().log;
  assert.equal(log.lastError, 'local api grind_log: invalid response');
  assert.equal(log.failures, 1);
  await h.loaded.plugin.onUnload();
});

test('the deadline aborts the request where the runtime honours a signal', async () => {
  const h = await logHarness({zip: Buffer.alloc(0), abort: true, hang: (url) => url.endsWith('/download_machine_logs')});
  await h.connect();
  await h.grind();
  const call = h.calls.find((entry) => entry.url.endsWith('/download_machine_logs'));
  assert.ok(call.init.signal, 'the request carries an abort signal');
  assert.equal(call.init.signal.aborted, false, 'not aborted while in flight');
  assert.equal(h.aborts.length, 0);
  await h.advance(20001);
  assert.equal(call.init.signal.aborted, true, 'the deadline aborts the socket');
  assert.equal(h.aborts.length, 1, 'exactly one abort');
  const log = h.events().log;
  assert.equal(log.status, 'failed');
  assert.equal(log.lastError, 'grind log timeout');
  await h.loaded.plugin.onUnload();
});

async function inventoryRun({decaid = decaidApi(), extra = {}, grinderType = 'E64 WS', connects = 1} = {}) {
  const fetchImpl = hostFetch([], decaid);
  const fixture = {sent: [], events: []};
  const loaded = await load({InstancesJson: one('127.0.0.1', {pollMs: 0}), TokensJson: JSON.stringify({one: {host: '127.0.0.1', token: 't'}}), PopulateGrinderRecord: 'true', SyncWorkflowGrinder: 'false', ...extra}, fixture, {}, fetchImpl);
  const read = async () => JSON.parse((await loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:one', read: 'inventory'}})).body);
  for (let i = 0; i < connects; i++) {
    fixture.sent = [];
    const connected = loaded.registrations[0].handlers.connect({transport: transport(fixture), publish: async () => {}, reportDisconnected: async () => {}});
    await new Promise(resolve => setImmediate(resolve));
    answer(fixture, 0, {grindState: 'Idle', ddValueDum: 819, ddSensorFailed: false});
    await connected;
    if (extra.PopulateGrinderRecord !== 'false') {
      let answered = false;
      for (let n = 0; n < 40; n++) {
        await new Promise(resolve => setImmediate(resolve));
        const index = fixture.sent.findIndex((message) => message.type === 'RequestNachineInfo');
        if (index >= 0 && !answered) { answered = true; answer(fixture, index, {grinderType, sessionId: 'secret'}); }
      }
    }
  }
  // Retries wait 100-500 ms between attempts; let the sync finish.
  for (const deadline = Date.now() + 3000; Date.now() < deadline;) {
    const current = await read();
    if (current.lastSyncAt !== null || ['error', 'archived', 'disabled'].includes(current.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  const inventory = await read();
  await loaded.plugin.onUnload();
  return {decaid, inventory, writes: decaid.calls.filter((call) => call.method !== 'GET')};
}

test('connect creates one grinder record and links an empty workflow', async () => {
  const {decaid, inventory, writes} = await inventoryRun({connects: 2});
  assert.equal(decaid.grinders.length, 1, 'no duplicate on reconnect');
  const [record] = decaid.grinders;
  assert.deepEqual({...record, id: typeof record.id, extras: {...record.extras, lastSeenAt: typeof record.extras.lastSeenAt}}, {
    id: 'string', archived: false, notes: null, settingValues: null, rpmSmallStep: null, rpmBigStep: null,
    model: 'Mahlkönig E64 WS', burrs: '64 mm flat (stock)', burrSize: 64, burrType: 'flat', settingType: 'numeric', settingSmallStep: 1, settingBigStep: 10,
    extras: {source: 'mahlkoenig-e64.reaplugin', instanceId: 'one', unit: 'µm (grinder display)', deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:one', lastSeenAt: 'string'}});
  assert.equal(JSON.stringify(decaid.grinders).includes('secret'), false);
  assert.deepEqual(decaid.workflow.context, {grinderId: record.id, grinderModel: 'Mahlkönig E64 WS'});
  assert.deepEqual(writes.map((call) => `${call.method} ${call.path}`), ['POST /api/v1/grinders', 'PUT /api/v1/workflow'], 'the second connect writes nothing');
  assert.deepEqual([inventory.status, inventory.grinderId, inventory.workflowLink, inventory.archived], ['linked', record.id, 'linked', false]);
});

test('an existing E64 record is adopted, user fields are never overwritten and an archived record is respected', async () => {
  const userRecord = () => ({id: 'user', model: 'My E64 at home', burrs: 'SSP HU', burrSize: 64, burrType: 'flat', notes: 'mine', archived: false,
    settingType: 'numeric', settingSmallStep: 0.5, settingBigStep: 5, extras: {color: 'red'}});
  const other = {id: 'other', model: 'E64 via other plugin', archived: false, extras: {source: 'someone.else'}};
  const adopted = await inventoryRun({decaid: decaidApi({grinders: [other, userRecord()]})});
  const record = adopted.decaid.grinders.find((g) => g.id === 'user');
  assert.deepEqual({...record, extras: {...record.extras, lastSeenAt: 'x'}}, {...userRecord(), extras: {color: 'red', source: 'mahlkoenig-e64.reaplugin', instanceId: 'one',
    unit: 'µm (grinder display)', deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:one', lastSeenAt: 'x'}});
  assert.deepEqual(adopted.writes.filter((call) => call.path.startsWith('/api/v1/grinders')).map((call) => Object.keys(call.body)), [['extras']]);
  assert.equal(adopted.inventory.status, 'adopted');

  const stale = {...userRecord(), extras: {source: 'mahlkoenig-e64.reaplugin', instanceId: 'one', deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:one', lastSeenAt: '2020-01-01T00:00:00.000Z'}};
  const refreshed = await inventoryRun({decaid: decaidApi({grinders: [stale]})});
  assert.deepEqual(refreshed.writes.filter((call) => call.path.startsWith('/api/v1/grinders')).map((call) => Object.keys(call.body)), [['extras']]);
  assert.equal(refreshed.decaid.grinders[0].model, 'My E64 at home');

  const archived = await inventoryRun({decaid: decaidApi({grinders: [{...stale, archived: true}]})});
  assert.deepEqual(archived.writes, [], 'no unarchive, recreate or workflow link');
  assert.deepEqual([archived.inventory.status, archived.inventory.archived], ['archived', true]);
});

test('the workflow grinder is only set when empty, and both settings switch the feature off', async () => {
  for (const context of [{grinderId: 'someone-else'}, {grinderModel: 'Niche Zero'}]) {
    const run = await inventoryRun({decaid: decaidApi({workflow: {context: {...context, grinderSetting: '12', targetYield: 36}, profile: {title: 'P'}}})});
    assert.deepEqual(run.decaid.workflow, {context: {...context, grinderSetting: '12', targetYield: 36}, profile: {title: 'P'}});
    assert.equal(run.inventory.workflowLink, 'kept-existing');
  }
  const kept = await inventoryRun({decaid: decaidApi({workflow: {context: {grinderSetting: '12', targetYield: 36}, profile: {title: 'P'}}})});
  assert.deepEqual(kept.writes.find((call) => call.path === '/api/v1/workflow').body, {context: {grinderId: kept.decaid.grinders[0].id, grinderModel: 'Mahlkönig E64 WS'}});
  assert.deepEqual(kept.decaid.workflow.context.grinderSetting, '12');
  const unknown = await inventoryRun({grinderType: 'Unknown', extra: {LinkWorkflowGrinder: 'false'}});
  assert.equal(unknown.decaid.grinders[0].model, 'Mahlkönig E64 WS', 'dev-mode "Unknown" never becomes the model');
  assert.deepEqual(unknown.writes.map((call) => call.path), ['/api/v1/grinders']);
  assert.equal(unknown.inventory.workflowLink, 'disabled');
  const off = await inventoryRun({extra: {PopulateGrinderRecord: 'false'}});
  assert.deepEqual(off.decaid.calls, []);
  assert.equal(off.inventory.status, 'disabled');
});

test('an expired grinder session costs exactly one extra login', async () => {
  const zip = zipOf([{name: 'HemroE64WSServiceLogs_SN1_x.csv', data: `${serviceHeader}\n1,1,LogIn,2026-11-23 10:00:00,Role Owner logged in`, method: 8}]);
  const h = await logHarness({zip, refuse: (init) => init.headers.Authorization === 'Bearer t1'});
  await h.connect();
  await h.grind();
  assert.deepEqual([h.logins(), h.downloads()], [2, 2], 'refused once, logged in once, retried once');
  assert.equal(h.events().log.status, 'ok');
  await h.loaded.plugin.onUnload();
});

test('two records owned by the same instance resolve to the oldest without deleting either', async () => {
  const own = (id, createdAt) => ({id, model: 'Mahlkönig E64 WS', archived: false, createdAt,
    extras: {source: 'mahlkoenig-e64.reaplugin', instanceId: 'one', deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:one', lastSeenAt: new Date().toISOString()}});
  const run = await inventoryRun({decaid: decaidApi({grinders: [own('newer', '2026-11-23T10:00:00Z'), own('older', '2026-11-20T10:00:00Z')]})});
  assert.deepEqual([run.inventory.grinderId, run.inventory.duplicates, run.decaid.grinders.length], ['older', 1, 2]);
  assert.deepEqual(run.writes.map((call) => call.path), ['/api/v1/workflow']);
});

async function workflowHarness({workflow = {context: {targetYield: 36, extras: {dialin: {plan: 'keep'}}}, profile: {title: 'P'}}, grinders = [], shots = {}, extra = {}, grinderFetch = null} = {}) {
  let now = Date.parse('2026-11-23T12:00:00Z');
  class FakeDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const pending = new Map(); let nextTimer = 0;
  const timers = {setTimeout: (callback, delay) => {const id = ++nextTimer; pending.set(id, {callback, delay, at: now + delay}); return id;}, clearTimeout: id => pending.delete(id), Date: FakeDate};
  const decaid = decaidApi({workflow, grinders, shots});
  const fixture = {sent: [], events: []};
  const loaded = await load({InstancesJson: one('127.0.0.1', {pollMs: 100}), TokensJson: JSON.stringify({one: {host: '127.0.0.1', token: 't'}}), PopulateGrinderRecord: 'true', ...extra}, fixture, timers,
    grinderFetch ? ((base) => (url, init) => grinderFetch(url, init) || base(url, init))(hostFetch([], decaid)) : hostFetch([], decaid));
  const answeredIds = new Set();
  let dd = 819, grindState = 'Idle';
  const respond = () => {
    fixture.sent.forEach((message, index) => {
      if (answeredIds.has(message.msgId)) return;
      answeredIds.add(message.msgId);
      answer(fixture, index, message.type === 'RequestNachineInfo' ? {grinderType: 'E64 WS'} : {grindState, ddValueDum: dd, ddSensorFailed: false, grindTargetWeightGr: 18, grindResultWeightGr: 18.1, grindStartWeightGr: 487.04, motorRunTimeMs: 8300});
    });
  };
  const settle = async () => { for (let i = 0; i < 12; i++) { await new Promise(resolve => setImmediate(resolve)); respond(); } };
  const advance = async (ms) => {
    const end = now + ms;
    while (true) {
      const next = [...pending.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = Math.max(now, next[1].at); pending.delete(next[0]); next[1].callback(); await settle();
    }
    now = end; await settle();
  };
  const connected = loaded.registrations[0].handlers.connect({transport: transport(fixture), publish: async () => {}, reportDisconnected: async () => {}});
  await settle(); await connected; await settle();
  return {decaid, loaded, advance, setDial: (value) => { dd = value; }, setGrind: (value) => { grindState = value; },
    context: () => decaid.workflow.context, writes: () => decaid.workflowWrites || 0};
}

test('the active workflow carries this grinder, debounced and only on change', async () => {
  const h = await workflowHarness();
  await h.advance(3500);
  const record = h.decaid.grinders[0];
  assert.deepEqual(h.context(), {targetYield: 36, extras: {dialin: {plan: 'keep'}}, grinderId: record.id, grinderModel: 'Mahlkönig E64 WS',
    grinderBurrs: '64 mm flat (stock)', grinderSetting: '82'});
  assert.deepEqual(h.decaid.workflow.profile, {title: 'P'});
  assert.equal(h.writes(), 1, 'link, model, burrs and setting in one write');
  for (const value of [826, 831, 836]) { h.setDial(value); await h.advance(1000); }
  assert.equal(h.writes(), 1, 'a moving dial is not written');
  await h.advance(4000);
  assert.deepEqual([h.context().grinderSetting, h.writes()], ['84', 2]);
  await h.advance(60000);
  assert.equal(h.writes(), 2, 'nothing changed, nothing written');
  h.context().grinderSetting = '84';
  record.model = 'My E64'; record.burrs = 'SSP HU 64';
  h.setDial(845); await h.advance(5000);
  assert.deepEqual([h.context().grinderModel, h.context().grinderBurrs, h.context().grinderSetting], ['My E64', 'SSP HU 64', '85'], 'record edits win');
  await h.loaded.plugin.onUnload();
});

test('workflow writes wait for the machine and respect a user-set grinder setting', async () => {
  const h = await workflowHarness();
  await h.advance(3500);
  const writes = h.writes();
  h.loaded.plugin.onEvent({name: 'stateUpdate', payload: {state: {state: 'espresso', substate: 'pouring'}}});
  h.setDial(900); await h.advance(10000);
  assert.equal(h.writes(), writes, 'no writes during a shot');
  h.loaded.plugin.onEvent({name: 'stateUpdate', payload: {state: {state: 'idle', substate: 'idle'}}});
  await h.advance(4000);
  assert.deepEqual([h.context().grinderSetting, h.writes()], ['90', writes + 1]);

  h.context().grinderSetting = '75'; // planned by the user (or another plugin)
  h.setGrind('Grind'); await h.advance(200); h.setGrind('Idle'); await h.advance(4000);
  assert.equal(h.context().grinderSetting, '75', 'a planned value is kept while the dial has not moved');
  assert.deepEqual(Object.keys(h.context().extras).sort(), ['dialin', 'mahlkoenig-e64.reaplugin']);
  assert.deepEqual(h.context().extras.dialin, {plan: 'keep'});
  const meta = h.context().extras['mahlkoenig-e64.reaplugin'];
  assert.deepEqual({...meta, lastGrind: {...meta.lastGrind, completedAt: typeof meta.lastGrind.completedAt}}, {ddValueDum: 900, displayedSetting: '90', unit: 'µm',
    lastGrind: {completedAt: 'string', targetWeightGr: 18, resultWeightGr: 18.1, motorRunTimeMs: 8300, mode: null}}, 'mode only when the grind states show it');
  h.setDial(755); await h.advance(4000);
  assert.equal(h.context().grinderSetting, '76', 'the dial moved after the user choice');
  h.context().grinderSetting = '70';
  h.setGrind('Grind'); await h.advance(200); h.setGrind('Idle'); await h.advance(4000);
  assert.equal(h.context().grinderSetting, '70');
  await h.advance(11 * 60000);
  h.setGrind('Grind'); await h.advance(200); h.setGrind('Idle'); await h.advance(4000);
  assert.equal(h.context().grinderSetting, '76', 'after 10 minutes the grinder reading wins again');
  await h.loaded.plugin.onUnload();
});

test('RecordGrindDose sets the target dose and stores the ground weight and grind details on the shot', async () => {
  const shots = {};
  const shot = (id, grinderId) => ({id, timestamp: '2026-11-23T13:00:00', workflow: {context: {grinderId, targetDoseWeight: 18}},
    annotations: {actualDoseWeight: 18, actualYield: 36, extras: {other: {keep: true}}}});
  const h = await workflowHarness({extra: {RecordGrindDose: 'true'}, shots, workflow: {context: {targetDoseWeight: 20, targetYield: 40}}});
  await h.advance(3500);
  h.setGrind('GbwPostGrind'); await h.advance(200); h.setGrind('Idle'); await h.advance(4000);
  assert.deepEqual([h.context().targetDoseWeight, h.context().targetYield], [18, 40], 'the grinder target is the dose; the yield stays');
  h.context().targetDoseWeight = 19;
  h.setDial(830); await h.advance(5000);
  assert.equal(h.context().targetDoseWeight, 19, 'only a new grind writes the dose');

  h.loaded.plugin.onEvent({name: 'stateUpdate', payload: {state: {state: 'espresso', substate: 'preinfusion'}}});
  await h.advance(30000);
  h.loaded.plugin.onEvent({name: 'stateUpdate', payload: {state: {state: 'idle', substate: 'idle'}}});
  shots.s1 = shot('s1', h.decaid.grinders[0].id);
  h.loaded.plugin.onEvent({name: 'shotStored', payload: {id: 's1'}});
  await h.advance(10);
  const {annotations} = shots.s1;
  assert.equal(annotations.actualDoseWeight, 18.1);
  assert.equal(annotations.actualYield, 36);
  assert.deepEqual(annotations.extras.other, {keep: true});
  const grind = annotations.extras['mahlkoenig-e64.reaplugin'].grind;
  assert.deepEqual({...grind, completedAt: typeof grind.completedAt}, {completedAt: 'string', secondsBeforeShot: 9, mode: 'GbW', targetWeightGr: 18, resultWeightGr: 18.1,
    deviationGr: 0.1, overshootWeightGr: null, motorRunTimeMs: 8300, setting: '82', grindUuid: null, grindDurationMs: null, successful: null,
    trigger: null, portafilterRecognized: null, portafilterWeightGr: 487, recipe: null});

  shots.s2 = shot('s2', 'other-grinder');
  h.loaded.plugin.onEvent({name: 'shotStored', payload: {id: 's2'}});
  await h.advance(10);
  assert.equal(shots.s2.annotations.actualDoseWeight, 18, 'a shot with another grinder is left alone');
  await h.loaded.plugin.onUnload();

  const off = await workflowHarness({shots: {s1: shot('s1', null)}, workflow: {context: {targetDoseWeight: 20}}});
  await off.advance(3500);
  off.setGrind('GbwPostGrind'); await off.advance(200); off.setGrind('Idle'); await off.advance(4000);
  off.loaded.plugin.onEvent({name: 'shotStored', payload: {id: 's1'}});
  await off.advance(10);
  assert.equal(off.context().targetDoseWeight, 20, 'off by default');
  assert.equal(off.decaid.calls.some((call) => call.method === 'PUT' && call.path.startsWith('/api/v1/shots/')), false);
  await off.loaded.plugin.onUnload();
});

test('a grinder log that arrives after the shot adds the trigger, the recipe and whether the grinder applied it', async () => {
  const header = grindHeader + ',grind_trigger,recipe_icon,recipe_gbs_enabled';
  const stamp = stampAt(Date.parse('2026-11-23T12:00:30Z'));
  const rowA = `1,uuid-a,${stamp},819,8000,18050,1,1,r1,GbW,18000,Espresso,0,27000,36000,StartButton,Cup,0`;
  const rowB = `2,uuid-b,${stamp},830,8300,18100,1,2,r2,GbW,18000,"Espresso, double",830,27000,36000,PortafilterDetection,Double,1`;
  let rows = [rowA];
  let downloads = 0;
  const grinderFetch = (url) => {
    if (url.endsWith('/login')) return Promise.resolve({ok: true, status: 200, headers: {get: (name) => name === 'authorization' ? 'Bearer t1' : 'PHPSESSID=abc; path=/'}, text: async () => ''});
    if (url.endsWith('/download_machine_logs')) {
      downloads++;
      const zip = zipOf([{name: 'HemroE64WSGrindLogs_SN1_x.csv', data: [header, ...rows].join('\n'), method: 8}]);
      return Promise.resolve({ok: true, status: 200, headers: {get: () => null}, base64: async () => zip.toString('base64')});
    }
    return null;
  };
  const shots = {};
  const h = await workflowHarness({shots, grinderFetch,
    extra: {RecordGrindDose: 'true', MintTokens: 'true', PasswordsJson: JSON.stringify({one: {host: '127.0.0.1', password: 'pw'}})}});
  await h.advance(3500);
  h.setGrind('GbwPostGrind'); await h.advance(200); h.setGrind('Idle'); await h.advance(4000);
  assert.equal(downloads, 1, 'the first grind reads the log at once');
  h.setDial(830); await h.advance(4000);
  rows = [rowB, rowA];
  h.setGrind('GbwPostGrind'); await h.advance(200); h.setGrind('Idle'); await h.advance(4000);
  assert.equal(downloads, 1, 'a second grind within 10 minutes waits for the next read');

  h.loaded.plugin.onEvent({name: 'stateUpdate', payload: {state: {state: 'espresso', substate: 'preinfusion'}}});
  await h.advance(30000);
  h.loaded.plugin.onEvent({name: 'stateUpdate', payload: {state: {state: 'idle', substate: 'idle'}}});
  shots.s1 = {id: 's1', timestamp: '2026-11-23T13:00:00', workflow: {context: {grinderId: h.decaid.grinders[0].id}}, annotations: {actualDoseWeight: 18}};
  h.loaded.plugin.onEvent({name: 'shotStored', payload: {id: 's1'}});
  await h.advance(10);
  const before = shots.s1.annotations.extras['mahlkoenig-e64.reaplugin'].grind;
  assert.deepEqual([before.grindUuid, before.trigger, before.portafilterRecognized, before.recipe], [null, null, null, null]);
  shots.s1.annotations.actualDoseWeight = 18.3; // the user corrects the dose meanwhile

  await h.advance(10 * 60000);
  assert.equal(downloads, 2);
  const grind = shots.s1.annotations.extras['mahlkoenig-e64.reaplugin'].grind;
  assert.equal(shots.s1.annotations.actualDoseWeight, 18.3, 'the late update leaves the dose alone');
  assert.deepEqual([grind.grindUuid, grind.trigger, grind.portafilterRecognized, grind.successful, grind.grindDurationMs], ['uuid-b', 'PortafilterDetection', true, true, 8300]);
  assert.deepEqual(grind.recipe, {index: 2, uuid: 'r2', mode: 'GbW', type: 'Espresso, double', amountGr: 18, setting: '83', brewTimeMs: 27000, brewWeightGr: 36,
    icon: 'Double', gbsEnabled: true, doseApplied: true, settingApplied: true});
  await h.loaded.plugin.onUnload();
});

test('another grinder in the workflow is left alone and the same value is never rewritten', async () => {
  const other = await workflowHarness({workflow: {context: {grinderId: 'other', grinderModel: 'Niche'}}});
  other.setDial(830); await other.advance(10000);
  assert.deepEqual([other.writes(), other.context()], [0, {grinderId: 'other', grinderModel: 'Niche'}]);
  await other.loaded.plugin.onUnload();
  const same = await workflowHarness();
  await same.advance(3500);
  const writes = same.writes();
  same.context().grinderSetting = '83'; // Streamline "Follow Grinder" wrote the reading first
  same.setDial(830); await same.advance(5000);
  assert.equal(same.writes(), writes, 'an equal value needs no write');
  await same.loaded.plugin.onUnload();
});

test('missing or invalid configuration loads in needs-setup and serves the setup page', async () => {
  const notices = [], registrations = [];
  const host = {notify: (value) => { notices.push(value); }, dismissNotification: () => {}, devices: {register(definition) { registrations.push(definition); return Promise.resolve({deviceId: 'x'}); }}};
  const sandbox = {setTimeout, clearTimeout, Promise, Map, Set, JSON, Object, Number, Array, Error, encodeURIComponent, btoa: globalThis.btoa};
  vm.runInNewContext(`globalThis.createPlugin = (${source}\n);`, sandbox);
  const plugin = sandbox.createPlugin(host);
  await plugin.onLoad({InstancesJson: one('8.8.8.8'), TokensJson: '{}', PasswordsJson: JSON.stringify({one: {host: '8.8.8.8', password: 'top-secret'}})});
  assert.deepEqual(registrations, []);
  assert.match(notices[0].message, /^Mahlkönig E64 needs setup: instance host must be .* Set up\.$/);
  const status = JSON.parse(plugin.handleHttpRequest({endpoint: 'setup', method: 'GET', query: {status: '1'}}).body);
  assert.deepEqual([status.needsSetup, status.instances], [true, []]);
  for (const response of [plugin.handleHttpRequest({endpoint: 'setup', method: 'GET', query: {}}), plugin.handleHttpRequest({endpoint: 'ui', method: 'GET', query: {view: 'setup'}})]) {
    assert.equal(response.status, 200);
    assert.match(response.headers['Content-Type'], /^text\/html/);
    assert.match(response.body, /class="pu"/);
    assert.ok(response.body.includes('data-pu-step') && response.body.includes('--pu-tap'));
    assert.equal(response.body.includes('top-secret'), false);
    assert.equal(/UNION SELECT|no-password|AllowNoPasswordWorkaround/i.test(response.body), false, 'the workaround is not offered');
  }
  const check = await plugin.handleHttpRequest({endpoint: 'setup', method: 'POST', query: {}, body: {action: 'check', settings: {InstancesJson: one('192.168.1.40'), TokensJson: '{}', MintTokens: 'true'}}});
  assert.match(JSON.parse(check.body).errors[0], /MintTokens needs a password/);
  const bad = await plugin.handleHttpRequest({endpoint: 'setup', method: 'POST', query: {}, body: {action: 'probe-cert', host: 'example.com'}});
  assert.equal(bad.status, 400);
});

test('setup probes the certificate and tests the login without storing anything', async () => {
  let now = 1_000_000, presented = '91b412ee014f21c3bb2445430b6a3d77903334a1300ad84f1980ab2c5f53620b';
  class FakeDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({url, init});
    if (init.tlsPinSha256 !== presented) throw new Error('HandshakeException');
    if (url.endsWith('/ping')) return {ok: true, status: 200, headers: {get: () => null}, text: async () => 'expired'};
    const ok = JSON.parse(init.body).password === 'right';
    return {ok, status: ok ? 200 : 400, headers: {get: (name) => ok && name === 'authorization' ? 'Bearer t' : null}, text: async () => ''};
  };
  const loaded = await load({}, {sent: [], events: []}, {Date: FakeDate}, fetchImpl);
  const post = async (body) => { const r = await loaded.plugin.handleHttpRequest({endpoint: 'setup', method: 'POST', query: {}, body}); return [r.status, JSON.parse(r.body)]; };
  assert.deepEqual(await post({action: 'probe-cert', host: '192.168.1.40'}), [200, {recognised: true, certSha256: presented}]);
  assert.deepEqual(calls[0].url, 'https://192.168.1.40/rest_api/ping');
  presented = 'ab'.repeat(32);
  assert.deepEqual(await post({action: 'probe-cert', host: '192.168.1.40', restPort: 8443}), [200, {recognised: false}]);
  const login = (password) => post({action: 'test-login', host: '192.168.1.40', certSha256: presented, password});
  assert.equal((await login('wrong'))[1].result, 'wrong-password');
  assert.deepEqual((await login('right'))[0], 429, 'one attempt every 3 s');
  now += 3000;
  assert.equal((await login('right'))[1].result, 'accepted');
  now += 3000;
  assert.equal((await post({action: 'test-login', host: '192.168.1.40', certSha256: 'cd'.repeat(32), password: 'right'}))[1].result, 'unreachable');
  assert.equal(JSON.stringify(calls.map((call) => call.init.body)).includes('right') && JSON.stringify(loaded.plugin.handleHttpRequest({endpoint: 'setup', method: 'GET', query: {status: '1'}}).body).includes('right'), false);
  await loaded.plugin.onUnload();
});

test('the manifest hides the raw settings and declares the setup surface', async () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  for (const key of ['InstancesJson', 'TokensJson', 'PasswordsJson', 'MintTokens', 'AllowNoPasswordWorkaround']) assert.equal(manifest.settings[key].hidden, true, key);
  assert.deepEqual(manifest.surfaces.map((surface) => [surface.role, surface.endpoint]), [['setup', 'setup'], ['diagnostics', 'e64-diagnostics']]);
  assert.ok(manifest.api.some((api) => api.id === 'setup') && manifest.api.some((api) => api.id === 'ui'));
  assert.equal(manifest.settings.AdjustmentOwner.valueLabels.grinder, 'Let the grinder adjust itself');
  assert.equal(manifest.drivers.some((driver) => (driver.surfaces || []).some((surface) => surface.role === 'setup')), false, 'stock hosts reject a setup driver surface');
});

// The host contract this plugin ships against (decaid
// lib/src/plugins/plugin_loader_service.dart and lib/src/settings/
// plugins_settings_view.dart at the host commit CI pins): savePluginSettings
// throws for a key the manifest does not declare, refuses an enum value outside
// `values`, keeps `secure` keys in the secret store instead of the ordinary
// preferences, and hands every stored key back on load. The settings dialog
// maps every declared entry into one flat form, so a declaration is all a field
// needs to reach the user: a key the manifest omits cannot be supplied from an
// install, however correct the service code is.
function hostSave(manifest, patch) {
  for (const [key, value] of Object.entries(patch)) {
    const schema = manifest.settings[key];
    assert.ok(schema, `the host rejects the undeclared setting ${key}`);
    if (schema.type === 'enum') assert.ok(schema.values.includes(value), `${key} must be one of ${schema.values.join(', ')}`);
  }
  const secure = {}, ordinary = {};
  for (const [key, value] of Object.entries(patch)) (manifest.settings[key].secure === true ? secure : ordinary)[key] = value;
  return {ordinary, secure, load: () => ({...ordinary, ...secure})};
}

test('the manifest declares the Local API settings the plugin reads', async () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  const settings = manifest.settings;
  const read = new Set([...source.matchAll(/jsonSetting\(settings, "([A-Za-z]+)"/g)].map((match) => match[1]));
  read.add('AdjustmentOwner');
  for (const key of ['UseLocalApi', 'ApiTokensJson']) assert.ok(read.has(key), `the service reads ${key}`);
  for (const key of read) assert.ok(settings[key], `${key} is declared in the manifest, so the host can save it`);
  assert.deepEqual([settings.UseLocalApi.type, settings.UseLocalApi.values, settings.UseLocalApi.default], ['enum', ['false', 'true'], 'false']);
  assert.deepEqual([settings.ApiTokensJson.type, settings.ApiTokensJson.secure === true, settings.ApiTokensJson.default], ['string', true, '{}']);
  const saved = hostSave(manifest, {UseLocalApi: 'true', ApiTokensJson: '{"one":{"host":"127.0.0.1","token":"synthetic"}}'});
  assert.deepEqual(Object.keys(saved.secure), ['ApiTokensJson'], 'the token list is a secret, not a plain setting');
  assert.deepEqual(Object.keys(saved.ordinary), ['UseLocalApi'], 'the enable flag is not secret material');
});

test('the declared keys enable the Local API and their declared defaults leave it off', async () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  const token = 'synthetic-local-api-token';
  const tokenList = JSON.stringify({one: {host: '127.0.0.1', token}});
  const zip = zipOf([{name: 'HemroE64WSServiceLogs_SN1_x.csv', data: [serviceHeader, '1,1,PowerOn,2026-11-23 11:00:00,Firmware started'].join('\n'), method: 8}]);
  const on = await logHarness({zip, extraSettings: hostSave(manifest, {UseLocalApi: 'true', ApiTokensJson: tokenList}).load()});
  await on.connect();
  await on.grind();
  assert.equal(on.localCalls('grind_log').length, 1, 'the declared flag and token reach the service');
  assert.equal(on.localCalls('service_log').length, 1);
  assert.deepEqual([on.events().log.status, on.downloads()], ['ok', 0], 'the Local API answered, so the vendor ZIP is not needed');
  await on.loaded.plugin.onUnload();
  const off = await logHarness({zip, extraSettings: hostSave(manifest, {UseLocalApi: manifest.settings.UseLocalApi.default, ApiTokensJson: tokenList}).load()});
  await off.connect();
  await off.grind();
  assert.deepEqual([off.localCalls('grind_log').length, off.downloads()], [0, 1], 'the declared default keeps the vendor ZIP path');
  await off.loaded.plugin.onUnload();
});

test('a token supplied through the declared secure field reaches the Local API client', async () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  const token = 'synthetic-owner-token-2f8c41';
  const saved = hostSave(manifest, {UseLocalApi: 'true', ApiTokensJson: JSON.stringify({one: {host: '127.0.0.1', token}})});
  const h = await logHarness({zip: Buffer.alloc(0), extraSettings: saved.load()});
  await h.connect();
  await h.grind();
  const [grindCall] = h.localCalls('grind_log');
  const [serviceCall] = h.localCalls('service_log');
  assert.deepEqual([grindCall.init.headers['X-E64-Local-Token'], serviceCall.init.headers['X-E64-Local-Token']], [token, token]);
  assert.equal([grindCall.url, serviceCall.url].some((url) => url.includes(token)), false, 'the token travels in the header, never the URL');
  const query = {deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:one'};
  const surfaces = [h.loaded.plugin.handleHttpRequest({endpoint: 'setup', method: 'GET', query: {status: '1'}}),
    h.loaded.plugin.handleHttpRequest({endpoint: 'ui', method: 'GET', query: {...query, ui: '1'}}),
    h.loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query}),
    h.loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {...query, ui: '1'}}),
    h.loaded.plugin.handleHttpRequest({endpoint: 'grind-events', method: 'GET', query}), h.service(), h.events()];
  for (const surface of surfaces) assert.equal(JSON.stringify(surface).includes(token), false, 'no surface echoes the token');
  assert.equal(JSON.stringify(h.events().log).includes(token), false, 'the log reports a category, not the token');
  await h.loaded.plugin.onUnload();
});

test('diagnostics render as an HTML page for ui=1 and stay JSON otherwise', async () => {
  const fixture = {sent: [], events: []};
  const loaded = await load({InstancesJson: one('127.0.0.1', {pollMs: 0}), TokensJson: JSON.stringify({one: {host: '127.0.0.1', token: 'secret-token'}})}, fixture);
  const query = {deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:one'};
  const html = await loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {...query, ui: '1'}});
  assert.match(html.headers['Content-Type'], /^text\/html/);
  assert.ok(html.body.includes('<h1>One</h1>') && html.body.includes('class="pu"'));
  assert.equal(html.body.includes('secret-token'), false);
  const json = await loaded.plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query});
  assert.equal(json.headers['Content-Type'], 'application/json');
  await loaded.plugin.onUnload();
});

test('grinder extras writes keep a concurrent dial-in key and retry a clobbered write', async () => {
  const dialin = {model: 'stats', samples: 12};
  const stale = () => ({id: 'mine', model: 'Mahlkönig E64 WS', archived: false, createdAt: '2026-11-20T10:00:00Z',
    extras: {source: 'mahlkoenig-e64.reaplugin', instanceId: 'one', deviceId: 'old-device', lastSeenAt: '2020-01-01T00:00:00.000Z'}});
  // Dial-in writes its key after E64 listed the grinders but before E64's PUT.
  const racing = decaidApi({grinders: [stale()]});
  const handle = racing.handle;
  racing.handle = (method, path, body) => {
    const result = handle(method, path, body);
    const copy = {status: result.status, value: JSON.parse(JSON.stringify(result.value))};
    if (method === 'GET' && path.startsWith('/api/v1/grinders?')) racing.grinders[0].extras['assisted-dialin.reaplugin'] = dialin;
    return copy;
  };
  const kept = await inventoryRun({decaid: racing});
  assert.deepEqual(racing.grinders[0].extras['assisted-dialin.reaplugin'], dialin);
  assert.equal(racing.grinders[0].extras.deviceId, 'plugin:mahlkoenig-e64.reaplugin:e64:one');
  assert.equal(kept.inventory.status, 'linked');
  const put = racing.calls.find((call) => call.method === 'PUT' && call.path === '/api/v1/grinders/mine');
  const order = racing.calls.map((call) => `${call.method} ${call.path}`);
  assert.equal(order[order.indexOf('PUT /api/v1/grinders/mine') - 1], 'GET /api/v1/grinders/mine', 'a fresh read right before the PUT');
  assert.deepEqual(Object.keys(put.body), ['extras']);

  // Another writer replaces extras wholesale right after E64's first PUT: E64 notices and writes again.
  const clobbered = decaidApi({grinders: [stale()]});
  const inner = clobbered.handle;
  let puts = 0;
  clobbered.handle = (method, path, body) => {
    const result = inner(method, path, body);
    if (method === 'PUT' && path === '/api/v1/grinders/mine' && ++puts === 1) clobbered.grinders[0].extras = {'assisted-dialin.reaplugin': dialin};
    return result;
  };
  const retried = await inventoryRun({decaid: clobbered});
  assert.equal(puts, 2);
  assert.deepEqual(clobbered.grinders[0].extras['assisted-dialin.reaplugin'], dialin);
  assert.equal(clobbered.grinders[0].extras.source, 'mahlkoenig-e64.reaplugin');
  assert.equal(retried.inventory.status, 'linked');

  // A writer that always wins: three attempts, then an error, and the other key is still there.
  const hostile = decaidApi({grinders: [stale()]});
  const base = hostile.handle;
  hostile.handle = (method, path, body) => {
    const result = base(method, path, body);
    if (method === 'PUT' && path === '/api/v1/grinders/mine') hostile.grinders[0].extras = {'assisted-dialin.reaplugin': dialin};
    return result;
  };
  const failed = await inventoryRun({decaid: hostile});
  assert.equal(hostile.calls.filter((call) => call.method === 'PUT').length, 3);
  assert.deepEqual([failed.inventory.status, failed.inventory.lastError], ['error', '/api/v1/grinders write conflict HTTP 409']);
});

test('plugin-level diagnostics without a deviceId default to one instance or offer a picker', async () => {
  const get = (plugin, query) => plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query});
  const single = await load({InstancesJson: one('127.0.0.1', {pollMs: 0}), TokensJson: JSON.stringify({one: {host: '127.0.0.1', token: 't'}})}, {sent: [], events: []});
  const json = await get(single.plugin, {read: 'connection'});
  assert.deepEqual([json.status, JSON.parse(json.body).connected], [200, false]);
  const page = await get(single.plugin, {ui: '1'});
  assert.match(page.headers['Content-Type'], /^text\/html/);
  assert.ok(page.body.includes('<h1>One</h1>'));
  await single.plugin.onUnload();

  const two = JSON.stringify([{id: 'a', name: 'Bar <E64>', host: '127.0.0.1', port: 1, pollMs: 0}, {id: 'b', name: 'Kitchen', host: '127.0.0.1', port: 2, pollMs: 0}]);
  const multi = await load({InstancesJson: two, TokensJson: JSON.stringify({a: {host: '127.0.0.1', token: 'x'}, b: {host: '127.0.0.1', token: 'y'}})}, {sent: [], events: []});
  const list = await get(multi.plugin, {});
  assert.deepEqual([list.status, JSON.parse(list.body)], [400, {error: 'deviceId required', instances: [
    {deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:a', name: 'Bar <E64>'}, {deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:b', name: 'Kitchen'}]}]);
  const picker = await get(multi.plugin, {ui: '1', theme: 'dark', lang: 'de', returnTo: 'javascript:alert(1)'});
  assert.equal(picker.status, 200);
  assert.ok(picker.body.includes('Bar &lt;E64&gt;') && !picker.body.includes('Bar <E64>'));
  assert.ok(picker.body.includes('href="?ui=1&amp;deviceId=plugin%3Amahlkoenig-e64.reaplugin%3Ae64%3Ab&amp;theme=dark&amp;lang=de"'));
  assert.equal(picker.body.includes('javascript:'), false);
  assert.equal((await get(multi.plugin, {deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:b'})).status, 200);
  assert.equal((await get(multi.plugin, {deviceId: 'nope'})).status, 404);
  await multi.plugin.onUnload();

  const empty = await load({}, {sent: [], events: []});
  const none = await get(empty.plugin, {ui: '1'});
  assert.ok(none.body.includes('No grinder is set up yet.') && none.body.includes('href="setup?"'));
  assert.equal((await get(empty.plugin, {})).status, 404);
  await empty.plugin.onUnload();
});
