import { getSafeRelatedLinks, SHELL_OUTPUT_SCOPE, type CanonicalRecord, type OutputScope } from '../../lib/canonical';
import { getPublishedForLocale, type IntegrationSnapshot } from '../../lib/integration';
import { assertUniqueArcAnchors } from '../../lib/routes';
import type { Locale } from '../../lib/types';

export interface ReviewedAboutFields {
  introduction?: readonly string[];
  methods?: readonly { title: string; text: string }[];
  contact?: string;
  links?: ReadonlyMap<string, { name: string; href: string; description?: string }>;
}

interface RelatedLink {
  href: string;
  title: string;
}

interface SummaryRow {
  id: string;
  title: string;
  summary: string;
  related: RelatedLink[];
}

export interface AboutMilestone extends SummaryRow {
  date: string;
}

const ABOUT_ROUTES = [
  { route: '/about/', outputFiles: ['about/index.html'] },
  { route: '/zh/about/', outputFiles: ['zh/about/index.html'] }
] as const;

export const ABOUT_CANDIDATE_SCOPE: OutputScope = {
  scopeId: 'G6B-ABOUT-ENGINEERING-CANDIDATE',
  approvedRoutes: [...SHELL_OUTPUT_SCOPE.approvedRoutes, ...ABOUT_ROUTES]
};

const hasText = (value: string | undefined): value is string => Boolean(value?.trim());

function isCalendarDate(value: string | undefined): value is string {
  if (!value || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function reviewedWebUrl(value: string): string | undefined {
  if (!/^https:\/\//i.test(value) || /[\u0000-\u0020\u007f\\]/.test(value)) return;
  const url = URL.parse(value);
  if (url?.protocol === 'https:' && !url.username && !url.password) return url.href;
}

/** The caller supplies locale-specific editorial fields separately from the canonical publication view. */
export function makeAboutView(snapshot: IntegrationSnapshot, locale: Locale, reviewed: ReviewedAboutFields = {}) {
  const published = getPublishedForLocale(snapshot, locale);
  const byId = new Map(published.map((record) => [record.canonicalId, record]));
  const livePaths = new Set(snapshot.output.approvedRoutes);
  const liveRoutes = new Map(snapshot.routes.filter((route) =>
    route.locale === locale && route.state === 'page' && livePaths.has(route.path)
  ).map((route) => [route.permanentId, route.path]));

  function related(record: CanonicalRecord): RelatedLink[] {
    const links = new Map<string, RelatedLink>();
    for (const target of getSafeRelatedLinks(record, published)) {
      const title = byId.get(target.id)?.title;
      if (hasText(title) && liveRoutes.get(target.id) === target.href) {
        links.set(target.id, { href: target.href, title });
      }
    }
    return [...links.values()];
  }

  const milestones: AboutMilestone[] = [];
  const collaborations: SummaryRow[] = [];
  const links: { id: string; name: string; href: string; description?: string }[] = [];
  for (const record of published) {
    const { canonicalId: id, title, summary, date } = record;
    if (record.entity === 'ArchiveRecord' && record.archiveKind === 'Milestone' &&
        record.projectIds.length === 0 && isCalendarDate(date) && hasText(title) && hasText(summary)) {
      milestones.push({ id, title, summary, date, related: related(record) });
    }

    if (record.entity === 'Collaboration' && hasText(title) && hasText(summary)) {
      collaborations.push({ id, title, summary, related: related(record) });
    }

    if (record.entity === 'Link') {
      const link = reviewed.links?.get(id);
      if (!link || !hasText(link.name)) continue;
      const href = reviewedWebUrl(link.href);
      if (href) links.push({ id, name: link.name, href, description: link.description });
    }
  }
  milestones.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  assertUniqueArcAnchors(milestones.map(({ id }) => id));

  return {
    introduction: (reviewed.introduction ?? []).filter(hasText),
    methods: (reviewed.methods ?? []).filter(({ title, text }) => hasText(title) && hasText(text)),
    contact: hasText(reviewed.contact) ? reviewed.contact : undefined,
    milestones,
    collaborations,
    links
  };
}

export type AboutView = ReturnType<typeof makeAboutView>;
