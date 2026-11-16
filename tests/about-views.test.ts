import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ABOUT_CANDIDATE_SCOPE, makeAboutView } from '../src/components/about/page-model';
import { getCanonicalEntities, getOutputManifest, getRegistryView, getRouteManifest, type OutputScope } from '../src/lib/canonical';
import { loadIntegrationSnapshot } from '../src/lib/integration';
import { routeFor } from '../src/lib/routes';
import type { RecordBase, RegistryEvent } from '../src/lib/types';
import { validateDataset } from '../src/lib/validate';

const scope = (relatedPaths: string[] = []): OutputScope => ({
  ...ABOUT_CANDIDATE_SCOPE,
  approvedRoutes: [
    ...ABOUT_CANDIDATE_SCOPE.approvedRoutes,
    ...relatedPaths.map((route) => ({ route, outputFiles: [route.slice(1) + 'index.html'] }))
  ]
});

function snapshot(records: RecordBase[], relatedPaths: string[] = []) {
  const assignments = new Map<string, RegistryEvent>();
  for (const { permanentId, entity } of records) {
    assignments.set(permanentId, { permanentId, entity, state: 'Assigned', recordedAt: '2026-01-01' });
  }
  const registry = [...assignments.values()];
  validateDataset(records, registry);
  const routes = getRouteManifest(records);
  return {
    records: getCanonicalEntities(records), registry: getRegistryView(records, registry), routes,
    output: getOutputManifest(routes, scope(relatedPaths))
  };
}

function row(id: string, entity: RecordBase['entity'], changes: Partial<RecordBase> = {}): RecordBase {
  return {
    permanentId: id, entity, slug: id.toLowerCase(), locale: 'en', sourceLocale: 'en',
    publicationStatus: 'Published', publishedAt: '2026-01-01',
    title: 'Synthetic ' + id, summary: 'Synthetic sample only.', projectIds: [], ...changes
  };
}

const milestone = (id: string, date: string, changes: Partial<RecordBase> = {}) =>
  row(id, 'ArchiveRecord', { archiveKind: 'Milestone', validityStatus: 'Valid', date, ...changes });

const project = (id: string, changes: Partial<RecordBase> = {}) =>
  row(id, 'Project', { primaryType: 'research', lifecycle: 'active', goal: 'Synthetic goal', ...changes });

function translation(record: RecordBase, status: RecordBase['publicationStatus'] = 'Published'): RecordBase {
  return { ...record, locale: 'zh', title: '合成示例 ' + record.permanentId, publicationStatus: status };
}

test('inherited files show one English event and omit unapproved About fields in both locales', () => {
  const actual = loadIntegrationSnapshot();
  const en = makeAboutView(actual, 'en');
  assert.deepEqual(en.milestones.map(({ id }) => id), ['ARC-0002']);
  assert.deepEqual(makeAboutView(actual, 'zh'), {
    introduction: [], methods: [], contact: undefined, milestones: [], collaborations: [], links: []
  });
  assert.deepEqual(en.collaborations, []);
  assert.deepEqual(en.links, []);
  assert.deepEqual(en.introduction, []);
  assert.equal(en.contact, undefined);
});

test('About excludes a shared Project event, Work, undated/invalid and unpublished locales', () => {
  const alpha = project('PRJ-1201');
  const beta = project('PRJ-1202');
  const latest = milestone('ARC-1206', '2024-02-29');
  const tiedA = milestone('ARC-1204', '2024-02-20');
  const tiedB = milestone('ARC-1205', '2024-02-20');
  const linked = milestone('ARC-1207', '2024-03-01', { projectIds: [alpha.permanentId, beta.permanentId] });
  const data = snapshot([
    alpha, beta, linked, tiedB, tiedA, translation(tiedA), latest, translation(latest, 'Draft'),
    milestone('ARC-1208', '2026-02-29'),
    milestone('ARC-1209', '', { publicationStatus: 'Draft' }),
    milestone('ARC-1210', '2024-03-02', { publicationStatus: 'Withdrawn' }),
    milestone('ARC-1211', '2024-03-02', { archiveKind: 'Work' }),
    milestone('ARC-1212', '2024-03-02', { summary: '  ' })
  ]);
  assert.deepEqual(makeAboutView(data, 'en').milestones.map(({ id }) => id), ['ARC-1206', 'ARC-1204', 'ARC-1205']);
  assert.deepEqual(makeAboutView(data, 'zh').milestones.map(({ id }) => id), ['ARC-1204']);
  assert.equal(routeFor(linked), null);
  assert.equal(data.routes.some(({ permanentId }) => permanentId === linked.permanentId), false);
});

test('reject duplicate page-local ARC anchors even if a caller broke the validated snapshot', () => {
  const data = snapshot([milestone('ARC-1204', '2024-02-20')]);
  data.records.push(data.records[0]!);
  assert.throws(() => makeAboutView(data, 'en'), /duplicate ARC anchor/i);
});

test('related links require a published target in the visitor locale and the exact output scope', () => {
  const alpha = project('PRJ-1201');
  const beta = project('PRJ-1202');
  const coll = row('COL-1201', 'Collaboration', {
    projectIds: [alpha.permanentId, beta.permanentId], relations: [{ id: alpha.permanentId, entity: 'Project' }]
  });
  const onlyEnPath = routeFor(alpha)!;
  const data = snapshot([alpha, beta, coll, translation(coll)], [onlyEnPath, '/zh/projects/prj-1201/']);
  assert.deepEqual(makeAboutView(data, 'en').collaborations[0]?.related,
    [{ title: alpha.title, href: onlyEnPath }]);
  assert.deepEqual(makeAboutView(data, 'zh').collaborations[0]?.related, []);
});

test('optional editorial projection is locale-specific and requires an eligible Link plus safe reviewed URL', () => {
  const link = row('LNK-1201', 'Link');
  const invalid = ['javascript:alert(1)', '//example.invalid', 'https://u:p@example.invalid/',
    'mailto:test@example.invalid', 'https://example.invalid/\n', 'https://', 'https://example.invalid\\path'];
  const data = snapshot([link, translation(link, 'Draft')]);
  for (const href of invalid) {
    const links = new Map([[link.permanentId, { name: 'Reference', href }]]);
    assert.deepEqual(makeAboutView(data, 'en', { links }).links, [], href);
  }
  const links = new Map([
    [link.permanentId, { name: 'Synthetic reference', href: 'https://example.invalid/reference' }],
    ['LNK-1234', { name: 'Unregistered', href: 'https://example.invalid/hidden' }]
  ]);
  const reviewed = { links, introduction: [' ', 'Synthetic prose'], methods: [{ title: ' ', text: 'Omit' }], contact: '' };
  const en = makeAboutView(data, 'en', reviewed);
  assert.deepEqual(en.links.map(({ id, href }) => [id, href]), [[link.permanentId, 'https://example.invalid/reference']]);
  assert.deepEqual(en.introduction, ['Synthetic prose']);
  assert.deepEqual(en.methods, []);
  assert.equal(en.contact, undefined);
  assert.deepEqual(makeAboutView(data, 'zh', { links }).links, []);
});

test('exact About scope contains both locale indexes and no Milestone, Link or Collaboration routes', () => {
  const actual = loadIntegrationSnapshot();
  const output = getOutputManifest(actual.routes, ABOUT_CANDIDATE_SCOPE);
  assert.deepEqual(output.approvedRoutes, ['/', '/zh/', '/about/', '/zh/about/']);
  assert.deepEqual(output.allowedFiles, ['index.html', 'zh/index.html', 'about/index.html', 'zh/about/index.html']);
});
