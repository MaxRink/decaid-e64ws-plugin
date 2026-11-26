// Every fork-only facility, exercised against a modelled UPSTREAM host and a
// modelled FORK host, in both release channels.
//
// The point of these tests is the promise the plugin makes to the user: a
// fork-only feature either works, or is explicitly disabled with one sentence
// that names the build which supports it. Silent failure and tracebacks are
// both failures here.
import test from 'node:test';
import assert from 'node:assert/strict';
import {bakedChannel, connect, loadPlugin} from './support/host-stub.mjs';

const PIN = 'a'.repeat(64);
const HOST = '192.168.200.103';
const FORK_NAME = /the MaxRink\/decaid fork build/;

const instances = (extra = {}) => JSON.stringify([{id: 'one', name: 'E64', host: HOST, port: 9997, pollMs: 0, ...extra}]);

// A static token keeps the login fetch out of the way unless a test asks for it.
const settings = (extra = {}) => ({
  InstancesJson: instances(extra),
  TokensJson: JSON.stringify({one: {host: HOST, token: 'static'}}),
  PopulateGrinderRecord: 'false',
});

const minting = (extra = {}) => ({
  InstancesJson: instances(extra),
  TokensJson: '{}',
  MintTokens: 'true',
  PasswordsJson: JSON.stringify({one: {host: HOST, password: 'pw'}}),
  PopulateGrinderRecord: 'false',
});

const status = async (loaded) => {
  const response = await loaded.plugin.handleHttpRequest({
    endpoint: 'e64-diagnostics', method: 'GET',
    query: {deviceId: 'plugin:mahlkoenig-e64.reaplugin:e64:one', read: 'connection'},
  });
  return JSON.parse(response.body);
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 25));
const capNotices = (loaded) => loaded.state.notices.filter((notice) => String(notice.id).startsWith('cap-'));

// ---------------------------------------------------------------- upstream host

test('upstream host: the upstream artefact sends no fork-only fetch or transport option', async () => {
  const loaded = await loadPlugin({channel: 'upstream', kind: 'upstream', settings: minting({certSha256: PIN})});
  loaded.state.authorization = 'Bearer tok';
  try {
    await connect(loaded).catch(() => {});
    await settle();
    assert.equal(loaded.state.fetch.length > 0, true, 'the login fetch still happens');
    for (const call of loaded.state.fetch) {
      assert.equal(Object.hasOwn(call.init, 'tlsPinSha256'), false, `tlsPinSha256 must not be sent: ${call.url}`);
      assert.equal(Object.hasOwn(call.init, 'responseType'), false, 'responseType must not be sent');
    }
    for (const call of loaded.state.open) {
      assert.equal(Object.hasOwn(call, 'tlsPinSha256'), false, 'the wss open must not carry a pin');
    }
  } finally { await loaded.plugin.onUnload(); }
});

test('upstream host: the upstream artefact reports its channel and disables pinning by name', async () => {
  const loaded = await loadPlugin({channel: 'upstream', kind: 'upstream', settings: settings({certSha256: PIN})});
  try {
    const body = await status(loaded);
    assert.equal(body.capabilities.channel, 'upstream');
    assert.equal(body.capabilities.tlsPinSha256, 'channel-off');
    assert.equal(body.pinned, false, 'a configured pin is not claimed to be in force');
    // No Decaid build implements requestCancellation; the plugin never pretends otherwise.
    assert.equal(body.capabilities.requestCancellation, 'unused');
    assert.equal(body.capabilities.setupSurface, 'unrendered');
    const notices = capNotices(loaded);
    assert.equal(notices.filter((notice) => notice.id === 'cap-tlsPin').length, 1, 'one notice, not a stream');
    assert.equal(notices[0].message, body.capabilities.messages.tlsPin, 'the notice is the documented sentence');
    assert.match(notices[0].message, FORK_NAME);
  } finally { await loaded.plugin.onUnload(); }
});

test('upstream host: the setup wizard refuses to claim a certificate it cannot verify', async () => {
  const loaded = await loadPlugin({channel: 'upstream', kind: 'upstream', settings: settings()});
  try {
    const response = await loaded.plugin.handleHttpRequest({
      endpoint: 'setup', method: 'POST', query: {}, body: {action: 'probe-cert', host: HOST},
    });
    const body = JSON.parse(response.body);
    const documented = (await status(loaded)).capabilities.messages.tlsPin;
    assert.deepEqual([response.status, body.recognised, body.pinning, body.message], [200, false, false, documented]);
    assert.match(body.message, FORK_NAME);
    // The login probe says the same thing instead of reporting "unreachable".
    const login = await loaded.plugin.handleHttpRequest({
      endpoint: 'setup', method: 'POST', query: {}, body: {action: 'test-login', host: HOST, certSha256: PIN, password: 'pw'},
    });
    assert.deepEqual([JSON.parse(login.body).result, JSON.parse(login.body).message], ['no-pinning', documented]);
  } finally { await loaded.plugin.onUnload(); }
});

test('upstream host: a dropped responseType degrades with the documented sentence, not silence', async () => {
  const loaded = await loadPlugin({channel: 'upstream', kind: 'upstream', settings: settings()});
  try {
    const documented = (await status(loaded)).capabilities.messages.base64;
    assert.match(documented, FORK_NAME);
    // The upstream shim returns a text body, so the plugin must read support off
    // the response instead of assuming it.
    const response = await loaded.fetchImpl('http://example.invalid/bin', {});
    assert.equal('base64' in response, false, 'an upstream host cannot return binary at all');
    assert.equal((await status(loaded)).capabilities.responseTypeBase64, 'unchecked');
  } finally { await loaded.plugin.onUnload(); }
});

// -------------------------------------------------------------------- fork host

test('fork host: the fork artefact pins the login fetch and the wss open', async () => {
  const loaded = await loadPlugin({channel: 'fork', kind: 'fork', settings: minting({certSha256: PIN}), presented: PIN});
  loaded.state.authorization = 'Bearer tok';
  try {
    await connect(loaded);
    assert.equal(loaded.state.fetch.some((call) => call.init.tlsPinSha256 === PIN), true, 'the login fetch is pinned');
    assert.equal(loaded.state.open.some((call) => call.tlsPinSha256 === PIN), true, 'the wss open is pinned');
    const body = await status(loaded);
    assert.equal(body.pinned, true, 'the pin is reported as in force');
    assert.equal(body.capabilities.channel, 'fork');
    assert.equal(capNotices(loaded).length, 0, 'a supporting host sees no degradation notice');
  } finally { await loaded.plugin.onUnload(); }
});

test('fork host: the pin probe classifies a supporting host as supported', async () => {
  const loaded = await loadPlugin({channel: 'fork', kind: 'fork',
    settings: settings({certSha256: PIN}), presented: 'b'.repeat(64)});
  try {
    await assert.rejects(connect(loaded), /E64 connection failed/);
    await settle();
    const body = await status(loaded);
    assert.equal(body.capabilities.tlsPinSha256, 'supported');
    assert.equal(capNotices(loaded).length, 0, 'support is never announced as a problem');
  } finally { await loaded.plugin.onUnload(); }
});

// The dangerous combination: the fork artefact installed on an upstream host.
test('upstream host: the fork artefact detects the dropped pin and degrades honestly', async () => {
  const loaded = await loadPlugin({channel: 'fork', kind: 'upstream', settings: settings({certSha256: PIN})});
  try {
    assert.equal((await status(loaded)).capabilities.tlsPinSha256, 'unchecked', 'nothing is assumed before evidence');
    // The pin is sent and the host ignores it, so the connection fails on the
    // self-signed certificate rather than on a pin mismatch.
    await assert.rejects(connect(loaded), /E64 connection failed/);
    await settle();
    const body = await status(loaded);
    assert.equal(body.capabilities.tlsPinSha256, 'unsupported', 'the probe proves the host drops the option');
    const notices = capNotices(loaded).filter((notice) => notice.id === 'cap-tlsPin');
    assert.equal(notices.length, 1);
    assert.equal(notices[0].message, body.capabilities.messages.tlsPin);
    // And the feature is now off, so the plugin stops sending a field that does nothing.
    const before = loaded.state.fetch.length;
    await connect(loaded).catch(() => {});
    await settle();
    for (const call of loaded.state.fetch.slice(before)) {
      assert.equal(Object.hasOwn(call.init, 'tlsPinSha256'), false, 'the pin is dropped once it is known to be ignored');
    }
    assert.equal((await status(loaded)).pinned, false);
  } finally { await loaded.plugin.onUnload(); }
});

test('neither host: requestCancellation is never used, so it is never promised', async () => {
  for (const kind of ['upstream', 'fork']) {
    const loaded = await loadPlugin({channel: 'fork', kind, settings: settings()});
    try {
      assert.equal((await status(loaded)).capabilities.requestCancellation, 'unused', kind);
      assert.equal(Object.hasOwn(loaded.state, 'requestCancellation'), false, `the stub exposes none: ${kind}`);
    } finally { await loaded.plugin.onUnload(); }
  }
});

// CI points this suite at a packaged artefact via E64_PLUGIN_SOURCE and requires
// the baked channel to match, so the shipped file is proven, not just the tree.
test('the file under test is baked for the channel the caller expects', () => {
  const expected = process.env.E64_EXPECT_CHANNEL || 'fork';
  assert.equal(bakedChannel(), expected,
    'the source tree ships as the fork channel; --channel upstream rewrites it at packaging time');
});
