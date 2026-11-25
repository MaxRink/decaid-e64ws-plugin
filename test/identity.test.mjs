// Guards for the plugin's identity strings.
//
// The plugin covers a family of grinders, not one model, so the display name,
// the README title and the strings the code emits have to move together: a
// rename that touches one of them and not the others fails here. The persisted
// identity (manifest id, driver ids, surface endpoints, setting keys) is
// deliberately frozen, because the host stores settings and devices under those
// strings. docs/NAMING.md carries the reasoning.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const repo = new URL('..', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, repo), 'utf8');
const manifestOf = () => JSON.parse(read('manifest.json'));

// The decision, in one place.
const NAME = 'Mahlkönig WebSocket grinders';
const ID = 'mahlkoenig-e64.reaplugin';
const README_TITLE = `# ${NAME} — Decaid plugin`;

test('the display name is the one the naming decision chose', () => {
  assert.equal(manifestOf().name, NAME, 'manifest.json name');
  assert.ok(read('docs/NAMING.md').includes(`"${NAME}"`), 'docs/NAMING.md records the chosen name');
});

test('the README title carries the same name', () => {
  const [title] = read('README.md').split('\n');
  assert.equal(title, README_TITLE, 'README.md first line');
});

test('the description claims only the tested model', () => {
  const {description} = manifestOf();
  assert.match(description, /E64 WS/, 'the description names the model that is tested');
  assert.match(description, /untested/, 'the description says the rest is untested');
  assert.doesNotMatch(description, /\b(?:all|every)\s+Mahlkönig/i, 'the description does not claim every Mahlkönig grinder');
  assert.doesNotMatch(description, /\ball grinders\b/i, 'the description does not claim all grinders');
});

test('the README says up front which models are tested and which are expected', () => {
  const readme = read('README.md');
  const table = readme.indexOf('## Compatible grinders');
  assert.ok(table > 0, 'README.md keeps the Compatible grinders section');
  const above = readme.slice(0, table);
  assert.match(above, /\*\*Tested today:\*\* E64 WS/, 'above the table, the tested model is named');
  assert.match(above, /\*\*Expected, untested:\*\*/, 'above the table, the expected models are marked untested');
});

test('the compatibility table still marks untested and incompatible models', () => {
  const readme = read('README.md');
  const row = (model) => {
    const line = readme.split('\n').find((candidate) => candidate.startsWith('| ' + model + ' |'));
    assert.ok(line, `README.md keeps a compatibility row for ${model}`);
    return line;
  };
  assert.match(row('E64 WS'), /\*\*Supported and tested\*\*/, 'E64 WS stays the tested model');
  assert.match(row('E64 TS'), /untested/i, 'E64 TS stays untested');
  const ng2 = 'E65T GbS, E65W GbS, E80T GbS, E80W GbS';
  assert.match(row(ng2), /untested/i, 'the NG2 GbS row stays untested');
  assert.match(row(ng2), /not supported/i, 'the NG2 GbS row stays unsupported');
  for (const model of [
    'EK Omnia',
    'X54, X64 SD',
    'E65S GbW, E80S GbW, EK43, K30, Peak, K60, Vario and other non-networked models',
  ]) {
    assert.match(row(model), /Not compatible/, `the ${model} row stays incompatible`);
  }
});

test('the code emits the display name and no model-specific plugin label', () => {
  const source = read('plugin.js');
  const manifest = manifestOf();
  assert.ok(source.includes(`PLUGIN_NAME = "${NAME}"`), 'plugin.js declares the display name once');
  assert.ok(source.includes('"Setup needed for " + PLUGIN_NAME'), 'the setup notification names the plugin');
  assert.ok(source.includes('htmlPage("Set up " + PLUGIN_NAME'), 'the setup page title names the plugin');
  assert.ok(source.includes('Set up ${PLUGIN_NAME}'), 'the setup page heading names the plugin');
  const diagnostics = [manifest.surfaces, ...manifest.drivers.map((driver) => driver.surfaces || [])]
    .flat()
    .filter((surface) => surface.role === 'diagnostics');
  assert.equal(diagnostics.length, 3, 'the plugin and both drivers declare a diagnostics surface');
  for (const surface of diagnostics) {
    assert.equal(surface.label, 'Grinder diagnostics', 'the diagnostics label no longer names one model');
  }
  assert.ok(!source.includes('E64 diagnostics'), 'plugin.js no longer titles a page "E64 diagnostics"');
});

test('no setting label names a single grinder model', () => {
  const {settings} = manifestOf();
  for (const [key, setting] of Object.entries(settings)) {
    assert.doesNotMatch(String(setting.label || ''), /\bE64\b/, `${key} label`);
  }
  // One description keeps the model name on purpose: it describes the
  // E64-specific record adoption the code really performs.
  const named = Object.entries(settings)
    .filter(([, setting]) => /\bE64\b/.test(String(setting.description || '')))
    .map(([key]) => key);
  assert.deepEqual(named, ['PopulateGrinderRecord'], 'only the documented inventory-adoption description names E64');
});

test('the persisted identity stays frozen so installed settings keep working', () => {
  const manifest = manifestOf();
  assert.equal(manifest.id, ID, 'the id keys plugin.settings.secure.<id> and every device id');
  assert.deepEqual(manifest.drivers.map((driver) => driver.id), ['e64', 'e64-control'], 'driver ids appear in persisted device ids');
  assert.deepEqual(
    manifest.surfaces.map((surface) => [surface.id, surface.role, surface.endpoint]),
    [['setup', 'setup', 'setup'], ['diagnostics', 'diagnostics', 'e64-diagnostics']],
    'surface ids and endpoints appear in host URLs',
  );
  const frozen = [
    'InstancesJson', 'TokensJson', 'PasswordsJson', 'MintTokens', 'AllowNoPasswordWorkaround',
    'AllowControl', 'SyncBacklight', 'AdjustmentOwner', 'PopulateGrinderRecord',
    'LinkWorkflowGrinder', 'SyncWorkflowGrinder', 'RecordGrindDose',
  ];
  for (const key of frozen) {
    assert.ok(key in manifest.settings, `the host stores ${key} by key, so the key stays`);
  }
  assert.equal(JSON.parse(read('package.json')).name, ID.replace('.reaplugin', '-reaplugin'), 'package.json mirrors the frozen id');
});

test('the docs and the release title use the same name', () => {
  const [vmTitle] = read('docs/VM_TESTING.md').split('\n');
  assert.doesNotMatch(vmTitle, /E64 plugin/, 'docs/VM_TESTING.md no longer titles itself after one model');
  const release = read('.github/workflows/release.yml');
  assert.ok(release.includes(NAME), 'the release workflow titles releases with the plugin name');
  assert.ok(!release.includes('E64 WS $GITHUB_REF_NAME'), 'the release title no longer says E64 WS');
});
