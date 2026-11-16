import type { Locale, RecordBase, RouteHistory, RouteRecord } from './types';
import { ValidationError } from './errors';
import { prefixMatchesEntity } from './registry';

export function routeFor(record: RecordBase): string | null {
  const prefix = record.locale === 'zh' ? '/zh' : '';
  if (record.entity === 'Collaboration' || record.entity === 'Link') return null;
  if (record.entity === 'ArchiveRecord' && record.archiveKind === 'Milestone') return null;
  const collection = record.entity === 'Project' ? 'projects' : record.entity === 'Note' ? 'notes' : 'archive';
  return prefix + '/' + collection + '/' + record.slug + '/';
}

const pathKey = (p: string) => p.replace(/\/+$/, '') || '/';

export function isWithdrawnWork(record: RecordBase): boolean {
  return record.entity === 'ArchiveRecord' && record.validityStatus === 'Withdrawn';
}

export function buildRoutes(records: readonly RecordBase[], history: readonly RouteHistory[] = []): RouteRecord[] {
  const byPath = new Map<string, RouteRecord>();
  const historical = new Map<string, RouteHistory>();
  for (const old of history) {
    if (!/^\/(?:zh\/)?(?:projects|archive|notes)\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/.test(old.path)) {
      throw new ValidationError('HISTORY_PATH', 'Invalid historical path: ' + old.path);
    }
    if ((old.path.startsWith('/zh/') ? 'zh' : 'en') !== old.locale) {
      throw new ValidationError('HISTORY_LOCALE', 'Historical locale/path mismatch: ' + old.path);
    }
    if (!['Published', 'Tombstone', 'Withdrawn'].includes(old.currentState)) {
      throw new ValidationError('HISTORY_STATE', 'Unsupported historical state: ' + old.path);
    }
    const section = old.path.replace(/^\/zh/, '').split('/')[1];
    const historicalEntity = section === 'projects' ? 'Project' : section === 'archive' ? 'ArchiveRecord' : 'Note';
    if (!prefixMatchesEntity(historicalEntity, old.permanentId, historicalEntity === 'Note')) {
      throw new ValidationError('HISTORY_ID_TYPE', 'Historical route ID does not match its section: ' + old.path);
    }
    const key = pathKey(old.path);
    if (historical.has(key)) throw new ValidationError('HISTORY_DUPLICATE', 'Duplicate historical path: ' + old.path);
    historical.set(key, old);
  }

  const add = (route: RouteRecord) => {
    const key = pathKey(route.path);
    if (byPath.has(key)) throw new ValidationError('ROUTE_COLLISION', 'Duplicate route: ' + route.path);
    const old = historical.get(key);
    if (old && (old.permanentId !== route.permanentId || old.locale !== route.locale)) {
      throw new ValidationError('HISTORY_CONFLICT', 'Historical URL reassigned: ' + route.path);
    }
    if (old && old.currentState !== 'Published' && route.kind === 'page') {
      throw new ValidationError('HISTORY_REACTIVATION', 'Retired historical URL reactivated without approval: ' + route.path);
    }
    byPath.set(key, route);
  };

  for (const record of records) {
    const path = routeFor(record);
    if (!path) continue;
    const old = historical.get(pathKey(path));
    if (isWithdrawnWork(record)) {
      add({ path, permanentId: record.permanentId, locale: record.locale, entity: record.entity, kind: 'withdrawn', noindex: true });
    } else if (record.publicationStatus === 'Published') {
      add({ path, permanentId: record.permanentId, locale: record.locale, entity: record.entity, kind: 'page', noindex: false });
    } else if (record.publicationStatus === 'Withdrawn') {
      add({ path, permanentId: record.permanentId, locale: record.locale, entity: record.entity, kind: 'withdrawn', noindex: true });
    } else if (old?.currentState === 'Withdrawn') {
      add({ path, permanentId: record.permanentId, locale: record.locale, entity: record.entity, kind: 'withdrawn', noindex: true });
    } else if (record.previouslyPublished || old) {
      add({ path, permanentId: record.permanentId, locale: record.locale, entity: record.entity, kind: 'tombstone', noindex: true });
    }
  }

  for (const old of history) {
    const key = pathKey(old.path);
    if (byPath.has(key)) continue;
    if (old.currentState === 'Published') {
      throw new ValidationError('HISTORY_DISAPPEARANCE', 'Published historical URL disappeared: ' + old.path);
    }
    const entity = old.permanentId.startsWith('PRJ-') ? 'Project' : /^(?:NTE|NOT)-/.test(old.permanentId) ? 'Note' : old.permanentId.startsWith('ARC-') ? 'ArchiveRecord' : null;
    const section = old.path.replace(/^\/zh/, '').split('/')[1];
    if (!entity || (section === 'projects' && entity !== 'Project') || (section === 'notes' && entity !== 'Note') || (section === 'archive' && entity !== 'ArchiveRecord')) {
      throw new ValidationError('HISTORY_ENTITY', 'Historical URL entity/section mismatch: ' + old.path);
    }
    add({ path: old.path, permanentId: old.permanentId, locale: old.locale, entity,
      kind: old.currentState === 'Withdrawn' ? 'withdrawn' : 'tombstone', noindex: true });
  }
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function resolveLocale(records: readonly RecordBase[], id: string, requested: Locale, history: readonly RouteHistory[] = []) {
  const target = records.find((record) => record.permanentId === id && record.locale === requested);
  if (target && isWithdrawnWork(target)) return { kind: 'withdrawn' as const, record: target };
  if (target?.publicationStatus === 'Published') return { kind: 'published' as const, record: target };
  if (target?.publicationStatus === 'Withdrawn') return { kind: 'withdrawn' as const, record: target };
  const old = history.find((item) => item.permanentId === id && item.locale === requested);
  if (old?.currentState === 'Withdrawn') return { kind: 'withdrawn' as const, record: target };
  if (target?.previouslyPublished && target.publicationStatus === 'Draft') return { kind: 'tombstone' as const };
  if (old) return { kind: 'tombstone' as const };
  const sourceLocale = records.find((record) => record.permanentId === id)?.sourceLocale;
  if (!sourceLocale) return { kind: 'missing' as const };
  const source = records.find((record) => record.permanentId === id && record.locale === sourceLocale && record.publicationStatus === 'Published');
  if (source && isWithdrawnWork(source)) return { kind: 'withdrawn' as const, record: source };
  if (source) return { kind: 'source-fallback' as const, record: source, source };
  return { kind: 'missing' as const };
}

export function assertUniqueArcAnchors(anchors: readonly string[]): void {
  const seen = new Set<string>();
  for (const anchor of anchors) {
    if (!/^ARC-\d{4}$/.test(anchor) || seen.has(anchor)) throw new ValidationError('ARC_DUPLICATE', 'Invalid or duplicate ARC anchor: ' + anchor);
    seen.add(anchor);
  }
}
