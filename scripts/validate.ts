import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RecordBase, RegistryEvent, RouteHistory } from '../src/lib/types';
import { validateDataset, validateAssets } from '../src/lib/validate';
import { buildRoutes } from '../src/lib/routes';

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}
const contentDir = 'src/data/public/content';
const records = readdirSync(contentDir).filter((name) => name.endsWith('.json')).sort().map((name) => readJson<RecordBase>(join(contentDir, name)));
const registry = readJson<RegistryEvent[]>('src/data/registry.json');
const history = readJson<RouteHistory[]>('src/data/route-history.json');
const assets = readJson<{ path: string; approved: boolean; public: boolean; mime: string }[]>('src/data/manifests/assets.json');

validateDataset(records, registry, history);
validateAssets(assets);
const routes = buildRoutes(records, history);
writeFileSync('artifacts/route-manifest.json', JSON.stringify({ generatedFrom: 'src/data/public/content', routes }, null, 2) + '\n');
writeFileSync('validation-output.json', JSON.stringify({ status: 'PASS', actualRecords: records.length, registryEntries: registry.length, routeCount: routes.length, source: 'actual JSON content and ledgers', privateContentIncluded: false }, null, 2) + '\n');
console.log('PASS actual data validation: ' + records.length + ' records, ' + registry.length + ' registry entries, ' + routes.length + ' routes');
