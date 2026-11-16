import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const manifestRelative = 'evidence/ALL_FILES_SHA256.txt';
const manifestPath = join(root, manifestRelative);
if (!existsSync(manifestPath)) throw new Error('Delivery manifest is missing: ' + manifestRelative);

const lines = readFileSync(manifestPath, 'utf8').split(/\r?\n/).filter(Boolean);
if (lines[0] !== '# SELF_HASH: EXCLUDED') throw new Error('Manifest must explicitly exclude its own hash entry');
const expected = new Map<string, string>();
for (const line of lines.slice(1)) {
  const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
  if (!match) throw new Error('Malformed delivery manifest line: ' + line);
  const digest = match[1]!;
  const path = match[2]!;
  if (path === manifestRelative || path.includes('..') || path.startsWith('/')) throw new Error('Manifest contains an unsafe path: ' + path);
  if (expected.has(path)) throw new Error('Manifest repeats a path: ' + path);
  expected.set(path, digest);
}

function enumerate(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const absolute = join(dir, name);
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error('Delivery contains a symlink: ' + relative(root, absolute));
    if (stat.isDirectory()) found.push(...enumerate(absolute));
    else if (stat.isFile()) found.push(relative(root, absolute).replace(/\\/g, '/'));
    else throw new Error('Unsupported delivery file type: ' + relative(root, absolute));
  }
  return found;
}

const actual = enumerate(root).filter((path) => path !== manifestRelative).sort();
const listed = [...expected.keys()].sort();
if (JSON.stringify(actual) !== JSON.stringify(listed)) {
  throw new Error('Delivery manifest file set differs. expected=' + listed.join(', ') + ' actual=' + actual.join(', '));
}
for (const [path, digest] of expected) {
  const actualDigest = createHash('sha256').update(readFileSync(join(root, path))).digest('hex');
  if (actualDigest !== digest) throw new Error('Delivery manifest hash mismatch: ' + path);
}
console.log('PASS delivery manifest self-exclusion and SHA-256 verification: ' + listed.length + ' files');
