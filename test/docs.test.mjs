// Documentation guards: every relative link and image in the docs must resolve,
// the setup guide must keep naming the settings the manifest actually declares,
// and the sections that depend on a manifest key must match whether that key is
// there. Runs offline; no browser, no network.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';

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

test('every relative link and image in the documentation resolves', () => {
  const output = execFileSync(process.execPath, [new URL('../tools/check-doc-links.mjs', import.meta.url).pathname], {encoding: 'utf8'});
  const count = Number(output.match(/^(\d+) relative links resolve/)?.[1] ?? 0);
  assert.ok(count > 20, `the checker looked at ${count} links, which is implausibly few`);
});

test('the setup guide names the settings the manifest declares', () => {
  const manifest = manifestOf();
  const guide = read('docs/SETUP.md');
  for (const key of Object.keys(manifest.settings)) {
    assert.ok(guide.includes(`\`${key}\``), `docs/SETUP.md names ${key}`);
  }
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

// Same rule for the one troubleshooting setting the plugin reads but the
// manifest may not declare yet: instructions must not point at a key the host
// would refuse to save.
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

test('the provenance table covers every committed documentation image', () => {
  const assets = read('docs/ASSETS.md');
  const images = [];
  for (const dir of ['docs/assets/setup', 'docs/assets/grinder']) {
    for (const name of fs.readdirSync(new URL(`${dir}/`, repo))) {
      if (name.endsWith('.png')) images.push(`${dir}/${name}`);
    }
  }
  assert.ok(images.length > 0, 'the documentation ships images');
  for (const image of images) assert.ok(assets.includes(image), `docs/ASSETS.md lists ${image}`);
});
