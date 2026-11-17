import { getSafeRelatedLinks, type CanonicalRecord, type OutputScope, type RouteManifestEntry } from '../../lib/canonical';
import { getPublishedForLocale, type IntegrationSnapshot } from '../../lib/integration';
import { assertUniqueArcAnchors } from '../../lib/routes';
import type { Entity, Locale } from '../../lib/types';

export interface LinkView {
  href: string;
  title: string;
  locale: Locale;
}

export interface Card extends LinkView {
  id: string;
  summary: string;
  primaryType?: string;
  lifecycle?: string;
  date?: string;
  projects: LinkView[];
}

export interface Milestone {
  id: string;
  title: string;
  summary: string;
  date: string;
}

export interface Detail {
  route: RouteManifestEntry;
  alternate?: LinkView;
  source?: LinkView;
  record?: CanonicalRecord;
  milestones: Milestone[];
  projects: LinkView[];
  works: LinkView[];
  notes: LinkView[];
}

const byDateAndId = (a: { date?: string; id: string }, b: { date?: string; id: string }) =>
  (b.date ?? '').localeCompare(a.date ?? '') || a.id.localeCompare(b.id);

export function makePaViews(snapshot: IntegrationSnapshot, scope: OutputScope) {
  const approvedPaths = new Set(scope.approvedRoutes.map(({ route }) => route));
  const realRoutes = snapshot.routes.filter((route) => route.state === 'page' && approvedPaths.has(route.path));
  const published = {
    en: getPublishedForLocale(snapshot, 'en'),
    zh: getPublishedForLocale(snapshot, 'zh')
  };
  const getPublished = (id: string, locale: Locale) =>
    published[locale].find((record) => record.canonicalId === id);

  function relatedLinks(from: CanonicalRecord, candidates: CanonicalRecord[], entity: Entity, reverse = false): LinkView[] {
    const links = new Map<string, LinkView>();
    for (const candidate of candidates) {
      if (candidate.entity !== entity || candidate.canonicalId === from.canonicalId) continue;
      const by = reverse ? candidate : from;
      const target = reverse ? from : candidate;
      const resolved = getSafeRelatedLinks(by, published[by.locale])
        .find((link) => link.id === target.canonicalId);
      if (!resolved) continue;
      // A reverse relation still needs the unrelated record's own public route.
      const route = realRoutes.find(({ permanentId, locale }) =>
        permanentId === candidate.canonicalId && locale === candidate.locale);
      if (route) links.set(candidate.canonicalId, {
        href: route.path,
        title: candidate.title!,
        locale: candidate.locale
      });
    }
    return [...links.values()];
  }

  function index(locale: Locale, family: 'projects' | 'archive'): Card[] {
    return published[locale].flatMap((record) => {
      const include = family === 'projects'
        ? record.entity === 'Project' && record.lifecycle?.toLowerCase() !== 'archived'
        : record.entity === 'ArchiveRecord' && record.archiveKind === 'Work';
      if (!include) return [];
      const route = realRoutes.find((entry) => entry.permanentId === record.canonicalId && entry.locale === locale);
      if (!route) return [];
      return [{
        id: record.canonicalId,
        href: route.path,
        title: record.title!,
        summary: record.summary!,
        locale,
        primaryType: record.primaryType,
        lifecycle: record.lifecycle,
        date: record.date,
        projects: family === 'archive' ? relatedLinks(record, published[locale], 'Project') : []
      }];
    }).sort(family === 'archive' ? byDateAndId : (a, b) => a.id.localeCompare(b.id));
  }

  function detail(route: RouteManifestEntry): Detail {
    const view: Detail = { route, milestones: [], projects: [], works: [], notes: [] };
    if (!approvedPaths.has(route.path) || route.state === 'missing') {
      throw new Error('PA route is outside the renderable scope: ' + route.path);
    }
    // Safe historical views do not read records or copy withdrawn/draft fields.
    if (route.state === 'withdrawn' || route.state === 'tombstone') return view;
    const locale = route.state === 'source-fallback' ? route.sourceLocale : route.locale;
    if (!locale) throw new Error('Missing canonical content locale: ' + route.path);
    const sourceRoute = realRoutes.find((entry) => entry.permanentId === route.permanentId && entry.locale === locale);
    const record = getPublished(route.permanentId, locale);
    if (!record || !sourceRoute ||
        (route.state === 'source-fallback' && sourceRoute.path !== route.sourceCanonical) ||
        (record.entity !== 'Project' && (record.entity !== 'ArchiveRecord' || record.archiveKind !== 'Work'))) {
      throw new Error('PA route has no matching public Project or Work: ' + route.path);
    }
    view.record = record;
    const peer = realRoutes.find((entry) => entry.permanentId === route.permanentId && entry.locale !== locale);
    if (route.state === 'page' && peer) {
      const title = getPublished(route.permanentId, peer.locale)?.title;
      if (title) view.alternate = { title, locale: peer.locale, href: peer.path };
    }
    if (route.state === 'source-fallback') view.source = { title: record.title!, locale, href: sourceRoute.path };
    if (record.entity === 'Project') {
      const unique = new Map<string, Milestone>();
      for (const candidate of published[locale]) {
        if (candidate.entity !== 'ArchiveRecord' || candidate.archiveKind !== 'Milestone' ||
            !candidate.projectIds.includes(record.canonicalId)) continue;
        unique.set(candidate.canonicalId, {
          id: candidate.canonicalId, date: candidate.date!, title: candidate.title!, summary: candidate.summary!
        });
      }
      view.milestones = [...unique.values()].sort(byDateAndId);
      assertUniqueArcAnchors(view.milestones.map(({ id }) => id));
      view.works = relatedLinks(record, published[locale].filter((candidate) => candidate.archiveKind === 'Work'), 'ArchiveRecord', true);
      view.notes = relatedLinks(record, published[locale], 'Note', true);
    } else {
      view.projects = relatedLinks(record, published[locale], 'Project');
    }
    return view;
  }

  return { index, detail };
}
