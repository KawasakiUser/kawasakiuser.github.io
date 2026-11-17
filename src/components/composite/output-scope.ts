import { getOutputManifest, SHELL_OUTPUT_SCOPE, type OutputScope, type RouteManifestEntry } from '../../lib/canonical';

// GATE-INT-2: synthetic-only, enumerated routes. A route manifest entry alone
// never grants public output approval; additions require a reviewed change.
export const REVIEWED_INDEX_ROUTES = [
  '/projects/', '/zh/projects/', '/archive/', '/zh/archive/',
  '/notes/', '/zh/notes/', '/about/', '/zh/about/'
] as const;
export const REVIEWED_DETAIL_ROUTES = [
  '/projects/foundation-fixture/', '/zh/projects/foundation-fixture/',
  '/archive/work-fixture/', '/notes/note-fixture/'
] as const;
const fileForRoute = (route: string): string => route.slice(1) + 'index.html';
export function getCompositeOutputScope(routes: readonly RouteManifestEntry[]): OutputScope {
  for (const path of REVIEWED_DETAIL_ROUTES) {
    if (!routes.some((route) => route.path === path && route.state !== 'missing')) {
      throw new Error('INT2_ROUTE_SCOPE: reviewed fixture detail is missing: ' + path);
    }
  }
  const scope: OutputScope = {
    scopeId: 'G6B-INT2-SYNTHETIC-EXACT-ROUTES',
    approvedRoutes: [
      ...SHELL_OUTPUT_SCOPE.approvedRoutes,
      ...REVIEWED_INDEX_ROUTES.map((route) => ({ route, outputFiles: [fileForRoute(route)] })),
      ...REVIEWED_DETAIL_ROUTES.map((route) => ({ route, outputFiles: [fileForRoute(route)] }))
    ]
  };
  getOutputManifest(routes, scope);
  return scope;
}
