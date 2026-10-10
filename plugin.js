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
    if (!Array.isArray(rows) || rows.length > MAX || !tokens || Array.isArray(tokens) || typeof tokens !== "object") fail("invalid instance or token JSON");
    const ids = new Set();
    const result = rows.map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) fail("instances must be objects");
      const id = row.id, name = row.name, scheme = row.scheme === undefined ? "ws" : row.scheme;
      const pollMs = row.pollMs === undefined ? 1000 : row.pollMs;
      if (typeof id !== "string" || !idPattern.test(id) || ids.has(id)) fail("instance ids must be safe and unique");
      if (typeof name !== "string" || !name || name.length > 128) fail("instance name is invalid");
      if ((scheme !== "ws" && scheme !== "wss") || !validHost(row.host) || !Number.isInteger(row.port) || row.port < 1 || row.port > 65535) fail("instance address is invalid");
      if (!Number.isInteger(pollMs) || pollMs < 0 || (pollMs !== 0 && pollMs < 100) || pollMs > 3600000) fail("pollMs is out of bounds");
      if (typeof tokens[id] !== "string" || !tokens[id] || tokens[id].length > 2048) fail("each instance needs a token");
      ids.add(id);
      return {id, name, scheme, host: row.host, port: row.port, pollMs, token: tokens[id]};
    });
    if (Object.keys(tokens).some((id) => !ids.has(id))) fail("TokensJson contains an unknown id");
    return result;
  }
  function url(config) {
    const hostName = config.host.indexOf(":") >= 0 && config.host[0] !== "[" ? "[" + config.host + "]" : config.host;
    return config.scheme + "://" + hostName + ":" + config.port + "/?token=" + encodeURIComponent(config.token);
  }
  function stateOf(data) {
    const value = data && (data.state || data.status || data.mode);
    if (typeof value !== "string") return "unknown";
    const normalized = value.toLowerCase();
    if (["grinding", "running", "active"].includes(normalized)) return "grinding";
    if (["idle", "ready", "stopped"].includes(normalized)) return "idle";
    if (["error", "fault"].includes(normalized)) return "error";
    return "unknown";
  }
  function make(config) {
    return {config, deviceId: null, context: null, transport: null, handle: null, epoch: 0, nextId: 0, pending: new Map(), poll: null, connected: false, observations: {}, lastObservationAt: null};
  }
  function clear(instance) { if (instance.poll !== null) clearTimeout(instance.poll); instance.poll = null; }
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
      instance.context.publish({state: stateOf(message.data)}).then(item.resolve, item.reject);
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
  function disconnect(instance, expectedEpoch, reason) {
    if (expectedEpoch !== undefined && expectedEpoch !== instance.epoch) return Promise.resolve();
    const transport = instance.transport, handle = instance.handle;
    instance.epoch++; instance.connected = false; instance.transport = null; instance.handle = null; instance.context = null; clear(instance); rejectAll(instance, reason || "E64 disconnected");
    return transport && handle ? transport.close(handle).catch(() => {}) : Promise.resolve();
  }
  async function connect(instance, context) {
    await disconnect(instance);
    const epoch = ++instance.epoch; const transport = context.transport;
    instance.context = context; instance.transport = transport; instance.observations = {}; instance.lastObservationAt = null;
    try {
      const opened = await transport.open({kind: "websocket", url: url(instance.config)});
      if (epoch !== instance.epoch) { await transport.close(opened.handle).catch(() => {}); return; }
      instance.handle = opened.handle; instance.connected = true;
      transport.onEvent(opened.handle, (eventValue) => event(instance, epoch, opened.handle, eventValue));
      await request(instance, "state", true); schedule(instance, epoch);
    } catch (_) { await disconnect(instance, epoch, "E64 connection failed"); throw new Error("E64 connection failed"); }
  }
  function request(instance, name, publish) {
    if (!instance.connected || !instance.transport || !instance.handle) return Promise.reject(new Error("E64 is disconnected"));
    if (instance.pending.size >= MAX_PENDING) return Promise.reject(new Error("E64 request queue is full"));
    const epoch = instance.epoch, id = ++instance.nextId, command = commands[name];
    return new Promise((resolve, reject) => {
      const item = {epoch, type: command[1], name, publish, resolve, reject, timer: setTimeout(() => { if (instance.pending.delete(id)) reject(new Error("E64 request timed out")); }, TIMEOUT)};
      instance.pending.set(id, item);
      instance.transport.send(instance.handle, {type: "text", data: JSON.stringify({type: command[0], msgId: id})}).catch(() => { if (instance.pending.delete(id)) { clearTimeout(item.timer); reject(new Error("E64 request failed")); } });
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
      if (read !== undefined && read !== "config" && read !== "machineInfo" && read !== "logs") return {status: 400, headers: {"Content-Type": "application/json"}, body: JSON.stringify({error: "unsupported read"})};
      const operation = read === undefined ? null : read;
      const headers = (live) => ({"Content-Type": "application/json", "X-E64-Observation-State": live ? "live" : (instance.lastObservationAt ? "last-known" : "none"), ...(instance.lastObservationAt ? {"X-E64-Observation-Time": instance.lastObservationAt} : {})});
      return (operation ? requestRead(instance, operation) : Promise.resolve(instance.observations)).then((data) => ({status: 200, headers: headers(Boolean(operation)), body: JSON.stringify(data)}), () => ({status: 503, headers: headers(false), body: JSON.stringify({error: "E64 unavailable"})}));
    }
  };
  function requestRead(instance, operation) { return request(instance, operation, false); }
  return plugin;
}
