import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCanonicalEntities, getOutputManifest, getRegistryView, getRouteManifest } from '../src/lib/canonical';
import { loadIntegrationSnapshot } from '../src/lib/integration';
import type { RecordBase, RegistryEvent, RouteHistory } from '../src/lib/types';
import { makePaViews } from '../src/components/projects/page-model';
import { getPaOutputScope, makePaOutputScope } from '../src/components/projects/output-scope';
import { vettedResources } from '../src/components/archive/public-provenance';

function dataset(records: RecordBase[], history: RouteHistory[] = []) {
  const registry: RegistryEvent[] = [...new Map(records.map((record) => [
    record.permanentId,
    { permanentId: record.permanentId, entity: record.entity, state: 'Assigned', recordedAt: '2026-01-01' } as const
  ])).values()];
  const routes = getRouteManifest(records, history);
  return { records: getCanonicalEntities(records), registry: getRegistryView(records, registry),
    routes, output: getOutputManifest(routes) };
}
function project(n: string, data: Partial<RecordBase> = {}): RecordBase {
  return { entity: 'Project', permanentId: 'PRJ-' + n, slug: 'example-' + n, locale: 'en', sourceLocale: 'en',
    publicationStatus: 'Published', primaryType: 'research', lifecycle: 'active', projectIds: [],
    title: 'Synthetic project ' + n, summary: 'Synthetic summary', goal: 'Synthetic goal', ...data };
}
function archive(n: string, data: Partial<RecordBase> = {}): RecordBase {
  return { entity: 'ArchiveRecord', permanentId: 'ARC-' + n, slug: 'example-' + n,
    locale: 'en', sourceLocale: 'en', publicationStatus: 'Published',
    projectIds: [], archiveKind: 'Work', validityStatus: 'Valid', date: '2026-01-02',
    title: 'Synthetic item ' + n, summary: 'Synthetic summary', ...data };
}
function historic(path: string, permanentId: string, locale: 'en' | 'zh', currentState: RouteHistory['currentState']): RouteHistory {
  return { path, permanentId, locale, currentState, firstPublishedAt: '2026-01-01' };
}
function requireRoute(snapshot: ReturnType<typeof dataset>, path: string) {
  const entry = snapshot.routes.find((route) => route.path === path);
  assert.ok(entry, path);
  return entry;
}

test('pinned actual shared snapshot authorizes seven exact PA paths and two Home files', () => {
  const snapshot = loadIntegrationSnapshot();
  const scope = getPaOutputScope(snapshot.routes);
  assert.equal(scope.approvedRoutes.length, 9);
  assert.equal(makePaViews(snapshot, scope).index('zh', 'archive').length, 0);
  assert.throws(() => makePaOutputScope(snapshot.routes, ['/archive/milestone-fixture/']), /no canonical/);
  assert.throws(() => makePaOutputScope(snapshot.routes, ['/notes/note-fixture/']), /no canonical/);
  assert.throws(() => makePaOutputScope(snapshot.routes, ['/archive/work-fixture/', '/archive/work-fixture/']), /repeats a route/);
});

test('project lifecycle, reverse relations, standalone Work and Work-only ordering use public route scope', () => {
  const snapshot = dataset([
    project('1201'), project('1202', { lifecycle: 'archived' }),
    archive('1204'), archive('1205', { date: '2026-01-09', projectIds: ['PRJ-1201', 'PRJ-1202'] }),
    archive('1206', { archiveKind: 'Milestone' })
  ]);
  const paths = ['/projects/example-1201/', '/projects/example-1202/', '/archive/example-1204/', '/archive/example-1205/'] as const;
  const views = makePaViews(snapshot, makePaOutputScope(snapshot.routes, paths));
  assert.deepEqual(views.index('en', 'projects').map(({ id }) => id), ['PRJ-1201']);
  assert.equal(views.detail(requireRoute(snapshot, paths[1])).record?.lifecycle, 'archived');
  assert.deepEqual(views.index('en', 'archive').map(({ id }) => id), ['ARC-1205', 'ARC-1204']);
  assert.equal(views.detail(requireRoute(snapshot, paths[2])).projects.length, 0);
  assert.equal(views.detail(requireRoute(snapshot, paths[3])).projects.length, 2);
  assert.deepEqual(views.detail(requireRoute(snapshot, paths[0])).works.map(({ href }) => href), [paths[3]]);
  const narrowed = makePaViews(snapshot, makePaOutputScope(snapshot.routes, paths.slice(0, 2)));
  assert.deepEqual(narrowed.detail(requireRoute(snapshot, paths[0])).works, []);
  assert.throws(() => narrowed.detail(requireRoute(snapshot, paths[3])), /outside the renderable scope/);
});

test('shared milestones reuse the same anchors across pages with descending date and ID tie-break', () => {
  const snapshot = dataset([
    project('1201'), project('1202'),
    archive('1204', { archiveKind: 'Milestone', projectIds: ['PRJ-1201', 'PRJ-1202', 'PRJ-1201'] }),
    archive('1206', { archiveKind: 'Milestone', projectIds: ['PRJ-1201'], date: '2026-01-09' }),
    archive('1205', { archiveKind: 'Milestone', projectIds: ['PRJ-1201'] }),
    archive('1207', { archiveKind: 'Milestone' }),
    archive('1208', { archiveKind: 'Milestone', projectIds: ['PRJ-1201'], publicationStatus: 'Draft' })
  ]);
  const paths = ['/projects/example-1201/', '/projects/example-1202/'] as const;
  const views = makePaViews(snapshot, makePaOutputScope(snapshot.routes, paths));
  assert.deepEqual(views.detail(requireRoute(snapshot, paths[0])).milestones.map(({ id }) => id),
    ['ARC-1206', 'ARC-1204', 'ARC-1205']);
  assert.deepEqual(views.detail(requireRoute(snapshot, paths[1])).milestones.map(({ id }) => id), ['ARC-1204']);
  assert.equal(snapshot.routes.some((route) => route.entity === 'ArchiveRecord'), false);
});

test('source fallback obeys shared decisions and never yields an alternate locale or Draft content', () => {
  const enPath = '/projects/example-1201/';
  const zhPath = '/zh/projects/example-1201/';
  const records = [project('1201'), project('1201', { locale: 'zh', publicationStatus: 'Draft', title: 'SECRET_PRIVATE_DRAFT' })];
  const snapshot = dataset(records);
  const views = makePaViews(snapshot, makePaOutputScope(snapshot.routes, [enPath, zhPath]));
  const target = views.detail(requireRoute(snapshot, zhPath));
  assert.equal(target.route.state, 'source-fallback');
  assert.equal(target.route.noindex, true);
  assert.equal(target.source?.href, enPath);
  assert.equal(target.record?.locale, 'en');
  assert.equal(target.alternate, undefined);
  assert.equal(views.detail(requireRoute(snapshot, enPath)).alternate, undefined);
  assert.equal(views.index('zh', 'projects').length, 0);
  const missing = dataset([project('1201', { publicationStatus: 'Draft' }), project('1201', { locale: 'zh' })]);
  assert.equal(requireRoute(missing, enPath).state, 'missing');
  assert.throws(() => makePaOutputScope(missing.routes, [enPath]), /no canonical renderable/);
});

test('withheld locale and withdrawn Work produce history-only views with no content or related links', () => {
  const paths = ['/projects/example-1201/', '/zh/projects/example-1201/', '/archive/example-1204/'] as const;
  const snapshot = dataset([
    project('1201'), project('1201', { locale: 'zh', publicationStatus: 'Draft', title: 'SECRET_PRIVATE_DRAFT' }),
    archive('1204', { validityStatus: 'Withdrawn', title: 'WITHDRAWN_SENTINEL', projectIds: ['PRJ-1201'] })
  ], [historic(paths[1], 'PRJ-1201', 'zh', 'Tombstone'), historic(paths[2], 'ARC-1204', 'en', 'Withdrawn')]);
  const views = makePaViews(snapshot, makePaOutputScope(snapshot.routes, paths));
  for (const [path, expected] of [[paths[1], 'tombstone'], [paths[2], 'withdrawn']] as const) {
    const detail = views.detail(requireRoute(snapshot, path));
    assert.equal(detail.route.state, expected);
    assert.equal(detail.record, undefined);
    assert.equal(detail.source, undefined);
    assert.deepEqual(detail.projects, []);
  }
  assert.deepEqual(views.index('en', 'archive'), []);
  assert.deepEqual(views.detail(requireRoute(snapshot, paths[0])).works, []);
});

test('public resource presentation rejects unsafe schemes, credentials, whitespace and malformed URLs', () => {
  const hrefs = ['https://example.invalid/fixture.pdf', 'javascript:alert(1)', '//example.invalid',
    'http://example.invalid', 'https://guest:pass@example.invalid', 'https://example.invalid\\evil', 'https://', 'https://foo bar'];
  assert.deepEqual(vettedResources(hrefs.map((href) => ({ href, label: 'Synthetic link' }))).map(({ href }) => href), [hrefs[0]]);
});
