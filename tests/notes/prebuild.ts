/** Disposable candidate only; invoked after the unchanged root validation. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { getOutputManifest, getRouteManifest, type OutputScope } from '../../src/lib/canonical';
import { loadIntegrationSnapshot } from '../../src/lib/integration';
import { renderScience, type ScienceAsset } from '../../src/lib/science-render/render';
import { notesIndex, noteDetail } from '../../src/lib/science-render/views';
import type { RecordBase } from '../../src/lib/types';
import { loadNotesCandidate, type Candidate } from './runtime';

const snapshot = loadIntegrationSnapshot();
const json = <T>(path: string) => JSON.parse(readFileSync(path, 'utf8')) as T;
const scope = json<OutputScope>('tests/notes/candidate-scope.json');
const { routes } = snapshot;
if (process.env.NOTES_LAB_FALLBACK === '1') {
  // Shared adapter currently emits fallback only if a target row exists; the public gate rejects Draft rows.
  // Exercise the UI using a shared-adapter result from a body-free temporary descriptor.
  const source = snapshot.records.find((record) => record.permanentId === 'NTE-0003' && record.locale === 'en');
  if (!source) throw new Error('NOTES_LAB: missing fallback source');
  const descriptor: RecordBase = {
    entity: 'Note', permanentId: source.permanentId, locale: 'zh', sourceLocale: 'en', slug: source.slug,
    publicationStatus: 'Draft', projectIds: []
  };
  const fallback = getRouteManifest([source, descriptor]).find((route) => route.locale === 'zh');
  if (!fallback || fallback.state !== 'source-fallback' || routes.some((route) => route.path === fallback.path)) {
    throw new Error('NOTES_LAB: invalid fallback specimen');
  }
  routes.push(fallback);
  scope.approvedRoutes = [...scope.approvedRoutes, { route: fallback.path, outputFiles: ['zh/notes/synthetic-original/index.html'] }];
}
const assets = json<Record<string, ScienceAsset>>('tests/notes/fixture-asset-map.json');
const mdxApprovals = json<Record<string, string>>('tests/notes/fixture-mdx-approvals.json');
for (const [id, approval] of Object.entries(assets)) {
  const manifest = json<{ files: { path: string; sha256: string }[] }>('src/data/manifests/public-source-allowlist.json');
  const path = 'public' + approval.href;
  const expected = manifest.files.find((entry) => entry.path === path);
  if (!expected || createHash('sha256').update(readFileSync(path)).digest('hex') !== expected.sha256) {
    throw new Error('NOTES_ASSET_APPROVAL: ' + id);
  }
}
const proposed = new Set(scope.approvedRoutes.map((approval) => approval.route));
for (const route of routes.filter((entry) => entry.entity === 'Note' && entry.state !== 'missing')) {
  if (!proposed.has(route.path)) throw new Error('NOTES_OUTPUT_SCOPE: ' + route.path);
}
const candidate: Candidate = { routes, scope, assets, mdxApprovals };
writeFileSync('artifacts/notes-candidate.json', JSON.stringify(candidate, null, 2) + '\n');
const { activePaths, getScienceOptions } = loadNotesCandidate();
for (const locale of ['en', 'zh'] as const) notesIndex(snapshot, locale, activePaths);
for (const route of routes) {
  const model = noteDetail(snapshot, route, activePaths);
  if (model?.note) renderScience(model.note.body, getScienceOptions(model.note));
}
writeFileSync('artifacts/output-manifest.json', JSON.stringify(getOutputManifest(routes, scope), null, 2) + '\n');
console.log('PASS Notes candidate prebuild: scoped routes and scientific content validated');
