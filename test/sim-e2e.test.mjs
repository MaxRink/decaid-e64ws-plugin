// End-to-end tests against the E64 WS simulator from the private research
// repository (E64_SIM_ROOT, default ../mahlkoenig-e64ws-local-research).
// They fail when the simulator is missing unless E64_SIM_OPTIONAL=1.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {control, freePort, loadPlugin, makeCert, replayTrace, requireSim, startSim, until} from './support/sim-host.mjs';

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
  assert.deepEqual(last(session), {state: 'idle', observedSetting: '5000 ddValueDum'});
  await control(sim, '/sim/action', {suffix: 'SetAgsaTargetDdValue', data: {targetDdValue: 4321}});
  await until(() => last(session).observedSetting === '4321 ddValueDum', 'DD 4321');
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
  for (const read of ['config', 'machineInfo']) {
    const live = await session.diagnostics(read);
    assert.equal(live.status, 200);
    assert.equal(live.headers['X-E64-Observation-State'], 'live');
    assert.deepEqual(live.body, {}, `${read} has no allowlisted simulator fields`);
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
    assert.deepEqual(last(session), {state: 'idle', observedSetting: '5000 ddValueDum'});
    assert.equal(fetchLog[0].url, `https://127.0.0.1:${sim.httpPort}/rest_api/login`);
    assert.equal(JSON.parse(fetchLog[0].init.body).userRole, 'Owner');
    assert.equal(fetchLog[0].init.tlsPinSha256, cert.sha256.replace(/:/g, '').toLowerCase());
    assert.match(openLog[0].url, /^wss:\/\//);
    assert.equal(openLog[0].tlsPinSha256, fetchLog[0].init.tlsPinSha256);
    const connection = (await session.diagnostics('connection')).body;
    assert.equal(connection.tokenSource, 'password');
    assert.equal(JSON.stringify(connection).includes('sim-password'), false);
    assert.equal(JSON.stringify(connection).includes(sim.token), false);
    assert.deepEqual(notices, [['dismiss', 'login-sim']]);
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
    assert.equal(notices[0][0], 'notify');
    assert.equal(notices[0][1].message.includes('wrong-password'), false);
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
    assert.equal(fetchLog.length, 2, 'a fresh token is minted for the new session');
    assert.equal((await session.diagnostics('connection')).body.connected, true);
  });
});

test('replays the real 2026-11-19 grind capture through the plugin', (t) => withSim(t, {replay: replayTrace}, async (sim, keep) => {
  const {session} = keep(await loadPlugin({InstancesJson: instance(sim, {scheme: 'ws'}), TokensJson: token(sim.token)}));
  await session.connect();
  assert.deepEqual(last(session), {state: 'idle', observedSetting: '819 ddValueDum'});
  for (const [seconds, state] of [[28, 'grinding'], [35, 'unknown'], [38, 'idle']]) {
    await control(sim, '/sim/replay/seek', {t: seconds});
    await until(() => last(session).state === state, `${state} at ${seconds}s`);
    assert.equal(last(session).observedSetting, '819 ddValueDum');
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
