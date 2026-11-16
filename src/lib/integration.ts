import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RecordBase, RegistryEvent, RouteHistory, Locale } from './types';
import { validateDataset } from './validate';
import { getCanonicalEntities, getOutputManifest, getPublicationView, getRegistryView, getRouteManifest, type AssetDeclaration, type CanonicalRecord, type OutputManifest, type RegistryView, type RouteManifestEntry } from './canonical';

export interface IntegrationSnapshot {
  records: CanonicalRecord[];
  registry: RegistryView;
  routes: RouteManifestEntry[];
  output: OutputManifest;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function loadIntegrationSnapshot(root = process.cwd()): IntegrationSnapshot {
  const records = readActualRecords(root);
  const registry = readJson<RegistryEvent[]>(join(root, 'src/data/registry.json'));
  const history = readJson<RouteHistory[]>(join(root, 'src/data/route-history.json'));
  validateDataset(records, registry, history);
  const canonical = getCanonicalEntities(records);
  const registryView = getRegistryView(records, registry);
  const routes = getRouteManifest(records, history);
  const output = getOutputManifest(routes);
  return { records: canonical, registry: registryView, routes, output };
}

export function getPublishedForLocale(snapshot: IntegrationSnapshot, locale: Locale): CanonicalRecord[] {
  return getPublicationView(snapshot.records, locale);
}

export function writeIntegrationArtifacts(root = process.cwd()): IntegrationSnapshot {
  const records = readActualRecords(root);
  const registry = readJson<RegistryEvent[]>(join(root, 'src/data/registry.json'));
  const history = readJson<RouteHistory[]>(join(root, 'src/data/route-history.json'));
  validateDataset(records, registry, history);
  const canonical = getCanonicalEntities(records);
  const registryView = getRegistryView(records, registry);
  const routes = getRouteManifest(records, history);
  const output = getOutputManifest(routes);
  mkdirSync(join(root, 'artifacts'), { recursive: true });
  writeFileSync(join(root, 'artifacts/canonical-entities.json'), JSON.stringify(canonical, null, 2) + '\n');
  writeFileSync(join(root, 'artifacts/registry-view.json'), JSON.stringify({ activeIds: registryView.activeIds, retiredIds: registryView.retiredIds }, null, 2) + '\n');
  writeFileSync(join(root, 'artifacts/route-manifest.json'), JSON.stringify({ generatedFrom: 'canonical adapter', routes }, null, 2) + '\n');
  writeFileSync(join(root, 'artifacts/output-manifest.json'), JSON.stringify(output, null, 2) + '\n');
  return { records: canonical, registry: registryView, routes, output };
}

export function readActualRecords(root = process.cwd()): RecordBase[] {
  const contentDir = join(root, 'src/data/public/content');
  return readdirSync(contentDir).filter((file) => file.endsWith('.json')).sort().map((file) => readJson<RecordBase>(join(contentDir, file)));
}

export function readAssetManifest(root = process.cwd()): AssetDeclaration[] {
  return readJson<AssetDeclaration[]>(join(root, 'src/data/manifests/assets.json'));
}
