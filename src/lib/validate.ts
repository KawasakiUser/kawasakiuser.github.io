import type { RecordBase, RegistryEvent, RouteHistory } from './types';
import { ValidationError } from './errors';
import { prefixFor, reconcileRegistry } from './registry';
import { assertSafeText, validateAssetManifest } from './security';
import { buildRoutes } from './routes';

function assertPublishedMinimum(record: RecordBase): void {
  const fields = record.entity === 'Project'
    ? ['title', 'summary', 'goal', 'primaryType', 'lifecycle']
    : record.entity === 'Note'
      ? ['title', 'date', 'category', 'body']
      : record.entity === 'ArchiveRecord'
        ? ['title', 'summary', 'date', 'archiveKind']
        : ['title'];
  for (const field of fields) if (!record[field as keyof RecordBase]) {
    throw new ValidationError('PUBLISHED_REQUIRED', record.permanentId + '/' + record.locale + ' missing ' + field);
  }
  if (!record.publishedAt) throw new ValidationError('PUBLISHED_DATE', record.permanentId + '/' + record.locale + ' missing publishedAt');
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

    if (!new RegExp('^' + prefixFor(record.entity) + '-\\d{4}$').test(record.permanentId)) {
      throw new ValidationError('ID_TYPE', 'Wrong ID prefix for ' + record.entity + ': ' + record.permanentId);
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
    if (!sourceLocale || !variants.some((record) => record.locale === sourceLocale)) {
      throw new ValidationError('SOURCE_LOCALE', 'Source locale has no corresponding record: ' + id);
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
