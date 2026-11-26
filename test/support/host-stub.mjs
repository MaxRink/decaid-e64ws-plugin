// Host stubs that model a Decaid *build*, not just an API surface.
//
// Every difference below is taken from a pinned ref, not from a guess:
//   upstream 1d74fbf7a5eb3a5ba5208b4147aea136726a4909 (and origin/main c1ebc628)
//     - lib/src/plugins/plugin_manager.dart _performFetch reads only
//       url/method/headers/body, so tlsPinSha256 and responseType are dropped
//       silently and the pin is never compared.
//     - no lib/ file mentions requestCancellation.
//     - plugin_manifest.dart parses only a driver's `surfaces`; a top-level
//       `surfaces` block is never read, so no setup surface is rendered.
//   fork a0dede246cd5a65601bf24bc79b77d5778b78fc6
//     - lib/src/plugins/plugin_tls_pin.dart parseTlsPinSha256 rejects a pin that
//       is not 64 hex digits BEFORE a client or socket is built (plugin_manager
//       calls it at :3723, the pinned client is built at :3727).
//     - plugin_manager.dart:1093 forwards responseType and :1115 exposes base64().
//     - requestCancellation is still absent, exactly as upstream.
import fs from 'node:fs';
import vm from 'node:vm';

export const CHANNEL_PATTERN = /const PLUGIN_CHANNEL = "(?:fork|upstream)"; \/\* package-plugin:channel \*\//;

const RESULT_TYPE = {
  RequestDriverState: 'RequestDriverStateResult',
  RequestDriverConfig: 'RequestDriverConfigResult',
  RequestNachineInfo: 'RequestNachineInfoResult',
  GrinderAction: 'GrinderActionResult',
  RequestLogMessages: 'RequestLogMessagesResult',
};

// E64_PLUGIN_SOURCE lets CI point the same suite at a *packaged* plugin.js, so
// the artefact that ships is what gets proven, not just the source tree.
const pluginSource = () =>
  fs.readFileSync(process.env.E64_PLUGIN_SOURCE || new URL('../../plugin.js', import.meta.url), 'utf8');

/** Return plugin.js with the build-time channel constant set to `channel`. */
export function channelSource(channel) {
  if (channel !== 'fork' && channel !== 'upstream') throw new Error(`unknown channel: ${channel}`);
  const source = pluginSource();
  if (!CHANNEL_PATTERN.test(source)) throw new Error('plugin.js is missing the package-plugin:channel marker');
  return source.replace(CHANNEL_PATTERN, `const PLUGIN_CHANNEL = "${channel}"; /* package-plugin:channel */`);
}

const isPinError = pin => !/^[0-9a-f]{64}$/.test(String(pin));

/** The channel baked into the file under test (the source tree, or a packaged artefact). */
export function bakedChannel() {
  const match = pluginSource().match(/const PLUGIN_CHANNEL = "(fork|upstream)"; \/\* package-plugin:channel \*\//);
  if (!match) throw new Error('the plugin source carries no packaged channel constant');
  return match[1];
}

/**
 * Build a host stub.
 *
 * kind      'upstream' | 'fork'  which Decaid build is on the other side
 * presented the certificate SHA-256 the device actually serves
 */
export function hostStub(kind, {presented = 'a'.repeat(64), channel = 'fork'} = {}) {
  if (kind !== 'upstream' && kind !== 'fork') throw new Error(`unknown host kind: ${kind}`);
  const state = {
    fetch: [], open: [], notices: [], dismissed: [], registered: [],
    onEventCb: null, selfSigned: true, binary: kind === 'fork',
    authorization: '', jsonPayload: {}, textBody: '', base64Body: '',
  };

  const pinVerdict = (pin) => {
    // A host that supports the option validates it before any I/O.
    if (isPinError(pin)) {
      throw new Error('tlsPinSha256 must be the SHA-256 of the certificate as 64 hex digits');
    }
    if (String(pin) !== presented) throw new Error('HandshakeException: CERTIFICATE_VERIFY_FAILED');
  };

  const fetchImpl = async (url, init = {}) => {
    state.fetch.push({url, init});
    if (state.fetchOnlyProbe?.(url, init)) throw new Error('connection refused');
    const pin = init.tlsPinSha256;
    // The upstream shim ignores every key it does not read; the pin is never compared.
    const pinned = kind === 'fork' && pin !== undefined;
    if (pinned) pinVerdict(pin);
    // Without a pin the self-signed grinder certificate fails platform validation.
    if (!pinned && state.selfSigned && String(url).startsWith('https://')) {
      throw new Error('CERTIFICATE_VERIFY_FAILED: self signed certificate');
    }
    return {
      ok: true,
      status: 200,
      headers: {get: (name) => (String(name).toLowerCase() === 'authorization' ? state.authorization : null)},
      json: async () => state.jsonPayload,
      text: async () => state.textBody,
      // responseType is fork-only, so an upstream host has no base64() accessor.
      ...(state.binary ? {base64: async () => state.base64Body} : {}),
    };
  };

  const transport = {
    open: async (options) => {
      state.open.push(options);
      const pin = options.tlsPinSha256;
      if (kind === 'fork' && pin !== undefined) pinVerdict(pin);
      else if (state.selfSigned) throw new Error('WebSocketException: CERTIFICATE_VERIFY_FAILED: self signed certificate');
      return {handle: 1};
    },
    onEvent: (_handle, callback) => { state.onEventCb = callback; },
    close: async () => {},
    send: async (_handle, message) => {
      const request = JSON.parse(message.data);
      // The device echoes the request id as refId, which is what pending keys on.
      const reply = {type: RESULT_TYPE[request.type], refId: request.msgId, data: {grindState: 'Idle'}};
      queueMicrotask(() => state.onEventCb?.({type: 'data', dataType: 'text', data: JSON.stringify(reply)}));
    },
  };

  const host = {
    devices: {
      register(definition, handlers) {
        state.registered.push({definition, handlers});
        return Promise.resolve({deviceId: `plugin:mahlkoenig-e64.reaplugin:e64:${definition.instanceId}`});
      },
    },
    notify: (value) => { state.notices.push(value); },
    dismissNotification: (id) => { state.dismissed.push(id); },
    // No `surfaces`/`renderSurface` and no `requestCancellation` on either build.
  };

  const sandbox = {
    setTimeout, clearTimeout, Promise, Map, Set, JSON, Object, Number, Array, Error,
    Date, Math, String, Boolean, RegExp, encodeURIComponent, btoa: globalThis.btoa,
    atob: globalThis.atob, fetch: fetchImpl,
  };
  vm.runInNewContext(`globalThis.createPlugin = (${channelSource(channel)}\n);`, sandbox);
  const plugin = sandbox.createPlugin(host);
  return {state, host, transport, sandbox, fetchImpl, plugin, kind, channel};
}

/** Load plugin.js for `channel` against a `kind` host. */
export async function loadPlugin({channel, kind, settings, presented}) {
  const loaded = hostStub(kind, {presented, channel});
  await loaded.plugin.onLoad(settings);
  return loaded;
}

/** Connect the single registered driver. */
export async function connect(loaded) {
  const registration = loaded.state.registered[0];
  return registration.handlers.connect({
    transport: loaded.transport,
    publish: async () => {},
    reportDisconnected: async () => {},
  });
}
