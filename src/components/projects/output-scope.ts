import { getOutputManifest, SHELL_OUTPUT_SCOPE, type OutputScope, type RouteManifestEntry } from '../../lib/canonical';

export const PA_INDEX_PATHS = ['/projects/', '/zh/projects/', '/archive/', '/zh/archive/'] as const;

// Candidate for PCS review. Record paths are explicitly pinned to the approved
// synthetic inputs. A manifest entry alone never grants static output permission.
const fixturePaths = [
  '/projects/foundation-fixture/',
  '/zh/projects/foundation-fixture/',
  '/archive/work-fixture/'
] as const;

export function isPaDetailRoute(route: RouteManifestEntry): boolean {
  return route.entity === 'Project' || route.entity === 'ArchiveRecord';
}

export function makePaOutputScope(
  routes: readonly RouteManifestEntry[],
  reviewedPaths: readonly string[]
): OutputScope {
  const approvals = [...PA_INDEX_PATHS, ...reviewedPaths].map((route) => ({
    route,
    outputFiles: [route.slice(1) + 'index.html']
  }));
  for (const path of reviewedPaths) {
    if (!routes.some((route) => route.path === path && isPaDetailRoute(route) && route.state !== 'missing')) {
      throw new Error('PA scoped detail has no canonical renderable route: ' + path);
    }
  }
  const scope = {
    scopeId: 'G6B-SHELL-HOME-PA-SYNTHETIC',
    approvedRoutes: [...SHELL_OUTPUT_SCOPE.approvedRoutes, ...approvals]
  };
  getOutputManifest(routes, scope);
  return scope;
}

export function getPaOutputScope(routes: readonly RouteManifestEntry[]): OutputScope {
  return makePaOutputScope(routes, fixturePaths);
}
