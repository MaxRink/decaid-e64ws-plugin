#!/usr/bin/env node
// Checks that every relative link and image path in the documentation resolves,
// and that `#anchors` point at a heading in the target file.
//
// Usage: node tools/check-doc-links.mjs
// Exits non-zero and lists every broken target; prints a one-line summary
// otherwise. Only documentation is read; nothing is fetched from the network.
import fs from 'node:fs';
import path from 'node:path';

const repo = path.resolve(new URL('..', import.meta.url).pathname);
const roots = ['README.md', 'CONTRIBUTING.md', ...fs.readdirSync(path.join(repo, 'docs')).filter((name) => name.endsWith('.md')).map((name) => path.join('docs', name))];

// GitHub's heading anchors: lowercase, drop everything but letters, digits,
// spaces and hyphens, then turn spaces into hyphens.
function slug(heading) {
  return heading
    .replace(/`/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, '')
    .replace(/ /g, '-');
}

function anchors(file) {
  const text = fs.readFileSync(file, 'utf8');
  const found = new Set();
  let inFence = false;
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const match = line.match(/^#{1,6}\s+(.*)$/);
    if (match) found.add(slug(match[1]));
  }
  return found;
}

const problems = [];
let checked = 0;
for (const relative of roots) {
  const file = path.join(repo, relative);
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    const where = `${relative}:${index + 1}`;
    for (const match of line.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const raw = match[1];
      if (/^(https?:|mailto:|#)/.test(raw)) continue;
      checked += 1;
      const [target, anchor] = raw.split('#');
      const resolved = target === '' ? file : path.resolve(path.dirname(file), decodeURIComponent(target));
      if (!fs.existsSync(resolved)) { problems.push(`${where}: missing file ${raw}`); continue; }
      if (anchor) {
        const headings = anchors(resolved);
        if (!headings.has(anchor)) problems.push(`${where}: missing anchor #${anchor} in ${target}`);
      }
    }
  });
}

if (problems.length) {
  process.stderr.write(`${problems.length} broken link(s):\n${problems.map((problem) => `  ${problem}`).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`${checked} relative links resolve across ${roots.length} documents\n`);
