import type { Locale, RecordBase, RouteHistory, RouteRecord } from './types';
import { ValidationError } from './errors';

export function routeFor(record: RecordBase): string | null {
  const prefix = record.locale === 'zh' ? '/zh' : '';
  if (record.entity === 'Collaboration' || record.entity === 'Link') return null;
  if (record.entity === 'ArchiveRecord' && record.archiveKind === 'Milestone') return null;
  const collection = record.entity === 'Project' ? 'projects' : record.entity === 'Note' ? 'notes' : 'archive';
  return prefix + '/' + collection + '/' + record.slug + '/';
}

export function buildRoutes(records: readonly RecordBase[], history: readonly RouteHistory[] = []): RouteRecord[] {
  const output: RouteRecord[] = [];
  for (const record of records) {
    const path = routeFor(record);
    if (!path) continue;
    if (record.publicationStatus === 'Published') output.push({ path, permanentId: record.permanentId, locale: record.locale, entity: record.entity, kind: 'page', noindex: false });
    else if (record.publicationStatus === 'Withdrawn') output.push({ path, permanentId: record.permanentId, locale: record.locale, entity: record.entity, kind: 'withdrawn', noindex: true });
    else if (record.previouslyPublished || history.some((item) => item.path === path && item.permanentId === record.permanentId)) {
      output.push({ path, permanentId: record.permanentId, locale: record.locale, entity: record.entity, kind: 'tombstone', noindex: true });
    }
  }

  const seen = new Set<string>();
  for (const route of output) {
    const key = route.path.replace(/\/+$/, '') || '/';
    if (seen.has(key)) throw new ValidationError('ROUTE_COLLISION', 'Duplicate route: ' + route.path);
    seen.add(key);
  }

  for (const old of history) {
    const current = output.find((route) => route.path === old.path);
    if (current && current.permanentId !== old.permanentId) throw new ValidationError('HISTORY_CONFLICT', 'Historical route replaced: ' + old.path);
    if (!current && old.currentState === 'Published') throw new ValidationError('HISTORY_DISAPPEARANCE', 'Published historical route disappeared: ' + old.path);
  }
  return output;
}

export function resolveLocale(records: readonly RecordBase[], id: string, requested: Locale) {
  const target = records.find((record) => record.permanentId === id && record.locale === requested);
  if (target?.publicationStatus === 'Published') return { kind: 'published' as const, record: target };
  if (target?.previouslyPublished && target.publicationStatus === 'Draft') return { kind: 'tombstone' as const };
  const sourceLocale = records.find((record) => record.permanentId === id)?.sourceLocale;
  if (!sourceLocale) return { kind: 'missing' as const };
  const source = records.find((record) => record.permanentId === id && record.locale === sourceLocale && record.publicationStatus === 'Published');
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
