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
  for (const item of ['src', 'scripts', 'package.json', 'package-lock.json', 'astro.config.mjs', 'tsconfig.json', '.gitignore']) {
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
caseRun('QA-INT2-04 outside-root staged Draft', (dir) => {
  const path = 'docs/authoring/qa-synthetic-draft.md';
  mkdirSync(join(dir, 'docs/authoring'), { recursive: true });
  writeFileSync(join(dir, path), '---\npublicationStatus: Draft\n---\nSynthetic draft');
  assert.equal(spawnSync('git', ['init', '-q'], { cwd: dir }).status, 0);
  assert.equal(spawnSync('git', ['add', '--', path], { cwd: dir }).status, 0);
}, 'PRIVATE_IN_PUBLIC_REPO');
caseRun('QA-INT2-04 ignored private path', (dir) => {
  mkdirSync(join(dir, 'private'));
  writeFileSync(join(dir, 'private/draft.mdx'), 'Synthetic MDX draft');
}, 'PRIVATE_IN_PUBLIC_REPO');
caseRun('QA-INT2-04 case variant JSON', (dir) => {
  writeFileSync(join(dir, 'src/data/Registry.JSON'), '{}');
}, 'PUBLIC_REPO_UNLISTED');
caseRun('QA-INT2-04 unregistered hidden root file', (dir) => {
  writeFileSync(join(dir, '.synthetic-secret'), 'Synthetic secret');
}, 'PUBLIC_REPO_UNLISTED');
caseRun('QA-INT2-04 unregistered raster outside asset roots', (dir) => {
  writeFileSync(join(dir, 'synthetic.png'), 'Synthetic unapproved bytes');
}, 'PUBLIC_REPO_UNLISTED');
caseRun('QA-INT2-04 outside-root symlink', (dir) => {
  symlinkSync('src/data', join(dir, 'Alias'));
}, 'PUBLIC_SYMLINK');
caseRun('QA-INT2-04 force-staged generated file', (dir) => {
  const path = 'artifacts/synthetic-draft.json';
  mkdirSync(join(dir, 'artifacts'));
  writeFileSync(join(dir, path), '{}');
  assert.equal(spawnSync('git', ['init', '-q'], { cwd: dir }).status, 0);
  assert.equal(spawnSync('git', ['add', '-f', '--', path], { cwd: dir }).status, 0);
}, 'PUBLIC_REPO_GENERATED');

function approveSyntheticTestPath(dir: string, path: string): void {
  const inventoryFile = join(dir, 'scripts/public-repo-paths.json');
  const inventory = JSON.parse(readFileSync(inventoryFile, 'utf8')) as Record<string, string | null>;
  inventory[path] = null;
  writeFileSync(inventoryFile, JSON.stringify(inventory));
}
buildOnlyCase('SEC-07 extra static page', (dir) => {
  approveSyntheticTestPath(dir, 'src/pages/rogue/index.astro');
  mkdirSync(join(dir, 'src/pages/rogue'), { recursive: true });
  writeFileSync(join(dir, 'src/pages/rogue/index.astro'), '<html><body>rogue</body></html>');
}, 'Unexpected build output paths');
buildOnlyCase('SEC-08 executable output', (dir) => {
  const path = join(dir, 'src/pages/index.astro');
  const source = readFileSync(path, 'utf8');
  writeFileSync(path, source.replace('<body>', '<body><script>alert(1)</script>'));
}, 'Build output contains executable or private content');
buildOnlyCase('QA-INT2-05 encoded href through Astro build', (dir) => {
  const path = join(dir, 'src/pages/index.astro');
  const source = readFileSync(path, 'utf8');
  writeFileSync(path, source.replace('</body>', '<a href="java&#x73;cript:void(0)">QA</a></body>'));
}, 'OUTPUT_URL');

const scannerControl = prepare();
try {
  const build = run(scannerControl, 'build');
  assert.equal(build.status, 0, build.text);
  const out = join(scannerControl, 'dist/index.html');
  const original = readFileSync(out, 'utf8');
  const emit = (markup: string) => writeFileSync(out, original.replace('</body>', markup + '</body>'));
  emit('<a href="https://example.org/a%20b?x=1&amp;y=2">HTTPS</a><a href="mailto:qa@example.org">Mail</a><a href="tel:+1234">Tel</a><a href="#main">Skip</a><img src="/test.png" srcset="/test.png 1x, /test2.png 2x" alt="">');
  const positive = run(scannerControl, 'scan:build');
  assert.equal(positive.status, 0, positive.text);
  console.log('PASS QA-INT2-05 safe URL controls through actual scanner');
  for (const [name, markup] of [
    ['href entity', '<a href=java&#x73;cript:void(0)>QA</a>'],
    ['href mixed case/whitespace', '<a HREF="  JaVa&#9;ScRiPt&colon;void(0)">QA</a>'],
    ['href percent', '<a href="java%73cript%3avoid(0)">QA</a>'],
    ['src executable data', '<img SRC="d&#97;ta:text/html,synthetic" alt="">'],
    ['srcset secondary URL', '<img srcset="/safe.png 1x, java&#x73;cript:void(0) 2x" alt="">'],
    ['formaction', '<button formaction="javascript&colon;void(0)">QA</button>'],
    ['SVG xlink:href', '<svg><a xlink:href="java&#x73;cript:void(0)"></a></svg>'],
    ['poster', '<video poster="vb&#x73;cript&colon;void(0)"></video>'],
    ['ping URL list', '<a href="/" ping="/safe java&#x73;cript:void(0)">QA</a>']
  ] as const) {
    emit(markup);
    const result = run(scannerControl, 'scan:build');
    assert.notEqual(result.status, 0, result.text);
    assert.ok(result.text.includes('OUTPUT_URL'), result.text);
    console.log('PASS QA-INT2-05 actual scanner negative: ' + name);
  }
} finally { rmSync(scannerControl, { recursive: true, force: true }); }
console.log('PASS all real-input CLI negative integration cases');
