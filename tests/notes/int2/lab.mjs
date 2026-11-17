import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { auditCompositeNotes } from './output-audit.mjs';

const root = process.cwd();
const mode = process.argv[2] ?? 'all';
assert.ok(['all', 'positive', 'negative'].includes(mode), 'unknown mode');
const evidence = resolve(process.argv[3] ?? 'artifacts/notes-int2');
const inputs = 'tests/notes/int2/';
const temp = mkdtempSync(join(tmpdir(), 'notes-int2-'));
const source = 'src/data/public/content';
const allowlist = 'src/data/manifests/public-source-allowlist.json';
const assetManifest = 'src/data/manifests/assets.json';
const sciencePolicy = 'src/data/manifests/notes-science.json';
const mdxId = 'NTE-0102-en';
const fileFor = (id) => source + '/' + id + '.json';
const original = fileFor('NTE-0103-en');
const mdx = fileFor(mdxId);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const unmarshal = (path) => JSON.parse(readFileSync(path, 'utf8'));
const readJson = (path) => unmarshal(join(temp, path));
function write(path, bytes) {
  const file = join(temp, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, bytes);
}
const writeJson = (path, value) => write(path, JSON.stringify(value, null, 2) + '\n');

function pin(path, bytes, mime) {
  write(path, bytes);
  const inventory = readJson(allowlist);
  inventory.files = inventory.files.filter((row) => row.path !== path);
  inventory.files.push({ path, sha256: digest(bytes) });
  writeJson(allowlist, inventory);
  const assets = readJson(assetManifest);
  const declarations = assets.filter((row) => row.path !== path);
  declarations.push({ path, approved: true, public: true, mime });
  writeJson(assetManifest, declarations);
}

function markOutputScope(expected, figure) {
  const path = 'src/components/composite/output-scope.ts';
  const start = readFileSync(join(temp, path), 'utf8');
  const marker = '...REVIEWED_DETAIL_ROUTES.map((route) => ({ route, outputFiles: [fileForRoute(route)] }))';
  assert.ok(start.includes(marker), 'composite exact scope entrypoint moved');
  const routes = Object.keys(expected).map((route) => ({
    route, outputFiles: [route.slice(1) + 'index.html', ...(route === '/notes/synthetic-geometry/' ? [figure.href.slice(1)] : [])]
  }));
  const checks = '  for (const [path, state] of Object.entries(' + JSON.stringify(expected) + ')) {\n' +
    "    if (!routes.some((route) => route.path === path && route.state === state && route.entity === 'Note')) throw new Error('NOTES_INT2_TEST_SCOPE: ' + path);\n" +
    '  }\n';
  assert.equal(start.split('  const scope: OutputScope = {').length, 2);
  write(path, start.replace('  const scope: OutputScope = {', checks + '  const scope: OutputScope = {')
    .replace(marker, marker + ',\n      ...' + JSON.stringify(routes, null, 2)));
}

function stage() {
  const hashes = unmarshal(inputs + 'inventory.json');
  const read = (path) => {
    assert.ok(Object.hasOwn(hashes, path), 'unknown scientific input: ' + path);
    const bytes = readFileSync(path);
    assert.equal(digest(bytes), hashes[path], 'fixture differs from pinned bytes: ' + path);
    return bytes;
  };
  const catalogue = JSON.parse(read(inputs + 'fixtures.json'));
  const fixtureAssets = JSON.parse(read('tests/notes/fixtures/assets.json'));
  const { base64, ...figure } = fixtureAssets['radial-figure'];
  pin('public' + figure.href, Buffer.from(base64, 'base64'), figure.mime);
  const date = '2026-01-07';
  const registry = readJson('src/data/registry.json');
  const history = readJson('src/data/route-history.json');
  const approvals = {};
  const fixtureRecords = [];
  for (const { id, body: paths, ...fields } of catalogue.records) {
    const body = paths.map((path) => read(path).toString('utf8')).join('\n');
    const row = { permanentId: id, entity: 'Note', publicationStatus: 'Published', category: 'Synthetic methods',
      projectIds: [], date, publishedAt: date, ...fields, body };
    fixtureRecords.push(row);
    const key = id + '-' + fields.locale;
    pin(fileFor(key), JSON.stringify(row) + '\n', 'application/json');
    if (paths[0].endsWith('.mdx')) approvals[key] = digest(body);
    if (!registry.some((row) => row.permanentId === id)) registry.push({ permanentId: id, entity: 'Note', state: 'Assigned', recordedAt: date });
  }
  for (const { id, path, locale, state } of catalogue.history) {
    history.push({ permanentId: id, path, locale, currentState: state, firstPublishedAt: date });
  }
  writeJson('src/data/registry.json', registry);
  writeJson('src/data/route-history.json', history);
  writeJson(sciencePolicy, { assets: { 'radial-figure': figure }, mdxApprovals: approvals });
  markOutputScope(catalogue.scope, figure);
  return { catalogue, fixtureRecords, fixtureAssets };
}

function run(command, file, diagnostic) {
  const result = spawnSync('npm', ['run', command], { cwd: temp, encoding: 'utf8', timeout: 120000 });
  if (result.error) throw result.error;
  const text = result.stdout + result.stderr;
  writeFileSync(join(evidence, file + '.log'), 'exit=' + result.status + '\n' + text);
  if (diagnostic) {
    assert.notEqual(result.status, 0, file + ' unexpectedly passed');
    assert.ok(text.includes(diagnostic), file + ' missed ' + diagnostic + '\n' + text.slice(-3000));
  } else {
    assert.equal(result.status, 0, file + '\n' + text.slice(-4500));
  }
  return { command, exit: result.status, evidence: file + '.log', diagnostic };
}

const mutations = [
  ['mdx-import', mdx, 'import probe from "./open-never.mjs"\n\nA note.', 'NOTE_AST: mdxjsEsm'],
  ['mdx-export', mdx, 'export const privateProbe = 1\n\nA note.', 'NOTE_AST: mdxjsEsm'],
  ['mdx-expression', mdx, '{globalThis.process.exitCode}', 'NOTE_AST: mdxFlowExpression'],
  ['mdx-jsx', mdx, '<img src="https://example.org/a.png" />', 'MDX_COMPONENT'],
  ['mdx-spread', mdx, '<Callout {...props} />', 'MDX_ATTRIBUTE'],
  ['mdx-event-handler', mdx, '<Callout text="x" onClick="x" />', 'EXECUTABLE_MARKUP'],
  ['mdx-cite-url', mdx, '<Cite href="javascript:alert" label="Cite" />', 'NOTE_URL'],
  ['mdx-pdf-asset', mdx, '<PdfLink asset="unapproved" label="Paper" />', 'NOTE_ASSET'],
  ['raw-html', original, '<div>raw</div>', 'NOTE_AST: html'],
  ['script', original, '<script>alert(1)</script>', 'EXECUTABLE_MARKUP'],
  ['bibliography-obfuscated', original, 'A note.[^src]\n\n[^src]: [Citation](java&#x73;cript:alert%281%29)', 'NOTE_URL'],
  ['network-path', original, '[Citation](//example.org/)', 'NOTE_URL'],
  ['fallback-link-as-translation', original, '[Translation](/zh/notes/synthetic-components/)', 'NOTE_URL'],
  ['remote-image', original, '![alt](https://example.org/remote.png "caption")', 'NOTE_ASSET'],
  ['path-traversal', original, '![alt](asset:../../private "caption")', 'NOTE_ASSET'],
  ['untrusted-tex-resource', original, '$\\includegraphics{https://example.org/remote.png}$', 'TEX_COMMAND'],
  ['untrusted-tex-link', original, '$\\href{https://example.org/}{x}$', 'TEX_COMMAND'],
  ['untrusted-tex-macro', original, '$\\def\\x{x}\\x$', 'TEX_COMMAND'],
  ['malformed-tex', original, '$\\frac{a}$', 'ParseError'],
  ['unknown-equation-ref', original, '$\\eqref{eq:missing}$', 'TEX_REFERENCE']
];

const results = [];
function withRestore(paths, callback) {
  const saved = paths.map((path) => [path, readFileSync(join(temp, path))]);
  try { callback(); } finally { for (const [path, bytes] of saved) write(path, bytes); }
}
function rejects(name, diagnostic) {
  for (const command of ['validate', 'build']) results.push(run(command, name + '-' + command, diagnostic));
}

function negative(fixtureAssets) {
  for (const [name, path, body, diagnostic] of mutations) {
    withRestore([path, allowlist, assetManifest, sciencePolicy], () => {
      pin(path, JSON.stringify({ ...readJson(path), body }) + '\n', 'application/json');
      if (path === mdx) {
        const policy = readJson(sciencePolicy);
        policy.mdxApprovals[mdxId] = digest(body);
        writeJson(sciencePolicy, policy);
      }
      rejects(name, diagnostic);
    });
  }
  withRestore([mdx, allowlist, assetManifest], () => {
    pin(mdx, JSON.stringify({ ...readJson(mdx), body: 'Synthetic body changed without independent MDX approval.' }), 'application/json');
    rejects('stale-mdx-approval', 'MDX_TRUST');
  });
  for (const status of ['Draft', 'Withdrawn']) {
    const hidden = fileFor('NTE-0103-zh');
    withRestore([allowlist, assetManifest], () => {
      pin(hidden, JSON.stringify({ ...readJson(original), locale: 'zh', publicationStatus: status, body: 'SECRET_PRIVATE_DRAFT' }), 'application/json');
      try { rejects('public-' + status.toLowerCase(), 'PUBLIC_DRAFT'); }
      finally { rmSync(join(temp, hidden)); }
    });
  }
  for (const [name, field, value, diagnostic] of [
    ['slug-diverges', 'slug', 'different-canonical-slug', 'GLOBAL_SLUG'],
    ['source-locale-diverges', 'sourceLocale', 'zh', 'GLOBAL_SOURCE']
  ]) {
    const path = fileFor('NTE-0101-zh');
    withRestore([path, allowlist, assetManifest], () => {
      pin(path, JSON.stringify({ ...readJson(path), [field]: value }), 'application/json');
      rejects(name, diagnostic);
    });
  }
  const extraLocale = fileFor('NTE-0103-fr');
  withRestore([allowlist, assetManifest], () => {
    pin(extraLocale, JSON.stringify({ ...readJson(original), locale: 'fr' }), 'application/json');
    try { rejects('unsupported-note-locale', 'NOTES_LOCALE'); } finally { rmSync(join(temp, extraLocale)); }
  });
  const figure = 'public' + fixtureAssets['radial-figure'].href;
  withRestore([figure], () => {
    write(figure, 'synthetic tampered bytes');
    rejects('raster-hash', 'PUBLIC_HASH');
  });
  withRestore([sciencePolicy], () => {
    writeJson(sciencePolicy, { ...readJson(sciencePolicy), assets: { fake: { href: '/notes-fixtures/unapproved.png', mime: 'image/png' } } });
    rejects('asset-policy-unlisted', 'NOTES_ASSET_POLICY');
  });
  const { href, base64, mime } = fixtureAssets['equation-pdf'];
  withRestore([allowlist, assetManifest], () => {
    pin('public' + href, Buffer.from(base64, 'base64'), mime);
    try { rejects('pdf-mime', 'ASSET_MIME'); } finally { rmSync(join(temp, 'public' + href)); }
  });
  const extra = 'src/pages/notes/int2-unapproved.astro';
  write(extra, '<html><meta name="robots" content="noindex"><p>Unapproved synthetic route</p></html>');
  try { results.push(run('build', 'extra-route-build', 'Unexpected build output paths')); }
  finally { rmSync(join(temp, extra)); }
  assert.equal(results.length, 59);
}

try {
  mkdirSync(evidence, { recursive: true });
  for (const name of ['src', 'scripts', 'package.json', 'package-lock.json', 'astro.config.mjs', 'tsconfig.json']) {
    cpSync(resolve(root, name), join(temp, name), { recursive: true });
  }
  symlinkSync(resolve(root, 'node_modules'), join(temp, 'node_modules'), 'dir');
  const { catalogue, fixtureRecords, fixtureAssets } = stage();
  if (mode !== 'negative') {
    run('validate', 'composite-validate');
    run('build', 'composite-build');
    for (const name of ['route-manifest', 'output-manifest', 'notes-candidate', 'canonical-entities', 'registry-view']) {
      cpSync(join(temp, 'artifacts', name + '.json'), join(evidence, name + '.json'));
    }
    for (const name of [allowlist, assetManifest, 'src/data/registry.json', 'src/data/route-history.json']) {
      cpSync(join(temp, name), join(evidence, name.split('/').at(-1)));
    }
    cpSync(join(temp, 'dist'), join(evidence, 'dist'), { recursive: true });
    writeFileSync(join(evidence, 'fixture-records.json'), JSON.stringify(fixtureRecords, null, 2) + '\n');
    const audit = auditCompositeNotes(evidence, catalogue);
    writeFileSync(join(evidence, 'output-audit.json'), JSON.stringify(audit, null, 2) + '\n');
    console.log('PASS composite science: ' + audit.htmlFiles + ' exact HTML pages; ' + audit.imageFiles + ' pinned raster asset');
  }
  if (mode !== 'positive') {
    negative(fixtureAssets);
    writeFileSync(join(evidence, 'negative-results.json'), JSON.stringify(results, null, 2) + '\n');
    console.log('PASS 29 source negatives at both real commands; 1 extra-route build negative');
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}
