// Browser test of the setup assistant served by plugin.js, at phone and tablet
// widths in both themes. A small server stands in for Decaid: it routes the
// plugin endpoints, keeps the settings store, and reloads the plugin on save.
import {test, expect} from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../plugin.js', import.meta.url), 'utf8');
const FLEET = '91b412ee014f21c3bb2445430b6a3d77903334a1300ad84f1980ab2c5f53620b';
const base = '/api/v1/plugins/mahlkoenig-e64.reaplugin';

// The grinder as plugin fetch sees it: the fleet certificate and Owner password "right".
async function grinderFetch(url, init = {}) {
  if (init.tlsPinSha256 !== FLEET) throw new Error('HandshakeException');
  if (url.endsWith('/rest_api/ping')) return {ok: true, status: 200, headers: {get: () => null}, text: async () => 'expired'};
  const ok = JSON.parse(init.body || '{}').password === 'right';
  return {ok, status: ok ? 200 : 400, headers: {get: (name) => ok && name === 'authorization' ? 'Bearer t' : null}, text: async () => ''};
}

function decaid() {
  const store = {settings: {}, saves: []};
  let plugin;
  const reload = async () => {
    const sandbox = {setTimeout, clearTimeout, Promise, Map, Set, JSON, Object, Number, Array, Error, Date, Math, encodeURIComponent, btoa: globalThis.btoa, fetch: grinderFetch};
    vm.runInNewContext(`globalThis.createPlugin = (${source}\n);`, sandbox);
    plugin = sandbox.createPlugin({notify: () => {}, dismissNotification: () => {}, devices: {register: (definition) => Promise.resolve({deviceId: `plugin:mahlkoenig-e64.reaplugin:${definition.driverId}:${definition.instanceId}`})}});
    await plugin.onLoad({...store.settings, PopulateGrinderRecord: 'false'});
  };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let body = ''; for await (const chunk of req) body += chunk;
    const send = (status, value, type = 'application/json') => { res.writeHead(status, {'content-type': type}); res.end(typeof value === 'string' ? value : JSON.stringify(value)); };
    if (url.pathname === `${base}/settings`) {
      if (req.method === 'GET') {
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
  return {store, reload, server};
}

let host, origin;
test.beforeAll(async () => {
  host = decaid();
  await host.reload();
  await new Promise((resolve) => host.server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${host.server.address().port}`;
});
test.afterAll(async () => { await new Promise((resolve) => host.server.close(resolve)); });

for (const theme of ['light', 'dark']) {
  for (const [label, viewport] of [['phone', {width: 390, height: 844}], ['tablet', {width: 1280, height: 800}]]) {
    test(`setup assistant end to end, ${theme} theme, ${label}`, async ({page}, info) => {
      host.store.settings = {}; host.store.saves.length = 0; await host.reload();
      await page.setViewportSize(viewport);
      await page.goto(`${origin}${base}/setup?theme=${theme}`);
      expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
      const layout = async () => {
        const result = await page.evaluate(() => ({
          overflow: document.scrollingElement.scrollWidth - window.innerWidth,
          small: [...document.querySelectorAll('.pu-btn, input:not([type=radio]):not([type=checkbox]), select, fieldset.pu-choice label')].filter((el) => el.offsetParent && el.getBoundingClientRect().height < 44).map((el) => el.id || el.textContent),
        }));
        expect(result.overflow, 'no horizontal scrolling').toBeLessThanOrEqual(0);
        expect(result.small, 'touch targets').toEqual([]);
      };
      const next = page.locator('[data-pu-next]');
      await expect(page.getByRole('heading', {name: 'Before you start'})).toBeVisible();
      await layout();
      await next.click();
      await page.locator('#host').fill('example.com');
      await next.click();
      await expect(page.locator('#hostOut')).toContainText('local network');
      await page.locator('#host').fill('192.168.1.40');
      await next.click();
      await expect(page.locator('#certOk')).toBeVisible();
      await expect(page.locator('#fp')).toHaveText(/^91:B4:12:EE:.*:62:0B$/);
      await layout();
      await page.locator('#trust').click();
      await next.click();
      await page.locator('#password').fill('wrong');
      await page.locator('#test').click();
      await expect(page.locator('#pwOut')).toContainText('did not accept');
      await page.waitForTimeout(3100);
      await page.locator('#password').fill('right');
      await page.locator('#test').click();
      await expect(page.locator('#pwOut')).toContainText('Password accepted');
      await next.click();
      await expect(page.locator('#ownerDecaid')).toBeDisabled();
      await page.locator('label', {hasText: 'Let the grinder adjust itself'}).click();
      await layout();
      await next.click();
      await expect(page.getByRole('heading', {name: 'Grinder control (optional)'})).toBeVisible();
      await next.click();
      await expect(page.locator('#summary')).toContainText('Let the grinder adjust itself');
      await layout();
      await page.screenshot({path: info.outputPath(`wizard-${theme}-${label}.png`), fullPage: true});
      await page.locator('#save').click();
      await expect(page.locator('#saveOut')).toContainText('Saved');
      const [save] = host.store.saves;
      const instances = JSON.parse(save.InstancesJson);
      expect(instances).toEqual([{id: 'e64', name: 'Mahlkönig E64', scheme: 'wss', host: '192.168.1.40', port: 9997, restPort: 443, pollMs: 1000, certSha256: FLEET}]);
      expect(JSON.parse(save.PasswordsJson)).toEqual({e64: {host: '192.168.1.40', password: 'right'}});
      expect([save.MintTokens, save.AdjustmentOwner, save.AllowControl, save.TokensJson]).toEqual(['true', 'grinder', 'false', '{}']);
      expect(save.AllowNoPasswordWorkaround).toBeUndefined();
      expect(await page.locator('#password').inputValue()).toBe('');
      const status = await (await fetch(`${origin}${base}/setup?status=1`)).json();
      expect(status.needsSetup).toBe(false);
    });
  }
}

test('reopening keeps the saved password and asks again when the address changes', async ({page}) => {
  host.store.settings = {InstancesJson: JSON.stringify([{id: 'e64', name: 'E64', scheme: 'wss', host: '192.168.1.40', port: 9997, restPort: 443, pollMs: 1000, certSha256: FLEET}]),
    TokensJson: '{}', MintTokens: 'true', PasswordsJson: JSON.stringify({e64: {host: '192.168.1.40', password: 'right'}}), AdjustmentOwner: 'grinder'};
  host.store.saves.length = 0; await host.reload();
  await page.goto(`${origin}${base}/setup`);
  const next = page.locator('[data-pu-next]');
  await next.click();
  await expect(page.locator('#host')).toHaveValue('192.168.1.40');
  await next.click(); await page.locator('#trust').click(); await next.click();
  await expect(page.locator('#pwHint')).toContainText('Leave empty to keep it');
  await next.click(); await next.click(); await next.click();
  await page.locator('#save').click();
  await expect(page.locator('#saveOut')).toContainText('Saved');
  expect(host.store.saves[0].PasswordsJson).toEqual({isSet: true});
  await page.goto(`${origin}${base}/setup`);
  await next.click();
  await page.locator('#host').fill('192.168.1.41');
  await next.click();
  await expect(page.locator('#certOk')).toBeVisible();
  await page.locator('#trust').click(); await next.click();
  await expect(page.locator('#pwHint')).toContainText('enter the password again');
  await next.click();
  await expect(page.locator('#pwOut')).toContainText('Enter the Owner password');
});
