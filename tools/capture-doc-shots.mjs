#!/usr/bin/env node
// Captures the setup-guide images from the plugin's own pages.
//
// Nothing here is drawn by hand: every PNG is a screenshot of HTML/CSS/JS that
// plugin.js served in this run. A small Node server stands in for Decaid's
// plugin host (it routes the plugin endpoints, keeps the settings store and
// reloads the plugin on save), and the grinder is either a fake host `fetch`
// (setup assistant) or this repository's own mock WebSocket fixture
// (tools/e64-mock-server.mjs, diagnostics page).
//
// Usage: node tools/capture-doc-shots.mjs [--out <dir>]
//
// The Decaid desktop app is NOT involved: this shows the plugin's pages, not
// the host's window chrome. See docs/SETUP.md for what each image is.
import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repo = path.resolve(new URL('..', import.meta.url).pathname);
const source = fs.readFileSync(path.join(repo, 'plugin.js'), 'utf8');
const base = '/api/v1/plugins/mahlkoenig-e64.reaplugin';
// The certificate every E64 serves; the setup assistant recognises it.
const FLEET = '91b412ee014f21c3bb2445430b6a3d77903334a1300ad84f1980ab2c5f53620b';
// Obviously synthetic values: they only exist to fill a field in a screenshot.
const SAMPLE_HOST = '192.168.1.40';
const SAMPLE_PASSWORD = 'SYNTHETIC-owner-password-not-a-real-one';
const MOCK_TOKEN = 'synthetic-mock-token';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  if (process.argv[i].startsWith('--')) args.set(process.argv[i].slice(2), process.argv[i + 1] ?? true);
}
const outDir = path.resolve(String(args.get('out') || path.join(repo, 'docs', 'assets', 'setup')));

// The grinder as the plugin's host `fetch` sees it: the fleet certificate and
// any non-empty Owner password. Used for the setup assistant, which only probes
// the certificate and tests a login - it never opens the WebSocket.
async function grinderFetch(url, init = {}) {
  if (init.tlsPinSha256 !== FLEET) throw new Error('HandshakeException');
  if (String(url).endsWith('/rest_api/ping')) return {ok: true, status: 200, headers: {get: () => null}, text: async () => 'expired'};
  if (!String(url).endsWith('/rest_api/login')) throw new Error(`unexpected fetch ${url}`);
  const accepted = typeof init.body === 'string' && JSON.parse(init.body).password.length > 0;
  return {
    ok: accepted,
    status: accepted ? 200 : 400,
    headers: {get: (name) => (accepted && name.toLowerCase() === 'authorization' ? 'Bearer synthetic-wss-token' : null)},
    text: async () => '',
  };
}

// A stand-in for the Decaid host: plugin settings store, plugin reload, endpoint
// routing. The plugin sees the same host surface the app gives it.
function decaid({fetch = grinderFetch} = {}) {
  const store = {settings: {}, saves: []};
  const registrations = [];
  let plugin;
  const reload = async () => {
    const sandbox = {setTimeout, clearTimeout, Promise, Map, Set, JSON, Object, Number, Array, Error, Date, Math, encodeURIComponent, btoa: globalThis.btoa, fetch};
    vm.runInNewContext(`globalThis.createPlugin = (${source}\n);`, sandbox);
    plugin = sandbox.createPlugin({
      notify: () => {}, dismissNotification: () => {},
      devices: {register: (definition, handlers) => {
        const device = {deviceId: `plugin:mahlkoenig-e64.reaplugin:${definition.driverId}:${definition.instanceId}`};
        registrations.push({definition, handlers, device});
        return Promise.resolve(device);
      }},
    });
    await plugin.onLoad({...store.settings, PopulateGrinderRecord: 'false'});
  };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let body = '';
    for await (const chunk of req) body += chunk;
    const send = (status, value, type = 'application/json') => {
      res.writeHead(status, {'content-type': type});
      res.end(typeof value === 'string' ? value : JSON.stringify(value));
    };
    if (url.pathname === `${base}/settings`) {
      if (req.method === 'GET') {
        // Secure settings never come back as a value, only as "is set": the same
        // shape Decaid's settings route returns.
        const visible = Object.fromEntries(Object.entries(store.settings).map(([key, value]) => [key, ['TokensJson', 'PasswordsJson'].includes(key) ? {isSet: true} : value]));
        return send(200, visible);
      }
      const update = JSON.parse(body);
      store.saves.push(update);
      for (const [key, value] of Object.entries(update)) if (!(value && typeof value === 'object' && value.isSet === true)) store.settings[key] = value;
      await reload();
      return send(200, {ok: true});
    }
    const endpoint = url.pathname.startsWith(`${base}/`) ? url.pathname.slice(base.length + 1) : null;
    if (!endpoint) return send(404, {error: 'not found'});
    const result = await plugin.handleHttpRequest({endpoint, method: req.method, query: Object.fromEntries(url.searchParams), body: body ? JSON.parse(body) : null});
    send(result.status, result.body, result.headers['Content-Type']);
  });
  return {store, reload, server, registrations, plugin: () => plugin};
}

// This repository's own mock grinder, spoken over a real WebSocket, so the
// diagnostics page shows a live session instead of fixture JSON.
function startMock() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(repo, 'tools', 'e64-mock-server.mjs'), '--id', 'one', '--port', '0', '--token', MOCK_TOKEN], {stdio: ['ignore', 'pipe', 'inherit']});
    const timer = setTimeout(() => reject(new Error('E64 mock startup timed out')), 10_000);
    child.stdout.on('data', (chunk) => {
      const match = chunk.toString().match(/listening on .*:(\d+)/);
      if (match) { clearTimeout(timer); resolve({child, port: Number(match[1])}); }
    });
    child.on('error', reject);
    child.on('exit', (code) => reject(new Error(`E64 mock exited before startup (${code})`)));
  });
}

async function main() {
  if (!fs.existsSync(path.join(repo, 'node_modules', '@playwright', 'test'))) {
    throw new Error('Run npm ci first: @playwright/test is needed for the browser.');
  }
  fs.mkdirSync(outDir, {recursive: true});
  const browser = await chromium.launch();
  const written = [];
  // The plugin's page is `main#page`; screenshot that box so the image ends at
  // the content instead of at the browser viewport's empty space.
  const shoot = async (page, name) => {
    const file = path.join(outDir, name);
    const content = page.locator('main#page');
    await content.screenshot({path: file});
    written.push(path.relative(repo, file));
  };

  // --- Setup assistant: the plugin's setup page, walked like a reader would ---
  const wizard = decaid();
  await wizard.reload();
  await new Promise((resolve) => wizard.server.listen(0, '127.0.0.1', resolve));
  const wizardOrigin = `http://127.0.0.1:${wizard.server.address().port}`;
  const page = await browser.newPage({viewport: {width: 1100, height: 900}, colorScheme: 'light'});
  await page.goto(`${wizardOrigin}${base}/setup?theme=light`);
  const next = page.locator('[data-pu-next]');
  await page.waitForSelector('text=Before you start');
  await shoot(page, '01-before-you-start.png');

  await next.click();
  await page.locator('#host').fill(SAMPLE_HOST);
  await shoot(page, '02-device-address.png');

  await next.click();
  await page.waitForSelector('#certOk', {state: 'visible'});
  await shoot(page, '03-trust-certificate.png');

  await page.locator('#trust').click();
  await next.click();
  await page.locator('#password').fill(SAMPLE_PASSWORD);
  await page.locator('#test').click();
  await page.waitForSelector('#pwOut:has-text("Password accepted")');
  await shoot(page, '04-owner-password.png');

  await next.click();
  await page.waitForSelector('text=How Decaid and the grinder work together');
  await shoot(page, '05-grind-and-workflow.png');

  await next.click(); // Grinder control (optional), left at its default
  await next.click();
  await page.waitForSelector('#summary .pu-row');
  await shoot(page, '06-review-and-save.png');
  await page.close();
  await new Promise((resolve) => wizard.server.close(resolve));

  // --- Diagnostics: the plugin connected to this repository's mock grinder ---
  const mock = await startMock();
  const transport = {
    async open({url}) {
      const socket = new WebSocket(url);
      await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve, {once: true});
        socket.addEventListener('error', reject, {once: true});
      });
      return {handle: socket};
    },
    onEvent(handle, callback) { handle.addEventListener('message', (event) => callback({type: 'data', dataType: 'text', data: event.data})); },
    send(handle, payload) { handle.send(payload.data); return Promise.resolve(); },
    close(handle) { handle.close(); return Promise.resolve(); },
  };
  const live = decaid({fetch: async () => { throw new Error('not used with a static token'); }});
  live.store.settings = {
    InstancesJson: JSON.stringify([{id: 'one', name: 'Mahlkönig E64', scheme: 'ws', host: '127.0.0.1', port: mock.port, pollMs: 250}]),
    TokensJson: JSON.stringify({one: {host: '127.0.0.1', token: MOCK_TOKEN}}),
  };
  await live.reload();
  const registration = live.registrations[0];
  await registration.handlers.connect({
    transport,
    publish: async () => {},
    reportDisconnected: async () => {},
  });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await new Promise((resolve) => live.server.listen(0, '127.0.0.1', resolve));
  const liveOrigin = `http://127.0.0.1:${live.server.address().port}`;
  const diagnostics = await browser.newPage({viewport: {width: 1100, height: 800}, colorScheme: 'light'});
  await diagnostics.goto(`${liveOrigin}${base}/e64-diagnostics?ui=1&theme=light&deviceId=${encodeURIComponent(registration.device.deviceId)}`);
  await diagnostics.waitForSelector('text=Connected');
  await shoot(diagnostics, '07-diagnostics.png');
  await diagnostics.close();
  await new Promise((resolve) => live.server.close(resolve));
  await live.plugin().onUnload();
  mock.child.kill('SIGTERM');
  await browser.close();
  process.stdout.write(`${written.length} screenshots written to ${path.relative(repo, outDir)}\n${written.map((file) => `  ${file}`).join('\n')}\n`);
}

await main();
