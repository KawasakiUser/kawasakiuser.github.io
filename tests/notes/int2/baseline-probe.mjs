import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const sha = '08c6a5d4556ff2fa315d72d95ecac7f3ee71f0f8';
const out = resolve(process.argv[2] ?? 'artifacts/notes-int2-baseline');
mkdirSync(out, { recursive: true });
const temp = mkdtempSync(join(tmpdir(), 'notes-int2-red-'));
const contentPath = 'src/data/public/content/NTE-0106-zh.json';
const read = (file) => JSON.parse(readFileSync(join(temp, file), 'utf8'));
const write = (file, value) => writeFileSync(join(temp, file), JSON.stringify(value) + '\n');
function run(cmd, args, opts) {
  const result = spawnSync(cmd, args, opts);
  if (result.error) throw result.error;
  return result;
}

try {
  const archive = run('git', ['archive', sha], { maxBuffer: 8 * 1024 * 1024 });
  assert.equal(archive.status, 0);
  assert.equal(run('tar', ['-x', '-C', temp], { input: archive.stdout }).status, 0);
  symlinkSync(resolve('node_modules'), join(temp, 'node_modules'), 'dir');
  const route = run(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
    import {getRouteManifest} from './src/lib/canonical.ts';
    import {resolveLocale} from './src/lib/routes.ts';
    const rows = [{entity:'Note',locale:'en',sourceLocale:'en',slug:'red-probe',permanentId:'NTE-0106',publicationStatus:'Published',projectIds:[]}];
    console.log(JSON.stringify({resolution:resolveLocale(rows,'NTE-0106','zh').kind, zhRoute:getRouteManifest(rows).filter(r=>r.locale==='zh')}));
  `], { cwd: temp, encoding: 'utf8' });
  assert.equal(route.status, 0, route.stderr);
  assert.deepEqual(JSON.parse(route.stdout), { resolution: 'source-fallback', zhRoute: [] });
  writeFileSync(join(out, 'baseline-no-route.json'), route.stdout);
  const date = '2026-01-07';
  write(contentPath, { entity: 'Note', locale: 'zh', sourceLocale: 'en', slug: 'red-probe', permanentId: 'NTE-0106',
    publicationStatus: 'Published', title: '合成译文', summary: '合成摘要', body: '合成正文', date, publishedAt: date, category: 'Synthetic', projectIds: [] });
  const ledger = read('src/data/registry.json');
  ledger.push({ entity: 'Note', permanentId: 'NTE-0106', state: 'Assigned', recordedAt: date });
  write('src/data/registry.json', ledger);
  const pins = read('src/data/manifests/public-source-allowlist.json');
  pins.files.push({ path: contentPath, sha256: createHash('sha256').update(readFileSync(join(temp, contentPath))).digest('hex') });
  write('src/data/manifests/public-source-allowlist.json', pins);
  const assets = read('src/data/manifests/assets.json');
  assets.push({ path: contentPath, mime: 'application/json', approved: true, public: true });
  write('src/data/manifests/assets.json', assets);
  for (const script of ['validate', 'build']) {
    const result = run('npm', ['run', script], { cwd: temp, encoding: 'utf8', timeout: 120000 });
    const log = result.stdout + result.stderr;
    writeFileSync(join(out, 'baseline-translation-' + script + '.log'), 'exit=' + result.status + '\n' + log);
    assert.notEqual(result.status, 0);
    assert.ok(log.includes('SOURCE_LOCALE'), log);
  }
  console.log('Confirmed PR #8 red cases: fallback resolution lacks a static route; authorized translated-only Note fails validate and build.');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
