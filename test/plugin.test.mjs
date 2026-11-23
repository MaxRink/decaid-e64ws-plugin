import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../plugin.js', import.meta.url), 'utf8');
function load(settings, fixture, timers = {}, fetchImpl = null) {
  const registrations = [];
  const host = {devices: {register(definition, handlers) { registrations.push({definition, handlers}); return Promise.resolve({deviceId: `plugin:mahlkoenig-e64.reaplugin:e64:${definition.instanceId}`}); }}};
  const sandbox = {setTimeout, clearTimeout, Promise, Map, Set, JSON, Object, Number, Array, Error, encodeURIComponent, btoa: globalThis.btoa, ...(fetchImpl ? {fetch: fetchImpl} : {}), ...timers};
  vm.runInNewContext(`globalThis.createPlugin = (${source}\n);`, sandbox);
  const plugin = sandbox.createPlugin(host);
  return plugin.onLoad(settings).then(() => ({plugin, registrations}));
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
  assert.deepEqual(manifest.permissions, ['api', 'network.websocket', 'events.machine', 'notifications']);
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
