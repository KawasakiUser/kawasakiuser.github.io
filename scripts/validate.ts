import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RecordBase, RegistryEvent, RouteHistory } from '../src/lib/types';
import { validateDataset, validateAssets } from '../src/lib/validate';
import { buildRoutes } from '../src/lib/routes';
import { validatePublicSourceGate } from './public-gate';
import { getCanonicalEntities, getOutputManifest, getRegistryView, getRouteManifest } from '../src/lib/canonical';
import { getCompositeOutputScope } from '../src/components/composite/output-scope';
import { renderScience } from '../src/lib/science-render/render';

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}
const contentDir = 'src/data/public/content';
const records = readdirSync(contentDir).filter((name) => name.endsWith('.json')).sort().map((name) => readJson<RecordBase>(join(contentDir, name)));
const registry = readJson<RegistryEvent[]>('src/data/registry.json');
const history = readJson<RouteHistory[]>('src/data/route-history.json');
const assets = readJson<{ path: string; approved: boolean; public: boolean; mime: string }[]>('src/data/manifests/assets.json');

validatePublicSourceGate(records, assets);
validateDataset(records, registry, history);
mkdirSync('artifacts', { recursive: true });
validateAssets(assets);
const routes = buildRoutes(records, history);
const canonical = getCanonicalEntities(records);
const registryView = getRegistryView(records, registry);
const routeManifest = getRouteManifest(records, history);
const compositeScope = getCompositeOutputScope(routeManifest);
const outputManifest = getOutputManifest(routeManifest, compositeScope);
// Fail closed before Astro compilation: validate every approved Notes body via
// the bounded data-only AST/TeX renderer. Unapproved MDX remains rejected.
for (const record of records) {
  if (record.entity === 'Note' && record.publicationStatus === 'Published') {
    renderScience(record.body ?? '', {
      locale: record.locale,
      assets: {},
      approvedLinks: new Set(outputManifest.approvedRoutes)
    });
  }
}
writeFileSync('artifacts/notes-candidate.json', JSON.stringify({
  routes: routeManifest, scope: compositeScope, assets: {}, mdxApprovals: {}
}, null, 2) + '\n');
writeFileSync('artifacts/route-manifest.json', JSON.stringify({ generatedFrom: 'canonical adapter', routes: routeManifest }, null, 2) + '\n');
writeFileSync('artifacts/canonical-entities.json', JSON.stringify(canonical, null, 2) + '\n');
writeFileSync('artifacts/registry-view.json', JSON.stringify({ activeIds: registryView.activeIds, retiredIds: registryView.retiredIds }, null, 2) + '\n');
writeFileSync('artifacts/output-manifest.json', JSON.stringify(outputManifest, null, 2) + '\n');
writeFileSync('validation-output.json', JSON.stringify({ status: 'PASS', actualRecords: records.length, registryEntries: registry.length, routeCount: routeManifest.length, source: 'actual JSON content and ledgers', privateContentIncluded: false }, null, 2) + '\n');
console.log('PASS actual data validation: ' + records.length + ' records, ' + registry.length + ' registry entries, ' + routes.length + ' routes');
