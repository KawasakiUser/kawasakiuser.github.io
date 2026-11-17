import type { RecordBase, RegistryEvent, RouteHistory } from './types';
import { ValidationError } from './errors';
import { prefixMatchesEntity, reconcileRegistry } from './registry';
import { assertSafeText, validateAssetManifest } from './security';
import { buildRoutes } from './routes';
import { assertPinnedLegacyFixture } from './legacy-fixtures';

function assertPublishedMinimum(record: RecordBase): void {
  const fields = record.entity === 'Project'
    ? ['title', 'summary', 'goal', 'primaryType', 'lifecycle']
    : record.entity === 'Note'
    ? ['title', 'summary', 'date', 'category', 'body']
      : record.entity === 'ArchiveRecord'
        ? ['title', 'summary', 'date', 'archiveKind']
        : ['title'];
  for (const field of fields) if (!record[field as keyof RecordBase]) {
    throw new ValidationError('PUBLISHED_REQUIRED', record.permanentId + '/' + record.locale + ' missing ' + field);
  }
  if (!record.publishedAt) throw new ValidationError('PUBLISHED_DATE', record.permanentId + '/' + record.locale + ' missing publishedAt');
}

function workValidity(record: RecordBase): 'Valid' | 'Withdrawn' {
  return record.validityStatus ?? 'Valid';
}

function globalValue(record: RecordBase, field: string): string {
  if (field === 'validityStatus') return workValidity(record);
  if (field === 'projectIds') return [...record.projectIds].sort().join('|');
  if (field === 'relations') return (record.relations ?? []).map((relation) => relation.entity + ':' + relation.id).sort().join('|');
  return String(record[field as keyof RecordBase] ?? '');
}

export function validateDataset(records: readonly RecordBase[], registry: readonly RegistryEvent[], history: readonly RouteHistory[] = []): void {
  const keys = new Set<string>();
  const byId = new Map<string, RecordBase[]>();

  for (const record of records) {
    const key = record.permanentId + ':' + record.locale;
    if (keys.has(key)) throw new ValidationError('LOCALE_DUPLICATE', 'Duplicate locale record: ' + key);
    keys.add(key);
    const variants = byId.get(record.permanentId) ?? [];
    variants.push(record);
    byId.set(record.permanentId, variants);

    const isLegacyNote = record.entity === 'Note' && record.permanentId.startsWith('NOT-');
    if (isLegacyNote) assertPinnedLegacyFixture(record);
    if (!prefixMatchesEntity(record.entity, record.permanentId, isLegacyNote)) {
      throw new ValidationError('ID_TYPE', 'Wrong ID prefix for ' + record.entity + ': ' + record.permanentId);
    }
    if (record.entity === 'Note' && record.locale !== 'en' && record.locale !== 'zh') {
      throw new ValidationError('NOTES_LOCALE', 'Unsupported Note locale: ' + record.permanentId);
    }
    if (record.entity === 'ArchiveRecord' && record.validityStatus && record.validityStatus !== 'Valid' && record.validityStatus !== 'Withdrawn') {
      throw new ValidationError('WORK_STATUS', 'Unsupported Work validity status: ' + record.permanentId);
    }
    if (record.entity === 'ArchiveRecord' && !record.validityStatus) {
      throw new ValidationError('WORK_STATUS_REQUIRED', 'ArchiveRecord must declare validityStatus: ' + record.permanentId);
    }
    if (record.entity === 'ArchiveRecord' && workValidity(record) === 'Withdrawn' && !record.withdrawnNotice) {
      throw new ValidationError('WITHDRAWN_NOTICE', 'Withdrawn Work must declare withdrawnNotice: ' + record.permanentId);
    }
    if (record.publicationStatus === 'Published') assertPublishedMinimum(record);
    for (const value of [record.title, record.summary, record.goal, record.body, record.withdrawnNotice].filter((value): value is string => Boolean(value))) {
      assertSafeText(value, record.permanentId);
    }
  }

  reconcileRegistry(records, registry);

  for (const [id, variants] of byId) {
    const slugs = new Set(variants.map((record) => record.slug));
    const sources = new Set(variants.map((record) => record.sourceLocale));
    if (slugs.size !== 1) throw new ValidationError('GLOBAL_SLUG', 'Slug differs across locale states: ' + id);
    if (sources.size !== 1) throw new ValidationError('GLOBAL_SOURCE', 'Source locale differs across locale states: ' + id);
    const sourceLocale = variants[0]?.sourceLocale;
    if ((sourceLocale !== 'en' && sourceLocale !== 'zh') ||
        (variants[0]?.entity !== 'Note' && !variants.some((record) => record.locale === sourceLocale))) {
      throw new ValidationError('SOURCE_LOCALE', 'Invalid source locale or corresponding record missing: ' + id);
    }
    // A public Note projection may contain just an independently Published translation.
    // No row for the original is needed, and no fallback can be generated without it.

    const globalFields = ['slug', 'sourceLocale', 'primaryType', 'lifecycle', 'archiveKind', 'validityStatus', 'projectIds', 'relations'];
    for (const field of globalFields) {
      const values = new Set(variants.map((record) => globalValue(record, field)));
      if (values.size !== 1) throw new ValidationError('GLOBAL_FACTS', 'Global field differs across locales for ' + id + ': ' + field);
    }

    for (const record of variants) {
      for (const projectId of record.projectIds) {
        const project = records.find((candidate) => candidate.permanentId === projectId && candidate.entity === 'Project');
        if (!project) throw new ValidationError('PROJECT_REFERENCE', record.permanentId + ' references unknown Project ' + projectId);
      }
      for (const relation of record.relations ?? []) {
        const target = records.find((candidate) => candidate.permanentId === relation.id);
        if (!target) throw new ValidationError('UNKNOWN_REFERENCE', record.permanentId + ' references unknown ' + relation.id);
        if (target.entity !== relation.entity) throw new ValidationError('REFERENCE_TYPE', record.permanentId + ' relation type mismatch for ' + relation.id);
      }
    }
  }

  buildRoutes(records, history);
}

export function validateAssets(manifest: { path: string; approved: boolean; public: boolean; mime: string }[]): void {
  validateAssetManifest(manifest);
}
