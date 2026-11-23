// Runs the private research simulator and emulates the Decaid host surface the
// plugin uses (fetch, transport, tlsPinSha256, notify) with Node built-ins.
// Nothing from the research repository is copied here; it is located at run time.
import {spawn, execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import vm from 'node:vm';

const repo = path.resolve(new URL('../..', import.meta.url).pathname);
export const source = fs.readFileSync(path.join(repo, 'plugin.js'), 'utf8');
export const simRoot = path.resolve(process.env.E64_SIM_ROOT || path.join(repo, '..', 'mahlkoenig-e64ws-local-research'));
const simScript = path.join(simRoot, 'tools', 'e64ws_simulator.py');
export const replayTrace = path.join(simRoot, 'tests', 'fixtures', 'grind-20261119-01.sanitized.jsonl');
const venvPython = path.join(simRoot, '.venv', 'bin', 'python');
const python = process.env.E64_SIM_PYTHON || (fs.existsSync(venvPython) ? venvPython : 'python3');

// Missing simulator files fail the run unless E64_SIM_OPTIONAL=1 explicitly allows skipping.
export function requireSim(t, ...files) {
  const missing = [simScript, ...files].filter((file) => !fs.existsSync(file));
  if (!missing.length) return true;
  const message = `E64 simulator not found (${missing.join(', ')}); set E64_SIM_ROOT`;
  if (process.env.E64_SIM_OPTIONAL === '1') { t.skip(message + ' (skipped: E64_SIM_OPTIONAL=1)'); return false; }
  throw new Error(message + ' or E64_SIM_OPTIONAL=1');
}

export async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const {port} = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

// A fresh self-signed certificate per run, so no key material lives in either repository.
export function makeCert() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e64-sim-cert-'));
  const cert = path.join(dir, 'cert.pem'), key = path.join(dir, 'key.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes', '-days', '2',
    '-subj', '/CN=e64-sim', '-keyout', key, '-out', cert], {stdio: 'ignore'});
  const sha256 = new crypto.X509Certificate(fs.readFileSync(cert)).fingerprint256;
  return {dir, cert, key, sha256};
}

export async function startSim({tlsCert, httpsCert, fw01 = false, replay, token = 'sim-ws-token', ports} = {}) {
  const port = ports?.port ?? await freePort(), httpPort = ports?.httpPort ?? await freePort(), scalePort = ports?.scalePort ?? await freePort();
  const args = [simScript, '--host', '127.0.0.1', '--port', String(port), '--scale-port', String(scalePort), '--http-port', String(httpPort), '--token', token];
  if (tlsCert) args.push('--tls-cert', tlsCert.cert, '--tls-key', tlsCert.key);
  if (httpsCert) args.push('--http-tls-cert', httpsCert.cert, '--http-tls-key', httpsCert.key);
  if (fw01) args.push('--fw01-login');
  if (replay) args.push('--replay', replay);
  const child = spawn(python, ['-u', ...args], {cwd: simRoot, stdio: ['ignore', 'pipe', 'pipe']});
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const sim = {child, port, httpPort, scalePort, token, https: Boolean(httpsCert), ports: {port, httpPort, scalePort},
    stop: () => new Promise((resolve) => { if (child.exitCode !== null) return resolve(); child.once('exit', resolve); child.kill('SIGTERM'); })};
  const deadline = Date.now() + 15000;
  while (!output.includes('E64 simulator:')) {
    if (child.exitCode !== null) throw new Error('simulator exited: ' + output);
    if (Date.now() > deadline) { await sim.stop(); throw new Error('simulator start timed out: ' + output); }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return sim;
}

// Test-only control channel; the simulator's own certificate is not verified here.
export async function control(sim, route, body) {
  const response = await request({host: '127.0.0.1', port: sim.httpPort, secure: sim.https, insecure: true},
    body === undefined ? 'GET' : 'POST', route, body === undefined ? undefined : JSON.stringify(body));
  if (response.status !== 200) throw new Error(`sim ${route} ${response.status} ${response.body}`);
  return JSON.parse(response.body);
}

// Host pin semantics: platform validation first; a failed validation is rescued
// only by a leaf certificate whose SHA-256 equals tlsPinSha256.
function connect({host, port, secure, pin, insecure = false}) {
  if (!secure) {
    if (pin) return Promise.reject(new Error('tlsPinSha256 is only valid for TLS'));
    return new Promise((resolve, reject) => { const socket = net.connect(port, host, () => resolve(socket)); socket.once('error', reject); });
  }
  return new Promise((resolve, reject) => {
    const socket = tls.connect({host, port, rejectUnauthorized: false, servername: net.isIP(host) ? undefined : host});
    socket.once('error', reject);
    socket.once('secureConnect', () => {
      const digest = crypto.createHash('sha256').update(socket.getPeerCertificate().raw).digest('hex');
      const wanted = pin && pin.replace(/:/g, '').toLowerCase();
      if (socket.authorized || insecure || (wanted && digest === wanted)) return resolve(socket);
      socket.destroy();
      reject(new Error('HandshakeException: CERTIFICATE_VERIFY_FAILED: self signed certificate'));
    });
  });
}

async function request(target, method, route, body, headers = {}) {
  const socket = await connect(target);
  const lines = [`${method} ${route} HTTP/1.1`, `Host: ${target.host}:${target.port}`, 'Connection: close',
    ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`)];
  if (body !== undefined) lines.push(`Content-Length: ${Buffer.byteLength(body)}`);
  socket.end(lines.join('\r\n') + '\r\n\r\n' + (body ?? ''));
  const raw = await new Promise((resolve, reject) => { const chunks = []; socket.on('data', (c) => chunks.push(c)); socket.on('end', () => resolve(Buffer.concat(chunks).toString())); socket.on('error', reject); });
  const [head, ...rest] = raw.split('\r\n\r\n');
  const [status, ...headerLines] = head.split('\r\n');
  const parsed = Object.fromEntries(headerLines.map((line) => [line.slice(0, line.indexOf(':')).trim().toLowerCase(), line.slice(line.indexOf(':') + 1).trim()]));
  return {status: Number(status.split(' ')[1]), headers: parsed, body: rest.join('\r\n\r\n')};
}

export function hostFetch(log = []) {
  return async (url, init = {}) => {
    const parsed = new URL(url);
    log.push({url, init});
    const response = await request({host: parsed.hostname.replace(/^\[|\]$/g, ''), port: Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80)),
      secure: parsed.protocol === 'https:', pin: init.tlsPinSha256}, init.method || 'GET', parsed.pathname + parsed.search, init.body, init.headers || {});
    return {status: response.status, ok: response.status >= 200 && response.status < 300,
      headers: {get: (name) => response.headers[name.toLowerCase()] ?? null}, text: async () => response.body};
  };
}

// Minimal RFC 6455 client: masked text frames out, pong for pings, close events in.
export function hostTransport(log = []) {
  return {
    async open(options) {
      log.push(options);
      const url = new URL(options.url);
      const socket = await connect({host: url.hostname, port: Number(url.port), secure: url.protocol === 'wss:', pin: options.tlsPinSha256});
      const key = crypto.randomBytes(16).toString('base64');
      socket.write(`GET ${url.pathname}${url.search} HTTP/1.1\r\nHost: ${url.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
      let buffer = Buffer.alloc(0);
      await new Promise((resolve, reject) => {
        const onData = (chunk) => {
          buffer = Buffer.concat([buffer, chunk]);
          const end = buffer.indexOf('\r\n\r\n');
          if (end < 0) return;
          socket.off('data', onData);
          const head = buffer.subarray(0, end).toString();
          buffer = buffer.subarray(end + 4);
          if (!/^HTTP\/1\.1 101/.test(head)) { socket.destroy(); reject(new Error('WebSocket upgrade rejected: ' + head.split('\r\n')[0])); } else resolve();
        };
        socket.on('data', onData); socket.once('error', reject);
      });
      const handle = {socket, listener: null, queue: [], closed: false};
      const emit = (event) => { if (handle.listener) handle.listener(event); else handle.queue.push(event); };
      const send = (opcode, payload) => {
        const mask = crypto.randomBytes(4), data = Buffer.from(payload);
        const head = data.length < 126 ? Buffer.from([0x80 | opcode, 0x80 | data.length])
          : Buffer.from([0x80 | opcode, 0x80 | 126, data.length >> 8, data.length & 255]);
        for (let i = 0; i < data.length; i++) data[i] ^= mask[i % 4];
        socket.write(Buffer.concat([head, mask, data]));
      };
      handle.send = send;
      const parse = () => {
        while (buffer.length >= 2) {
          let length = buffer[1] & 127, offset = 2;
          if (length === 126) { if (buffer.length < 4) return; length = buffer.readUInt16BE(2); offset = 4; }
          else if (length === 127) { if (buffer.length < 10) return; length = Number(buffer.readBigUInt64BE(2)); offset = 10; }
          if (buffer.length < offset + length) return;
          const opcode = buffer[0] & 15, payload = buffer.subarray(offset, offset + length);
          buffer = buffer.subarray(offset + length);
          if (opcode === 1) emit({type: 'data', dataType: 'text', data: payload.toString()});
          else if (opcode === 9) send(10, payload);
          else if (opcode === 8) { handle.closed = true; emit({type: 'close', code: payload.length >= 2 ? payload.readUInt16BE(0) : undefined}); socket.end(); }
        }
      };
      socket.on('data', (chunk) => { buffer = Buffer.concat([buffer, chunk]); parse(); });
      socket.on('close', () => { if (!handle.closed) { handle.closed = true; emit({type: 'close'}); } });
      parse();
      return {handle};
    },
    onEvent(handle, callback) { handle.listener = callback; for (const event of handle.queue.splice(0)) callback(event); },
    async send(handle, payload) { if (handle.closed) throw new Error('transport closed'); handle.send(1, payload.data); },
    async close(handle) { if (!handle.closed) { handle.closed = true; try { handle.send(8, Buffer.alloc(0)); } catch (_) {} handle.socket.end(); } },
  };
}

export async function loadPlugin(settings, {fetchLog = [], openLog = [], notices = []} = {}) {
  const registrations = [];
  const host = {
    notify: (value) => { notices.push(['notify', value]); return 'request'; },
    dismissNotification: (id) => { notices.push(['dismiss', id]); },
    devices: {register(definition, handlers) { registrations.push({definition, handlers}); return Promise.resolve({deviceId: `plugin:mahlkoenig-e64.reaplugin:e64:${definition.instanceId}`}); }},
  };
  const sandbox = {setTimeout, clearTimeout, Promise, Map, Set, JSON, Object, Number, Array, Error, Date, Math, encodeURIComponent, btoa: globalThis.btoa, fetch: hostFetch(fetchLog)};
  vm.runInNewContext(`globalThis.createPlugin = (${source}\n);`, sandbox);
  const plugin = sandbox.createPlugin(host);
  await plugin.onLoad(settings);
  const transport = hostTransport(openLog);
  const sessions = registrations.map(({definition, handlers}) => {
    const session = {id: definition.instanceId, published: [], disconnected: 0};
    session.context = {transport, publish: async (value) => { session.published.push(JSON.parse(JSON.stringify(value))); }, reportDisconnected: async () => { session.disconnected++; }};
    session.connect = () => handlers.connect(session.context);
    session.disconnect = () => handlers.disconnect();
    session.diagnostics = async (read) => {
      const response = await plugin.handleHttpRequest({endpoint: 'e64-diagnostics', method: 'GET', query: {deviceId: `plugin:mahlkoenig-e64.reaplugin:e64:${definition.instanceId}`, ...(read ? {read} : {})}});
      return {status: response.status, headers: response.headers, body: JSON.parse(response.body)};
    };
    return session;
  });
  return {plugin, sessions, session: sessions[0]};
}

export async function until(predicate, message, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (!(await predicate())) {
    if (Date.now() > deadline) throw new Error('timed out waiting for ' + message);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
