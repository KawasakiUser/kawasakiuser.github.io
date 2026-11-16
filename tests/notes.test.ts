import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadIntegrationSnapshot } from '../src/lib/integration';
import { getRouteManifest } from '../src/lib/canonical';
import { notesIndex, noteDetail } from '../src/lib/science-render/views';
import { renderScience } from '../src/lib/science-render/render';
import type { RecordBase } from '../src/lib/types';

const digest = (text: string) => createHash('sha256').update(text).digest('hex');

test('bilingual scientific Markdown renders durable references, narrow panels and a captioned table', () => {
  for (const locale of ['en', 'zh'] as const) {
    const body = readFileSync('tests/notes/fixtures/geometry-' + locale + '.md', 'utf8');
    const options = { locale, assets: { 'radial-figure': { href: '/fixtures/radial.png', mime: 'image/png' as const } } };
    const result = renderScience(body, options);
    assert.deepEqual(result, renderScience(body, options));
    for (const markup of [/<math /, /id="eq-kerr"/, /href="#eq-kerr"/, /<figcaption>/, /<caption>/, /<th scope="col">/, /aria-label=.*? tabindex="0"/]) {
      assert.match(result.html, markup);
    }
    assert.equal(result.headings.filter(({ depth }) => depth === 2).length, 3);
    assert.doesNotMatch(result.html, /<script|<svg|<iframe|javascript:/i);
  }
});

test('MDX routes through an exact reviewed hash and typed data-only components', () => {
  const body = '<PdfLink asset="paper" label="Reference (PDF)" />\n\n<Callout text="&lt;b&gt;Data&lt;/b&gt;" />';
  assert.throws(() => renderScience(body, { locale: 'en', format: 'mdx' }), /MDX_TRUST/);
  const result = renderScience(body, {
    locale: 'en', format: 'mdx', reviewedMdxSha256: digest(body),
    assets: { paper: { href: '/fixtures/reference.pdf', mime: 'application/pdf' } }
  });
  assert.match(result.html, /href="\/fixtures\/reference\.pdf"/);
  assert.doesNotMatch(result.html, /<b>/);
  for (const [source, reason] of [
    ['<Callout text={process.env} />', /MDX_ATTRIBUTE/],
    ['<Ctor text="x" />', /MDX_COMPONENT/],
    ['{globalThis.process.exitCode}', /NOTE_AST/],
    ['<Cite href="data:bad" label="Content" />', /NOTE_URL/]
  ] as const) {
    assert.throws(() => renderScience(source, { locale: 'en', format: 'mdx', reviewedMdxSha256: digest(source) }), reason);
  }
});

test('bad and duplicate equation references and invalid heading levels fail closed', () => {
  const display = '$$\nx=1\\tag{1}\\label{eq:one}\n$$';
  assert.throws(() => renderScience(display + '\n\n' + display, { locale: 'en' }), /TEX_LABEL/);
  assert.throws(() => renderScience('$\\eqref{eq:missing}$', { locale: 'en' }), /TEX_REFERENCE/);
  assert.throws(() => renderScience('### A skipped heading', { locale: 'en' }), /NOTE_HEADING/);
  assert.throws(() => renderScience('$x$', {
    locale: 'en', renderer: () => '<math><mi href="https://example.org">x</mi></math>'
  }), /MATH_OUTPUT/);
});

test('index and detail selection enforce real routes and source identity', () => {
  const snapshot = loadIntegrationSnapshot();
  const source = snapshot.records.find((record) => record.permanentId === 'NOT-0001')!;
  const en = snapshot.routes.find((route) => route.permanentId === source.permanentId)!;
  assert.deepEqual(notesIndex(snapshot, 'en', new Set()), []);
  assert.equal(notesIndex(snapshot, 'en', new Set([en.path])).length, 1);
  assert.deepEqual(notesIndex(snapshot, 'zh', new Set([en.path])), []);
  const fixture: RecordBase = { ...source, legacyFixture: undefined, permanentId: 'NTE-9999', slug: 'locale-test' };
  const unresolved: RecordBase = { ...fixture, locale: 'zh', publicationStatus: 'Draft', body: 'DRAFT TEST MARKER' };
  const routes = getRouteManifest([fixture, unresolved]);
  const fallback = routes.find((route) => route.state === 'source-fallback')!;
  const testSnapshot = { ...snapshot, records: [{ ...fixture, canonicalId: fixture.permanentId, globalKey: fixture.permanentId, legacyFixture: false }], routes };
  const paths = new Set(routes.map((route) => route.path));
  const page = noteDetail(testSnapshot, fallback, paths);
  assert.equal(page?.note?.locale, 'en');
  assert.equal(page?.canonical, '/notes/locale-test/');
  assert.deepEqual(page?.alternates, []);
  assert.throws(() => noteDetail(testSnapshot, { ...fallback, sourceCanonical: '/notes/incorrect/' }, paths), /NOTES_SOURCE/);
});
