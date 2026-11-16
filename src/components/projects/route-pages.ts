import { loadIntegrationSnapshot } from '../../lib/integration';
import type { Locale } from '../../lib/types';
import { getPaOutputScope, isPaDetailRoute } from './output-scope';
import { makePaViews } from './page-model';

export type Family = 'projects' | 'archive';

export function indexPage(locale: Locale, family: Family) {
  const snapshot = loadIntegrationSnapshot();
  const scope = getPaOutputScope(snapshot.routes);
  const views = makePaViews(snapshot, scope);
  return { locale, family, view: { cards: views.index(locale, family) } };
}

export function detailPages(locale: Locale, family: Family) {
  const snapshot = loadIntegrationSnapshot();
  const scope = getPaOutputScope(snapshot.routes);
  const approved = new Set(scope.approvedRoutes.map(({ route }) => route));
  const views = makePaViews(snapshot, scope);
  return snapshot.routes
    .filter((route) => isPaDetailRoute(route) && route.locale === locale &&
      (family === 'projects' ? route.entity === 'Project' : route.entity === 'ArchiveRecord') &&
      approved.has(route.path))
    .map((route) => ({
      params: { slug: route.path.split('/').at(-2)! },
      props: { locale, family, view: { detail: views.detail(route) } }
    }));
}
