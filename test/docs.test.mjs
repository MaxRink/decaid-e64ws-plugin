// Documentation guards: links resolve, the guide keeps naming what the manifest
// declares (keys AND labels, so a rename cannot silently orphan the screenshots),
// the sections that depend on a manifest key match whether it is there, and every
// committed image has a provenance row. Runs offline; no browser, no network.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repo = new URL('..', import.meta.url);
const read = (relative) => fs.readFileSync(new URL(relative, repo), 'utf8');
const manifestOf = () => JSON.parse(read('manifest.json'));

// The body of one "## " section, heading included, so a claim can be located
// without matching the whole document.
function section(text, heading) {
  const start = text.indexOf(heading);
  assert.ok(start >= 0, `the document has a section starting "${heading}"`);
  const next = text.indexOf('\n## ', start + heading.length);
  return text.slice(start, next === -1 ? undefined : next);
}

// The settings table of docs/SETUP.md: key -> label cell, in the order written.
function settingsRows(guide) {
  const body = section(guide, '## 2. The settings');
  const rows = [];
  for (const line of body.split('\n')) {
    const match = line.match(/^\| `([A-Za-z]+)` \| ([^|]+?) \|/);
    if (match) rows.push({key: match[1], label: match[2].trim()});
  }
  return rows;
}

function pngsUnder(dir) {
  const found = [];
  for (const entry of fs.readdirSync(new URL(`${dir}/`, repo), {withFileTypes: true})) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) found.push(...pngsUnder(relative));
    else if (entry.name.endsWith('.png')) found.push(relative);
  }
  return found;
}

test('every relative link and image in the documentation resolves', () => {
  const output = execFileSync(process.execPath, [new URL('../tools/check-doc-links.mjs', import.meta.url).pathname], {encoding: 'utf8'});
  const count = Number(output.match(/^(\d+) relative links resolve/)?.[1] ?? 0);
  assert.ok(count > 20, `the checker looked at ${count} links, which is implausibly few`);
});

test('the setup guide names the settings the manifest declares', () => {
  const manifest = manifestOf();
  const keys = new Set(settingsRows(read('docs/SETUP.md')).map((row) => row.key));
  for (const key of Object.keys(manifest.settings)) assert.ok(keys.has(key), `docs/SETUP.md names ${key}`);
});

// A renamed label is how the screenshots and the guide went stale once: the keys
// stayed right, the words the UI shows did not. Compare the cells, not the file.
test('the setup guide quotes every setting label the manifest declares', () => {
  const manifest = manifestOf();
  const rows = new Map(settingsRows(read('docs/SETUP.md')).map((row) => [row.key, row.label]));
  for (const [key, schema] of Object.entries(manifest.settings)) {
    assert.equal(rows.get(key), schema.label, `docs/SETUP.md quotes the label for ${key} verbatim`);
  }
});

// Same failure mode one level up: the display name in the title, the plugin card
// and the settings path all come from the manifest.
test('the setup guide uses the plugin display name the manifest declares', () => {
  const {name} = manifestOf();
  const guide = read('docs/SETUP.md');
  const title = guide.split('\n')[0];
  assert.ok(title.includes(name), `the title (${title}) carries "${name}"`);
  assert.ok(guide.includes(`**${name}**`), `the guide names the plugin card as "${name}"`);
});

// The Local API section is the one place that must not get ahead of, or fall
// behind, the manifest: PR #18 declares the two keys, and the section has to
// say so the moment they are there and say the opposite while they are not.
test('the Local API section matches whether the manifest declares its settings', () => {
  const settings = manifestOf().settings;
  const declared = Boolean(settings.UseLocalApi && settings.ApiTokensJson);
  const localApi = section(read('docs/SETUP.md'), '## 12. Local API');

  assert.match(localApi, /`UseLocalApi`/, 'the section names UseLocalApi');
  assert.match(localApi, /`ApiTokensJson`/, 'the section names ApiTokensJson');

  if (declared) {
    assert.match(localApi, /declared in `manifest\.json`, so Decaid can save them/,
      'the section says the keys are declared');
    assert.doesNotMatch(localApi, /not available on `main`|cannot be enabled|not declared in `manifest\.json`|not selectable/i,
      'the section does not claim the feature is unavailable');
  } else {
    assert.match(localApi, /not declared in `manifest\.json`/,
      'the section says the keys are missing while they are');
    assert.doesNotMatch(localApi, /declared in `manifest\.json`, so Decaid can save them/,
      'the section does not claim the keys are declared');
  }
});

// Same rule for the one troubleshooting setting the plugin reads: the prose must
// not describe a key the host would refuse to save.
test('the verbose-log instructions match whether DebugLog is declared', () => {
  const declared = Boolean(manifestOf().settings.DebugLog);
  const doc = read('docs/TROUBLESHOOTING.md');
  assert.match(doc, /`DebugLog`/, 'the document names the setting');
  if (declared) {
    assert.doesNotMatch(doc, /does not declare it|not declared/i,
      'the document no longer says DebugLog is undeclared');
  } else {
    assert.match(doc, /does not declare it/,
      'the document says DebugLog is undeclared while it is');
  }
});

// The provenance file claims to list every image in the documentation. Walk the
// whole tree so a new asset cannot slip past the claim.
test('the provenance table covers every committed documentation image', () => {
  const assets = read('docs/ASSETS.md');
  const images = pngsUnder('docs/assets');
  assert.ok(images.length >= 14, `found ${images.length} documented images`);
  for (const image of images) assert.ok(assets.includes(image), `docs/ASSETS.md lists ${image}`);
});
