import assert from 'node:assert/strict';
import test from 'node:test';
import { getRouteManifest } from '../src/lib/canonical';
import { buildRoutes, resolveLocale } from '../src/lib/routes';
import type { RecordBase, RegistryEvent, RouteHistory } from '../src/lib/types';
import { validateDataset } from '../src/lib/validate';

const en: RecordBase = {
  entity: 'Note', permanentId: 'NTE-0190', locale: 'en', sourceLocale: 'en', slug: 'int2-test',
  publicationStatus: 'Published', title: 'Synthetic source', summary: 'Summary', date: '2026-01-02',
  category: 'Synthetic', body: 'Synthetic source body', publishedAt: '2026-01-02', projectIds: []
};
const zh: RecordBase = { ...en, locale: 'zh', title: '合成译文', body: '合成译文正文' };
const history = (currentState: RouteHistory['currentState'], slug = en.slug): RouteHistory =>
  ({ permanentId: en.permanentId, locale: 'zh', path: '/zh/notes/' + slug + '/', currentState, firstPublishedAt: '2026-01-02' });
const target = (records: RecordBase[], ledger: RouteHistory[] = []) =>
  getRouteManifest(records, ledger).find((route) => route.locale === 'zh' && route.path === '/zh/notes/int2-test/');
const assigned: RegistryEvent = { permanentId: en.permanentId, entity: 'Note', state: 'Assigned', recordedAt: '2026-01-02' };

test('INT2 missing target and never-public Draft share the same source fallback route', () => {
  for (const records of [[en], [en, { ...zh, publicationStatus: 'Draft' as const, body: 'PRIVATE_NOTE_SENTINEL' }]]) {
    const route = target(records);
    assert.deepEqual([route?.state, route?.permanentId, route?.sourceCanonical, route?.sourceLocale, route?.noindex],
      ['source-fallback', en.permanentId, '/notes/int2-test/', 'en', true]);
    assert.doesNotMatch(JSON.stringify(route), /PRIVATE_NOTE_SENTINEL/);
    assert.equal(buildRoutes(records).filter((route) => route.kind === 'source-fallback').length, 1);
  }
});

test('INT2 genuine translation outranks a missing-locale fallback', () => {
  assert.equal(target([en, zh])?.state, 'page');
  assert.equal(target([en, zh])?.sourceCanonical, undefined);
  const originalZh: RecordBase = { ...zh, sourceLocale: 'zh' };
  const enFallback = getRouteManifest([originalZh]).find((route) => route.locale === 'en');
  assert.deepEqual([enFallback?.state, enFallback?.sourceCanonical, enFallback?.sourceLocale],
    ['source-fallback', '/zh/notes/int2-test/', 'zh']);
});

test('INT2 same-locale history preserves old paths and blocks fallback regardless of order', () => {
  for (const state of ['Tombstone', 'Withdrawn'] as const) {
    const expected = state === 'Tombstone' ? 'tombstone' : 'withdrawn';
    assert.equal(target([en], [history(state)])?.state, expected);
    assert.equal(target([en, { ...zh, publicationStatus: 'Draft' }], [history(state)])?.state, expected);
    assert.equal(target([en], [history(state, 'old-int2-test')]), undefined);
    const old = getRouteManifest([en], [history(state, 'old-int2-test')]).find((route) => route.locale === 'zh');
    assert.deepEqual([old?.path, old?.state, old?.noindex], ['/zh/notes/old-int2-test/', expected, true]);
  }
  const old = history('Tombstone', 'another-old-slug');
  for (const entries of [[old, history('Withdrawn')], [history('Withdrawn'), old]]) {
    assert.equal(resolveLocale([en], en.permanentId, 'zh', entries).kind, 'withdrawn');
    assert.equal(target([en], entries)?.state, 'withdrawn');
  }
});

test('INT2 explicit previously public/withdrawn target cannot receive source fallback', () => {
  assert.equal(target([en, { ...zh, publicationStatus: 'Draft', previouslyPublished: true }])?.state, 'tombstone');
  assert.equal(target([en, { ...zh, publicationStatus: 'Withdrawn' }])?.state, 'withdrawn');
});

test('INT2 absent, Draft, withdrawn original and a translated-only public projection', () => {
  validateDataset([zh], [assigned]);
  assert.equal(target([zh])?.state, 'page');
  assert.equal(resolveLocale([zh], en.permanentId, 'en').kind, 'missing');
  for (const status of ['Draft', 'Withdrawn'] as const) {
    const source = { ...en, publicationStatus: status };
    assert.ok(!getRouteManifest([source]).some((route) => route.state === 'source-fallback'));
    assert.equal(target([source, zh])?.state, 'page');
  }
  assert.ok(!getRouteManifest([{ ...en, publicationStatus: 'Draft' }, { ...zh, publicationStatus: 'Draft' }])
    .some((route) => route.state === 'page' || route.state === 'source-fallback'));
});

test('INT2 history cannot silently disappear or reactivate, fallback cannot take another identity', () => {
  assert.throws(() => getRouteManifest([en], [history('Published')]), /Published historical URL disappeared/);
  assert.throws(() => getRouteManifest([en, zh], [history('Tombstone')]), /reactivated without approval/);
  const other = { ...zh, permanentId: 'NTE-0191', sourceLocale: 'zh' as const };
  assert.throws(() => getRouteManifest([en, other]), /Duplicate route/);
});

test('INT2 canonical identity remains permanent and sourceLocale must be a valid language', () => {
  assert.throws(() => validateDataset([en, { ...zh, slug: 'different' }], [assigned]), /Slug differs/);
  assert.throws(() => validateDataset([en, { ...zh, sourceLocale: 'zh' }], [assigned]), /Source locale differs/);
  assert.throws(() => validateDataset([zh], [assigned, { ...assigned, state: 'Retired' }]), /Retired permanent ID/);
});
