import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Test the same public-source pipeline used by CI, in disposable worktrees.
// We never mutate repository data or GitHub settings.
const source = process.cwd();
interface CommandResult { status: number | null; text: string }
function prepare(): string {
  const dir = mkdtempSync(join(tmpdir(), 'g6a-actual-input-'));
  for (const item of ['src', 'scripts', 'package.json', 'package-lock.json', 'astro.config.mjs', 'tsconfig.json']) {
    cpSync(resolve(source, item), join(dir, item), { recursive: true });
  }
  if (!existsSync(resolve(source, 'node_modules'))) throw new Error('Install dependencies with npm ci first');
  symlinkSync(resolve(source, 'node_modules'), join(dir, 'node_modules'), 'dir');
  return dir;
}
function run(dir: string, command: string): CommandResult {
  const p = spawnSync('npm', ['run', command], { cwd: dir, encoding: 'utf8', timeout: 120000 });
  if (p.error) throw p.error;
  return { status: p.status, text: (p.stdout ?? '') + '\n' + (p.stderr ?? '') };
}
function updateAllowlist(dir: string, path: string): void {
  const allowlistPath = join(dir, 'src/data/manifests/public-source-allowlist.json');
  const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8')) as { files: Array<{ path: string; sha256: string }> };
  const digest = createHash('sha256').update(readFileSync(join(dir, path))).digest('hex');
  const entry = allowlist.files.find((item) => item.path === path);
  if (entry) entry.sha256 = digest;
  else allowlist.files.push({ path, sha256: digest });
  writeFileSync(allowlistPath, JSON.stringify(allowlist, null, 2));
  const assetsPath = join(dir, 'src/data/manifests/assets.json');
  const assets = JSON.parse(readFileSync(assetsPath, 'utf8')) as Array<{ path: string; approved: boolean; public: boolean; mime: string }>;
  if (!assets.some((item) => item.path === path)) assets.push({ path, approved: true, public: true, mime: 'application/json' });
  writeFileSync(assetsPath, JSON.stringify(assets, null, 2));
}
function caseRun(label: string, inject: (dir: string) => void, expected: string): void {
  const dir = prepare();
  try {
    inject(dir);
    for (const command of ['validate', 'build']) {
      const result = run(dir, command);
      assert.notEqual(result.status, 0, label + ': npm run ' + command + ' unexpectedly PASS\n' + result.text);
      assert.ok(result.text.includes(expected), label + ': missing expected diagnostic ' + expected + '\n' + result.text);
      console.log('PASS negative actual-input ' + label + ' (' + command + ') exit=' + result.status + ' diagnostic=' + expected);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

function buildOnlyCase(label: string, inject: (dir: string) => void, expected: string): void {
  const dir = prepare();
  try {
    inject(dir);
    const result = run(dir, 'build');
    assert.notEqual(result.status, 0, label + ': npm run build unexpectedly PASS\n' + result.text);
    assert.ok(result.text.includes(expected), label + ': missing expected diagnostic ' + expected + '\n' + result.text);
    console.log('PASS negative build-output ' + label + ' exit=' + result.status + ' diagnostic=' + expected);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const clean = prepare();
try {
  for (const command of ['validate', 'build']) {
    const result = run(clean, command);
    assert.equal(result.status, 0, 'clean control failed: ' + command + '\n' + result.text);
    console.log('PASS positive actual-input clean (' + command + ')');
  }
} finally { rmSync(clean, { recursive: true, force: true }); }

caseRun('SEC-01 registered Draft public JSON', (dir) => {
  const path = join(dir, 'src/data/public/content/PRJ-0002-en.json');
  writeFileSync(path, JSON.stringify({ entity: 'Project', permanentId: 'PRJ-0002', locale: 'en', slug: 'unreleased-internal', publicationStatus: 'Draft', title: 'SECRET_PRIVATE_DRAFT', sourceLocale: 'en', projectIds: [] }));
  const registryPath = join(dir, 'src/data/registry.json');
  const events = JSON.parse(readFileSync(registryPath, 'utf8')) as unknown[];
  events.push({ permanentId: 'PRJ-0002', entity: 'Project', state: 'Assigned', recordedAt: '2026-10-01' });
  writeFileSync(registryPath, JSON.stringify(events));
}, 'PUBLIC_DRAFT');
caseRun('SEC-02 unlisted SVG', (dir) => {
  writeFileSync(join(dir, 'src/data/public/content/unapproved.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
}, 'UNLISTED_PUBLIC_FILE');
caseRun('SEC-03 forged approval flag', (dir) => {
  const path = 'src/data/public/content/unauthorized.png';
  writeFileSync(join(dir, path), 'synthetic not a real image');
  const manifestPath = join(dir, 'src/data/manifests/assets.json');
  const entries = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown[];
  entries.push({ path, mime: 'image/png', public: true, approved: true });
  writeFileSync(manifestPath, JSON.stringify(entries));
}, 'UNLISTED_PUBLIC_FILE');
caseRun('SEC-04 modified reviewed file', (dir) => {
  const path = join(dir, 'src/data/public/content/NOT-0001-en.json');
  const record = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  record.title = 'changed-fixture-without-independent-review';
  writeFileSync(path, JSON.stringify(record));
}, 'PUBLIC_HASH');
caseRun('SEC-05 hidden public file', (dir) => {
  writeFileSync(join(dir, 'src/data/public/content/.sensitive-cache'), 'fixture');
}, 'UNLISTED_PUBLIC_FILE');
caseRun('SEC-06 unlisted public asset', (dir) => {
  mkdirSync(join(dir, 'public'), { recursive: true });
  writeFileSync(join(dir, 'public/rogue.txt'), 'unreviewed asset');
}, 'UNLISTED_PUBLIC_FILE');
caseRun('P1-01 unregistered NOT Note ID', (dir) => {
  const path = 'src/data/public/content/NOT-9999-en.json';
  writeFileSync(join(dir, path), JSON.stringify({ entity: 'Note', permanentId: 'NOT-9999', locale: 'en', slug: 'unregistered-note', publicationStatus: 'Published', title: 'Synthetic note', summary: 'Synthetic summary', sourceLocale: 'en', date: '2026-01-10', category: 'Methods', body: 'Synthetic body', projectIds: [], publishedAt: '2026-01-10' }));
  updateAllowlist(dir, path);
  const registryPath = join(dir, 'src/data/registry.json');
  const registry = JSON.parse(readFileSync(registryPath, 'utf8')) as unknown[];
  registry.push({ permanentId: 'NOT-9999', entity: 'Note', state: 'Assigned', recordedAt: '2026-01-10' });
  writeFileSync(registryPath, JSON.stringify(registry));
}, 'LEGACY_ID_UNREGISTERED');
caseRun('P1-02 Published NTE Note missing summary', (dir) => {
  const path = 'src/data/public/content/NTE-0002-en.json';
  writeFileSync(join(dir, path), JSON.stringify({ entity: 'Note', permanentId: 'NTE-0002', locale: 'en', slug: 'missing-summary', publicationStatus: 'Published', title: 'Synthetic note', sourceLocale: 'en', date: '2026-01-11', category: 'Methods', body: 'Synthetic body', projectIds: [], publishedAt: '2026-01-11' }));
  updateAllowlist(dir, path);
  const registryPath = join(dir, 'src/data/registry.json');
  const registry = JSON.parse(readFileSync(registryPath, 'utf8')) as unknown[];
  registry.push({ permanentId: 'NTE-0002', entity: 'Note', state: 'Assigned', recordedAt: '2026-01-11' });
  writeFileSync(registryPath, JSON.stringify(registry));
}, 'PUBLISHED_REQUIRED');
caseRun('P1-03 global Project facts differ', (dir) => {
  const path = 'src/data/public/content/PRJ-0001-zh.json';
  const record = JSON.parse(readFileSync(join(dir, path), 'utf8')) as Record<string, unknown>;
  record.primaryType = 'Different';
  writeFileSync(join(dir, path), JSON.stringify(record));
  updateAllowlist(dir, path);
}, 'GLOBAL_FACTS');
caseRun('P1-03 withdrawn Work needs notice', (dir) => {
  const path = 'src/data/public/content/ARC-0001-en.json';
  const record = JSON.parse(readFileSync(join(dir, path), 'utf8')) as Record<string, unknown>;
  record.validityStatus = 'Withdrawn';
  writeFileSync(join(dir, path), JSON.stringify(record));
  updateAllowlist(dir, path);
}, 'WITHDRAWN_NOTICE');
buildOnlyCase('SEC-07 extra static page', (dir) => {
  mkdirSync(join(dir, 'src/pages/rogue'), { recursive: true });
  writeFileSync(join(dir, 'src/pages/rogue/index.astro'), '<html><body>rogue</body></html>');
}, 'Unexpected build output paths');
buildOnlyCase('SEC-08 executable output', (dir) => {
  const path = join(dir, 'src/pages/index.astro');
  const source = readFileSync(path, 'utf8');
  writeFileSync(path, source.replace('<body>', '<body><script>alert(1)</script>'));
}, 'Build output contains executable or private content');
console.log('PASS all real-input CLI negative integration cases');
