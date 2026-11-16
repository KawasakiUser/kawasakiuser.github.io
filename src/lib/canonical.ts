import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import type { Locale, RecordBase, RegistryEvent, RouteHistory, RouteRecord } from './types';
import { ValidationError } from './errors';
import { currentRegistry, prefixMatchesEntity } from './registry';
import { assertPinnedLegacyFixture } from './legacy-fixtures';
import { buildRoutes, isWithdrawnWork, routeFor, resolveLocale } from './routes';

export interface CanonicalRecord extends RecordBase {
  canonicalId: string;
  globalKey: string;
  legacyFixture: boolean;
}

export interface RegistryView {
  current: ReadonlyMap<string, RegistryEvent>;
  activeIds: readonly string[];
  retiredIds: readonly string[];
}

export interface RouteManifestEntry extends RouteRecord {
  state: RouteRecord['kind'];
  canonical?: string;
  sourceCanonical?: string;
  sourceLocale?: Locale;
}

export interface OutputManifest {
  generatedFrom: string;
  scopeId: string;
  approvedRoutes: readonly string[];
  allowedFiles: readonly string[];
  homeRoutes: readonly string[];
  routeStates: readonly Pick<RouteManifestEntry, 'path' | 'state' | 'noindex'>[];
}

export interface OutputRouteApproval {
  route: string;
  outputFiles: readonly string[];
}

export interface OutputScope {
  scopeId: string;
  approvedRoutes: readonly OutputRouteApproval[];
}

export const SHELL_OUTPUT_SCOPE: OutputScope = Object.freeze({
  scopeId: 'G6B-SHELL-HOME',
  approvedRoutes: Object.freeze([
    Object.freeze({ route: '/', outputFiles: Object.freeze(['index.html']) }),
    Object.freeze({ route: '/zh/', outputFiles: Object.freeze(['zh/index.html']) })
  ])
});

export interface AssetDeclaration {
  path: string;
  approved: boolean;
  public: boolean;
  mime: string;
}

export interface ApprovedSource {
  path: string;
  sha256: string;
}

export function adaptRecord(record: RecordBase): CanonicalRecord {
  const isLegacy = record.entity === 'Note' && record.permanentId.startsWith('NOT-');
  if (isLegacy) assertPinnedLegacyFixture(record);
  if (!prefixMatchesEntity(record.entity, record.permanentId, isLegacy)) {
    throw new ValidationError('ID_TYPE', 'Wrong ID prefix for ' + record.entity + ': ' + record.permanentId);
  }
  return {
    ...record,
    canonicalId: record.permanentId,
    globalKey: record.permanentId + ':' + record.slug,
    legacyFixture: isLegacy
  };
}

export function getCanonicalEntities(records: readonly RecordBase[]): CanonicalRecord[] {
  return records.map(adaptRecord);
}

export function getRegistryView(records: readonly RecordBase[], registry: readonly RegistryEvent[]): RegistryView {
  const current = currentRegistry(registry);
  const activeIds = [...current].filter(([, event]) => event.state === 'Assigned').map(([id]) => id);
  const retiredIds = [...current].filter(([, event]) => event.state === 'Retired').map(([id]) => id);
  const recordIds = new Set(records.map((record) => record.permanentId));
  for (const [id, event] of current) {
    if (event.state === 'Assigned' && !recordIds.has(id)) {
      throw new ValidationError('REGISTRY_ORPHAN', 'Active Registry ID has no record: ' + id);
    }
  }
  return { current, activeIds, retiredIds };
}

function canonicalPath(path: string): string {
  if (!path || path.startsWith('/') || path.includes('\\') || path.includes('\0') || path.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new ValidationError('PUBLIC_PATH', 'Noncanonical public path: ' + path);
  }
  const root = resolve(process.cwd());
  const absolute = resolve(root, path);
  if (!absolute.startsWith(root + sep)) throw new ValidationError('PUBLIC_PATH', 'Path escapes repository: ' + path);
  return absolute;
}

export function assertApprovedAsset(asset: AssetDeclaration, approvedSources: readonly ApprovedSource[]): void {
  const absolute = canonicalPath(asset.path);
  if (!existsSync(absolute) || !lstatSync(absolute).isFile()) throw new ValidationError('ASSET_MISSING', 'Asset does not exist: ' + asset.path);
  if (!asset.approved || !asset.public) throw new ValidationError('PUBLIC_DECLARATION', 'Asset is not approved/public: ' + asset.path);
  const source = approvedSources.find((item) => item.path === asset.path);
  if (!source) throw new ValidationError('PUBLIC_NOT_AUTHORIZED', 'Asset is absent from the reviewed allowlist: ' + asset.path);
  const digest = createHash('sha256').update(readFileSync(absolute)).digest('hex');
  if (digest !== source.sha256) throw new ValidationError('PUBLIC_HASH', 'Asset bytes do not match reviewed source: ' + asset.path);
}

export function getRouteManifest(records: readonly RecordBase[], history: readonly RouteHistory[] = []): RouteManifestEntry[] {
  const entries: RouteManifestEntry[] = [];
  const routes = buildRoutes(records, history);
  const routeById = new Map(routes.map((route) => [route.path, route]));

  for (const record of records) {
    const path = routeFor(record);
    if (!path) continue;
    const result = resolveLocale(records, record.permanentId, record.locale, history);
    const route = routeById.get(path);
    if (route) {
      entries.push({
        ...route,
        state: route.kind,
        canonical: route.kind === 'page' ? path : undefined,
        sourceCanonical: result.kind === 'source-fallback' ? routeFor(result.source) ?? undefined : undefined,
        sourceLocale: result.kind === 'source-fallback' ? result.source.locale : undefined
      });
    } else {
      entries.push({
        path,
        permanentId: record.permanentId,
        locale: record.locale,
        entity: record.entity,
        kind: result.kind === 'published' ? 'page' : result.kind,
        state: result.kind === 'published' ? 'page' : result.kind,
        noindex: true,
        sourceCanonical: result.kind === 'source-fallback' ? routeFor(result.source) ?? undefined : undefined,
        sourceLocale: result.kind === 'source-fallback' ? result.source.locale : undefined
      });
    }
  }

  for (const route of routes) {
    if (!entries.some((entry) => entry.path === route.path)) {
      entries.push({ ...route, state: route.kind, canonical: route.kind === 'page' ? route.path : undefined });
    }
  }

  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.path)) continue;
    seen.add(entry.path);
    if (entry.state === 'source-fallback' && !entry.sourceCanonical) {
      throw new ValidationError('FALLBACK_SOURCE', 'Fallback route has no source canonical: ' + entry.path);
    }
  }
  return entries.filter((entry, index, all) => all.findIndex((candidate) => candidate.path === entry.path) === index)
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function getSafeRelatedLinks(record: RecordBase, records: readonly RecordBase[]): Array<{ id: string; href: string; locale: Locale }> {
  const links: Array<{ id: string; href: string; locale: Locale }> = [];
  const ids = [...record.projectIds, ...(record.relations ?? []).map((relation) => relation.id)];
  for (const id of ids) {
    const target = records.find((candidate) => candidate.permanentId === id && candidate.locale === record.locale && candidate.publicationStatus === 'Published' && !isWithdrawnWork(candidate));
    if (!target) continue;
    const href = routeFor(target);
    if (href) links.push({ id, href, locale: target.locale });
  }
  return links;
}

export function getPublicationView(records: readonly RecordBase[], locale: Locale): CanonicalRecord[] {
  return getCanonicalEntities(records.filter((record) => record.locale === locale && record.publicationStatus === 'Published' && !isWithdrawnWork(record)));
}

function assertOutputPath(path: string): void {
  if (!path || path.startsWith('/') || path.includes('..') || path.includes('\\') || path.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new ValidationError('OUTPUT_PATH', 'Output path is not canonical: ' + path);
  }
}

export function assertOutputRouteApproved(route: string, scope: OutputScope): void {
  if (!scope.approvedRoutes.some((approval) => approval.route === route)) {
    throw new ValidationError('OUTPUT_ROUTE_UNAUTHORIZED', 'Output route is outside the approved scope: ' + route);
  }
}

export function validateOutputManifest(manifest: OutputManifest): void {
  if (!manifest.scopeId || !Array.isArray(manifest.approvedRoutes) || !Array.isArray(manifest.allowedFiles)) {
    throw new ValidationError('OUTPUT_MANIFEST', 'Output manifest is incomplete');
  }
  const files = new Set<string>();
  for (const file of manifest.allowedFiles) {
    assertOutputPath(file);
    if (files.has(file)) throw new ValidationError('OUTPUT_MANIFEST', 'Output manifest repeats a file: ' + file);
    files.add(file);
  }
}

export function getOutputManifest(routeManifest: readonly RouteManifestEntry[], scope: OutputScope = SHELL_OUTPUT_SCOPE): OutputManifest {
  if (!scope.scopeId || !scope.approvedRoutes.length) throw new ValidationError('OUTPUT_SCOPE', 'Output scope must declare an identity and at least one route');
  const routes = new Set<string>();
  const files = new Set<string>();
  for (const approval of scope.approvedRoutes) {
    if (routes.has(approval.route)) throw new ValidationError('OUTPUT_SCOPE', 'Output scope repeats a route: ' + approval.route);
    routes.add(approval.route);
    if (!approval.outputFiles.length) throw new ValidationError('OUTPUT_SCOPE', 'Approved output route has no files: ' + approval.route);
    for (const file of approval.outputFiles) {
      assertOutputPath(file);
      if (files.has(file)) throw new ValidationError('OUTPUT_SCOPE', 'Output file is assigned more than once: ' + file);
      files.add(file);
    }
  }
  const manifest: OutputManifest = {
    generatedFrom: 'canonical-route-manifest + approved output scope',
    scopeId: scope.scopeId,
    approvedRoutes: [...routes],
    allowedFiles: [...files],
    homeRoutes: [...routes].filter((route) => route === '/' || route === '/zh/'),
    routeStates: routeManifest.map(({ path, state, noindex }) => ({ path, state, noindex }))
  };
  validateOutputManifest(manifest);
  return manifest;
}
