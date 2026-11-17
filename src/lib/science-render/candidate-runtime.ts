import { readFileSync } from 'node:fs';
import { getOutputManifest, type OutputScope, type RouteManifestEntry } from '../canonical';
import { loadIntegrationSnapshot } from '../integration';
import { noteDetail, notesIndexPath, type Note } from './views';
import type { ScienceAsset, ScienceOptions } from './render';
import type { Locale } from '../types';

export interface Candidate {
  routes: RouteManifestEntry[];
  scope: OutputScope;
  assets: Record<string, ScienceAsset>;
  mdxApprovals: Record<string, string>;
}

export function loadNotesCandidate() {
  const candidate = JSON.parse(readFileSync('artifacts/notes-candidate.json', 'utf8')) as Candidate;
  const snapshot = { ...loadIntegrationSnapshot(), routes: candidate.routes };
  const activePaths = new Set(getOutputManifest(snapshot.routes, candidate.scope).approvedRoutes);
  const approvedLinks = new Set(snapshot.routes.filter((route) => route.state === 'page' && activePaths.has(route.path)).map((route) => route.path));
  for (const locale of ['en', 'zh'] as const) approvedLinks.add(notesIndexPath(locale));
  function getScienceOptions(note: Pick<Note, 'permanentId' | 'locale'>): ScienceOptions {
    const mdxHash = candidate.mdxApprovals[note.permanentId + '-' + note.locale];
    return { locale: note.locale, assets: candidate.assets, approvedLinks, ...(mdxHash
      ? { format: 'mdx', reviewedMdxSha256: mdxHash } : {}) };
  }
  return { snapshot, activePaths, getScienceOptions };
}

export function getNotesPaths(locale: Locale) {
  const { snapshot, activePaths } = loadNotesCandidate();
  return snapshot.routes.filter((route) => route.locale === locale).flatMap((route) => {
    const model = noteDetail(snapshot, route, activePaths);
    if (!model) return [];
    const slug = route.path.slice(notesIndexPath(locale).length, -1);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('NOTES_PATH: ' + route.path);
    return [{ params: { slug }, props: { model } }];
  });
}
