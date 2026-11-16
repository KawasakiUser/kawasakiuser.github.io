import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const evidence = resolve(process.argv[3] ?? 'artifacts/notes-lab');
const temporary = mkdtempSync(join(tmpdir(), 'g6b-notes-'));
const out = join(temporary, 'repo');
const fixtureRoot = 'tests/notes/fixtures';
const enRecord = 'src/data/public/content/NTE-0001-en.json';
const mdxRecord = 'src/data/public/content/NTE-0002-en.json';
const allowlist = 'src/data/manifests/public-source-allowlist.json';
const assetsFile = 'src/data/manifests/assets.json';
const mdxApprovals = 'tests/notes/fixture-mdx-approvals.json';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (path) => JSON.parse(readFileSync(join(out, path), 'utf8'));
function write(path, bytes) {
  const file = join(out, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, bytes);
}
const put = (path, data) => write(path, JSON.stringify(data, null, 2) + '\n');
const command = (name, args, env = {}) => spawnSync(name, args, {
  cwd: out, env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024
});
function log(name, result) {
  const output = (result.stdout ?? '') + (result.stderr ?? '');
  writeFileSync(join(evidence, name + '.log'), 'exit=' + result.status + '\n' + output);
  return output;
}
function pin(path, bytes, mime) {
  write(path, bytes);
  const catalogue = json(allowlist);
  const previous = catalogue.files.find((item) => item.path === path);
  if (previous) previous.sha256 = hash(bytes);
  else catalogue.files.push({ path, sha256: hash(bytes) });
  put(allowlist, catalogue);
  const declarations = json(assetsFile);
  if (!declarations.some((item) => item.path === path)) {
    declarations.push({ path, approved: true, public: true, mime });
    put(assetsFile, declarations);
  }
}
function fixtures() {
  const inventory = json('tests/notes/fixture-inventory.json');
  const read = (name) => {
    const bytes = readFileSync(join(out, fixtureRoot, name));
    assert.equal(hash(bytes), inventory[name], 'synthetic fixture changed: ' + name);
    return bytes;
  };
  const allAssets = JSON.parse(read('assets.json'));
  const { base64, ...radial } = allAssets['radial-figure'];
  put('tests/notes/fixture-asset-map.json', { 'radial-figure': radial });
  pin('public' + radial.href, Buffer.from(base64, 'base64'), radial.mime);
  const date = '2026-01-07';
  const records = [
    { id: 'NTE-0001', locale: 'en', slug: 'synthetic-geometry', title: 'Geometry as a Field', summary: 'A reading specimen on metric components, Kerr spacetime, and scientific notation.', category: 'Geometry', file: 'geometry-en.md',
      relations: [{ id: 'NTE-0003', entity: 'Note' }] },
    { id: 'NTE-0001', locale: 'zh', slug: 'synthetic-geometry', title: '作为场的几何', summary: '用度规分量、Kerr 时空和科学记号，演示一篇带公式的长笔记。', category: '几何', file: 'geometry-zh.md',
      relations: [{ id: 'NTE-0003', entity: 'Note' }] },
    { id: 'NTE-0002', locale: 'en', slug: 'synthetic-components', title: 'Scientific components', summary: 'A specimen with reviewed, data-only components.', category: 'Methods', file: 'components-en.mdx' },
    { id: 'NTE-0003', locale: 'en', slug: 'synthetic-original', title: 'An original-language specimen', summary: 'An English-only specimen for the locale fixture.', category: 'Methods', file: 'source-en.md' }
  ];
  const registry = json('src/data/registry.json');
  const history = json('src/data/route-history.json');
  const approvals = {};
  for (const { id, file, ...fields } of records) {
    const body = read(file).toString('utf8');
    const row = { ...fields, permanentId: id, entity: 'Note', publicationStatus: 'Published', date, publishedAt: date, projectIds: [], sourceLocale: 'en', body };
    pin('src/data/public/content/' + id + '-' + fields.locale + '.json', JSON.stringify(row) + '\n', 'application/json');
    if (fields.locale === 'en') registry.push({ permanentId: id, entity: 'Note', state: 'Assigned', recordedAt: date });
    if (file.endsWith('.mdx')) approvals[id + '-' + fields.locale] = hash(body);
  }
  history.push(
    { path: '/zh/notes/synthetic-history/', permanentId: 'NTE-0004', locale: 'zh', firstPublishedAt: date, currentState: 'Tombstone' },
    { path: '/notes/synthetic-withdrawn/', permanentId: 'NTE-0005', locale: 'en', firstPublishedAt: date, currentState: 'Withdrawn' }
  );
  put('src/data/registry.json', registry);
  put('src/data/route-history.json', history);
  put(mdxApprovals, approvals);
}
function mountRoutes() {
  for (const locale of ['en', 'zh']) {
    const dir = 'src/pages/' + (locale === 'zh' ? 'zh/' : '') + 'notes/';
    const relativeRoot = locale === 'zh' ? '../../../../' : '../../../';
    for (const [template, output] of [['index', 'index.astro'], ['detail', '[slug].astro']]) {
      const source = readFileSync(join(out, 'tests/notes/route-templates', template + '.astro.txt'), 'utf8');
      write(dir + output, source.replaceAll('@ROOT@', relativeRoot).replaceAll('@LOCALE@', locale));
    }
  }
  const pkg = json('package.json');
  pkg.scripts.validate += ' && node --import tsx tests/notes/prebuild.ts';
  put('package.json', pkg);
}
function alter(path, body, refresh = true) {
  const value = json(path);
  value.body = body;
  const bytes = JSON.stringify(value) + '\n';
  if (!refresh) return write(path, bytes);
  pin(path, bytes, 'application/json');
  if (path === mdxRecord) put(mdxApprovals, { 'NTE-0002-en': hash(body) });
}
const negativeCases = [
  ['mdx-esm', mdxRecord, 'export const probe = 1\n\nA note.\n', 'NOTE_AST: mdxjsEsm'],
  ['mdx-import', mdxRecord, 'import probe from "./never-read.mjs"\n', 'NOTE_AST: mdxjsEsm'],
  ['mdx-expression', mdxRecord, '{globalThis.process.exitCode}\n', 'NOTE_AST: mdxFlowExpression'],
  ['mdx-jsx', mdxRecord, '<iframe src="https://example.org/" />', 'EXECUTABLE_MARKUP'],
  ['mdx-event', mdxRecord, '<Callout text="x" onClick="x" />', 'EXECUTABLE_MARKUP'],
  ['mdx-spread', mdxRecord, '<Callout {...props} />', 'MDX_ATTRIBUTE'],
  ['mdx-html-svg', mdxRecord, '<svg />', 'MDX_COMPONENT'],
  ['markdown-html', enRecord, '<div>raw</div>', 'NOTE_AST: html'],
  ['url-obfuscated', enRecord, '[bad](java&#x73;cript:alert%281%29)', 'NOTE_URL'],
  ['url-network-path', enRecord, '[bad](//example.org/)', 'NOTE_URL'],
  ['asset-unknown', enRecord, '![alt](asset:private "title")', 'NOTE_ASSET'],
  ['asset-traversal', enRecord, '![alt](asset:../../private "title")', 'NOTE_ASSET'],
  ['tex-network', enRecord, '$\\includegraphics{https://example.org/a.png}$', 'TEX_COMMAND'],
  ['tex-macro', enRecord, '$\\def\\x{x}\\x$', 'TEX_COMMAND'],
  ['tex-malformed', enRecord, '$\\frac{a}$', 'ParseError'],
  ['tex-unresolved', enRecord, '$\\eqref{eq:missing}$', 'TEX_REFERENCE']
];
function rejectsBoth(name, marker) {
  for (const entry of ['validate', 'build']) {
    const result = command('npm', ['run', entry]);
    const output = log(name + '-' + entry, result);
    assert.notEqual(result.status, 0, name + ' accepted by ' + entry);
    assert.ok(output.includes(marker), name + ' missing expected diagnostic ' + marker + '\n' + output.slice(-2000));
  }
}
function negative() {
  for (const [name, path, body, marker] of negativeCases) {
    const original = readFileSync(join(out, path));
    const originalApproval = readFileSync(join(out, mdxApprovals));
    alter(path, body);
    rejectsBoth(name, marker);
    pin(path, original, 'application/json');
    write(mdxApprovals, originalApproval);
  }
  const pristine = readFileSync(join(out, enRecord));
  for (const field of ['date', 'category']) {
    const record = JSON.parse(pristine);
    delete record[field];
    pin(enRecord, JSON.stringify(record) + '\n', 'application/json');
    rejectsBoth('published-missing-' + field, 'PUBLISHED_REQUIRED');
    pin(enRecord, pristine, 'application/json');
  }
  const invalidDate = { ...JSON.parse(pristine), date: '2026-02-31' };
  pin(enRecord, JSON.stringify(invalidDate) + '\n', 'application/json');
  rejectsBoth('published-invalid-date', 'NOTES_REQUIRED');
  pin(enRecord, pristine, 'application/json');
  alter(enRecord, 'Synthetic unauthorized change.', false);
  rejectsBoth('unrepinned-source', 'PUBLIC_HASH');
  write(enRecord, pristine);

  const pristineMdx = readFileSync(join(out, mdxRecord));
  const originalApproval = readFileSync(join(out, mdxApprovals));
  alter(mdxRecord, 'Synthetic unreviewed Markdown subset.');
  write(mdxApprovals, originalApproval);
  rejectsBoth('unreviewed-mdx', 'MDX_TRUST');
  pin(mdxRecord, pristineMdx, 'application/json');

  const draft = 'src/data/public/content/NTE-9999-en.json';
  write(draft, JSON.stringify({ ...json(enRecord), permanentId: 'NTE-9999', publicationStatus: 'Draft', body: 'SECRET_PRIVATE_DRAFT' }));
  rejectsBoth('public-draft', 'PUBLIC_DRAFT');
  rmSync(join(out, draft));
  const unlisted = 'public/unlisted.png';
  write(unlisted, 'synthetic unlisted bytes');
  rejectsBoth('unlisted-asset', 'UNLISTED_PUBLIC_FILE');
  rmSync(join(out, unlisted));

  const allAssets = json(fixtureRoot + '/assets.json');
  const pdf = allAssets['equation-pdf'];
  const pdfPath = 'public' + pdf.href;
  const previousAllowlist = readFileSync(join(out, allowlist));
  const previousAssets = readFileSync(join(out, assetsFile));
  pin(pdfPath, Buffer.from(pdf.base64, 'base64'), pdf.mime);
  rejectsBoth('pdf-shared-mime', 'ASSET_MIME');
  rmSync(join(out, pdfPath));
  write(allowlist, previousAllowlist);
  write(assetsFile, previousAssets);

  const extra = 'src/pages/notes/unapproved.astro';
  write(extra, '<!doctype html><meta name="robots" content="noindex"><p>Unapproved test output</p>');
  const result = command('npm', ['run', 'build']);
  assert.notEqual(result.status, 0);
  assert.ok(log('unapproved-route-build', result).includes('Unexpected build output paths'));
  rmSync(join(out, extra));
  console.log(negativeCases.length + 8 + ' source cases rejected at both validate and build; one unexpected output rejected after Astro build');
}
try {
  mkdirSync(evidence, { recursive: true });
  mkdirSync(out);
  for (const name of ['src', 'scripts', 'tests', 'package.json', 'package-lock.json', 'astro.config.mjs', 'tsconfig.json']) {
    cpSync(join(root, name), join(out, name), { recursive: true });
  }
  symlinkSync(join(root, 'node_modules'), join(out, 'node_modules'), 'dir');
  fixtures();
  mountRoutes();
  const mode = process.argv[2] ?? 'build';
  if (mode === 'negative') negative();
  else {
    const empty = mode === 'empty';
    if (empty) {
      const row = 'src/data/public/content/NTE-0001-zh.json';
      rmSync(join(out, row));
      const catalog = json(allowlist);
      catalog.files = catalog.files.filter((entry) => entry.path !== row);
      put(allowlist, catalog);
      put(assetsFile, json(assetsFile).filter((entry) => entry.path !== row));
      const scope = json('tests/notes/candidate-scope.json');
      scope.approvedRoutes = scope.approvedRoutes.filter((entry) => entry.route !== '/zh/notes/synthetic-geometry/');
      put('tests/notes/candidate-scope.json', scope);
    }
    const result = command('npm', ['run', 'build'], { NOTES_LAB_FALLBACK: mode === 'fallback' ? '1' : '0' });
    const output = log(mode + '-build', result);
    assert.equal(result.status, 0, output.slice(-6000));
    cpSync(join(out, 'dist'), join(evidence, 'dist'), { recursive: true });
    for (const name of ['notes-candidate', 'output-manifest', 'route-manifest']) {
      cpSync(join(out, 'artifacts', name + '.json'), join(evidence, name + '.json'));
    }
    console.log('PASS disposable Notes ' + mode + ' Astro build and original output scanner');
  }
} finally {
  if (existsSync(temporary)) rmSync(temporary, { recursive: true, force: true });
}
