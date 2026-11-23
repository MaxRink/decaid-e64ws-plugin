// End-to-end tests against the E64 WS simulator from the private research
// repository (E64_SIM_ROOT, default ../mahlkoenig-e64ws-local-research).
// They fail when the simulator is missing unless E64_SIM_OPTIONAL=1.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {control, decaidApi, freePort, loadPlugin, makeCert, replayTrace, requireSim, startSim, until} from './support/sim-host.mjs';

const instance = (sim, extra = {}) => JSON.stringify([{id: 'sim', name: 'Sim E64', host: '127.0.0.1', port: sim.port, pollMs: 100, ...extra}]);
const token = (value) => JSON.stringify({sim: {host: '127.0.0.1', token: value}});
const password = (value) => JSON.stringify({sim: {host: '127.0.0.1', password: value}});
const last = (session) => session.published.at(-1);

async function withSim(t, options, body, ...needs) {
  if (!requireSim(t, ...needs)) return;
  const sim = await startSim(options);
  let loaded;
  try { await body(sim, (value) => { loaded = value; return value; }); } finally {
    if (loaded) await loaded.plugin.onUnload();
    await sim.stop();
  }
}

test('static token over ws publishes state and DD observations driven by the simulator', (t) => withSim(t, {}, async (sim, keep) => {
  const {session} = keep(await loadPlugin({InstancesJson: instance(sim, {scheme: 'ws'}), TokensJson: token(sim.token)}));
  await session.connect();
  assert.deepEqual(last(session), {state: 'idle', observedSetting: '500'});
  await control(sim, '/sim/action', {suffix: 'SetAgsaTargetDdValue', data: {targetDdValue: 4325}});
  await until(() => last(session).observedSetting === '433', 'DD 4325 shown as 433');
  assert.equal((await session.diagnostics()).body.state.ddValueDum, 4325, 'raw coordinate stays in diagnostics');
  await control(sim, '/sim/action', {suffix: 'StartGrindManual', data: {}});
  await until(() => last(session).state === 'grinding', 'grinding');
  await control(sim, '/sim/action', {suffix: 'Stop', data: {}});
  await until(() => last(session).state === 'idle', 'idle after Stop');
}));

test('a wrong static token is refused by the simulator', (t) => withSim(t, {}, async (sim, keep) => {
  const {session} = keep(await loadPlugin({InstancesJson: instance(sim, {scheme: 'ws'}), TokensJson: token('not-the-sim-token')}));
  await assert.rejects(session.connect(), /E64 connection failed/);
  assert.equal(session.published.length, 0);
}));

test('diagnostics allowlist drops simulator session, clock and model fields', (t) => withSim(t, {}, async (sim, keep) => {
  const {session} = keep(await loadPlugin({InstancesJson: instance(sim, {scheme: 'ws', pollMs: 0}), TokensJson: token(sim.token)}));
  await session.connect();
  const known = await session.diagnostics();
  assert.equal(known.status, 200);
  assert.equal(known.body.state.ddValueDum, 5000);
  for (const field of ['sessionId', 'hmiTime', 'language', 'simulator', 'agsaHallSensorCounts']) assert.equal(Object.hasOwn(known.body.state, field), false, field);
  for (const [read, expected] of [['config', {}], ['machineInfo', {grinderType: 'Unknown'}]]) {
    const live = await session.diagnostics(read);
    assert.equal(live.status, 200);
    assert.equal(live.headers['X-E64-Observation-State'], 'live');
    assert.deepEqual(live.body, expected, `${read} keeps only allowlisted simulator fields`);
  }
  assert.equal((await session.diagnostics('logs')).status, 400);
}));

test('password minting over pinned https and wss', (t) => {
  const cert = makeCert();
  return withSim(t, {tlsCert: cert, httpsCert: cert}, async (sim, keep) => {
    const fetchLog = [], openLog = [], notices = [];
    const {session} = keep(await loadPlugin({InstancesJson: instance(sim, {restPort: sim.httpPort, certSha256: cert.sha256}), TokensJson: '{}',
      MintTokens: 'true', PasswordsJson: password('sim-password')}, {fetchLog, openLog, notices}));
    await session.connect();
    assert.deepEqual(last(session), {state: 'idle', observedSetting: '500'});
    assert.equal(fetchLog[0].url, `https://127.0.0.1:${sim.httpPort}/rest_api/login`);
    assert.equal(JSON.parse(fetchLog[0].init.body).userRole, 'Owner');
    assert.equal(fetchLog[0].init.tlsPinSha256, cert.sha256.replace(/:/g, '').toLowerCase());
    assert.match(openLog[0].url, /^wss:\/\//);
    assert.equal(openLog[0].tlsPinSha256, fetchLog[0].init.tlsPinSha256);
    const connection = (await session.diagnostics('connection')).body;
    assert.equal(connection.tokenSource, 'password');
    assert.equal(JSON.stringify(connection).includes('sim-password'), false);
    assert.equal(JSON.stringify(connection).includes(sim.token), false);
    assert.deepEqual(notices.filter(([, value]) => value !== 'setup'), [['dismiss', 'login-sim']]);
  });
});

test('missing or wrong certificate pins fail the login and the wss connection', (t) => {
  const cert = makeCert(), other = makeCert();
  return withSim(t, {tlsCert: cert, httpsCert: cert}, async (sim) => {
    for (const pin of [undefined, other.sha256]) {
      const extra = pin ? {certSha256: pin} : {};
      const minted = await loadPlugin({InstancesJson: instance(sim, {restPort: sim.httpPort, ...extra}), TokensJson: '{}', MintTokens: 'true', PasswordsJson: password('sim-password')});
      await assert.rejects(minted.session.connect(), /login request failed/);
      assert.equal((await minted.session.diagnostics('connection')).body.lastMintError, 'login request failed');
      await minted.plugin.onUnload();
      const fixed = await loadPlugin({InstancesJson: instance(sim, extra), TokensJson: token(sim.token)});
      await assert.rejects(fixed.session.connect(), /CERTIFICATE_VERIFY_FAILED/);
      await fixed.plugin.onUnload();
    }
  });
});

test('the FW-01 no-password workaround mints through the simulator login', (t) => {
  const cert = makeCert();
  return withSim(t, {tlsCert: cert, httpsCert: cert, fw01: true}, async (sim, keep) => {
    const fetchLog = [];
    const {session} = keep(await loadPlugin({InstancesJson: instance(sim, {restPort: sim.httpPort, certSha256: cert.sha256}), TokensJson: '{}',
      MintTokens: 'true', AllowNoPasswordWorkaround: 'true'}, {fetchLog}));
    await session.connect();
    assert.equal(last(session).state, 'idle');
    assert.match(JSON.parse(fetchLog[0].init.body).userRole, /^x" UNION SELECT "1\$1000\$/);
    assert.equal((await session.diagnostics('connection')).body.tokenSource, 'workaround');
  });
});

test('failed logins raise a notice and back off without contacting the simulator', (t) => {
  const cert = makeCert();
  return withSim(t, {tlsCert: cert, httpsCert: cert}, async (sim, keep) => {
    const fetchLog = [], notices = [];
    const {session} = keep(await loadPlugin({InstancesJson: instance(sim, {restPort: sim.httpPort, certSha256: cert.sha256}), TokensJson: '{}',
      MintTokens: 'true', PasswordsJson: password('wrong-password')}, {fetchLog, notices}));
    await assert.rejects(session.connect(), /login HTTP 400/);
    await assert.rejects(session.connect(), /login backoff/);
    assert.equal(fetchLog.length, 1);
    const connection = (await session.diagnostics('connection')).body;
    assert.equal(connection.lastMintError, 'login HTTP 400');
    assert.equal(typeof connection.mintBackoffUntil, 'string');
    const login = notices.filter(([kind]) => kind === 'notify');
    assert.equal(login[0][1].id, 'login-sim');
    assert.equal(login[0][1].message.includes('wrong-password'), false);
  });
});

test('a simulator restart disconnects the session and a reconnect re-mints', (t) => {
  const cert = makeCert();
  return withSim(t, {tlsCert: cert, httpsCert: cert}, async (sim, keep) => {
    const fetchLog = [];
    const {session} = keep(await loadPlugin({InstancesJson: instance(sim, {restPort: sim.httpPort, certSha256: cert.sha256}), TokensJson: '{}',
      MintTokens: 'true', PasswordsJson: password('sim-password')}, {fetchLog}));
    await session.connect();
    await sim.stop();
    await until(() => session.disconnected === 1, 'reportDisconnected');
    assert.equal((await session.diagnostics('connection')).body.connected, false);
    const restarted = await startSim({tlsCert: cert, httpsCert: cert, ports: sim.ports});
    sim.stop = restarted.stop;
    await session.connect();
    assert.equal(fetchLog.filter(({url}) => url.endsWith('/rest_api/login')).length, 2, 'a fresh token is minted for the new session');
    assert.equal((await session.diagnostics('connection')).body.connected, true);
  });
});

test('replays the real 2026-11-19 grind capture through the plugin', (t) => withSim(t, {replay: replayTrace}, async (sim, keep) => {
  const {session} = keep(await loadPlugin({InstancesJson: instance(sim, {scheme: 'ws'}), TokensJson: token(sim.token)}));
  await session.connect();
  assert.deepEqual(last(session), {state: 'idle', observedSetting: '82'});
  for (const [seconds, state] of [[28, 'grinding'], [35, 'unknown'], [38, 'idle']]) {
    await control(sim, '/sim/replay/seek', {t: seconds});
    await until(() => last(session).state === state, `${state} at ${seconds}s`);
    assert.equal(last(session).observedSetting, '82');
  }
  const known = (await session.diagnostics()).body.state;
  assert.equal(known.grindState, 'Idle');
  assert.equal(Object.hasOwn(known, 'sessionId'), false);
  assert.equal(Object.hasOwn(known, 'hmiTime'), false);
}, replayTrace));

test('Xenia routes reach the plugin through tools/xenia_bridge.py', async (t) => {
  const {plugin} = await loadPlugin({InstancesJson: JSON.stringify([{id: 'sim', name: 'Sim E64', host: '127.0.0.1', port: 1, pollMs: 0}]), TokensJson: token('unused')});
  const decaid = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    const url = new URL(req.url, 'http://127.0.0.1');
    const endpoint = url.pathname.split('/').at(-1);
    const result = await plugin.handleHttpRequest({endpoint, method: req.method, query: Object.fromEntries(url.searchParams), body: body ? JSON.parse(body) : null});
    res.writeHead(result.status, result.headers); res.end(result.body);
  });
  await new Promise((resolve) => decaid.listen(0, '127.0.0.1', resolve));
  const bridgePort = await freePort();
  const python = process.env.E64_SIM_PYTHON || 'python3';
  const bridge = spawn(python, [new URL('../tools/xenia_bridge.py', import.meta.url).pathname, '--decaid', `http://127.0.0.1:${decaid.address().port}`,
    '--bind', '127.0.0.1', '--port', String(bridgePort), '--instance', 'sim'], {stdio: 'ignore'});
  t.after(async () => { bridge.kill(); await new Promise((resolve) => decaid.close(resolve)); await plugin.onUnload(); });
  const call = async (method, route, body) => {
    for (let attempt = 0; ; attempt++) {
      try { const response = await fetch(`http://127.0.0.1:${bridgePort}${route}`, {method, headers: {'content-type': 'application/json'}, body: body && JSON.stringify(body)}); return {status: response.status, body: await response.json()}; }
      catch (error) { if (attempt > 200) throw error; await new Promise((resolve) => setTimeout(resolve, 50)); }
    }
  };
  plugin.onEvent({name: 'stateUpdate', payload: {state: {state: 'espresso', substate: 'pouring'}, flow: 2, groupTemperature: 93, targetGroupTemperature: 94}});
  assert.equal((await call('GET', '/api/v2/mako')).body.MA_STATUS, 3);
  assert.equal((await call('GET', '/api/v2/machine')).body.MA_TYPE, 'Xenia');
  assert.deepEqual((await call('POST', '/api/v2/brewratio', {SYNC_BEVERAGE_WEIGHT: '36.4', SYNC_FILTER: 2})).body, {MA_SYNC_BEVERAGE_WEIGHT: 36, MA_SYNC_FILTER: 2});
  assert.equal((await call('POST', '/api/v2/scripts/execute', {ID: 9})).body.started, false);
  assert.equal((await call('POST', '/api/v2/brewratio', {SYNC_BEVERAGE_WEIGHT: null, SYNC_FILTER: 2})).status, 400);
  assert.ok(fs.existsSync(new URL('../tools/xenia_bridge.py', import.meta.url)));
});

const controlSettings = (sim, cert, extra = {}) => ({InstancesJson: instance(sim, {restPort: sim.httpPort, certSha256: cert.sha256}), TokensJson: '{}',
  MintTokens: 'true', PasswordsJson: password('sim-password'), AllowControl: 'true', ...extra});
const shotRecord = (startMs, seconds, grams) => ({id: 'x', timestamp: new Date(startMs).toISOString(), measurements: [
  {machine: {timestamp: new Date(startMs).toISOString()}, scale: {weight: 0}},
  {machine: {timestamp: new Date(startMs + seconds * 1000).toISOString()}, scale: {weight: grams}}]});

test('a locked grinder is probed on a throwaway socket and stays read-only', (t) => {
  const cert = makeCert();
  return withSim(t, {tlsCert: cert, httpsCert: cert, devGate: 'locked'}, async (sim, keep) => {
    const openLog = [];
    const {session} = keep(await loadPlugin(controlSettings(sim, cert, {AdjustmentOwner: 'decaid'}), {openLog}));
    assert.equal(session.driverId, 'e64');
    assert.equal(session.handlers.start, undefined);
    assert.equal(session.handlers.setGrindSetting, undefined);
    assert.equal(openLog.length, 1, 'probe used its own connection');
    await session.connect();
    assert.deepEqual(last(session), {state: 'idle', observedSetting: '500'});
    const control = (await session.diagnostics('control')).body;
    assert.equal(control.debugMode, 'locked');
    assert.equal(typeof control.probedAt, 'string');
    assert.equal((await session.diagnostics('machineInfo')).body.grinderType, 'E64 WS');
  });
});

test('debug mode enables start/stop, grind-setting writes, grind events and backlight sync', (t) => {
  const cert = makeCert();
  return withSim(t, {tlsCert: cert, httpsCert: cert, devGate: 'open'}, async (sim, keep) => {
    const notices = [];
    const loaded = keep(await loadPlugin(controlSettings(sim, cert, {AdjustmentOwner: 'decaid', SyncBacklight: 'true'}), {notices}));
    const {session, plugin} = loaded;
    assert.equal(session.driverId, 'e64-control');
    await session.connect();
    assert.equal((await session.diagnostics('control')).body.debugMode, 'available');
    assert.equal((await session.diagnostics('machineInfo')).body.grinderType, 'Unknown', 'development image side effect');
    await session.handlers.setGrindSetting('505');
    await until(() => last(session).observedSetting === '505', 'AGSA move to 505');
    assert.equal((await session.diagnostics()).body.state.ddValueDum, 5050);
    await assert.rejects(session.handlers.setGrindSetting('520'), /within 10/);
    await assert.rejects(session.handlers.setGrindSetting('5o5'), /whole micrometres/);
    await session.handlers.start();
    await until(() => last(session).state === 'grinding', 'grinding after start');
    await session.handlers.stop();
    await until(() => last(session).state === 'idle', 'idle after stop');
    const events = (await session.diagnostics('grind-events')).body.events;
    assert.equal(events.length, 1);
    assert.equal(events[0].setting, '505');
    assert.equal(events[0].targetWeightGr, 18);
    plugin.onEvent({name: 'stateUpdate', payload: {state: {state: 'idle', substate: 'idle'}}});
    plugin.onEvent({name: 'stateUpdate', payload: {state: {state: 'sleeping', substate: 'idle'}}});
    await until(async () => (await control(sim, '/sim/state')).events.some((e) => e.event === 'backlight' && e.brightness === 0), 'backlight off');
    plugin.onEvent({name: 'stateUpdate', payload: {state: {state: 'idle', substate: 'idle'}}});
    await until(async () => (await control(sim, '/sim/state')).events.filter((e) => e.event === 'backlight').at(-1)?.brightness === 100, 'backlight restored');
    const actions = (await control(sim, '/sim/state')).events.map((e) => e.event);
    assert.equal(actions.includes('brew_event'), false, 'decaid ownership never sends brew events');
    assert.equal((await session.diagnostics('control')).body.lastAction.ok, true);
    assert.deepEqual(notices.filter(([, value]) => value === 'control-sim').at(-1), ['dismiss', 'control-sim']);
    await session.disconnect();
    await assert.rejects(session.handlers.stop(), /Stop failed/);
    const notice = notices.filter(([kind]) => kind === 'notify').at(-1)[1];
    assert.equal(notice.id, 'control-sim');
    assert.match(notice.message, /^E64 Sim E64: Stop failed: /);
  });
});

test('grinder ownership links shots to grinds and applies the brew-event gates', (t) => {
  const cert = makeCert();
  return withSim(t, {tlsCert: cert, httpsCert: cert, devGate: 'open'}, async (sim, keep) => {
    const shots = {};
    const loaded = keep(await loadPlugin(controlSettings(sim, cert, {AdjustmentOwner: 'grinder'}), {shots}));
    const {session, plugin} = loaded;
    await session.connect();
    await assert.rejects(session.handlers.setGrindSetting('501'), /AdjustmentOwner decaid/);
    const brew = async (id, record) => {
      shots[id] = record;
      plugin.onEvent({name: 'shotStored', payload: {id}});
      await until(async () => (await session.diagnostics('control')).body.lastBrewEvent?.shotId === id, 'brew event ' + id);
      return (await session.diagnostics('control')).body.lastBrewEvent;
    };
    assert.equal((await brew('before-grind', shotRecord(Date.now(), 30, 36))).reason, 'no successful grind within 5 min before the shot');
    await session.handlers.start();
    await until(() => last(session).state === 'grinding', 'grinding');
    await session.handlers.stop();
    await until(() => last(session).state === 'idle', 'idle');
    await until(async () => (await session.diagnostics('grind-events')).body.events[0]?.grindUuid, 'grind log uuid');
    const [grind] = (await session.diagnostics('grind-events')).body.events;
    assert.deepEqual(grind.recipe, {index: 1, uuid: '00000000-0000-4000-8000-000000000001', mode: 'GbW', type: 'Espresso, double',
      amountGr: 18, setting: '50', brewTimeMs: 27000, brewWeightGr: 36});
    assert.deepEqual([grind.log.setting, grind.log.grindWeightGr, grind.log.successful], ['500', 18, true]);
    assert.equal((await brew('short', shotRecord(Date.now() + 1000, 9, 36))).reason, 'shot not longer than 10 s');
    assert.equal((await brew('stale', shotRecord(Date.now() + 6 * 60000, 28, 36))).reason, 'no successful grind within 5 min before the shot');
    const linked = await brew('linked', shotRecord(Date.now() - 30000, 28, 36.4)); // grind ended 30 s after shot start: clock-skew tolerance
    assert.deepEqual([linked.status, linked.reason], ['sent', null]);
    assert.equal((await session.diagnostics('grind-events')).body.events[0].linkedShotId, 'linked');
    assert.deepEqual((await control(sim, '/sim/state')).lastBrewEvent, {grindUuid: grind.grindUuid, machineName: 'Decent DE1', groupHead: '1',
      doseIndex: 0, validity: true, brewTimeMs: 28000, brewWeightMg: 36400});
    assert.equal((await brew('second', shotRecord(Date.now() + 2000, 28, 36))).reason, 'no successful grind within 5 min before the shot', 'one shot per grind');
  });
});

test('an older host without binary fetch keeps grind events without a uuid', (t) => {
  const cert = makeCert();
  return withSim(t, {tlsCert: cert, httpsCert: cert, devGate: 'open'}, async (sim, keep) => {
    const shots = {};
    const {session, plugin} = keep(await loadPlugin(controlSettings(sim, cert, {AdjustmentOwner: 'grinder'}), {shots, binaryFetch: false}));
    await session.connect();
    await session.handlers.start();
    await until(() => last(session).state === 'grinding', 'grinding');
    await session.handlers.stop();
    await until(async () => (await session.diagnostics('grind-events')).body.log.status === 'unsupported-host', 'feature detection');
    shots.linked = shotRecord(Date.now() + 1000, 28, 36);
    plugin.onEvent({name: 'shotStored', payload: {id: 'linked'}});
    await until(async () => (await session.diagnostics('control')).body.lastBrewEvent?.shotId === 'linked', 'brew event');
    assert.equal((await session.diagnostics('control')).body.lastBrewEvent.reason, 'grind uuid unavailable');
    assert.equal((await control(sim, '/sim/state')).lastBrewEvent, null);
  });
});

test('the replayed real grind is matched to its grind-log row', (t) => {
  const cert = makeCert();
  return withSim(t, {tlsCert: cert, httpsCert: cert, replay: replayTrace}, async (sim, keep) => {
    const {session} = keep(await loadPlugin({InstancesJson: instance(sim, {restPort: sim.httpPort, certSha256: cert.sha256}), TokensJson: '{}',
      MintTokens: 'true', PasswordsJson: password('sim-password')}));
    await session.connect();
    await control(sim, '/sim/replay/seek', {t: 28});
    await until(() => last(session).state === 'grinding', 'replayed grind');
    await control(sim, '/sim/replay/seek', {t: 38});
    await until(async () => (await session.diagnostics('grind-events')).body.events[0]?.grindUuid, 'replayed grind enriched', 8000);
    const [event] = (await session.diagnostics('grind-events')).body.events;
    assert.equal(event.setting, '82');
    assert.equal(event.log.setting, '82', 'grind_ddd 819 shown as 82');
    assert.equal(event.recipe.mode, 'GbW');
  }, replayTrace);
});

test('connecting fills the Decaid grinder inventory and the empty workflow grinder', (t) => withSim(t, {devGate: 'locked'}, async (sim, keep) => {
  const decaid = decaidApi({workflow: {context: {targetYield: 36, grinderSetting: '82'}, profile: {title: 'Adaptive'}}});
  const {session} = keep(await loadPlugin({InstancesJson: instance(sim, {scheme: 'ws'}), TokensJson: token(sim.token)}, {decaid}));
  await session.connect();
  await until(async () => (await session.diagnostics('inventory')).body.workflowLink === 'linked', 'inventory sync');
  const [record] = decaid.grinders;
  assert.equal(record.model, 'Mahlkönig E64 WS');
  assert.deepEqual(record.extras.deviceId, 'plugin:mahlkoenig-e64.reaplugin:e64:sim');
  assert.deepEqual(decaid.workflow, {context: {targetYield: 36, grinderSetting: '82', grinderId: record.id, grinderModel: 'Mahlkönig E64 WS',
    grinderBurrs: '64 mm flat (stock)'}, profile: {title: 'Adaptive'}}, 'the planned setting 82 is kept; the dial reads 500');
  assert.equal((await session.diagnostics('grind-events')).body.grinderId, record.id);
  await session.disconnect();
  await session.connect();
  const listed = () => decaid.calls.filter((call) => call.method === 'GET' && call.path.startsWith('/api/v1/grinders?')).length;
  await until(() => listed() === 2 && decaid.calls.at(-1).path === '/api/v1/workflow', 'second sync');
  assert.equal(decaid.grinders.length, 1, 'the reconnect finds its own record');
  assert.equal(decaid.calls.filter((call) => call.method !== 'GET').length, 2, 'only the first sync wrote');
}));

test('the service log comes from the same coalesced download, redacted and incremental', (t) => {
  const cert = makeCert();
  return withSim(t, {tlsCert: cert, httpsCert: cert, devGate: 'locked'}, async (sim, keep) => {
    const {session, plugin} = keep(await loadPlugin({InstancesJson: instance(sim, {restPort: sim.httpPort, certSha256: cert.sha256}), TokensJson: '{}',
      MintTokens: 'true', PasswordsJson: password('sim-password')}));
    await session.connect();
    for (let i = 0; i < 2; i++) {
      await control(sim, '/sim/action', {suffix: 'StartGrindGbw', data: {targetWeightGr: 18}});
      await until(() => last(session).state === 'grinding', 'grinding');
      await control(sim, '/sim/action', {suffix: 'Stop', data: {}});
      await until(() => last(session).state === 'idle', 'idle');
    }
    await until(async () => (await session.diagnostics('grind-events')).body.log.status === 'ok', 'log download');
    const service = (query) => JSON.parse(plugin.handleHttpRequest({endpoint: 'service-log', method: 'GET', query}).body);
    const {rows, log} = service({instance: 'sim'});
    assert.deepEqual(rows.map((row) => row.eventType), ['PowerOn', 'WifiConnected', 'SerialNumberRead', 'LogIn']);
    const text = JSON.stringify(rows);
    for (const secret of ['sim-wifi-secret', '192.168.77.23', '02:00:5e:10:00:01', '000000123456', '0123456789abcdef0123456789abcdef', 'SimHomeNet']) assert.equal(text.includes(secret), false, secret);
    assert.deepEqual(service({instance: 'sim', after: String(rows[2].id)}).rows.map((row) => row.eventType), ['LogIn']);
    assert.equal(log.status, 'ok');
    const simEvents = (await control(sim, '/sim/state')).events.map((event) => event.event);
    assert.equal(simEvents.filter((event) => event === 'machine_logs_downloaded').length, 1, 'two grinds, one download');
    const [newest, older] = (await session.diagnostics('grind-events')).body.events;
    assert.ok(older.grindUuid, 'the first grind is enriched by the immediate download');
    assert.equal(newest.grindUuid, null, 'the second grind waits for the next coalesced download, 10 minutes later');
  });
});

test('a shot snapshot of the active workflow carries the full grinder metadata', (t) => withSim(t, {replay: replayTrace}, async (sim, keep) => {
  const decaid = decaidApi({workflow: {context: {targetYield: 36, extras: {dialin: {plan: 'keep'}}}, profile: {title: 'Adaptive'}}});
  const {session} = keep(await loadPlugin({InstancesJson: instance(sim, {scheme: 'ws'}), TokensJson: token(sim.token)}, {decaid}));
  await session.connect();
  await control(sim, '/sim/replay/seek', {t: 28});
  await until(() => last(session).state === 'grinding', 'replayed grind');
  await control(sim, '/sim/replay/seek', {t: 35});
  await until(() => last(session).state === 'unknown', 'GbwPostGrind observed');
  await control(sim, '/sim/replay/seek', {t: 38});
  await until(() => decaid.workflow.context.extras?.['mahlkoenig-e64.reaplugin']?.lastGrind, 'pre-shot metadata', 10000);
  const shot = JSON.parse(JSON.stringify(decaid.workflow)); // Decaid snapshots the active workflow at shot completion
  const [record] = decaid.grinders;
  assert.deepEqual({grinderId: shot.context.grinderId, grinderModel: shot.context.grinderModel, grinderBurrs: shot.context.grinderBurrs, grinderSetting: shot.context.grinderSetting},
    {grinderId: record.id, grinderModel: 'Mahlkönig E64 WS', grinderBurrs: '64 mm flat (stock)', grinderSetting: '82'});
  const meta = shot.context.extras['mahlkoenig-e64.reaplugin'];
  assert.deepEqual([meta.ddValueDum, meta.displayedSetting, meta.unit, meta.lastGrind.mode], [819, '82', 'µm', 'GbW']);
  assert.deepEqual(shot.context.extras.dialin, {plan: 'keep'});
  assert.equal(shot.context.targetYield, 36);
  assert.ok(decaid.workflowWrites <= 3, `few workflow writes (${decaid.workflowWrites})`);
}, replayTrace));

test('a full setup-assistant run against the simulator ends connected', (t) => {
  const cert = makeCert();
  return withSim(t, {tlsCert: cert, httpsCert: cert, devGate: 'open'}, async (sim, keep) => {
    // A fresh install loads in needs-setup and serves the assistant.
    const fresh = await loadPlugin({});
    const call = async (plugin, body) => { const r = await plugin.handleHttpRequest({endpoint: 'setup', method: 'POST', query: {}, body}); return JSON.parse(r.body); };
    assert.equal(JSON.parse(fresh.plugin.handleHttpRequest({endpoint: 'setup', method: 'GET', query: {status: '1'}}).body).needsSetup, true);
    const target = {host: '127.0.0.1', port: sim.port, restPort: sim.httpPort};
    // The simulator's certificate is not the E64 fleet certificate: the page asks for the fingerprint (path C).
    assert.deepEqual(await call(fresh.plugin, {action: 'probe-cert', ...target}), {recognised: false});
    const pin = cert.sha256;
    assert.equal((await call(fresh.plugin, {action: 'test-login', ...target, certSha256: pin, password: 'sim-password'})).result, 'accepted');
    await new Promise((resolve) => setTimeout(resolve, 3100));
    const probe = await call(fresh.plugin, {action: 'probe-control', ...target, certSha256: pin, password: 'sim-password'});
    assert.deepEqual([probe.result, probe.debugMode], ['accepted', 'available']);
    const settings = {InstancesJson: JSON.stringify([{id: 'e64', name: 'Mahlkönig E64', scheme: 'wss', ...target, pollMs: 100, certSha256: pin}]),
      TokensJson: '{}', MintTokens: 'true', PasswordsJson: JSON.stringify({e64: {host: '127.0.0.1', password: 'sim-password'}}),
      AdjustmentOwner: 'decaid', AllowControl: 'true', SyncBacklight: 'false', PopulateGrinderRecord: 'true', LinkWorkflowGrinder: 'true'};
    assert.deepEqual((await call(fresh.plugin, {action: 'check', settings})).errors, []);
    await fresh.plugin.onUnload();
    // Saving reloads the plugin with the new settings.
    const {session, plugin} = keep(await loadPlugin(settings));
    assert.equal(session.driverId, 'e64-control');
    await session.connect();
    await until(() => JSON.parse(plugin.handleHttpRequest({endpoint: 'setup', method: 'GET', query: {status: '1'}}).body).instances[0].displayedSetting === '500', 'status shows the display');
    const status = JSON.parse(plugin.handleHttpRequest({endpoint: 'setup', method: 'GET', query: {status: '1'}}).body);
    assert.deepEqual([status.needsSetup, status.instances[0].connected, status.instances[0].debugMode], [false, true, 'available']);
  });
});
