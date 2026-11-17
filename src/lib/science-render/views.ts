import { getPublishedForLocale, type IntegrationSnapshot } from '../integration';
import { getSafeRelatedLinks, type CanonicalRecord, type RouteManifestEntry } from '../canonical';
import type { Locale } from '../types';

export interface Note extends CanonicalRecord {
  entity: 'Note';
  title: string;
  summary: string;
  date: string;
  category: string;
  body: string;
}

export function notesIndexPath(locale: Locale): string {
  return locale === 'zh' ? '/zh/notes/' : '/notes/';
}

function publishedNotes(snapshot: IntegrationSnapshot, locale: Locale): Note[] {
  return getPublishedForLocale(snapshot, locale).filter((record): record is Note => {
    if (record.entity !== 'Note') return false;
    const date = record.date;
    if (!record.title?.trim() || !record.summary?.trim() || !record.category?.trim() ||
        !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date || !record.body?.trim()) throw new Error('NOTES_REQUIRED: ' + record.permanentId + '/' + locale);
    return true;
  });
}

export function notesIndex(snapshot: IntegrationSnapshot, locale: Locale, activePaths: ReadonlySet<string>) {
  const notes = new Map(publishedNotes(snapshot, locale).map((note) => [note.permanentId, note]));
  return snapshot.routes.flatMap((route) => {
    const note = notes.get(route.permanentId);
    return route.entity === 'Note' && route.locale === locale && route.state === 'page' && activePaths.has(route.path) && note
      ? [{ note, href: route.path }] : [];
  }).sort((a, b) => b.note.date.localeCompare(a.note.date) || a.note.permanentId.localeCompare(b.note.permanentId));
}

export function noteDetail(snapshot: IntegrationSnapshot, route: RouteManifestEntry, activePaths: ReadonlySet<string>) {
  if (route.entity !== 'Note' || route.state === 'missing' || !activePaths.has(route.path)) return null;
  if (route.state === 'tombstone' || route.state === 'withdrawn') {
    return { state: route.state, route, canonical: undefined, alternates: [] };
  }
  const sourcePath = route.state === 'source-fallback' ? route.sourceCanonical : route.canonical;
  const sourceLocale = route.state === 'source-fallback' ? route.sourceLocale : route.locale;
  const source = snapshot.routes.find((candidate) => candidate.path === sourcePath && candidate.state === 'page' &&
    candidate.entity === 'Note' && candidate.permanentId === route.permanentId && candidate.locale === sourceLocale);
  if (!source || !activePaths.has(source.path)) throw new Error('NOTES_SOURCE: ' + route.path);
  const note = publishedNotes(snapshot, source.locale).find((candidate) => candidate.permanentId === source.permanentId);
  if (!note) throw new Error('NOTES_PUBLICATION: ' + route.path);
  const alternates = route.state === 'page' ? snapshot.routes.filter((candidate) => candidate.entity === 'Note' &&
    candidate.permanentId === route.permanentId && candidate.state === 'page' && activePaths.has(candidate.path)) : [];
  const related = getSafeRelatedLinks(note, snapshot.records).flatMap((link) => {
    const target = snapshot.records.find((item) => item.permanentId === link.id && item.locale === link.locale);
    return target?.title && activePaths.has(link.href) && snapshot.routes.some((candidate) =>
      candidate.path === link.href && candidate.state === 'page' && candidate.locale === route.locale)
      ? [{ ...link, title: target.title }] : [];
  });
  return { state: route.state, route, note, canonical: source.path, alternates, related };
}

export type NoteDetail = NonNullable<ReturnType<typeof noteDetail>>;
