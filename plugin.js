function createPlugin(host) {
  "use strict";
  /* plugin-ui:begin */
const PLUGIN_UI = {"version":1,"sha256":{"css":"e725294a0884b0db871d778596bf065dda587f38d2c8130c5d37dce9950134ec","js":"749c8fd79583c4fdebc357cfcf1532a13bb61f7b495ed40dd323550f8e32b676"},"css":":root{--pu-bg:#fff;--pu-surface:#f6f8fa;--pu-text:#121212;--pu-muted:#5f6368;--pu-border:#c9c9c9;--pu-accent:#385a92;--pu-link:#385a92;--pu-on-accent:#fff;--pu-scheme:light;--pu-ok:#0a8a6c;--pu-warn:#b26a00;--pu-danger:#c62828;--pu-radius:12px;--pu-tap:56px;--pu-row:48px}\n:root[data-theme=dark]{--pu-bg:#101217;--pu-surface:#17191e;--pu-text:#e8e8e8;--pu-muted:#959595;--pu-border:#3d4255;--pu-accent:#415996;--pu-link:#9db4ee;--pu-scheme:dark;--pu-ok:#0ca581;--pu-warn:#e0a030;--pu-danger:#ef5350}\n@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--pu-bg:#101217;--pu-surface:#17191e;--pu-text:#e8e8e8;--pu-muted:#959595;--pu-border:#3d4255;--pu-accent:#415996;--pu-link:#9db4ee;--pu-scheme:dark;--pu-ok:#0ca581;--pu-warn:#e0a030;--pu-danger:#ef5350}}\n*,*::before,*::after{box-sizing:border-box}\nbody.pu{margin:0;background:var(--pu-bg);color:var(--pu-text);font:18px/1.4 system-ui,\"Inter\",-apple-system,\"Segoe UI\",Roboto,sans-serif;-webkit-text-size-adjust:100%}\n[data-embed] body.pu{background:transparent}\n.pu [hidden]{display:none!important}\n.pu-page{max-width:46rem;margin:0 auto;padding:16px;background:var(--pu-bg);border-radius:var(--pu-radius)}\n.pu h1{font-size:24px;margin:0}.pu h2{font-size:20px;margin:0 0 8px}.pu p{margin:0 0 12px}\n.pu a{color:var(--pu-link)}\n.pu-muted,.pu-hint{color:var(--pu-muted);font-size:16px}\n.pu-header{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:var(--pu-tap);margin-bottom:12px}\n[data-embed] [data-pu-done]{display:none}\n.pu-card{background:var(--pu-surface);border:1px solid var(--pu-border);border-radius:var(--pu-radius);padding:16px;margin:0 0 16px}\n.pu-row{display:grid;gap:4px 16px;align-items:center;min-height:var(--pu-row);padding:8px 0;border-top:1px solid var(--pu-border)}\n.pu-row:first-child{border-top:0}\n@media (min-width:600px){.pu-row{grid-template-columns:minmax(10rem,1fr) minmax(0,1.4fr)}.pu-row>.pu-hint{grid-column:1/-1}}\n.pu label{font-weight:600}\n.pu input:not([type=checkbox]):not([type=radio]),.pu select,.pu textarea{width:100%;min-height:var(--pu-row);padding:10px 12px;font:inherit;color:var(--pu-text);background:var(--pu-bg);border:1px solid var(--pu-border);border-radius:8px;color-scheme:var(--pu-scheme)}\n.pu textarea{min-height:8rem;font-family:ui-monospace,monospace;font-size:15px}\n.pu :focus-visible{outline:3px solid var(--pu-accent);outline-offset:2px}\n.pu-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:var(--pu-tap);padding:0 28px;font:inherit;font-weight:700;border-radius:999px;border:2px solid var(--pu-accent);background:var(--pu-accent);color:var(--pu-on-accent);cursor:pointer;text-decoration:none}\n.pu-btn.pu-secondary{background:transparent;color:var(--pu-link)}\n.pu-btn.pu-danger{background:var(--pu-danger);border-color:var(--pu-danger)}\n.pu-btn:disabled{opacity:.45;cursor:not-allowed}\n.pu-actions{display:flex;flex-wrap:wrap;gap:12px;justify-content:flex-end;padding:12px 0}\n.pu-actions.pu-sticky{position:sticky;bottom:0;background:var(--pu-bg);border-top:1px solid var(--pu-border)}\n.pu-switch{appearance:none;flex:none;width:72px;height:40px;margin:8px 0;border-radius:999px;background:var(--pu-border);position:relative;cursor:pointer;transition:background .15s}\n.pu-switch::after{content:\"\";position:absolute;top:4px;left:4px;width:32px;height:32px;border-radius:50%;background:#fff;transition:transform .15s}\n.pu-switch:checked{background:var(--pu-accent)}.pu-switch:checked::after{transform:translateX(32px)}\n.pu-choice{display:grid;gap:12px;margin:0;padding:0;border:0}\n.pu-choice label{display:flex;gap:12px;align-items:flex-start;min-height:var(--pu-tap);padding:14px 16px;border:2px solid var(--pu-border);border-radius:var(--pu-radius);cursor:pointer;font-weight:400}\n.pu-choice label:has(input:checked){border-color:var(--pu-accent)}\n.pu-choice label:has(input:disabled){opacity:.5;cursor:not-allowed}\n.pu-choice input{width:24px;height:24px;margin:2px 0 0;accent-color:var(--pu-accent);color-scheme:var(--pu-scheme);flex:none}\n.pu-choice b{display:block}\n.pu-stepper{display:flex;align-items:center;gap:8px;margin:0 0 16px;color:var(--pu-muted);font-size:16px}\n.pu-stepper i{width:10px;height:10px;border-radius:50%;background:var(--pu-border)}\n.pu-stepper i.on{background:var(--pu-accent)}\n.pu-pill{display:inline-flex;align-items:center;min-height:32px;padding:2px 12px;border-radius:999px;font-size:15px;font-weight:600;border:1px solid currentColor;color:var(--pu-muted)}\n.pu-pill.pu-ok{color:var(--pu-ok)}.pu-pill.pu-warn{color:var(--pu-warn)}.pu-pill.pu-error{color:var(--pu-danger)}\n.pu-alert{padding:12px 16px;margin:0 0 16px;border-radius:var(--pu-radius);border-left:6px solid var(--pu-accent);background:var(--pu-surface)}\n.pu-alert.pu-ok{border-color:var(--pu-ok)}.pu-alert.pu-warn{border-color:var(--pu-warn)}.pu-alert.pu-error{border-color:var(--pu-danger)}\n.pu-code{display:block;padding:12px;font:15px/1.6 ui-monospace,monospace;background:var(--pu-bg);border:1px solid var(--pu-border);border-radius:8px;overflow-wrap:anywhere}\n.pu-secure{display:flex;gap:8px}.pu-secure input{flex:1}.pu-secure .pu-btn{padding:0 16px}\ndetails.pu-details{margin:0 0 16px}details.pu-details>summary{min-height:var(--pu-row);display:flex;align-items:center;cursor:pointer;font-weight:600;color:var(--pu-link)}\n@media (prefers-reduced-motion:reduce){.pu *{transition:none!important}}\n","js":"(function () {\n  \"use strict\";\n  var q = new URLSearchParams(location.search), root = document.documentElement;\n  var lang = (q.get(\"lang\") || \"en\").toLowerCase().split(\"-\")[0];\n  var strings = {de: {Back: \"Zurück\", Next: \"Weiter\", Done: \"Fertig\", Show: \"Anzeigen\", Hide: \"Verbergen\", \"Step {n} of {m}\": \"Schritt {n} von {m}\"}};\n  var embedded = q.get(\"embed\") === \"1\", fit = false;\n  var parentPost = function (msg) { if (window.parent !== window) window.parent.postMessage(msg, \"*\"); };\n  var pu = {\n    lang: lang, embedded: embedded, params: q,\n    t: function (key, vars) {\n      var s = (strings[lang] && strings[lang][key]) || key;\n      return s.replace(/\\{(\\w+)\\}/g, function (_, k) { return vars && k in vars ? vars[k] : \"{\" + k + \"}\"; });\n    },\n    init: function (opts) {\n      opts = opts || {};\n      Object.keys(opts.strings || {}).forEach(function (l) { strings[l] = Object.assign(strings[l] || {}, opts.strings[l]); });\n      document.querySelectorAll(\"[data-pu-t]\").forEach(function (el) { el.textContent = pu.t(el.getAttribute(\"data-pu-t\")); });\n      fit = Boolean(opts.fit) && embedded;\n      parentPost({type: \"streamline:ready\"});\n      if (fit) { pu.size(); if (window.ResizeObserver) new ResizeObserver(pu.size).observe(document.querySelector(\".pu-page\") || document.body); }\n    },\n    size: function () {\n      if (!fit) return;\n      var r = (document.querySelector(\".pu-page\") || document.body).getBoundingClientRect();\n      parentPost({type: \"streamline:size\", width: Math.ceil(r.width), height: Math.ceil(r.height)});\n    },\n    done: async function () {\n      if (window.parent !== window) return parentPost({type: \"streamline:close\"});\n      var bridge = window.flutter_inappwebview;\n      if (bridge && bridge.callHandler) return bridge.callHandler(\"pluginSurface\", {type: \"close\"});\n      var target = q.get(\"returnTo\"), skin = null, path = q.get(\"return\");\n      try {\n        if (!target && path && /^\\/(?![\\/\\\\])/.test(path)) {\n          var s = await (await fetch(\"/api/v1/webui/server/status\")).json();\n          if (s.serving && Number.isInteger(s.port)) { skin = new URL(location.href); skin.port = String(s.port); target = new URL(path, skin.origin).href; }\n        }\n        if (target) {\n          var u = new URL(target);\n          if (/^https?:$/.test(u.protocol) && u.hostname === location.hostname && !u.username && !u.password && (!skin || u.origin === skin.origin)) return location.assign(u.href);\n        }\n      } catch (e) { target = null; }\n      history.back();\n    },\n    api: async function (path, opts) {\n      opts = opts || {};\n      var res = await fetch(path, {method: opts.method || (opts.body === undefined ? \"GET\" : \"POST\"),\n        headers: opts.body === undefined ? {} : {\"Content-Type\": \"application/json\"},\n        body: opts.body === undefined ? undefined : JSON.stringify(opts.body)});\n      var data = null; try { data = await res.json(); } catch (e) { data = null; }\n      if (!res.ok) { var err = new Error((data && data.error) || \"HTTP \" + res.status); err.status = res.status; err.data = data; throw err; }\n      return data;\n    },\n    secureValue: function (input, wasSet) {\n      if (input.value) return input.value;\n      return wasSet ? {isSet: true} : undefined;\n    },\n    fingerprint: function (hex) {\n      return String(hex).replace(/[^0-9a-f]/gi, \"\").toUpperCase().replace(/(..)(?!$)/g, \"$1:\");\n    },\n    wizard: function (container, onNext) {\n      var steps = Array.prototype.slice.call(container.querySelectorAll(\"[data-pu-step]\")), i = 0;\n      var back = container.querySelector(\"[data-pu-back]\"), next = container.querySelector(\"[data-pu-next]\"), bar = container.querySelector(\"[data-pu-stepper]\");\n      function show(n) {\n        i = n;\n        steps.forEach(function (s, k) { s.hidden = k !== i; });\n        if (back) back.disabled = i === 0;\n        if (next) next.hidden = i === steps.length - 1;\n        if (bar) bar.innerHTML = steps.map(function (_, k) { return \"<i class=\\\"\" + (k <= i ? \"on\" : \"\") + \"\\\"></i>\"; }).join(\"\") + \"<span></span>\";\n        if (bar) bar.lastChild.textContent = pu.t(\"Step {n} of {m}\", {n: i + 1, m: steps.length});\n        var h = steps[i].querySelector(\"h2\"); if (h) { h.tabIndex = -1; h.focus(); }\n        pu.size();\n      }\n      if (back) back.addEventListener(\"click\", function () { if (i > 0) show(i - 1); });\n      if (next) next.addEventListener(\"click\", async function () {\n        next.disabled = true;\n        try { if (!onNext || (await onNext(i, steps[i])) !== false) show(Math.min(i + 1, steps.length - 1)); } finally { next.disabled = false; }\n      });\n      show(0);\n      return {show: show, get index() { return i; }};\n    }\n  };\n  var theme = q.get(\"theme\");\n  if (theme === \"light\" || theme === \"dark\") root.setAttribute(\"data-theme\", theme);\n  if (embedded) root.setAttribute(\"data-embed\", \"\");\n  root.lang = lang;\n  document.addEventListener(\"click\", function (e) {\n    var b = e.target.closest && e.target.closest(\"[data-pu-reveal]\");\n    if (b) {\n      var input = b.parentNode.querySelector(\"input\");\n      var hidden = input.type === \"password\";\n      input.type = hidden ? \"text\" : \"password\";\n      b.textContent = pu.t(hidden ? \"Hide\" : \"Show\");\n      b.setAttribute(\"aria-pressed\", String(hidden));\n    }\n    if (e.target.closest && e.target.closest(\"[data-pu-done]\")) pu.done();\n  });\n  window.pu = pu;\n})();\n"};
/* plugin-ui:end */
  const MAX = 8, TIMEOUT = 5000, MAX_PENDING = 32, MINT_BACKOFF_MS = 5000, MINT_BACKOFF_MAX_MS = 300000;
  const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
  const commands = {
    state: ["RequestDriverState", "RequestDriverStateResult"],
    config: ["RequestDriverConfig", "RequestDriverConfigResult"],
    machineInfo: ["RequestNachineInfo", "RequestNachineInfoResult"],
    action: ["GrinderAction", "GrinderActionResult"],
    probe: ["RequestLogMessages", "RequestLogMessagesResult"]
  };
  // The only GrinderAction suffixes this plugin may ever send; everything else
  // (calibration, fans, ESP, input injection, config writes, unlock tooling) is out of scope.
  const ALLOWED_ACTIONS = ["StartGrindGbw", "Stop", "SetAgsaTargetDdValue", "AddBrewEvent", "SetBacklightBrightness"];
  const GRIND_STATES = ["grinding", "running", "active", "grind", "manualstartgrind", "gbtstartgrind", "gbwpostgrind"];
  const OWNERS = ["off", "grinder", "decaid"];
  const MAX_STEP_UM = 10, BREW_MIN_MS = 10000, LINK_BEFORE_MS = 5 * 60000, LINK_AFTER_MS = 60000, MAX_GRIND_EVENTS = 20, PROBE_MS = 3000;
  const DECAID_API = "http://127.0.0.1:8080";
  const MAX_LOG_BYTES = 8 * 1024 * 1024, LOG_MATCH_MS = 10 * 60000;
  // Each machine-log download writes a ZIP to the grinder's /tmp and checkpoints
  // its SQLite WAL, so downloads are rare and bounded.
  const LOG_MIN_INTERVAL_MS = 10 * 60000, LOG_IDLE_REFRESH_MS = 6 * 3600000, LOG_CONNECT_DELAY_MS = 60000,
    LOG_MAX_FAILURES = 3, LOG_REQUEST_TIMEOUT_MS = 20000, LOG_RETRY_AFTER_MAX_MS = 3600000, LOCAL_API_ERROR_MAX = 120,
    LOG_ERROR_MAX = 160, MAX_SERVICE_ROWS = 500;
  // Local API v1: owner-authorized read-only endpoints on dev-mode devices
  // The plugin only ever reads two of these: grind_log and service_log.
  const LOCAL_API_STATUS = {401: "unauthorized", 403: "forbidden", 409: "conflict", 422: "unprocessable", 429: "rate-limited", 503: "unavailable"};
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
  // --- Grind-log codec: base64, ZIP (STORE/DEFLATE), RFC 1951 inflate, UTF-8, CSV.
  // QuickJS has no zlib or TextDecoder; these are small and bounded by `limit`.
  const B64 = {};
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("").forEach((c, i) => { B64[c] = i; });
  function fromBase64(text) {
    const out = new Uint8Array(Math.floor(text.length * 3 / 4) + 3);
    let acc = 0, bits = 0, n = 0;
    for (let i = 0; i < text.length; i++) {
      const v = B64[text[i]];
      if (v === undefined) { if (text[i] === "=") break; continue; }
      acc = ((acc << 6) | v) & 0xffffff; bits += 6;
      if (bits >= 8) { bits -= 8; out[n++] = (acc >> bits) & 255; }
    }
    return out.subarray(0, n);
  }
  const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const CLORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  function huffman(lengths) {
    const count = new Uint16Array(16), offs = new Uint16Array(16), symbol = new Uint16Array(lengths.length);
    for (let i = 0; i < lengths.length; i++) count[lengths[i]]++;
    count[0] = 0;
    for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + count[i - 1];
    for (let i = 0; i < lengths.length; i++) if (lengths[i]) symbol[offs[lengths[i]]++] = i;
    return {count, symbol};
  }
  function inflate(input, limit) {
    let pos = 0, buf = 0, cnt = 0, len = 0, out = new Uint8Array(Math.min(limit, Math.max(1024, input.length * 4)));
    const fail = (why) => { throw new Error("inflate: " + why); };
    const bits = (n) => {
      while (cnt < n) { if (pos >= input.length) fail("truncated"); buf |= input[pos++] << cnt; cnt += 8; }
      const v = buf & ((1 << n) - 1); buf >>>= n; cnt -= n; return v;
    };
    const put = (b) => {
      if (len === out.length) {
        if (len >= limit) fail("output exceeds limit");
        const grown = new Uint8Array(Math.min(limit, out.length * 2)); grown.set(out); out = grown;
      }
      out[len++] = b;
    };
    const decode = (h) => {
      let code = 0, first = 0, index = 0;
      for (let l = 1; l < 16; l++) {
        code |= bits(1);
        const c = h.count[l];
        if (code - c < first) return h.symbol[index + (code - first)];
        index += c; first = (first + c) << 1; code <<= 1;
      }
      return fail("bad code");
    };
    let fixed = null, last = 0;
    while (!last) {
      last = bits(1);
      const type = bits(2);
      if (type === 0) {
        buf = 0; cnt = 0;
        if (pos + 4 > input.length) fail("truncated");
        const n = input[pos] | (input[pos + 1] << 8);
        if ((n ^ (input[pos + 2] | (input[pos + 3] << 8))) !== 0xffff) fail("bad stored length");
        pos += 4;
        if (pos + n > input.length) fail("truncated");
        for (let i = 0; i < n; i++) put(input[pos++]);
        continue;
      }
      let lit, dist;
      if (type === 1) {
        if (!fixed) {
          const l = new Uint8Array(288);
          l.fill(8, 0, 144); l.fill(9, 144, 256); l.fill(7, 256, 280); l.fill(8, 280, 288);
          fixed = {lit: huffman(l), dist: huffman(new Uint8Array(30).fill(5))};
        }
        lit = fixed.lit; dist = fixed.dist;
      } else if (type === 2) {
        const nlen = bits(5) + 257, ndist = bits(5) + 1, ncode = bits(4) + 4;
        const cl = new Uint8Array(19);
        for (let i = 0; i < ncode; i++) cl[CLORDER[i]] = bits(3);
        const ch = huffman(cl), lengths = new Uint8Array(nlen + ndist);
        for (let i = 0; i < nlen + ndist;) {
          const sym = decode(ch);
          if (sym < 16) { lengths[i++] = sym; continue; }
          let repeat, value = 0;
          if (sym === 16) { if (!i) fail("repeat without length"); value = lengths[i - 1]; repeat = 3 + bits(2); }
          else repeat = sym === 17 ? 3 + bits(3) : 11 + bits(7);
          if (i + repeat > nlen + ndist) fail("too many lengths");
          while (repeat--) lengths[i++] = value;
        }
        lit = huffman(lengths.subarray(0, nlen)); dist = huffman(lengths.subarray(nlen));
      } else fail("bad block type");
      for (;;) {
        const sym = decode(lit);
        if (sym < 256) { put(sym); continue; }
        if (sym === 256) break;
        if (sym > 285) fail("bad length");
        const n = LBASE[sym - 257] + bits(LEXT[sym - 257]);
        const ds = decode(dist);
        if (ds > 29) fail("bad distance");
        const d = DBASE[ds] + bits(DEXT[ds]);
        if (d > len) fail("distance too far");
        for (let i = 0; i < n; i++) put(out[len - d]);
      }
    }
    return out.slice(0, len);
  }
  function readZip(bytes, wanted, limit) {
    const u16 = (o) => bytes[o] | (bytes[o + 1] << 8), u32 = (o) => (u16(o) | (u16(o + 2) << 16)) >>> 0;
    const latin1 = (from, to) => { let t = ""; for (let i = from; i < to; i++) t += String.fromCharCode(bytes[i]); return t; };
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (u32(i) === 0x06054b50) { end = i; break; }
    if (end < 0) throw new Error("zip: no end of central directory");
    let p = u32(end + 16);
    for (let n = u16(end + 10); n > 0; n--) {
      if (p + 46 > bytes.length || u32(p) !== 0x02014b50) throw new Error("zip: bad central directory");
      const flags = u16(p + 8), method = u16(p + 10), csize = u32(p + 20), usize = u32(p + 24), nlen = u16(p + 28);
      const name = latin1(p + 46, p + 46 + nlen), local = u32(p + 42);
      p += 46 + nlen + u16(p + 30) + u16(p + 32);
      if (!wanted(name)) continue;
      if (flags & 1) throw new Error("zip: encrypted entry");
      if (usize > limit) throw new Error("zip: entry exceeds limit");
      if (u32(local) !== 0x04034b50) throw new Error("zip: bad local header");
      const start = local + 30 + u16(local + 26) + u16(local + 28);
      if (start + csize > bytes.length) throw new Error("zip: truncated entry");
      const data = bytes.subarray(start, start + csize);
      if (method === 0) return data.slice();
      if (method === 8) return inflate(data, limit);
      throw new Error("zip: unsupported method " + method);
    }
    return null;
  }
  function utf8(bytes) {
    const parts = [];
    for (let i = 0; i < bytes.length;) {
      let chunk = "";
      for (const stop = Math.min(bytes.length, i + 8192); i < stop;) {
        const b = bytes[i++];
        if (b < 0x80) chunk += String.fromCharCode(b);
        else if (b < 0xe0) chunk += String.fromCharCode(((b & 31) << 6) | (bytes[i++] & 63));
        else if (b < 0xf0) { chunk += String.fromCharCode(((b & 15) << 12) | ((bytes[i] & 63) << 6) | (bytes[i + 1] & 63)); i += 2; }
        else {
          const cp = (((b & 7) << 18) | ((bytes[i] & 63) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63)) - 0x10000; i += 3;
          chunk += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 1023));
        }
      }
      parts.push(chunk);
    }
    return parts.join("");
  }
  function parseCsv(text) {
    const header = text.slice(0, text.search(/\r?\n|$/));
    const sep = header.includes(";") && !header.includes(",") ? ";" : ",";
    const rows = [];
    let row = [], field = "", quoted = false, i = 0;
    if (text.charCodeAt(0) === 0xfeff) i = 1;
    for (; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c !== '"') field += c;
        else if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else if (c === '"' && field === "") quoted = true;
      else if (c === sep) { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else field += c;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }
  function pick(data, keys) {
    const out = {};
    for (const key of keys) if (Object.prototype.hasOwnProperty.call(data, key)) out[key] = data[key];
    return out;
  }
  const instances = new Map();

  function fail(message) { throw new Error("E64 configuration error: " + message); }

  // --- Staged connection diagnosis ---------------------------------------
  // The host reports a failed login or socket as a plain exception, and its
  // message is the only structured evidence a plugin gets. Every stage below
  // keeps that message and its code, adds a fixed classification, and states
  // what was expected and what to do next. Nothing here may echo a token, a
  // password, an auth header or a certificate body.
  const PLUGIN_VERSION = "0.7.6"; // Keep in step with manifest.json; a test enforces it.
  const DIAG_STEPS_MAX = 24, DIAG_TEXT_MAX = 600, CERT_PROBE_MS = 4000;
  const PIN_COMPARISON = "SHA-256 of the leaf certificate DER, lowercase hex, colons ignored";
  // No certificate can hash to this, so a host that accepts it does not enforce the pin.
  const UNMATCHABLE_SHA256 = "0000000000000000000000000000000000000000000000000000000000000000";
  // One vocabulary for the notification, the diagnostics bundle and the docs.
  const STAGE_LABEL = {
    dns: "DNS lookup", refused: "TCP connect (connection refused)", unreachable: "TCP connect (no route)",
    timeout: "TCP connect (timeout)", tls: "TLS handshake", certificate: "TLS certificate verification",
    fingerprint: "certificate pin (certSha256)", upgrade: "WebSocket upgrade", auth: "HTTP login authentication",
    protocol: "protocol/schema", backoff: "login backoff", config: "configuration", unknown: "connect"
  };
  function fingerprintGroups(hex) {
    const clean = typeof hex === "string" ? hex.replace(/[^0-9a-f]/gi, "").toUpperCase() : "";
    return clean ? clean.replace(/(..)(?!$)/g, "$1:") : "";
  }
  // One parser for the settings, the setup page and the docs: "the value after
  // sha256 Fingerprint=" with optional colons, spaces or hyphens and any case.
  // Anything else is refused with the reason; the pin is never repaired into
  // something that might verify the wrong certificate.
  function parseFingerprint(value) {
    if (typeof value !== "string") return {ok: false, reason: "is not text"};
    const raw = value.trim();
    const label = /^([A-Za-z0-9]+)\s*fingerprint\s*[:=]\s*/i.exec(raw);
    if (label && label[1].toUpperCase() !== "SHA256") {
      return {ok: false, reason: "is labelled " + label[1].toUpperCase() + "; certSha256 needs the SHA-256, not SHA-1, fingerprint (pass -sha256 to openssl)"};
    }
    const hex = raw.replace(/^sha256\s*fingerprint\s*[:=]\s*/i, "").replace(/[:\s-]/g, "").toLowerCase();
    if (!hex) return {ok: false, reason: "is empty"};
    if (!/^[0-9a-f]+$/.test(hex)) return {ok: false, reason: "has characters that are not hex; paste only the value after \"sha256 Fingerprint=\""};
    if (hex.length === 40) return {ok: false, reason: "is 40 hex characters, which is a SHA-1 fingerprint; the pin needs the SHA-256 (pass -sha256 to openssl)"};
    if (hex.length !== 64) return {ok: false, reason: "is " + hex.length + " hex characters after removing colons, spaces and hyphens; the pin needs 64 hex characters"};
    return {ok: true, hex, grouped: fingerprintGroups(hex)};
  }
  // Everything a diagnostics surface may print passes through here: configured
  // secrets by value, then auth material and certificate bodies by shape.
  function redactForReport(value, secrets, cap) {
    let text = String(value === undefined || value === null ? "" : value);
    for (const secret of secrets || []) {
      if (typeof secret === "string" && secret.length >= 4) text = text.split(secret).join("[redacted]");
    }
    text = text
      .replace(/-----BEGIN [A-Z0-9 ]+-----[\s\S]*?-----END [A-Z0-9 ]+-----/g, "[certificate body redacted]")
      .replace(/([?&](?:token|api[_-]?key|password|secret|auth))=[^\s&#'"]*/gi, "$1=[redacted]")
      .replace(/\b(authorization|proxy-authorization|www-authenticate|x-e64-local-token|set-cookie|cookie|phpsessid)\b\s*:\s*[^\r\n]+/gi, "[auth header redacted]")
      .replace(/\b(bearer)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [redacted]")
      .replace(/\b(password|passwd|pwd|secret|token)\b(\s*[:=]\s*)("[^"]*"|'[^']*'|\S+)/gi, "$1$2[redacted]");
    return cap === undefined ? text.slice(0, DIAG_TEXT_MAX) : text.slice(0, cap);
  }
  // A classify result is the whole story of one failed stage: a fixed class, the
  // expected value, what was actually observed and one next step.
  function classifyFailure(error, site, config) {
    const message = error && typeof error.message === "string" ? error.message
      : typeof error === "string" ? error : error === undefined || error === null ? "" : String(error);
    const code = error && typeof error.code === "string" ? error.code : null;
    const haystack = (message + " " + (code || "")).toLowerCase();
    const has = (...needles) => needles.some((needle) => haystack.indexOf(needle) >= 0);
    // "HTTP status code: 401" and "login HTTP 400", but never the port of a URL.
    const statusMatch = [/(?:^|[^-\w])status(?:\s+code)?\s*[:=]?\s*(\d{3})\b/, /\bhttp\s+(\d{3})\b/]
      .map((pattern) => pattern.exec(haystack)).filter(Boolean).sort((a, b) => a.index - b.index)[0];
    const base = {message, code, status: statusMatch ? Number(statusMatch[1]) : null, retryAfterMs: null};
    const result = (stage, expected, observed, next) => ({...base, stage, class: stage, expected, observed, next});
    const detail = message || "the host reported no message";
    if (has("eai_again", "enotfound", "getaddrinfo", "name or service not known", "nodename nor servname", "failed host lookup", "no address associated", "temporary failure in name resolution")) {
      return result("dns", (config && typeof config.host === "string" ? config.host : "the grinder's address") + " to resolve on this network",
        "the name lookup failed (" + detail + ")",
        "check the address for typos, then use the grinder's IP address instead of a name; this device must be on the same network");
    }
    if (has("econnrefused", "connection refused", "actively refused")) {
      return result("refused", "something listening on " + endpointOf(config, site),
        "the host answered but refused the TCP connection (" + detail + ")",
        "wake the grinder, then check " + endpointOf(config, site) + ": the E64 serves WSS on 9997 and its HTTPS login on 443");
    }
    if (has("enetunreach", "ehostunreach", "no route to host", "network is unreachable")) {
      return result("unreachable", "a route from this device to the grinder",
        "the network reported no route to the grinder (" + detail + ")",
        "connect this device to the same network as the grinder and check its address");
    }
    if (has("etimedout", "esockettimedout", "timed out", "timeout", "timeoutexception")) {
      return result("timeout", "an answer from " + endpointOf(config, site) + " within the connect timeout",
        "nothing answered before the timeout (" + detail + ")",
        "check that the grinder is powered and on this network; a firewall or a wrong address usually looks like this");
    }
    if (has("pin mismatch", "certificate pin", "pinned certificate", "fingerprint mismatch", "pin verification")
      || (has("pin") && has("mismatch", "does not match", "unexpected certificate", "not the pinned"))) {
      return result("fingerprint", expectedPin(config), redactForReport(detail),
        "compare certSha256 with " + fingerprintCommand(config) + "; case, colons and spaces do not matter, the 64 hex characters must match exactly");
    }
    if (has("certificate_verify_failed", "certificate verify failed", "self signed", "self-signed", "unable to verify", "certificate has expired", "hostname mismatch", "unknown ca", "bad certificate", "cert_")) {
      return result("certificate", expectedPin(config),
        "the host did not verify the grinder's certificate (" + detail + ")",
        "run " + fingerprintCommand(config) + " and pin that value in certSha256; a host without tlsPinSha256 support ignores the pin and falls back to platform validation");
    }
    if (has("handshakeexception", "handshake failed", "handshake error", "tls alert", "ssl_error", "sslexception", "wrong version number", "protocol version", "certificate required")) {
      return result("tls", "a TLS handshake before the request is sent",
        "the TLS handshake failed (" + detail + ")",
        "check the scheme and the port: 9997 is wss and 443 is https; a plain HTTP port or an intercepting proxy looks like this");
    }
    if (has("not upgraded", "upgrade rejected", "upgrade required", "websocket", "101 switching")) {
      return result("upgrade", "an HTTP 101 Switching Protocols upgrade",
        "the upgrade was refused (" + detail + ")",
        base.status === 401 || base.status === 403
          ? "the grinder rejected the session token: mint a fresh token or check the Owner password, then reconnect within the token's 5-minute life"
          : "check that the address and port are the WebSocket listener (9997), not the web interface");
    }
    if (site === "login" && (base.status === 401 || base.status === 403) || has("unauthorized", "forbidden", "401 unauthorized", "403 forbidden")) {
      return result("auth", "HTTP 2xx and a session token in the response",
        "the grinder refused the login (" + detail + ")",
        "check the Owner password for this grinder; a password changed on the grinder must be re-entered here");
    }
    if (has("invalid response", "unexpected", "schema", "not json", "malformed", "no data")) {
      return result("protocol", "an E64 reply with the documented fields",
        "the reply did not match the E64 schema (" + detail + ")",
        "check that this is an E64 on the configured port; a firmware change can rename fields, so attach the diagnostics bundle to a bug report");
    }
    return result("unknown", "a reachable grinder on the configured address and port",
      "the connect failed without a recognisable transport error (" + detail + ")",
      "re-check the address and port; attach the diagnostics bundle from the plugin's diagnostics page to a bug report");
  }
  // An entry in the staged record; timings are milliseconds, never wall-clock guesses.
  function stageStep(instance, stage, ok, ms, failure) {
    const diag = instance.diag;
    const step = {stage, ok, at: new Date().toISOString()};
    if (typeof ms === "number" && Number.isFinite(ms)) step.ms = ms;
    if (failure) { step.class = failure.stage; }
    diag.steps.push(step);
    if (diag.steps.length > DIAG_STEPS_MAX) diag.steps.splice(0, diag.steps.length - DIAG_STEPS_MAX);
    if (failure) {
      diag.lastFailure = {class: failure.stage, message: redactForReport(failure.message, instanceSecrets(instance)), code: failure.code, at: new Date().toISOString()};
      diag.last = failure;
    }
    return step;
  }
  // The staged log. At the quiet level it names the stages, their timings and
  // the class a failed one matched; the verbose level adds the underlying error
  // message and code, redacted.
  function stageLines(instance, verbose) {
    const lines = instance.diag.steps.map((step) => (step.ms === undefined ? "" : step.ms + " ms ") +
      step.stage + " " + (step.ok ? "ok" : "failed") + (step.class ? " (" + step.class + ")" : ""));
    const failure = instance.diag.lastFailure;
    if (verbose && failure) lines.push("last error: " + failure.class + " " + failure.message + " [code: " + (failure.code || "none") + "]");
    return lines;
  }
  // The bundle a user attaches to a bug report: version, platform, endpoint,
  // the TLS/pin summary, the staged steps with timings and the error class.
  // No token, password, auth header or certificate body can reach it.
  function diagnosticsBundle(instance) {
    const config = instance.config || {}, secrets = instanceSecrets(instance), failure = instance.diag.last;
    return {
      schema: "e64-diagnostics/1",
      plugin: {id: "mahlkoenig-e64.reaplugin", version: PLUGIN_VERSION},
      platform: runtimePlatform(),
      generatedAt: new Date().toISOString(),
      instance: {name: config.name, host: config.host, port: config.port, scheme: config.scheme, restPort: config.restPort,
        pollMs: config.pollMs, connected: Boolean(instance.connected), tokenSource: instance.tokenSource,
        mintTokens: Boolean(config.mintTokens), staticToken: Boolean(config.staticToken)},
      tls: {pinned: Boolean(config.certSha256), expectedFingerprint: config.certSha256 ? fingerprintGroups(config.certSha256) : null,
        observedFingerprint: instance.diag.observedFingerprint ? fingerprintGroups(instance.diag.observedFingerprint) : null,
        observedSource: instance.diag.observedFingerprint ? "confirmed by an enforced tlsPinSha256 probe" : "not exposed by the host transport; run the openssl command in docs/TROUBLESHOOTING.md",
        comparison: PIN_COMPARISON, hostPinSupport: instance.diag.hostPinSupport || "unknown",
        certificateBody: "never included"},
      fingerprintCommand: fingerprintCommand(config),
      stages: instance.diag.steps.slice(),
      error: failure ? {class: failure.stage, code: failure.code || null, status: failure.status || null,
        expected: failure.expected, observed: redactForReport(failure.observed, secrets), next: failure.next} : null,
      lastFailure: instance.diag.lastFailure ? {class: instance.diag.lastFailure.class, message: instance.diag.lastFailure.message,
        code: instance.diag.lastFailure.code, at: instance.diag.lastFailure.at} : null,
      redaction: "tokens, Owner passwords, auth headers and certificate bodies are removed before anything is returned"
    };
  }
  // The command that prints the value the host compares, for this grinder.
  // The exact "host:port" a stage talks to, so a message never leaves the user
  // guessing which of the two E64 ports failed.
  function endpointOf(config, site) {
    if (!config) return "<grinder-address>";
    const port = site === "login" || site === "cert"
      ? (Number.isInteger(config.restPort) ? config.restPort : 443)
      : (Number.isInteger(config.port) ? config.port : 9997);
    return (typeof config.host === "string" ? hostName(config) : "<grinder-address>") + ":" + port;
  }
  function fingerprintCommand(config) {
    const port = config && Number.isInteger(config.restPort) ? config.restPort : 443;
    const host = config && typeof config.host === "string" ? hostName(config) : "<grinder-ip>";
    return "`openssl s_client -connect " + host + ":" + port + " </dev/null 2>/dev/null | openssl x509 -noout -fingerprint -sha256`";
  }
  // The expected value for the two stages where the certificate is the subject.
  function expectedPin(config) {
    return config && config.certSha256
      ? "leaf SHA-256 fingerprint " + fingerprintGroups(config.certSha256) + " via certSha256"
      : "a certificate this host trusts, or the grinder's SHA-256 fingerprint in certSha256 (none is pinned)";
  }
  function failureSentence(failure, secrets, cap) {
    return "Expected " + failure.expected + ". " +
      "Observed: " + redactForReport(failure.observed, secrets, cap) + "." +
      (failure.status ? " HTTP status " + failure.status + "." : "") +
      (failure.retryAfterMs ? " Retry-After: " + Math.round(failure.retryAfterMs / 1000) + " s." : "") +
      " Next: " + failure.next + " [code: " + (failure.code || "none") + "]";
  }
  function loginDiagnosis(failure, secrets, cap) {
    const category = failure.status ? "login HTTP " + failure.status : "login " + failure.stage;
    const lead = failure.status ? "The login request reached the grinder and was answered HTTP " + failure.status + "."
      : failure.stage === "backoff" ? "The login request was not sent: the previous failure is still being backed off."
      : "The login request did not complete: it failed at " + STAGE_LABEL[failure.stage] + ".";
    return category + ". " + lead + " " + failureSentence(failure, secrets, cap);
  }
  function loginFailureError(failure, secrets) {
    const error = new Error(loginDiagnosis(failure, secrets));
    error.failure = failure;
    error.stage = failure.stage;
    error.category = failure.status ? "login HTTP " + failure.status : "login " + failure.stage;
    return error;
  }
  function runtimePlatform() {
    try { if (typeof process === "object" && process && typeof process.platform === "string") return process.platform + (process.arch ? "/" + process.arch : ""); } catch (_) {}
    try { if (typeof navigator === "object" && navigator && typeof navigator.userAgent === "string" && navigator.userAgent) return navigator.userAgent.slice(0, 120); } catch (_) {}
    return "unknown (the host exposes no platform)";
  }
  function fetchWithTimeout(request, init, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("connect timeout after " + ms + " ms")), ms);
      fetch(request, init).then((value) => { clearTimeout(timer); resolve(value); },
        (error) => { clearTimeout(timer); reject(error); });
    });
  }
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
    const localApiTokens = jsonSetting(settings, "ApiTokensJson", {});
    const mintTokens = jsonSetting(settings, "MintTokens", false);
    const allowNoPassword = jsonSetting(settings, "AllowNoPasswordWorkaround", false);
    const allowControl = jsonSetting(settings, "AllowControl", false);
    const populateGrinder = jsonSetting(settings, "PopulateGrinderRecord", true);
    const linkWorkflow = jsonSetting(settings, "LinkWorkflowGrinder", true);
    const syncWorkflow = jsonSetting(settings, "SyncWorkflowGrinder", true);
    const recordDose = jsonSetting(settings, "RecordGrindDose", false);
    const useLocalApi = jsonSetting(settings, "UseLocalApi", false);
    // DebugLog is the opt-in diagnostics level: staged progress keeps the
    // underlying error message and code, still redacted, when it is on.
    const debugLog = jsonSetting(settings, "DebugLog", false);
    if (typeof debugLog !== "boolean") fail("DebugLog must be true or false");
    if (typeof recordDose !== "boolean") fail("RecordGrindDose must be true or false");
    if (typeof syncWorkflow !== "boolean") fail("SyncWorkflowGrinder must be true or false");
    if (typeof populateGrinder !== "boolean" || typeof linkWorkflow !== "boolean") fail("PopulateGrinderRecord and LinkWorkflowGrinder must be true or false");
    if (typeof useLocalApi !== "boolean") fail("UseLocalApi must be true or false");
    const syncBacklight = jsonSetting(settings, "SyncBacklight", false);
    const owner = settings && settings.AdjustmentOwner !== undefined ? settings.AdjustmentOwner : "off";
    if (typeof allowControl !== "boolean" || typeof syncBacklight !== "boolean") fail("AllowControl and SyncBacklight must be true or false");
    if (!OWNERS.includes(owner)) fail("AdjustmentOwner must be off, grinder or decaid");
    if (!Array.isArray(rows) || rows.length > MAX || !tokens || Array.isArray(tokens) || typeof tokens !== "object") fail("invalid instance or token JSON");
    if (!passwords || Array.isArray(passwords) || typeof passwords !== "object") fail("PasswordsJson must be an object");
    if (!localApiTokens || Array.isArray(localApiTokens) || typeof localApiTokens !== "object") fail("ApiTokensJson must be an object");
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
      // The pin is parsed, never repaired: an unparsable value names what is
      // wrong with it instead of a bare "must be 64 hex characters".
      let certSha256 = null;
      if (row.certSha256 !== undefined) {
        if (typeof row.certSha256 !== "string") fail("certSha256 must be text holding the SHA-256 fingerprint of the grinder's certificate");
        const parsed = parseFingerprint(row.certSha256);
        if (!parsed.ok) fail("certSha256 " + parsed.reason);
        certSha256 = parsed.hex;
      }
      const restPort = row.restPort === undefined ? 443 : row.restPort;
      if (!Number.isInteger(restPort) || restPort < 1 || restPort > 65535) fail("restPort is invalid");
      if (!Number.isInteger(pollMs) || pollMs < 0 || (pollMs !== 0 && pollMs < 100) || pollMs > 3600000) fail("pollMs is out of bounds");
      const token = boundSecret(tokens, "TokensJson", id, "token", row.host);
      const password = boundSecret(passwords, "PasswordsJson", id, "password", row.host);
      const localApiToken = boundSecret(localApiTokens, "ApiTokensJson", id, "token", row.host);
      if (token.length > 2048) fail("TokensJson token is too long");
      if (password.length > 1024) fail("PasswordsJson password is too long");
      if (localApiToken.length > 2048) fail("ApiTokensJson token is too long");
      if (!mintTokens && !token) fail("each instance needs a token unless MintTokens is true");
      if (mintTokens && !token && !password && !allowNoPassword) fail("MintTokens needs a password or AllowNoPasswordWorkaround for " + id);
      ids.add(id);
      return {id, name, scheme, host: row.host, port: row.port, pollMs, token, certSha256, restPort,
        password, mintTokens, allowNoPassword, staticToken: Boolean(token), allowControl, syncBacklight, owner, populateGrinder, linkWorkflow, syncWorkflow, recordDose,
        useLocalApi, localApiToken, staticLocalApiToken: Boolean(localApiToken), debugLog};
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

  function url(config, token = config.token) {
    return config.scheme + "://" + hostName(config) + ":" + config.port + "/?token=" + encodeURIComponent(token);
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
    return {config, deviceId: null, context: null, transport: null, handle: null, epoch: 0, nextId: 0, pending: new Map(), poll: null, observationExpiry: null, connected: false, observations: {}, lastObservationAt: null, tokenSource: config.staticToken ? "static" : "none", lastMintAt: null, lastMintError: null, lastMintDiagnosis: null, mintFailures: 0, nextMintAt: null,
      // Staged record of the connect pipeline: what ran, how long it took and,
      // on failure, the fixed class plus the redacted underlying error.
      diag: {steps: [], last: null, lastFailure: null, verbose: Boolean(config.debugLog)},
      xenia: {syncWeight: 0, syncFilter: 0, lastScriptId: null, lastScriptAt: null},
      control: {allowControl: config.allowControl, debugMode: config.allowControl ? "unprobed" : "disabled", probedAt: null,
        owner: config.owner, syncBacklight: config.syncBacklight, lastAction: null, lastBrewEvent: null},
      grindEvents: [], lastGrindState: null,
      grindLog: {status: config.mintTokens ? "idle" : "needs-mint-tokens", lastAt: null, lastAttemptAt: null, lastError: null, failures: 0, nextAt: null, dueAt: null,
        errorClass: null, retryable: true, retryAfterMs: null},
      serviceRows: [], logTimer: null, restToken: null, restCookie: null,
      inventory: {status: config.populateGrinder ? "pending" : "disabled", grinderId: null, model: null, archived: false, workflowLink: null, duplicates: 0, lastSyncAt: null, lastError: null},
      workflow: {enabled: config.populateGrinder && config.syncWorkflow, lastWriteAt: null, lastWriteMs: 0, lastWritten: null, lastError: null, writes: 0,
        display: null, displayAt: 0, ddValueDum: null, meta: null, override: null, doseTarget: null, lastDose: null}, workflowTimer: null};
  }
  function clear(instance) {
    if (instance.poll !== null) clearTimeout(instance.poll); instance.poll = null; clearTimeout(instance.observationExpiry); instance.observationExpiry = null;
    if (instance.logTimer !== null) clearTimeout(instance.logTimer); instance.logTimer = null; instance.grindLog.dueAt = null;
    if (instance.workflowTimer !== null) clearTimeout(instance.workflowTimer); instance.workflowTimer = null;
  }
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
      trackGrind(instance, message.data, snapshot.observedSetting);
      noteSetting(instance, snapshot.observedSetting, message.data.ddValueDum);
      instance.context.publish(snapshot).then(item.resolve, item.reject);
    } else if (item.name === "action") {
      if (!message.data || typeof message.data !== "object" || Array.isArray(message.data)) { item.reject(new Error("E64 invalid action response")); return; }
      item.resolve(message.data);
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
  // Every value that must never appear in a message, a log line or a bundle.
  function instanceSecrets(instance) {
    const config = instance.config || {};
    return [config.token, config.password, config.localApiToken, instance.restToken, instance.restCookie];
  }
  async function mintToken(instance) {
    const config = instance.config, secrets = instanceSecrets(instance);
    if (instance.nextMintAt !== null && Date.now() < instance.nextMintAt) {
      const wait = Math.ceil((instance.nextMintAt - Date.now()) / 1000);
      throw loginFailureError({stage: "backoff", class: "backoff", code: null, status: null, retryAfterMs: instance.nextMintAt - Date.now(),
        message: "login backoff", expected: "the login backoff to have expired", observed: "a login attempt " + wait + " s before the backoff expired",
        next: "wait " + wait + " s; the delay doubles per failed login up to 5 minutes"}, secrets);
    }
    let role = "Owner", password = config.password;
    if (!password) {
      if (!config.allowNoPassword) throw new Error("no token, password or workaround configured");
      const payload = noPasswordPayload();
      role = payload.role; password = payload.password;
    }
    // The E64 REST API is HTTPS-only (443; HTTP 80 redirects), whatever the WebSocket scheme.
    let failure = null;
    let response = null;
    try {
      response = await fetch(restUrl(config, "login"), {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({userRole: role, password}),
        ...(config.certSha256 ? {tlsPinSha256: config.certSha256} : {})
      });
    } catch (error) {
      // The host's transport error is classified, never discarded: it names the
      // stage (DNS, TCP, TLS, certificate or pin) the login stopped at.
      failure = classifyFailure(error, "login", config);
    }
    if (!failure) {
      if (!response || !response.ok) {
        const status = response && Number.isInteger(response.status) ? response.status : null;
        const retryAfter = status === 429 && response.headers && response.headers.get ? retryAfterMs(response) : null;
        failure = {stage: "auth", class: "auth", code: null, status, retryAfterMs: retryAfter,
          message: "login HTTP " + (status === null ? "unknown" : status),
          expected: "HTTP 2xx and a session token for the Owner password",
          observed: "the grinder answered HTTP " + (status === null ? "unknown" : status) + " to POST " + restUrl(config, "login"),
          next: status === 429
            ? "the grinder is rate limiting; wait for the Retry-After window, then retry"
            : "check the Owner password for this grinder; a password changed on the grinder must be re-entered here"};
      } else {
        const auth = response.headers && response.headers.get ? response.headers.get("authorization") : "";
        if (auth && auth.startsWith("Bearer ") && auth.slice(7).trim()) {
          const cookie = /PHPSESSID=([^;,\s]+)/.exec(response.headers.get("set-cookie") || "");
          instance.restCookie = cookie ? cookie[1] : null;
          instance.restToken = auth.slice(7).trim();
          instance.tokenSource = config.password ? "password" : "workaround";
          instance.lastMintAt = new Date().toISOString();
          instance.lastMintError = null; instance.lastMintDiagnosis = null; instance.mintFailures = 0; instance.nextMintAt = null;
          loginNotice(instance, null);
          return auth.slice(7).trim();
        }
        failure = {stage: "protocol", class: "protocol", code: null, status: null, retryAfterMs: null,
          message: "login returned no bearer token",
          expected: "an HTTP 2xx login with a Bearer session token header",
          observed: "the login succeeded but the response carried no Bearer token",
          next: "check that this grinder's firmware returns the session token on POST /rest_api/login; attach the diagnostics bundle to a bug report"};
      }
    }
    instance.tokenSource = "none";
    instance.lastMintError = failure.status ? "login HTTP " + failure.status : "login " + failure.stage;
    instance.lastMintDiagnosis = loginDiagnosis(failure, secrets);
    instance.mintFailures++;
    instance.nextMintAt = Date.now() + Math.min(MINT_BACKOFF_MS * Math.pow(2, instance.mintFailures - 1), MINT_BACKOFF_MAX_MS);
    loginNotice(instance, failure);
    throw loginFailureError(failure, secrets);
  }
  // A failing login is a current condition the user must fix; withdraw it once a login succeeds.
  // The message names the stage, the expected value and one next step; the
  // blanket "check the password, certSha256 and address" is gone.
  function loginNotice(instance, failure) {
    const id = "login-" + instance.config.id;
    try {
      if (failure === null) host.dismissNotification(id);
      else host.notify({id, message: "E64 " + instance.config.name + ": " + loginDiagnosis(failure, instanceSecrets(instance), Infinity),
        action: {id: "help", label: "Help", type: "openExternalUrl", url: "https://github.com/MaxRink/decaid-e64ws-plugin/blob/main/docs/TROUBLESHOOTING.md"}});
    } catch (_) {}
  }
  // A grind is complete when the state leaves the grind family. The grind UUID
  // needs the machine-log ZIP, which the host fetch cannot return yet, so it stays null.
  function trackGrind(instance, data, setting) {
    const now = typeof data.grindState === "string" ? data.grindState.toLowerCase() : null;
    const was = instance.lastGrindState;
    instance.lastGrindState = now;
    // GbW/GbT phases name the grind mode; a plain Grind state does not.
    if (now && GRIND_STATES.includes(now) && /^gb[wt]/.test(now)) instance.grindMode = now.startsWith("gbw") ? "GbW" : "GbT";
    if (!was || !GRIND_STATES.includes(was) || (now && GRIND_STATES.includes(now))) return;
    const mode = instance.grindMode || null;
    instance.grindMode = null;
    const finite = (value) => typeof value === "number" && Number.isFinite(value) ? value : null;
    instance.grindEvents.unshift({grindUuid: null, completedAt: new Date().toISOString(), completedAtMs: Date.now(),
      targetWeightGr: finite(data.grindTargetWeightGr), resultWeightGr: finite(data.grindResultWeightGr),
      motorRunTimeMs: finite(data.motorRunTimeMs), overshootWeightGr: finite(data.overshootWeightGr), mode,
      // The load before grinding is the empty portafilter the grinder weighed.
      portafilterWeightGr: finite(data.grindStartWeightGr) > 0 ? Math.round(data.grindStartWeightGr * 10) / 10 : null,
      setting: setting === undefined ? null : setting, linkedShotId: null});
    instance.grindEvents.length = Math.min(instance.grindEvents.length, MAX_GRIND_EVENTS);
    queueLogDownload(instance, 0);
    const grind = instance.grindEvents[0];
    instance.workflow.meta = {ddValueDum: Number.isSafeInteger(data.ddValueDum) ? data.ddValueDum : null, displayedSetting: grind.setting, unit: "µm",
      lastGrind: {completedAt: grind.completedAt, targetWeightGr: grind.targetWeightGr, resultWeightGr: grind.resultWeightGr,
        motorRunTimeMs: grind.motorRunTimeMs, mode}};
    // RecordGrindDose: a grind-by-weight target becomes the workflow's dose.
    if (instance.config.recordDose && mode === "GbW" && grind.targetWeightGr > 0) instance.workflow.doseTarget = grind.targetWeightGr;
    scheduleWorkflowSync(instance, 0);
  }
  // --- Active workflow: grinder model, burrs, setting and pre-shot metadata ---
  // Decaid copies the active workflow into each shot, so keeping its context
  // current is how shots carry this grinder. Writes are rare and only on change.
  const WORKFLOW_MIN_MS = 3000, SETTING_STABLE_MS = 3000, USER_HOLD_MS = 10 * 60000;
  const ACTIVE_STATES = ["espresso", "steam", "hotWater", "flush"];
  let machineActive = false;
  function noteSetting(instance, display, ddValueDum) {
    const wf = instance.workflow;
    if (display === undefined || display === wf.display) return;
    wf.display = display; wf.ddValueDum = ddValueDum; wf.displayAt = Date.now();
    scheduleWorkflowSync(instance, SETTING_STABLE_MS);
  }
  function scheduleWorkflowSync(instance, delayMs) {
    const wf = instance.workflow;
    if (!wf.enabled || !instance.connected || instance.inventory.grinderId === null) return;
    const due = Math.max(Date.now() + delayMs, wf.lastWriteMs + WORKFLOW_MIN_MS, wf.displayAt + SETTING_STABLE_MS);
    if (instance.workflowTimer !== null) clearTimeout(instance.workflowTimer);
    instance.workflowTimer = setTimeout(() => { instance.workflowTimer = null; syncWorkflow(instance).catch(() => {}); }, Math.max(0, due - Date.now()));
  }
  // Returns the workflow link state: linked, kept-existing (another grinder is chosen) or deferred.
  async function syncWorkflow(instance) {
    const wf = instance.workflow, inventory = instance.inventory, config = instance.config;
    if (!wf.enabled || inventory.grinderId === null || inventory.archived) return "disabled";
    if (machineActive) return "deferred";
    if (Date.now() - wf.lastWriteMs < WORKFLOW_MIN_MS || (wf.display !== null && Date.now() - wf.displayAt < SETTING_STABLE_MS)) {
      scheduleWorkflowSync(instance, 0); return "deferred";
    }
    try {
      const record = await api("GET", "/api/v1/grinders/" + encodeURIComponent(inventory.grinderId));
      const workflow = await api("GET", "/api/v1/workflow");
      const context = workflow && workflow.context && typeof workflow.context === "object" ? workflow.context : {};
      const ours = context.grinderId === record.id;
      if (!ours && (context.grinderId || context.grinderModel || !config.linkWorkflow)) { wf.doseTarget = null; return (inventory.workflowLink = "kept-existing"); }
      inventory.workflowLink = "linked";
      const patch = {};
      if (!ours) patch.grinderId = record.id;
      // The grinder record is the user's: its model and burrs win.
      if (typeof record.model === "string" && context.grinderModel !== record.model) patch.grinderModel = record.model;
      if (typeof record.burrs === "string" && record.burrs && context.grinderBurrs !== record.burrs) patch.grinderBurrs = record.burrs;
      if (wf.display !== null && context.grinderSetting !== wf.display) {
        const current = typeof context.grinderSetting === "string" ? context.grinderSetting : null;
        let allow = true;
        // A value the plugin did not write is a user's (or Streamline's) choice: keep it
        // for 10 minutes unless the dial moves away from the reading it had then.
        if (current !== null && current !== wf.lastWritten) {
          if (!wf.override || wf.override.value !== current) wf.override = {value: current, at: Date.now(), dial: wf.display};
          allow = Date.now() - wf.override.at >= USER_HOLD_MS || wf.display !== wf.override.dial;
        }
        if (allow) patch.grinderSetting = wf.display;
      }
      const existing = context.extras && typeof context.extras === "object" ? context.extras[PLUGIN_ID] : undefined;
      if (wf.meta && JSON.stringify(existing) !== JSON.stringify(wf.meta)) patch.extras = {[PLUGIN_ID]: wf.meta};
      if (wf.doseTarget !== null && context.targetDoseWeight !== wf.doseTarget) patch.targetDoseWeight = wf.doseTarget;
      if (!Object.keys(patch).length) { wf.doseTarget = null; return "linked"; }
      await api("PUT", "/api/v1/workflow", {context: patch});
      wf.doseTarget = null;
      if (patch.grinderSetting !== undefined) { wf.lastWritten = patch.grinderSetting; wf.override = null; }
      Object.assign(wf, {lastWriteAt: new Date().toISOString(), lastWriteMs: Date.now(), lastError: null, writes: wf.writes + 1});
      return "linked";
    } catch (error) {
      wf.lastError = error && /HTTP|returned/.test(error.message) ? error.message : "workflow request failed";
      return "error";
    }
  }
  // Machine logs (Local API v1 when configured, otherwise the download_machine_logs
  // ZIP): after completed grinds, coalesced to at most one download per 10 minutes,
  // plus one idle refresh per 6 hours for the service log. Three failures in a row
  // suspend downloads, which then probe once per idle refresh and recover on the
  // first success. Only the parsed, bounded rows are kept; ZIP and CSV are dropped.
  //
  // A stalled socket must never pin the log at "downloading": every request races a
  // bounded deadline, so the finally block that reschedules always runs even when a
  // response never arrives. The deadline is the timer race, because the plugin's own
  // runtime (QuickJS) has no AbortController and no host timer it can read.
  //
  // The host is the real backstop: the Decaid plugin host bounds every plugin fetch
  // with fetchTimeout = 30 s and rejects the op with "fetch timeout", so a hung
  // request is released there whether or not this deadline fires first. The abort
  // below only reaches the socket where the runtime honours `signal`; the host's
  // fetch shim forwards only url/method/headers/body, so on a real host the 30 s
  // host timer releases the connection and the abort is a no-op.
  function fetchLogRequest(url, init, label) {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    let timer = null;
    const pending = Promise.resolve().then(() => fetch(url, controller ? {...init, signal: controller.signal} : init));
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        if (controller) { try { controller.abort(); } catch (error) {} }
        reject(new Error(label + " timeout"));
      }, LOG_REQUEST_TIMEOUT_MS);
    });
    return Promise.race([pending, deadline]).finally(() => { if (timer !== null) clearTimeout(timer); });
  }
  function queueLogDownload(instance, delayMs) {
    const log = instance.grindLog;
    if (!instance.connected || !instance.config.mintTokens || log.status === "unsupported-host") return;
    // A refusal (401/403) cannot be fixed by retrying the same token: park the log
    // until the next connection or configuration change.
    if (log.retryable === false) return;
    // A suspension is not fatal: it only stretches the next attempt to the idle
    // refresh, so one success can reset the counter without a new connection.
    const wait = log.status === "suspended" ? Math.max(delayMs, LOG_IDLE_REFRESH_MS) : delayMs;
    const due = Math.max(Date.now() + wait, log.nextAt === null ? 0 : log.nextAt);
    if (instance.logTimer !== null && log.dueAt !== null && log.dueAt <= due) return;
    if (instance.logTimer !== null) clearTimeout(instance.logTimer);
    log.dueAt = due;
    const epoch = instance.epoch;
    instance.logTimer = setTimeout(() => {
      instance.logTimer = null; log.dueAt = null;
      if (instance.epoch !== epoch) return;
      // downloadLogs counts its own failures, but an unexpected throw must not
      // escape as an unhandled rejection and must not leave "downloading" behind.
      downloadLogs(instance).catch(() => {
        if (log.status === "downloading") log.status = "failed";
        log.lastError = "grind log download failed";
      });
    }, Math.max(0, due - Date.now()));
  }
  async function downloadLogs(instance) {
    const log = instance.grindLog, config = instance.config, epoch = instance.epoch;
    if (!instance.connected || log.status === "unsupported-host") return;
    log.status = "downloading"; log.lastAttemptAt = new Date().toISOString(); log.nextAt = Date.now() + LOG_MIN_INTERVAL_MS;
    // Declared outside the try: the catch block reports it when the ZIP fails too.
    let localError = null;
    try {
      // The Local API is preferred, but a refusal there is not a dead end: the
      // vendor ZIP still gets one attempt before the attempt counts as a failure.
      if (hasLocalApi(config)) {
        try {
          await downloadLogsLocalApi(instance);
          markLogOk(log);
          return;
        } catch (error) {
          localError = error;
        }
      }
      if (!await downloadLogsZip(instance, config)) { log.status = "unsupported-host"; return; }
      markLogOk(log);
    } catch (error) {
      const cause = localError || error;
      const retryable = !(cause && cause.retryable === false);
      log.failures++;
      // Retry-After is a floor for every later attempt, including grind-triggered ones.
      if (cause && typeof cause.retryAfterMs === "number") log.nextAt = Math.max(log.nextAt, Date.now() + cause.retryAfterMs);
      Object.assign(log, {status: retryable ? (log.failures >= LOG_MAX_FAILURES ? "suspended" : "failed") : (cause.class || "failed"),
        errorClass: cause && typeof cause.class === "string" ? cause.class : "failed",
        retryable, retryAfterMs: cause && typeof cause.retryAfterMs === "number" ? cause.retryAfterMs : null,
        lastError: logErrorMessage(cause)});
    } finally {
      if (instance.epoch === epoch) queueLogDownload(instance, typeof log.retryAfterMs === "number" ? log.retryAfterMs : LOG_IDLE_REFRESH_MS);
    }
  }
  // lastError is rendered by the diagnostics page, so only the plugin's own
  // fixed prefixes pass through - capped, and never a device's raw text.
  function logErrorMessage(error) {
    const message = error && typeof error.message === "string" ? error.message : "";
    return /^(grind log|no matching|zip|inflate|login|local api)/.test(message)
      ? truncateCodePoints(message, LOG_ERROR_MAX) : "grind log download failed";
  }
  // Cap by code point, never by code unit: slicing a surrogate pair leaves a lone
  // half, which renders as a replacement character. Unpaired halves are dropped.
  function truncateCodePoints(text, max) {
    let out = "", count = 0;
    for (const character of text) {
      const code = character.codePointAt(0);
      if (code >= 0xd800 && code <= 0xdfff) continue;
      out += character;
      if (++count === max) break;
    }
    return out;
  }
  // Device error text is free-form and reaches the diagnostics page, so it is
  // cleaned before it is appended to a fixed prefix: C0, DEL and C1 controls become
  // spaces, zero-width and bidi overrides are dropped (they can disguise the rest of
  // the line), secrets are redacted as in the service log, and the result is capped
  // by code point so a surrogate pair is never split into a lone half.
  function localApiText(value) {
    const cleaned = String(value === undefined || value === null ? "" : value)
      .slice(0, 1000)
      .replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ")
      .replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) return "invalid response";
    // Redact first so an expansion cannot push a secret back into the window.
    const capped = truncateCodePoints(redact(cleaned), LOCAL_API_ERROR_MAX);
    return capped.trim() ? capped : "invalid response";
  }
  function markLogOk(log) {
    Object.assign(log, {status: "ok", lastAt: new Date().toISOString(), lastError: null, failures: 0,
      errorClass: null, retryable: true, retryAfterMs: null});
  }
  // The vendor ZIP path. Returns false when the host cannot serve ZIPs at all,
  // which is a permanent per-host condition rather than a failure.
  async function downloadLogsZip(instance, config) {
    // Reuse the connection's Owner session; log in again only when it was refused.
    const fetchZip = () => fetchLogRequest(restUrl(config, "download_machine_logs"), {
      method: "POST", body: "{}", responseType: "base64",
      headers: {"Content-Type": "application/json", Authorization: "Bearer " + instance.restToken, ...(instance.restCookie ? {Cookie: "PHPSESSID=" + instance.restCookie} : {})},
      ...(config.certSha256 ? {tlsPinSha256: config.certSha256} : {})
    }, "grind log");
    let response = instance.restToken ? await fetchZip() : null;
    if (!response || (!response.ok && response.status >= 400 && response.status < 500)) {
      await mintToken(instance);
      response = await fetchZip();
    }
    if (!response || typeof response.base64 !== "function") return false;
    if (!response.ok) throw new Error("grind log HTTP " + response.status);
    const bytes = fromBase64(await response.base64());
    const grindCsv = readZip(bytes, (name) => /GrindLogs[^/]*\.csv$/i.test(name), MAX_LOG_BYTES);
    const serviceCsv = readZip(bytes, (name) => /ServiceLogs[^/]*\.csv$/i.test(name), MAX_LOG_BYTES);
    if (!grindCsv && !serviceCsv) throw new Error("grind log CSV missing");
    if (grindCsv) {
      const rows = grindRows(utf8(grindCsv));
      for (const grind of instance.grindEvents) {
        if (grind.grindUuid) continue;
        const row = matchGrindRow(instance, grind, rows);
        if (!row) continue;
        applyGrindRow(grind, row);
        // The log usually arrives after the shot: complete the shot's grind block then.
        if (grind.doseShot) writeShotGrind(grind, false).catch(() => {});
      }
    }
    if (serviceCsv) mergeServiceRows(instance, utf8(serviceCsv));
    return true;
  }
  async function downloadLogsLocalApi(instance) {
    const config = instance.config;
    const headers = {"Content-Type": "application/json", "X-E64-Local-Token": config.localApiToken};
    if (instance.restCookie) headers.Cookie = "PHPSESSID=" + instance.restCookie;
    const pin = config.certSha256 ? {tlsPinSha256: config.certSha256} : {};
    const fetchJson = (route, body = {}) => fetchLogRequest(localApiUrl(config, route), {
      method: "POST", body: JSON.stringify(body),
      headers, ...pin
    }, "local api");
    // Fetch grind_log
    let response = await fetchJson("grind_log", {limit: 5000});
    if (!response || !response.ok) throw localApiStatusError("grind_log", response);
    let data = await response.json();
    if (!data || !data.success || !data.data || !data.data.rows) throw new Error("local api grind_log: " + localApiText(data && data.error));
    const rows = data.data.rows.map((row) => {
      // Convert Local API row format to CSV-like format for grindRows compatibility
      const flat = {};
      for (const [key, value] of Object.entries(row)) {
        flat[key] = value !== null && value !== undefined ? String(value) : "";
      }
      return flat;
    });
    // Process grind log rows
    for (const grind of instance.grindEvents) {
      if (grind.grindUuid) continue;
      const row = matchGrindRowLocalApi(instance, grind, rows);
      if (!row) continue;
      applyGrindRowLocalApi(grind, row);
      if (grind.doseShot) writeShotGrind(grind, false).catch(() => {});
    }
    // Fetch service_log
    response = await fetchJson("service_log", {limit: MAX_SERVICE_ROWS});
    if (!response || !response.ok) throw localApiStatusError("service_log", response);
    data = await response.json();
    if (!data || !data.success || !data.data || !data.data.rows) throw new Error("local api service_log: " + localApiText(data && data.error));
    mergeServiceRowsLocalApi(instance, data.data.rows);
  }
  function matchGrindRowLocalApi(instance, grind, rows) {
    const used = new Set(instance.grindEvents.map((event) => event.grindUuid).filter(Boolean));
    return rows.find((row) => {
      if (!row.grind_uuid || used.has(row.grind_uuid)) return false;
      const amount = Number(row.recipe_amount) / 1000;
      if (grind.targetWeightGr && Number.isFinite(amount) && amount > 0 && Math.abs(amount - grind.targetWeightGr) > 0.5) return false;
      const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(row.grind_date_time || "");
      return !m || Math.abs(new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() - grind.completedAtMs) <= LOG_MATCH_MS;
    }) || null;
  }
  function applyGrindRowLocalApi(grind, row) {
    const num = (key, scale = 1) => row[key] === undefined || row[key] === "" || !Number.isFinite(Number(row[key])) ? null : Number(row[key]) / scale;
    const um = (key) => { const dum = num(key); return dum === null ? null : String(Math.floor((dum + 5) / 10)); };
    const text = (key) => typeof row[key] === "string" && row[key] !== "" ? row[key].slice(0, 128) : null;
    grind.grindUuid = text("grind_uuid");
    grind.trigger = text("grind_trigger");
    grind.log = {grindWeightGr: num("grind_weight", 1000), grindDurationMs: num("grind_duration"), setting: um("grind_ddd"),
      successful: row.grind_successfull === undefined ? null : row.grind_successfull === "1" || row.grind_successfull === "true"};
    grind.recipe = {index: num("recipe_index"), uuid: text("recipe_uuid"), mode: text("recipe_mode"), type: text("recipe_type"),
      amountGr: num("recipe_amount", 1000), setting: um("recipe_coarseness"), brewTimeMs: num("recipe_brew_time"), brewWeightGr: num("recipe_brew_weight", 1000),
      icon: text("recipe_icon"), gbsEnabled: row.recipe_gbs_enabled === undefined || row.recipe_gbs_enabled === "" ? null : row.recipe_gbs_enabled === "1" || row.recipe_gbs_enabled === "true"};
  }
  function mergeServiceRowsLocalApi(instance, rows) {
    const byId = new Map();
    const index = (name) => {
      const idx = ["event_id", "event_type_id", "event_type", "event_date_time", "event_details"].indexOf(name);
      return idx >= 0 ? idx : -1;
    };
    for (const row of rows) {
      const id = Number(row.event_id);
      if (!Number.isSafeInteger(id) || id < 0) continue;
      byId.set(id, {id, eventTypeId: Number(row.event_type_id) || null, eventType: redact(row.event_type || "").slice(0, 64),
        eventDateTime: (row.event_date_time || "").slice(0, 32), details: redact(row.event_details || "")});
    }
    instance.serviceRows = Array.from(byId.values()).sort((a, b) => a.id - b.id).slice(-MAX_SERVICE_ROWS);
  }
  // Service-log rows are vendor free text: identifiers and network details are redacted.
  function redact(text) {
    return String(text).slice(0, 500)
      .replace(/\b(password|passwd|pwd|psk|pass|key|token|secret|bearer|session(?:id)?|ssid)\b(\s*[:=]?\s*)("[^"]*"|\S+)/gi, "$1$2<redacted>")
      .replace(/\bSN[\s:#=_-]*[A-Za-z0-9-]{4,}/g, "SN<redacted>")
      .replace(/\b(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}\b/gi, "<mac>")
      .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "<ip>")
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<id>")
      .replace(/\b[0-9a-f]{16,}\b/gi, "<id>")
      .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "<email>");
  }
  function mergeServiceRows(instance, text) {
    const table = parseCsv(text);
    if (!table.length) return;
    const header = table[0].map((name) => name.trim());
    const index = (name) => header.indexOf(name);
    const byId = new Map(instance.serviceRows.map((row) => [row.id, row]));
    for (const cells of table.slice(1)) {
      const id = Number(cells[index("event_id")]);
      if (!Number.isSafeInteger(id) || id < 0) continue;
      byId.set(id, {id, eventTypeId: Number(cells[index("event_type_id")]) || null, eventType: redact(cells[index("event_type")] || "").slice(0, 64),
        eventDateTime: (cells[index("event_date_time")] || "").slice(0, 32), details: redact(cells[index("event_details")] || "")});
    }
    instance.serviceRows = Array.from(byId.values()).sort((a, b) => a.id - b.id).slice(-MAX_SERVICE_ROWS);
  }
  function restUrl(config, route) {
    return "https://" + hostName(config) + (config.restPort === 443 ? "" : ":" + config.restPort) + "/rest_api/" + route;
  }
  function localApiUrl(config, route) {
    return "https://" + hostName(config) + (config.restPort === 443 ? "" : ":" + config.restPort) + "/rest_api/" + route;
  }
  function hasLocalApi(config) {
    return config.useLocalApi && config.staticLocalApiToken && config.localApiToken;
  }
  // A Local API status is classified so automations can tell a bad token from a
  // busy device without parsing prose. 401/403 cannot be fixed by retrying the
  // same token, so they never schedule another attempt.
  function localApiStatusError(route, response) {
    const status = response && Number.isInteger(response.status) ? response.status : 0;
    const error = new Error("local api " + route + " HTTP " + (status || "no response"));
    error.status = status;
    error.class = LOCAL_API_STATUS[status] || "failed";
    error.retryable = status !== 401 && status !== 403;
    error.retryAfterMs = status === 429 ? retryAfterMs(response) : null;
    return error;
  }
  // Retry-After is delta-seconds or an HTTP-date. Both are capped, so a broken or
  // hostile device cannot park the schedule for days. A value the runtime cannot
  // parse (Date.parse returns NaN for an unsupported form) yields null, and the
  // caller then falls back to the fixed idle refresh.
  function retryAfterMs(response) {
    const header = response && response.headers && typeof response.headers.get === "function" ? response.headers.get("retry-after") : null;
    if (header === null || header === undefined || header === "") return null;
    const text = String(header).trim();
    let ms = null;
    if (/^\d+$/.test(text)) ms = Number(text) * 1000;
    else { const at = Date.parse(text); if (Number.isFinite(at)) ms = at - Date.now(); }
    if (ms === null || !Number.isFinite(ms)) return null;
    return Math.min(Math.max(ms, 0), LOG_RETRY_AFTER_MAX_MS);
  }
  // Rows as objects, newest first (highest grind_id), at most 20.
  function grindRows(text) {
    const table = parseCsv(text);
    if (!table.length) return [];
    const header = table[0].map((name) => name.trim());
    return table.slice(1).filter((cells) => cells.length === header.length)
      .map((cells) => Object.fromEntries(header.map((name, i) => [name, cells[i]])))
      .sort((a, b) => Number(b.grind_id) - Number(a.grind_id)).slice(0, 20);
  }
  // The newest unused row whose recipe amount matches the observed target and
  // whose device time lies within 10 minutes of the observed completion.
  function matchGrindRow(instance, grind, rows) {
    const used = new Set(instance.grindEvents.map((event) => event.grindUuid).filter(Boolean));
    return rows.find((row) => {
      if (!row.grind_uuid || used.has(row.grind_uuid)) return false;
      const amount = Number(row.recipe_amount) / 1000;
      if (grind.targetWeightGr && Number.isFinite(amount) && amount > 0 && Math.abs(amount - grind.targetWeightGr) > 0.5) return false;
      const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(row.grind_date_time || "");
      return !m || Math.abs(new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() - grind.completedAtMs) <= LOG_MATCH_MS;
    }) || null;
  }
  function applyGrindRow(grind, row) {
    const num = (key, scale = 1) => row[key] === undefined || row[key] === "" || !Number.isFinite(Number(row[key])) ? null : Number(row[key]) / scale;
    const um = (key) => { const dum = num(key); return dum === null ? null : String(Math.floor((dum + 5) / 10)); };
    const text = (key) => typeof row[key] === "string" && row[key] !== "" ? row[key].slice(0, 128) : null;
    grind.grindUuid = text("grind_uuid");
    grind.trigger = text("grind_trigger");
    grind.log = {grindWeightGr: num("grind_weight", 1000), grindDurationMs: num("grind_duration"), setting: um("grind_ddd"),
      successful: row.grind_successfull === undefined ? null : row.grind_successfull === "1" || row.grind_successfull === "true"};
    grind.recipe = {index: num("recipe_index"), uuid: text("recipe_uuid"), mode: text("recipe_mode"), type: text("recipe_type"),
      amountGr: num("recipe_amount", 1000), setting: um("recipe_coarseness"), brewTimeMs: num("recipe_brew_time"), brewWeightGr: num("recipe_brew_weight", 1000),
      icon: text("recipe_icon"), gbsEnabled: row.recipe_gbs_enabled === undefined || row.recipe_gbs_enabled === "" ? null : row.recipe_gbs_enabled === "1" || row.recipe_gbs_enabled === "true"};
  }
  // Debug-mode probe on a throwaway connection with its own token: a locked
  // image closes the socket on any dev=1 command, so the main session is never
  // used. RequestLogMessages is a read-only dev=1 type without side effects; its
  // reply is discarded.
  async function probeDebugMode(instance) {
    const control = instance.control, config = instance.config;
    if (!config.mintTokens) { control.debugMode = "unprobed-static-token"; return; }
    let token;
    try { token = await mintToken(instance); } catch (_) { control.debugMode = "unknown"; control.probedAt = new Date().toISOString(); return; }
    await probeWithToken(instance, token);
  }
  async function probeWithToken(instance, token) {
    const control = instance.control, config = instance.config;
    let handle = null;
    try {
      const pin = config.scheme === "wss" && config.certSha256 ? {tlsPinSha256: config.certSha256} : {};
      handle = (await host.transport.open({kind: "websocket", url: url(config, token), ...pin})).handle;
      control.debugMode = await new Promise((resolve) => {
        const timer = setTimeout(() => resolve("unknown"), PROBE_MS);
        host.transport.onEvent(handle, (event) => {
          if (event.type === "close" || event.type === "error") { clearTimeout(timer); resolve("locked"); return; }
          if (event.type !== "data" || event.dataType !== "text") return;
          let message; try { message = JSON.parse(event.data); } catch (_) { return; }
          if (message && message.type === commands.probe[1] && message.refId === 1) { clearTimeout(timer); resolve("available"); }
        });
        host.transport.send(handle, {type: "text", data: JSON.stringify({type: commands.probe[0], msgId: 1, data: {}})}).catch(() => { clearTimeout(timer); resolve("locked"); });
      });
    } catch (error) {
      // The probe is best-effort, but its reason belongs in the diagnostics.
      control.debugMode = "unknown";
      control.probeError = failureSentence(classifyFailure(error, "open", config), instanceSecrets(instance), Infinity);
    } finally {
      control.probedAt = new Date().toISOString();
      if (handle !== null) await host.transport.close(handle).catch(() => {});
    }
  }
  function action(instance, actionType, data) {
    if (!ALLOWED_ACTIONS.includes(actionType)) return Promise.reject(new Error("E64 action not allowed: " + actionType));
    if (instance.control.debugMode !== "available") return Promise.reject(new Error("E64 control is unavailable: debug mode " + instance.control.debugMode));
    const record = (ok, error) => { instance.control.lastAction = {actionType, ok, error: error || null, at: new Date().toISOString()}; controlNotice(instance, ok ? null : actionType + " failed: " + error); };
    return request(instance, "action", false, {actionType, ...data}).then((result) => {
      if (result.success !== true) throw new Error("rejected by the grinder");
      record(true); return result;
    }, (error) => { throw error; }).catch((error) => { record(false, error.message); throw new Error("E64 " + actionType + " failed: " + error.message); });
  }
  function controlNotice(instance, failure) {
    const id = "control-" + instance.config.id;
    try {
      if (failure === null) host.dismissNotification(id);
      else host.notify({id, message: "E64 " + instance.config.name + ": " + failure + "."});
    } catch (_) {}
  }
  function controlHandlers(instance) {
    const state = () => instance.observations.state || {};
    return {
      // Grind by weight with the grinder's own target; an unbounded manual grind is never started remotely.
      start: () => {
        const target = state().grindTargetWeightGr;
        if (!(typeof target === "number" && target > 0)) return Promise.reject(new Error("E64 has no grind-by-weight target"));
        return action(instance, "StartGrindGbw", {targetWeightGr: target}).then(() => {});
      },
      stop: () => action(instance, "Stop", {}).then(() => {}),
      setGrindSetting: (setting) => {
        if (instance.control.owner !== "decaid") return Promise.reject(new Error("E64 grind setting writes need AdjustmentOwner decaid"));
        const value = typeof setting === "string" && /^\d{1,5}$/.test(setting.trim()) ? Number(setting.trim()) : NaN;
        const current = state().ddValueDum;
        if (!Number.isSafeInteger(current)) return Promise.reject(new Error("E64 has no current grind setting"));
        // Firmware range limits are variant-specific and not recovered, so each move stays near the current reading.
        if (!Number.isInteger(value) || Math.abs(value - Math.floor((current + 5) / 10)) > MAX_STEP_UM) {
          return Promise.reject(new Error("E64 grind setting must be whole micrometres within " + MAX_STEP_UM + " of the current value"));
        }
        return action(instance, "SetAgsaTargetDdValue", {targetDdValue: value * 10}).then(() => {});
      }
    };
  }
  let machineSleeping = null;
  function syncBacklight(payload) {
    const sleeping = Boolean(payload.state && payload.state.state === "sleeping");
    if (sleeping === machineSleeping) return;
    const first = machineSleeping === null;
    machineSleeping = sleeping;
    if (first && !sleeping) return;
    for (const instance of instances.values()) {
      if (instance.control.syncBacklight && instance.connected && instance.control.debugMode === "available") {
        action(instance, "SetBacklightBrightness", {brightness: sleeping ? 0 : 100}).catch(() => {});
      }
    }
  }
  // AdjustmentOwner "grinder": report a finished Decaid shot to the grinder's GbS
  // as a brew event for the grind that preceded it.
  async function brewEvent(instance, shotId) {
    const result = (status, reason) => { instance.control.lastBrewEvent = {shotId, status, reason: reason || null, at: new Date().toISOString()}; };
    try {
      const response = await fetch(DECAID_API + "/api/v1/shots/" + encodeURIComponent(shotId));
      if (!response.ok) return result("skipped", "shot unavailable");
      const shot = JSON.parse(await response.text());
      const samples = Array.isArray(shot.measurements) ? shot.measurements : [];
      const times = samples.map((sample) => Date.parse(sample && sample.machine && sample.machine.timestamp)).filter(Number.isFinite);
      const brewTimeMs = times.length > 1 ? times[times.length - 1] - times[0] : 0;
      const weight = samples.length && samples[samples.length - 1].scale ? Number(samples[samples.length - 1].scale.weight) : NaN;
      const startedAt = shotStartedAt(shot);
      if (!(brewTimeMs > BREW_MIN_MS)) return result("skipped", "shot not longer than 10 s");
      if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(startedAt)) return result("skipped", "shot has no weight or start time");
      const grind = grindForShot(instance, shotId, startedAt);
      if (!grind) return result("skipped", "no successful grind within 5 min before the shot");
      grind.linkedShotId = shotId;
      if (!grind.grindUuid) return result("skipped", "grind uuid unavailable");
      await action(instance, "AddBrewEvent", {grindUuid: grind.grindUuid, machineName: "Decent DE1", groupHead: "1", doseIndex: 0,
        validity: true, brewTimeMs: Math.round(brewTimeMs), brewWeightMg: Math.round(weight * 1000)});
      result("sent");
    } catch (error) {
      result("failed", error && error.message ? error.message : "brew event failed");
    }
  }
  // Same linkage as assisted dial-in: the newest successful grind not used by
  // another shot that completed at most 5 min before the shot start, or up to
  // 1 min after it (clock skew).
  function grindForShot(instance, shotId, startedAt) {
    return instance.grindEvents.find((candidate) => (candidate.linkedShotId === null || candidate.linkedShotId === shotId) &&
      !(candidate.log && candidate.log.successful === false) &&
      candidate.completedAtMs - startedAt <= LINK_AFTER_MS && startedAt - candidate.completedAtMs <= LINK_BEFORE_MS) || null;
  }
  // The shot record's timestamp carries no zone, so the start seen on the
  // machine's state stream is preferred.
  let espressoStartMs = null, inEspresso = false;
  function shotStartedAt(shot) {
    return espressoStartMs !== null && Date.now() - espressoStartMs < LINK_BEFORE_MS + 30 * 60000 ? espressoStartMs : Date.parse(shot.timestamp);
  }
  // RecordGrindDose: the grind before a shot becomes the shot's actual dose,
  // with the grind's details under annotations.extras.
  async function recordShotDose(instance, shotId) {
    const result = (status, reason) => { instance.workflow.lastDose = {shotId, status, reason: reason || null, at: new Date().toISOString()}; };
    try {
      const shot = await api("GET", "/api/v1/shots/" + encodeURIComponent(shotId));
      const context = shot.workflow && shot.workflow.context ? shot.workflow.context : {};
      if (instance.inventory.grinderId === null || context.grinderId !== instance.inventory.grinderId) return result("skipped", "the shot's workflow names another grinder");
      const startedAt = shotStartedAt(shot);
      const grind = grindForShot(instance, shotId, startedAt);
      if (!grind) return result("skipped", "no grind within 5 min before the shot");
      if (!(grind.resultWeightGr > 0)) return result("skipped", "the grinder reported no ground weight");
      grind.linkedShotId = shotId;
      grind.doseShot = {id: shotId, startedAt};
      await writeShotGrind(grind, true);
      result("recorded");
    } catch (error) {
      result("failed", error && error.message ? error.message : "dose recording failed");
    }
  }
  // The shot's grind block: what was ground, how the grind was started, and the
  // recipe the grinder used. Log-derived fields stay null until the grinder log
  // has been read. withDose also sets the shot's actual dose; a later refresh
  // leaves the dose alone so an edit made in the meantime is kept.
  function writeShotGrind(grind, withDose) {
    const round = (value, digits) => typeof value === "number" ? Math.round(value * Math.pow(10, digits)) / Math.pow(10, digits) : null;
    const log = grind.log || {}, recipe = grind.recipe || null, trigger = grind.trigger || null;
    const near = (a, b, tolerance) => typeof a === "number" && typeof b === "number" ? Math.abs(a - b) <= tolerance : null;
    const details = {completedAt: grind.completedAt, secondsBeforeShot: Math.round((grind.doseShot.startedAt - grind.completedAtMs) / 1000), mode: grind.mode || null,
      targetWeightGr: grind.targetWeightGr, resultWeightGr: grind.resultWeightGr,
      deviationGr: grind.targetWeightGr > 0 ? round(grind.resultWeightGr - grind.targetWeightGr, 3) : null,
      overshootWeightGr: grind.overshootWeightGr === undefined ? null : grind.overshootWeightGr, motorRunTimeMs: grind.motorRunTimeMs,
      setting: grind.setting, grindUuid: grind.grindUuid, grindDurationMs: log.grindDurationMs === undefined ? null : log.grindDurationMs,
      successful: log.successful === undefined ? null : log.successful,
      trigger, portafilterRecognized: trigger === null ? null : trigger === "PortafilterDetection",
      portafilterWeightGr: grind.portafilterWeightGr === undefined ? null : grind.portafilterWeightGr,
      recipe: recipe && {...recipe,
        // Whether the grinder applied the recipe: its dose within 0.5 g of the
        // weighed result, its coarseness equal to the displayed setting.
        doseApplied: near(recipe.amountGr, grind.resultWeightGr, 0.5),
        settingApplied: recipe.setting === null || (log.setting || grind.setting) == null ? null : recipe.setting === (log.setting || grind.setting)}};
    const annotations = {extras: {[PLUGIN_ID]: {grind: details}}};
    if (withDose) annotations.actualDoseWeight = round(grind.resultWeightGr, 1);
    return api("PUT", "/api/v1/shots/" + encodeURIComponent(grind.doseShot.id), {annotations});
  }
  // --- Decaid grinder inventory -------------------------------------------
  // One Decaid grinder record per instance, so shots carry this grinder. The
  // user owns the record after creation: only plugin-owned extras change.
  const PLUGIN_ID = "mahlkoenig-e64.reaplugin", DAY_MS = 86400000;
  async function api(method, path, body) {
    const response = await fetch(DECAID_API + path, {method, ...(body === undefined ? {} : {headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)})});
    if (!response || !response.ok) throw new Error(path.split("?")[0] + " HTTP " + (response && response.status));
    return JSON.parse(await response.text());
  }
  async function syncInventory(instance, epoch) {
    const inventory = instance.inventory, config = instance.config;
    if (!config.populateGrinder || inventory.syncing) return;
    inventory.syncing = true;
    try {
      const list = await api("GET", "/api/v1/grinders?includeArchived=true");
      if (!Array.isArray(list)) throw new Error("/api/v1/grinders returned no list");
      if (epoch !== instance.epoch) return;
      const owned = (g) => g && g.extras && typeof g.extras === "object" && g.extras.source === PLUGIN_ID && g.extras.instanceId === config.id;
      // A reload racing an earlier generation's creation can leave two records; the oldest wins and nothing is deleted.
      const mineAll = list.filter(owned).sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
      const mine = mineAll[0];
      inventory.duplicates = Math.max(0, mineAll.length - 1);
      const own = () => ({source: PLUGIN_ID, instanceId: config.id, unit: "µm (grinder display)", deviceId: instance.deviceId, lastSeenAt: new Date().toISOString()});
      let record;
      if (mine) {
        if (mine.archived === true) {
          Object.assign(inventory, {status: "archived", grinderId: mine.id, model: mine.model, archived: true, workflowLink: null, lastError: null, lastSyncAt: new Date().toISOString()});
          return;
        }
        const seen = Date.parse(mine.extras.lastSeenAt);
        record = !Number.isFinite(seen) || Date.now() - seen >= DAY_MS || mine.extras.deviceId !== instance.deviceId
          ? await writeOwnExtras(mine.id, own()) : mine;
        inventory.status = "linked";
      } else {
        const adoptable = list.find((g) => g && g.archived !== true && typeof g.model === "string" && /E64/i.test(g.model) &&
          !(g.extras && typeof g.extras === "object" && g.extras.source));
        if (adoptable) {
          record = await writeOwnExtras(adoptable.id, own());
          inventory.status = "adopted";
        } else {
          let grinderType = null;
          try { grinderType = (await request(instance, "machineInfo", false)).grinderType; } catch (_) {}
          if (epoch !== instance.epoch) return;
          const known = typeof grinderType === "string" && /^E64\b/i.test(grinderType) ? "Mahlkönig " + grinderType : null;
          record = await api("POST", "/api/v1/grinders", {model: known || inventory.model || "Mahlkönig E64 WS", burrs: "64 mm flat (stock)",
            burrSize: 64, burrType: "flat", settingType: "numeric", settingSmallStep: 1, settingBigStep: 10, extras: own()});
          inventory.status = "created";
        }
      }
      Object.assign(inventory, {grinderId: record.id, model: record.model, archived: false, lastError: null, lastSyncAt: new Date().toISOString()});
      inventory.workflowLink = instance.workflow.enabled ? await syncWorkflow(instance) : config.linkWorkflow ? await linkWorkflow(record) : "disabled";
    } catch (error) {
      Object.assign(inventory, {status: "error", lastError: error && /HTTP|returned/.test(error.message) ? error.message : "inventory request failed"});
    } finally {
      inventory.syncing = false;
    }
  }
  // Decaid's grinder PUT replaces `extras` wholesale and has no precondition, and
  // other plugins (assisted dial-in) keep their own keys there. So: read the record
  // right before writing, change only this plugin's keys, read back, and retry
  // (3 attempts, with jitter) if ours did not land or another writer's key vanished.
  const OWN_EXTRAS = ["source", "instanceId", "unit", "deviceId", "lastSeenAt"];
  async function writeOwnExtras(id, own) {
    const path = "/api/v1/grinders/" + encodeURIComponent(id);
    const extrasOf = (record) => record && record.extras && typeof record.extras === "object" && !Array.isArray(record.extras) ? record.extras : {};
    for (let attempt = 1; ; attempt++) {
      const before = extrasOf(await api("GET", path));
      const others = Object.keys(before).filter((key) => !OWN_EXTRAS.includes(key));
      await api("PUT", path, {extras: {...before, ...own}});
      const after = await api("GET", path), stored = extrasOf(after);
      const landed = OWN_EXTRAS.every((key) => JSON.stringify(stored[key]) === JSON.stringify(own[key]));
      if (landed && others.every((key) => Object.prototype.hasOwnProperty.call(stored, key))) return after;
      if (attempt >= 3) throw new Error("/api/v1/grinders write conflict HTTP 409");
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt + Math.floor(Math.random() * 200)));
    }
  }
  // Fill the workflow's grinder only when it names none; other fields are untouched
  // (PUT /api/v1/workflow deep-merges a partial body).
  async function linkWorkflow(record) {
    const workflow = await api("GET", "/api/v1/workflow");
    const context = workflow && workflow.context && typeof workflow.context === "object" ? workflow.context : {};
    if (context.grinderId === record.id) return "linked";
    if (context.grinderId || context.grinderModel) return "kept-existing";
    await api("PUT", "/api/v1/workflow", {context: {grinderId: record.id, grinderModel: record.model}});
    return "linked";
  }
  function disconnect(instance, expectedEpoch, reason) {
    if (expectedEpoch !== undefined && expectedEpoch !== instance.epoch) return Promise.resolve();
    const transport = instance.transport, handle = instance.handle;
    instance.epoch++; instance.connected = false; instance.transport = null; instance.handle = null; instance.context = null; clear(instance); rejectAll(instance, reason || "E64 disconnected");
    if (instance.config && instance.config.mintTokens && !instance.config.staticToken) { instance.config.token = ""; instance.tokenSource = "none"; }
    instance.restToken = null; instance.restCookie = null;
    return transport && handle ? transport.close(handle).catch(() => {}) : Promise.resolve();
  }
  // One sentence per failed connect attempt: the stage, the underlying host
  // error with its code, the expected value, what was observed and one next
  // step. Every configured secret is redacted before it is returned.
  function connectDiagnosis(instance, error) {
    const secrets = instanceSecrets(instance), failure = error && error.failure ? error.failure : classifyFailure(error, "open", instance.config);
    const head = "E64 connection failed at " + STAGE_LABEL[failure.stage] + ". ";
    if (error && error.failure) return {failure, message: head + redactForReport(error.message, secrets, Infinity)};
    return {failure, message: head + failureSentence(failure, secrets, Infinity)};
  }
  // The connect failure is a current condition, so it is visible in Decaid
  // instead of only in whatever the host does with a rejected handler.
  function connectNotice(instance, diagnosis) {
    const id = "connect-" + instance.config.id;
    try {
      if (diagnosis === null) host.dismissNotification(id);
      else host.notify({id, message: "E64 " + instance.config.name + ": " + diagnosis.replace(/^E64 /, ""),
        action: {id: "help", label: "Help", type: "openExternalUrl", url: "https://github.com/MaxRink/decaid-e64ws-plugin/blob/main/docs/TROUBLESHOOTING.md"}});
    } catch (_) {}
  }
  async function connect(instance, context) {
    await disconnect(instance);
    const epoch = ++instance.epoch; const transport = context.transport;
    instance.context = context; instance.transport = transport; instance.observations = {}; instance.lastObservationAt = null;
    instance.diag.steps.length = 0;
    try {
      if (!instance.config.token && instance.config.mintTokens) {
        const started = Date.now();
        let token;
        try { token = await mintToken(instance); }
        catch (error) {
          stageStep(instance, "token", false, Date.now() - started, error && error.failure ? error.failure : classifyFailure(error, "login", instance.config));
          throw error;
        }
        stageStep(instance, "token", true, Date.now() - started);
        if (epoch !== instance.epoch) return;
        instance.config.token = token;
      }
      const pin = instance.config.scheme === "wss" && instance.config.certSha256 ? {tlsPinSha256: instance.config.certSha256} : {};
      const opening = Date.now();
      let opened;
      try { opened = await transport.open({kind: "websocket", url: url(instance.config), ...pin}); }
      catch (error) {
        stageStep(instance, "websocket", false, Date.now() - opening, classifyFailure(error, "open", instance.config));
        throw error;
      }
      stageStep(instance, "websocket", true, Date.now() - opening);
      if (epoch !== instance.epoch) { await transport.close(opened.handle).catch(() => {}); return; }
      instance.handle = opened.handle; instance.connected = true;
      transport.onEvent(opened.handle, (eventValue) => event(instance, epoch, opened.handle, eventValue));
      const polling = Date.now();
      try { await request(instance, "state", true); }
      catch (error) { stageStep(instance, "state", false, Date.now() - polling, classifyFailure(error, "state", instance.config)); throw error; }
      stageStep(instance, "state", true, Date.now() - polling);
      connectNotice(instance, null);
      schedule(instance, epoch);
      syncInventory(instance, epoch);
      // A new connection lifts a suspension and allows one idle refresh if none ran in 6 hours.
      if (instance.grindLog.status === "suspended" || instance.grindLog.retryable === false) {
        Object.assign(instance.grindLog, {status: "idle", failures: 0, retryable: true, errorClass: null, retryAfterMs: null});
      }
      const lastLog = Date.parse(instance.grindLog.lastAttemptAt);
      queueLogDownload(instance, Number.isFinite(lastLog) ? Math.max(LOG_CONNECT_DELAY_MS, lastLog + LOG_IDLE_REFRESH_MS - Date.now()) : LOG_CONNECT_DELAY_MS);
    } catch (error) {
      await disconnect(instance, epoch, "E64 connection failed");
      // Host WebSocket errors can echo the connect URL, which carries the token.
      const diagnosis = connectDiagnosis(instance, error);
      instance.diag.lastFailure = {class: diagnosis.failure.stage, message: redactForReport(error && error.message, instanceSecrets(instance)),
        code: diagnosis.failure.code || null, at: new Date().toISOString()};
      instance.diag.last = diagnosis.failure;
      connectNotice(instance, diagnosis.message);
      const wrapped = new Error(diagnosis.message);
      wrapped.failure = diagnosis.failure;
      wrapped.stage = diagnosis.failure.stage;
      throw wrapped;
    }
  }
  function request(instance, name, publish, payload) {
    if (!instance.connected || !instance.transport || !instance.handle) return Promise.reject(new Error("E64 is disconnected"));
    // Diagnostics reads must not starve the single in-flight state poll.
    if (!publish && instance.pending.size >= MAX_PENDING) return Promise.reject(new Error("E64 request queue is full"));
    const epoch = instance.epoch, id = ++instance.nextId, command = commands[name];
    return new Promise((resolve, reject) => {
      const item = {epoch, type: command[1], name, publish, resolve, reject, timer: setTimeout(() => { if (instance.pending.delete(id)) reject(new Error("E64 request timed out")); }, TIMEOUT)};
      instance.pending.set(id, item);
      instance.transport.send(instance.handle, {type: "text", data: JSON.stringify({type: command[0], msgId: id, data: payload || {}})}).catch(() => { if (instance.pending.delete(id)) { clearTimeout(item.timer); reject(new Error("E64 request failed")); } });
    });
  }
  // --- Setup assistant and HTML pages (plugin-ui kit) ------------------------
  // The standard E64 web certificate: every unit ships the same one (see docs/CERTIFICATE_TRUST.md).
  const FLEET_SHA256 = "91b412ee014f21c3bb2445430b6a3d77903334a1300ad84f1980ab2c5f53620b";
  const SETUP_TEST_MS = 3000;
  let needsSetup = null, lastSetupTest = 0;
  function setupNotice(message) {
    try {
      if (message === null) host.dismissNotification("setup");
      else host.notify({id: "setup", message: "Mahlkönig E64 needs setup: " + message + " Open Decaid > Settings > Plugins > Mahlkönig E64 > Set up."});
    } catch (_) {}
  }
  function validate(settings) {
    try {
      const configs = configuration(settings);
      return {errors: configs.length ? [] : ["No grinder is configured yet."], configs};
    } catch (error) {
      return {errors: [String(error.message).replace(/^E64 configuration error: /, "")], configs: []};
    }
  }
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]);
  function htmlPage(title, body, script) {
    return {status: 200, headers: {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store"},
      body: "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>" +
        escapeHtml(title) + "</title><style>" + PLUGIN_UI.css + "</style><body class=\"pu\"><main class=\"pu-page\" id=\"page\">" + body +
        "</main><script>" + PLUGIN_UI.js + "</script><script>" + script + "</script></body></html>"};
  }
  function setupStatus() {
    return {needsSetup: needsSetup !== null, message: needsSetup, instances: Array.from(instances.values()).map((instance) => ({
      id: instance.config.id, name: instance.config.name, deviceId: instance.deviceId, connected: instance.connected,
      displayedSetting: instance.workflow.display, debugMode: instance.control.debugMode, inventory: instance.inventory.status,
      diagnosis: instance.diag.last ? {stage: instance.diag.last.stage, message: failureSentence(instance.diag.last, instanceSecrets(instance))} : null,
      lastFailure: instance.diag.lastFailure}))};
  }
  // Setup actions never persist anything; the page saves once through the host's settings route.
  // Every field the assistant accepts, checked on its own so one bad value
  // never hides another and the message names the field it belongs to.
  function validateSetupFields(draft) {
    const fields = {};
    const host = typeof draft.host === "string" ? draft.host.trim() : "";
    if (!host) fields.host = "Enter the grinder's address, for example 192.168.1.40.";
    else if (!validHost(host)) fields.host = "Use the grinder's address on your local network: loopback, a private range such as 192.168.x.x, link-local or a .local name.";
    const port = draft.port === undefined ? 9997 : draft.port;
    if (!Number.isInteger(port) || port < 1 || port > 65535) fields.port = "The WebSocket port must be a whole number between 1 and 65535; the E64 uses 9997.";
    const restPort = draft.restPort === undefined ? 443 : draft.restPort;
    if (!Number.isInteger(restPort) || restPort < 1 || restPort > 65535) fields.restPort = "The login port must be a whole number between 1 and 65535; the E64 uses 443.";
    const name = typeof draft.name === "string" ? draft.name.trim() : "";
    if (name.length > 128) fields.name = "The name must be at most 128 characters.";
    if (draft.certSha256 !== undefined && draft.certSha256 !== null && draft.certSha256 !== "") {
      const parsed = parseFingerprint(draft.certSha256);
      if (!parsed.ok) fields.certSha256 = "certSha256 " + parsed.reason + ". Paste only the value after \"sha256 Fingerprint=\"; the pin needs 64 hex characters.";
    }
    return fields;
  }
  // The certificate probe is credential-free: GET /rest_api/ping carries no
  // token and no password, so it can be repeated without spending a session.
  // It only claims a fingerprint when the host provably enforced the pin.
  async function probeCertificate(target, candidate, instance) {
    const note = (pinSupport, observed) => {
      if (!instance) return;
      if (pinSupport) instance.diag.hostPinSupport = pinSupport;
      if (observed) instance.diag.observedFingerprint = observed;
    };
    const attempt = async (pin) => {
      try {
        await fetchWithTimeout(restUrl(target, "ping"), {method: "GET", tlsPinSha256: pin}, CERT_PROBE_MS);
        return {ok: true};
      } catch (error) { return {ok: false, failure: classifyFailure(error, "cert", {...target, certSha256: pin})}; }
    };
    const fleet = await attempt(FLEET_SHA256);
    if (fleet.ok) {
      // A host that ignores tlsPinSha256 accepts any certificate, so its
      // success proves nothing about which certificate the grinder serves.
      const unmatchable = await attempt(UNMATCHABLE_SHA256);
      if (unmatchable.ok) {
        note("ignored");
        return {recognised: false, reason: "pin-unsupported",
          message: "This Decaid build does not enforce certSha256 (it ignores tlsPinSha256), so the certificate cannot be identified here. Paste the SHA-256 fingerprint from the command below; it is stored and compared exactly."};
      }
      note("honoured", FLEET_SHA256);
      return {recognised: true, certSha256: FLEET_SHA256, observedFingerprint: FLEET_SHA256};
    }
    if (candidate && candidate.hex) {
      const pinned = await attempt(candidate.hex);
      if (pinned.ok) {
        note("honoured", candidate.hex);
        return {recognised: false, pinVerified: true, certSha256: candidate.hex, observedFingerprint: candidate.hex};
      }
      return {recognised: false, reason: pinned.failure.stage, message: pinned.failure.expected + " | " + failureSentence(pinned.failure, [])};
    }
    return {recognised: false, reason: fleet.failure.stage, message: failureSentence(fleet.failure, [])};
  }
  async function setupAction(body) {
    const draft = body && typeof body === "object" ? body : {};
    if (draft.action === "check") return {status: 200, payload: {errors: validate(draft.settings).errors}};
    if (draft.action === "validate") return {status: 200, payload: {fields: validateSetupFields(draft)}};
    const fields = validateSetupFields(draft);
    if (fields.host) return {status: 400, payload: {error: "host", fields, message: fields.host}};
    if (fields.port) return {status: 400, payload: {error: "port", fields, message: fields.port}};
    if (fields.restPort) return {status: 400, payload: {error: "restPort", fields, message: fields.restPort}};
    if (fields.name) return {status: 400, payload: {error: "name", fields, message: fields.name}};
    const hostValue = draft.host.trim();
    const restPort = draft.restPort === undefined ? 443 : draft.restPort;
    const target = {host: hostValue, restPort};
    if (draft.action === "probe-cert") {
      const candidate = typeof draft.certSha256 === "string" && draft.certSha256.trim() ? parseFingerprint(draft.certSha256) : null;
      if (candidate && !candidate.ok) return {status: 400, payload: {error: "certSha256", fields: {certSha256: "certSha256 " + candidate.reason + "."}, message: "certSha256 " + candidate.reason + "."}};
      const instance = Array.from(instances.values()).find((value) => value.config.host.toLowerCase() === hostValue.toLowerCase());
      return {status: 200, payload: await probeCertificate(target, candidate, instance)};
    }
    if (draft.action === "test-login" || draft.action === "probe-control") {
      if (Date.now() - lastSetupTest < SETUP_TEST_MS) return {status: 429, payload: {result: "wait", message: "Wait a moment before trying again."}};
      lastSetupTest = Date.now();
      const parsed = typeof draft.certSha256 === "string" ? parseFingerprint(draft.certSha256) : {ok: false, reason: "is missing"};
      if (!parsed.ok) return {status: 400, payload: {error: "certSha256", fields: {certSha256: "certSha256 " + parsed.reason + "."}, message: "certSha256 " + parsed.reason + "."}};
      const pin = parsed.hex;
      let password = typeof draft.password === "string" ? draft.password : "";
      if (!password) {
        const saved = Array.from(instances.values()).find((instance) => instance.config.host.toLowerCase() === hostValue.toLowerCase() && instance.config.password);
        password = saved ? saved.config.password : "";
      }
      if (!password || password.length > 1024) return {status: 400, payload: {result: "no-password", fields: {password: "Enter the Owner password."}, message: "Enter the Owner password."}};
      const secrets = [password];
      let response;
      try {
        response = await fetch(restUrl(target, "login"), {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({userRole: "Owner", password}), tlsPinSha256: pin});
      } catch (error) {
        // "Not reachable" hid a DNS, TCP, TLS, certificate or pin failure: the
        // stage is reported instead, with the expected value and one next step.
        const failure = classifyFailure(error, "login", {...target, certSha256: pin});
        return {status: 200, payload: {result: failure.stage, reason: failure.stage, message: failureSentence(failure, secrets)}};
      }
      const status = response && Number.isInteger(response.status) ? response.status : null;
      const auth = response && response.ok && response.headers && response.headers.get ? response.headers.get("authorization") || "" : "";
      if (!auth.startsWith("Bearer ")) {
        if (response && response.ok) {
          return {status: 200, payload: {result: "unexpected", reason: "no-bearer", message: "The grinder accepted the login but returned no session token. Next: check the firmware's /rest_api/login response and attach the diagnostics bundle to a bug report."}};
        }
        const retryAfter = status === 429 ? retryAfterMs(response) : null;
        return {status: 200, payload: {result: "wrong-password", reason: "auth", status, retryAfterMs: retryAfter,
          message: "The grinder refused this login with HTTP " + (status === null ? "unknown" : status) + "." +
            (retryAfter ? " Retry-After: " + Math.round(retryAfter / 1000) + " s." : "") +
            " Next: check the Owner password for this grinder; a password changed on the grinder must be re-entered here."}};
      }
      if (draft.action === "test-login") return {status: 200, payload: {result: "accepted", message: "Password accepted."}};
      const port = Number.isInteger(draft.port) ? draft.port : 9997;
      const probe = {control: {debugMode: "unknown", probedAt: null}, config: {mintTokens: true, scheme: "wss", host: hostValue, port, certSha256: pin, restPort}};
      const token = auth.slice(7).trim();
      await probeWithToken(probe, token);
      return {status: 200, payload: {result: "accepted", debugMode: probe.control.debugMode}};
    }
    return {status: 400, payload: {error: "action"}};
  }
  function setupPage() {
    return htmlPage("Set up the Mahlkönig E64", `
<header class="pu-header"><h1>Set up the Mahlkönig E64</h1><button type="button" class="pu-btn pu-secondary" data-pu-done>Done</button></header>
<div class="pu-stepper" data-pu-stepper></div>
<section data-pu-step>
  <h2>Before you start</h2>
  <p>Decaid will read the grinder's setting and show it with your shots. Optionally it can report shots to the grinder. It is read-only unless you choose otherwise.</p>
  <p>You need the grinder on the same network as this device and its Owner password.</p>
</section>
<section data-pu-step hidden>
  <h2>Find your grinder</h2>
  <div class="pu-card"><div class="pu-row"><label for="host">Address</label>
    <input id="host" inputmode="url" autocomplete="off" spellcheck="false" placeholder="192.168.1.40">
    <p class="pu-hint">The grinder's IP address on your local network. Decaid cannot search the network for it yet.</p></div></div>
  <details class="pu-details"><summary>Advanced</summary><div class="pu-card">
    <div class="pu-row"><label for="name">Name</label><input id="name" autocomplete="off" value="Mahlkönig E64"></div>
    <div class="pu-row"><label for="port">WebSocket port</label><input id="port" inputmode="numeric" value="9997"></div>
    <div class="pu-row"><label for="restPort">Login port</label><input id="restPort" inputmode="numeric" value="443"></div></div></details>
  <div id="hostOut" class="pu-alert pu-error" hidden></div>
</section>
<section data-pu-step hidden>
  <h2>Trust the grinder's certificate</h2>
  <div id="certOk" class="pu-alert pu-ok" hidden><span class="pu-pill pu-ok">Recognised</span> Standard Mahlkönig E64 certificate.</div>
  <div id="certUnknown" class="pu-alert pu-warn" hidden><span class="pu-pill pu-warn">Check</span> This is not the usual E64 certificate. Continue only if you just set up this grinder or its firmware changed.</div>
  <code class="pu-code" id="fp"></code>
  <div class="pu-card" id="pasteCard" hidden><div class="pu-row"><label for="paste">Certificate SHA-256</label>
    <input id="paste" autocomplete="off" spellcheck="false" placeholder="91:B4:12:…" aria-describedby="pasteHint">
    <p class="pu-hint" id="pasteHint">Read it from the grinder yourself: <code>openssl s_client -connect &lt;grinder-ip&gt;:443 &lt;/dev/null 2&gt;/dev/null | openssl x509 -noout -fingerprint -sha256</code> and paste the value after <code>sha256 Fingerprint=</code>. Colons, spaces and case do not matter.</p></div></div>
  <div class="pu-actions"><button type="button" class="pu-btn" id="trust">Trust this grinder</button></div>
  <details class="pu-details"><summary>What this means</summary><p>Pinning stops Decaid from talking to other servers and keeps the password away from anything that is not an E64. It does not prove this is your grinder, because every E64 shares one certificate. Decaid therefore only accepts local-network addresses and binds the password to this address.</p></details>
  <div id="certOut" class="pu-alert" hidden></div>
</section>
<section data-pu-step hidden>
  <h2>Owner password</h2>
  <div class="pu-card"><div class="pu-row"><label for="password">Password</label>
    <div class="pu-secure"><input id="password" type="password" autocomplete="off" spellcheck="false"><button type="button" class="pu-btn pu-secondary" data-pu-reveal aria-pressed="false">Show</button></div>
    <p class="pu-hint" id="pwHint">The grinder's Owner password.</p></div></div>
  <div class="pu-actions"><button type="button" class="pu-btn pu-secondary" id="test">Test login</button></div>
  <div id="pwOut" class="pu-alert" hidden></div>
</section>
<section data-pu-step hidden>
  <h2>How Decaid and the grinder work together</h2>
  <fieldset class="pu-choice"><legend class="pu-muted">Pick one. You can change it later.</legend>
    <label><input type="radio" name="owner" value="off" checked><span><b>Just show the grinder</b>Decaid shows the grinder's setting. Nothing is sent to the grinder.</span></label>
    <label><input type="radio" name="owner" value="grinder"><span><b>Let the grinder adjust itself</b>After each shot Decaid tells the grinder's own grind-by-sync how the shot went. The grinder decides any change.</span></label>
    <label><input type="radio" name="owner" value="decaid" id="ownerDecaid" disabled><span><b>Let Decaid adjust the grinder</b><span id="decaidReason">Needs grinder control, checked in the next step.</span></span></label>
  </fieldset>
  <div class="pu-card">
    <div class="pu-row"><label for="populate">Add this grinder to my grinders</label><input id="populate" type="checkbox" role="switch" class="pu-switch" checked></div>
    <div class="pu-row"><label for="link">Use it in my current workflow</label><input id="link" type="checkbox" role="switch" class="pu-switch" checked></div>
    <div class="pu-row"><label for="recordDose">Record each grind as the shot's dose</label><input id="recordDose" type="checkbox" role="switch" class="pu-switch"><p class="pu-hint">After a grind-by-weight grind, the workflow's dose becomes the grinder's target. A shot started within 5 minutes stores the weight the grinder measured as its actual dose, with the grind's details.</p></div></div>
</section>
<section data-pu-step hidden>
  <h2>Grinder control (optional)</h2>
  <details class="pu-details" id="controlDetails"><summary>Grinder control</summary>
    <p>Some owners run a development image on their grinder that accepts control commands. Decaid checks this by itself; on a normal grinder Decaid stays read-only. This plugin does not explain how to enable such an image.</p>
    <div class="pu-card"><div class="pu-row"><label for="allowControl">Allow grinder control</label><input id="allowControl" type="checkbox" role="switch" class="pu-switch"></div>
      <div class="pu-row" id="backlightRow" hidden><label for="syncBacklight">Turn the grinder's light off while the machine sleeps</label><input id="syncBacklight" type="checkbox" role="switch" class="pu-switch"></div></div>
    <div class="pu-actions"><button type="button" class="pu-btn pu-secondary" id="probe">Check the grinder</button></div>
    <div id="probeOut" class="pu-alert" hidden></div>
  </details>
</section>
<section data-pu-step hidden>
  <h2>Review and save</h2>
  <div class="pu-card" id="summary"></div>
  <div class="pu-actions"><button type="button" class="pu-btn" id="save">Save</button></div>
  <div id="saveOut" class="pu-alert" hidden aria-live="polite"></div>
</section>
<div class="pu-actions pu-sticky"><button type="button" class="pu-btn pu-secondary" data-pu-back>Back</button><button type="button" class="pu-btn" data-pu-next>Next</button></div>`,
SETUP_SCRIPT);
  }
  const SETUP_SCRIPT = `
pu.init({fit: true});
const base = location.pathname.replace(/\\/[^/]*$/, "");
const $ = (id) => document.getElementById(id);
const state = {certSha256: null, offered: null, previousHost: null, passwordSet: false, instanceId: "e64", loginOk: false, control: null, reached: null};
const say = (el, kind, text) => { el.hidden = !text; el.className = "pu-alert pu-" + kind; el.textContent = text || ""; };
const post = (body) => pu.api(base + "/setup", {method: "POST", body}).catch((e) => e.data || {result: "error", message: String(e.message)});
async function load() {
  try {
    const settings = await pu.api(base + "/settings");
    const rows = JSON.parse(settings.InstancesJson || "[]");
    if (rows[0]) {
      const row = rows[0];
      state.instanceId = row.id; state.previousHost = row.host;
      $("host").value = row.host || ""; $("name").value = row.name || "Mahlkönig E64";
      $("port").value = row.port || 9997; $("restPort").value = row.restPort || 443;
      if (row.certSha256) state.certSha256 = row.certSha256.replace(/:/g, "").toLowerCase();
    }
    state.passwordSet = Boolean(settings.PasswordsJson && settings.PasswordsJson.isSet);
    const owner = document.querySelector('input[name=owner][value="' + (settings.AdjustmentOwner || "off") + '"]');
    if (owner && !owner.disabled) owner.checked = true;
    $("populate").checked = settings.PopulateGrinderRecord !== "false";
    $("link").checked = settings.LinkWorkflowGrinder !== "false";
    $("recordDose").checked = settings.RecordGrindDose === "true";
    $("allowControl").checked = settings.AllowControl === "true";
    $("syncBacklight").checked = settings.SyncBacklight === "true";
    $("backlightRow").hidden = !$("allowControl").checked;
  } catch (e) { say($("hostOut"), "error", "Could not read the saved settings: " + e.message); }
  passwordHint();
}
const hostChanged = () => state.previousHost !== null && state.previousHost.toLowerCase() !== $("host").value.trim().toLowerCase();
function passwordHint() {
  $("pwHint").textContent = state.passwordSet && !hostChanged() ? "Password saved. Leave empty to keep it." :
    state.passwordSet ? "The address changed, so enter the password again: it is bound to the grinder's address." : "The grinder's Owner password.";
}
const target = () => ({host: $("host").value.trim(), port: Number($("port").value), restPort: Number($("restPort").value)});
// One server-side parser for every field, so the page and the plugin never
// disagree and each field has its own message.
async function checkField(field, out) {
  const payload = {action: "validate", ...target(), name: $("name").value.trim(), certSha256: state.certSha256 || ""};
  if (field === "certSha256" && $("paste").value.trim()) payload.certSha256 = $("paste").value.trim();
  const result = await post(payload);
  const message = result.fields && result.fields[field];
  if (out && message !== undefined) say($(out), "error", message);
  return !message;
}
async function probeCert() {
  $("certOk").hidden = $("certUnknown").hidden = $("pasteCard").hidden = true;
  const result = await post({action: "probe-cert", ...target()});
  state.reached = result.recognised || result.pinVerified || result.reason === "pin-unsupported" ? "ok" : (result.reason || null);
  if (result.recognised) {
    $("certOk").hidden = false; state.offered = result.certSha256;
    $("fp").textContent = pu.fingerprint(result.certSha256);
    say($("certOut"), "ok", "This is the fleet E64 certificate, confirmed by an enforced pin.");
    return true;
  }
  if (result.pinVerified) {
    state.offered = null; state.certSha256 = result.certSha256; $("certOk").hidden = false;
    $("fp").textContent = pu.fingerprint(result.certSha256);
    say($("certOut"), "ok", "Verified: this fingerprint is the one the grinder presents.");
    return true;
  }
  $("certUnknown").hidden = false; $("pasteCard").hidden = false; $("fp").textContent = ""; state.offered = null;
  // The reason is specific: a refused connection is not an unknown certificate.
  say($("certOut"), "error", result.message || "Paste the grinder's SHA-256 fingerprint to trust it.");
  return false;
}
$("trust").addEventListener("click", async () => {
  const pasted = state.offered || $("paste").value.trim();
  if (!pasted) return say($("certOut"), "error", "Paste the SHA-256 fingerprint from the command shown above.");
  const checked = await post({action: "validate", ...target(), name: $("name").value.trim(), certSha256: pasted});
  if (checked.fields && checked.fields.certSha256) return say($("certOut"), "error", checked.fields.certSha256);
  const pin = pasted.replace(/[^0-9a-f]/gi, "").toLowerCase();
  if (!state.offered && !$("trust").dataset.confirm) { $("trust").dataset.confirm = "1"; $("trust").textContent = "Trust anyway"; return say($("certOut"), "warn", "Tap again to trust this certificate."); }
  state.certSha256 = pin; say($("certOut"), "ok", "Trusted: " + pu.fingerprint(pin));
});
$("allowControl").addEventListener("change", () => { $("backlightRow").hidden = !$("allowControl").checked; });
$("host").addEventListener("input", passwordHint);
// Validate each field as it is left, with the message that belongs to it.
for (const [field, out] of [["host", "hostOut"], ["port", "hostOut"], ["restPort", "hostOut"], ["name", "hostOut"]]) {
  $(field).addEventListener("change", () => { checkField(field, out); });
}
$("paste").addEventListener("change", () => { checkField("certSha256", "certOut"); });
$("test").addEventListener("click", async () => {
  const result = await post({action: "test-login", ...target(), certSha256: state.certSha256, password: $("password").value});
  state.loginOk = result.result === "accepted";
  say($("pwOut"), state.loginOk ? "ok" : "error", result.message || "Login failed.");
});
$("probe").addEventListener("click", async () => {
  const result = await post({action: "probe-control", ...target(), certSha256: state.certSha256, password: $("password").value});
  state.control = result.debugMode || null;
  const ok = state.control === "available";
  $("ownerDecaid").disabled = !ok;
  $("decaidReason").textContent = ok ? "Decaid may set the grind setting, for example from assisted dial-in. No shot reports are sent to the grinder." : "Needs grinder control, which this grinder does not offer.";
  say($("probeOut"), ok ? "ok" : "warn", ok ? "Control is available on this grinder." : result.message || "This grinder does not accept control commands; Decaid stays read-only.");
});
function draft() {
  const owner = document.querySelector("input[name=owner]:checked").value;
  const t = target();
  const instance = {id: state.instanceId, name: $("name").value.trim() || "Mahlkönig E64", scheme: "wss", host: t.host, port: t.port, restPort: t.restPort, pollMs: 1000, certSha256: state.certSha256};
  const typed = $("password").value;
  const settings = {InstancesJson: JSON.stringify([instance]), TokensJson: "{}", MintTokens: "true",
    AdjustmentOwner: owner, PopulateGrinderRecord: String($("populate").checked), LinkWorkflowGrinder: String($("link").checked), RecordGrindDose: String($("recordDose").checked),
    AllowControl: String($("allowControl").checked), SyncBacklight: String($("allowControl").checked && $("syncBacklight").checked)};
  if (typed) settings.PasswordsJson = JSON.stringify({[state.instanceId]: {host: t.host, password: typed}});
  else if (state.passwordSet && !hostChanged()) settings.PasswordsJson = {isSet: true};
  return settings;
}
function summary() {
  const s = draft(), owner = document.querySelector("input[name=owner]:checked").closest("label").querySelector("b").textContent;
  const rows = [["Grinder", $("host").value.trim()], ["Certificate", state.certSha256 ? pu.fingerprint(state.certSha256) : "not trusted"],
    ["Password", $("password").value ? "new" : state.passwordSet && !hostChanged() ? "kept" : "missing"], ["Decaid and the grinder", owner],
    ["Add to my grinders", s.PopulateGrinderRecord === "true" ? "yes" : "no"], ["Grinder control", s.AllowControl === "true" ? "allowed" : "off"]];
  $("summary").replaceChildren(...rows.map(([k, v]) => { const row = document.createElement("div"); row.className = "pu-row"; const a = document.createElement("b"); a.textContent = k; const b = document.createElement(k === "Certificate" ? "code" : "span"); if (k === "Certificate") b.className = "pu-code"; b.textContent = v; row.append(a, b); return row; }));
}
pu.wizard($("page"), async (index) => {
  if (index === 1) {
    const fields = (await post({action: "validate", ...target(), name: $("name").value.trim()})).fields || {};
    const invalid = Object.keys(fields).filter((name) => name !== "certSha256");
    if (invalid.length) { say($("hostOut"), "error", fields[invalid[0]]); return false; }
    say($("hostOut"), "error", ""); passwordHint();
    const reached = await probeCert();
    // Reachability is verified before the assistant claims anything: a grinder
    // that refused the connection is not a grinder with an unknown certificate.
    if (!reached && state.reached !== "pin-unsupported") return false;
    return true;
  }
  if (index === 2 && !state.certSha256) { say($("certOut"), "error", "Trust the certificate to continue: paste its fingerprint, then tap Trust."); return false; }
  if (index === 3 && !$("password").value && !(state.passwordSet && !hostChanged())) { say($("pwOut"), "error", "Enter the Owner password."); return false; }
  if (index === 5) summary();
  return true;
});
$("save").addEventListener("click", async () => {
  const settings = draft();
  const check = await post({action: "check", settings: {...settings, PasswordsJson: typeof settings.PasswordsJson === "string" ? settings.PasswordsJson : JSON.stringify({[state.instanceId]: {host: target().host, password: "kept"}})}});
  if (check.errors && check.errors.length) return say($("saveOut"), "error", check.errors[0]);
  try { await pu.api(base + "/settings", {method: "POST", body: settings}); }
  catch (e) { return say($("saveOut"), "error", e.status === 401 ? "Finish this in Decaid: extension protection is on." : "Saving failed: " + e.message); }
  $("password").value = "";
  say($("saveOut"), "warn", "Saved. Connecting…");
  const started = Date.now();
  const poll = async () => {
    let status = null;
    try { status = await pu.api(base + "/setup?status=1"); } catch (_) {}
    const instance = status && status.instances && status.instances[0];
    if (status && status.needsSetup) return say($("saveOut"), "error", status.message);
    if (instance && instance.displayedSetting) return say($("saveOut"), "ok", "Connected, display shows " + instance.displayedSetting + " µm.");
    if (Date.now() - started < 60000) return setTimeout(poll, 1000);
    // Never a bare "saved": say which stage the first connect stopped at.
    const diagnosis = instance && instance.diagnosis;
    say($("saveOut"), "warn", diagnosis ? "Saved, but the first connect failed at " + diagnosis.stage + ". " + diagnosis.message
      : "Saved. The grinder has not reported yet: check that it is on and connect it in Decaid's device list.");
  };
  setTimeout(poll, 1000);
});
load();
`;
  function instancePicker(registered, query) {
    // Keep the page parameters the kit understands; anything else is dropped.
    const keep = ["theme", "lang", "embed"].filter((key) => typeof query[key] === "string" && /^[A-Za-z0-9-]{1,16}$/.test(query[key]))
      .map((key) => "&" + key + "=" + encodeURIComponent(query[key])).join("");
    const body = registered.length
      ? "<div class=\"pu-card\">" + registered.map((instance) => "<div class=\"pu-row\"><b>" + escapeHtml(instance.config.name) + "</b><a class=\"pu-btn pu-secondary\" href=\"?ui=1&amp;deviceId=" +
          escapeHtml(encodeURIComponent(instance.deviceId)) + escapeHtml(keep) + "\">" + (instance.connected ? "Connected" : "Not connected") + " – open</a></div>").join("") + "</div>"
      : "<div class=\"pu-alert pu-warn\">No grinder is set up yet.</div><div class=\"pu-actions\"><a class=\"pu-btn\" href=\"setup?" + escapeHtml(keep.slice(1)) + "\">Set up</a></div>";
    return htmlPage("E64 diagnostics", "<header class=\"pu-header\"><h1>E64 diagnostics</h1><button type=\"button\" class=\"pu-btn pu-secondary\" data-pu-done>Done</button></header>" +
      (registered.length ? "<p class=\"pu-muted\">Choose a grinder.</p>" : "") + body, "pu.init({fit: true});");
  }
  function diagnosticsPage(instance) {
    const {syncing, ...inventory} = instance.inventory;
    const failure = instance.diag.last;
    const rows = [["Connected", instance.connected ? "yes" : "no"],
      ["Last failure", failure ? failure.stage + ": " + failureSentence(failure, instanceSecrets(instance)) : "–"],
      ["Staged steps", instance.diag.steps.length ? instance.diag.steps.map((step) => step.stage + (step.ms === undefined ? "" : " " + step.ms + " ms") + (step.ok ? " ok" : " failed")).join(", ") : "–"],
      ["Fingerprint", instance.config.certSha256 ? fingerprintGroups(instance.config.certSha256) + (instance.diag.observedFingerprint ? " (confirmed by the host)" : " (not yet confirmed)") : "none pinned"],
      ["Display", instance.workflow.display === null ? "–" : instance.workflow.display + " µm"],
      ["Token", instance.tokenSource], ["Last login error", instance.lastMintError || "–"], ["Grinder record", inventory.status],
      ["Workflow", inventory.workflowLink || "–"], ["Grind log", instance.grindLog.status], ["Control", instance.control.debugMode],
      ["Adjustment owner", instance.control.owner], ["Grind events", String(instance.grindEvents.length)],
      ["Dose recording", !instance.config.recordDose ? "off" : instance.workflow.lastDose ? instance.workflow.lastDose.status + (instance.workflow.lastDose.reason ? ": " + instance.workflow.lastDose.reason : "") : "on, no shot yet"]];
    const bundle = JSON.stringify(diagnosticsBundle(instance), null, 2);
    return htmlPage("E64 diagnostics", "<header class=\"pu-header\"><h1>" + escapeHtml(instance.config.name) + "</h1><button type=\"button\" class=\"pu-btn pu-secondary\" data-pu-done>Done</button></header><div class=\"pu-card\">" +
      rows.map(([k, v]) => "<div class=\"pu-row\"><b>" + escapeHtml(k) + "</b><span>" + escapeHtml(v) + "</span></div>").join("") + "</div>" +
      "<details class=\"pu-details\"><summary>Diagnostics bundle for a bug report</summary><p class=\"pu-hint\">Contains no token, no password, no auth header and no certificate body. Attach this to the bug report.</p><code class=\"pu-code\">" +
      escapeHtml(bundle) + "</code></details>", "pu.init({fit: true});");
  }
  const plugin = {
    id: "mahlkoenig-e64.reaplugin",
    onLoad(settings) {
      // Invalid or missing configuration loads in a "needs setup" state so the setup page is served.
      const {errors, configs} = validate(settings);
      needsSetup = errors.length ? errors[0] : null;
      setupNotice(needsSetup);
      return Promise.all(configs.map(async (config) => {
        const instance = make(config); instances.set(config.id, instance);
        // Control is only registered when the probe proves the grinder accepts it, so a locked grinder stays read-only.
        if (config.allowControl) await probeDebugMode(instance);
        const control = instance.control.debugMode === "available";
        const handlers = {connect: (context) => connect(instance, context), disconnect: () => disconnect(instance), ...(control ? controlHandlers(instance) : {})};
        return host.devices.register({driverId: control ? "e64-control" : "e64", instanceId: config.id, name: config.name}, handlers)
          .then((device) => { instance.deviceId = device.deviceId; return device; },
            // A failed registration drops only that instance; the others stay usable.
            () => { instances.delete(config.id); return null; });
      }));
    },
    onUnload() { return Promise.all(Array.from(instances.values()).map((instance) => disconnect(instance))); },
    onEvent(event) {
      if (!event || !event.payload) return;
      if (event.name === "stateUpdate") {
        updateXenia(event.payload); syncBacklight(event.payload);
        const active = Boolean(event.payload.state && ACTIVE_STATES.includes(event.payload.state.state));
        const espresso = Boolean(event.payload.state && event.payload.state.state === "espresso");
        if (espresso && !inEspresso) espressoStartMs = Date.now();
        inEspresso = espresso;
        if (active !== machineActive) {
          machineActive = active;
          // Writes deferred during a shot, steam, hot water or flush run once the machine is done.
          if (!active) for (const instance of instances.values()) scheduleWorkflowSync(instance, 0);
        }
      }
      if (event.name === "shotStored" && typeof event.payload.id === "string") {
        for (const instance of instances.values()) {
          if (instance.config.recordDose) recordShotDose(instance, event.payload.id);
          if (instance.control.owner === "grinder" && instance.control.debugMode === "available") brewEvent(instance, event.payload.id);
        }
      }
    },
    handleHttpRequest(request) {
      const jsonResponse = (status, payload) => ({status, headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload)});
      if (request.endpoint === "setup" || request.endpoint === "ui") {
        const query = request.query || {};
        if (request.method === "POST" && request.endpoint === "setup") return setupAction(request.body).then(({status, payload}) => jsonResponse(status, payload));
        if (request.method !== "GET") return jsonResponse(405, {error: "method not allowed"});
        if (query.status === "1") return jsonResponse(200, setupStatus());
        if (request.endpoint === "ui" && query.view !== undefined && query.view !== "setup") return jsonResponse(404, {error: "unknown view"});
        return setupPage();
      }
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
      if (request.endpoint === "service-log") {
        if (request.method !== "GET") return jsonResponse(405, {error: "method not allowed"});
        const query = request.query || {};
        const target = query.instance !== undefined ? instances.get(query.instance)
          : query.deviceId !== undefined ? Array.from(instances.values()).find((candidate) => candidate.deviceId === query.deviceId)
          : instances.size === 1 ? Array.from(instances.values())[0] : null;
        if (!target) return query.instance === undefined && query.deviceId === undefined ? jsonResponse(400, {error: "instance or deviceId required"}) : jsonResponse(404, {error: "unknown instance"});
        const after = query.after === undefined ? -1 : Number(query.after);
        if (!Number.isSafeInteger(after)) return jsonResponse(400, {error: "after must be an event_id"});
        const {dueAt, ...log} = target.grindLog;
        return jsonResponse(200, {instance: target.config.id, rows: target.serviceRows.filter((row) => row.id > after), log});
      }
      if (request.endpoint !== "e64-diagnostics" && request.endpoint !== "grind-events") return jsonResponse(404, {error: "unknown endpoint"});
      if (request.method !== "GET") return jsonResponse(405, {error: "method not allowed"});
      const id = request.query && request.query.deviceId;
      const registered = Array.from(instances.values()).filter((candidate) => candidate.deviceId !== null);
      // Skins open the plugin-level diagnostics surface without a deviceId: one instance is the default,
      // several get a picker page (ui=1) or a list of deviceIds (JSON).
      const instance = id === undefined ? (registered.length === 1 ? registered[0] : null) : registered.find((candidate) => candidate.deviceId === id);
      if (!instance && id === undefined && request.query.ui === "1") return instancePicker(registered, request.query);
      if (!instance && id === undefined) {
        return jsonResponse(registered.length ? 400 : 404, registered.length
          ? {error: "deviceId required", instances: registered.map((candidate) => ({deviceId: candidate.deviceId, name: candidate.config.name}))}
          : {error: needsSetup ? "needs setup" : "no grinder configured"});
      }
      if (!instance) return {status: 404, headers: {"Content-Type": "application/json"}, body: JSON.stringify({error: "unknown instance"})};
      const grindEvents = () => instance.grindEvents.map(({completedAtMs, ...event}) => event);
      if (request.endpoint === "grind-events") return jsonResponse(200, {events: grindEvents(), log: instance.grindLog, grinderId: instance.inventory.grinderId});
      const read = request.query.read;
      if (read === undefined && request.query.ui === "1") return diagnosticsPage(instance);
      if (read !== undefined && read !== "config" && read !== "machineInfo" && read !== "connection" && read !== "xenia" && read !== "control" && read !== "inventory" && read !== "diagnostics" && read !== "stages") return jsonResponse(400, {error: "unsupported read"});
      const operation = read === undefined ? null : read;
      if (operation === "xenia") return Promise.resolve(jsonResponse(200, xeniaRead(instance)));
      if (operation === "control") return Promise.resolve(jsonResponse(200, instance.control));
      if (operation === "inventory") { const {syncing, ...inventory} = instance.inventory; return Promise.resolve(jsonResponse(200, inventory)); }
      if (operation === "diagnostics") return Promise.resolve(jsonResponse(200, diagnosticsBundle(instance, request.query.verbose === "1")));
      if (operation === "stages") return Promise.resolve(jsonResponse(200, {verbose: instance.diag.verbose || request.query.verbose === "1", lines: stageLines(instance, instance.diag.verbose || request.query.verbose === "1")}));
      if (operation === "connection") {
        const failure = instance.diag.last;
        const connection = {connected: instance.connected, tokenSource: instance.tokenSource,
          lastMintAt: instance.lastMintAt, lastMintError: instance.lastMintError,
          lastMintDiagnosis: instance.lastMintDiagnosis,
          // The staged diagnosis: what failed, what was expected and what was seen.
          diagnosis: failure ? {stage: failure.stage, status: failure.status, code: failure.code, expected: failure.expected,
            observed: redactForReport(failure.observed, instanceSecrets(instance)), next: failure.next} : null,
          mintBackoffUntil: instance.nextMintAt === null ? null : new Date(instance.nextMintAt).toISOString(),
          staticToken: Boolean(instance.config.staticToken), mintTokens: Boolean(instance.config.mintTokens)};
        return Promise.resolve({status: 200, headers: {"Content-Type": "application/json"}, body: JSON.stringify(connection)});
      }
      const headers = (live) => ({"Content-Type": "application/json", "X-E64-Observation-State": live ? "live" : (instance.lastObservationAt ? "last-known" : "none"), ...(instance.lastObservationAt ? {"X-E64-Observation-Time": instance.lastObservationAt} : {})});
      const known = instance.grindEvents.length ? {...instance.observations, grindEvents: grindEvents()} : instance.observations;
      return (operation ? requestRead(instance, operation) : Promise.resolve(known)).then((data) => ({status: 200, headers: headers(Boolean(operation)), body: JSON.stringify(data)}), () => ({status: 503, headers: headers(false), body: JSON.stringify({error: "E64 unavailable"})}));
    }
  };
  function requestRead(instance, operation) { return request(instance, operation, false); }
  // Internal codec, exposed for tests only.
  plugin.codec = {fromBase64, inflate, readZip, utf8, parseCsv};
  return plugin;
}
