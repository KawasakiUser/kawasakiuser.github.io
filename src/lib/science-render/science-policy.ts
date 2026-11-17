import type { OutputManifest, RouteManifestEntry } from '../canonical';
import type { Locale, RecordBase } from '../types';
import type { ScienceAsset, ScienceOptions } from './render';

export interface SciencePolicy {
  assets: Record<string, ScienceAsset>;
  mdxApprovals: Record<string, string>;
}

export function scienceOptions(policy: SciencePolicy, routes: readonly RouteManifestEntry[], approvedRoutes: readonly string[]) {
  const nonPagePaths = new Set(routes.filter(({ state }) => state !== 'page').map(({ path }) => path));
  const approvedLinks = new Set(approvedRoutes.filter((path) => !nonPagePaths.has(path)));
  return (note: { permanentId: string; locale: Locale }): ScienceOptions => {
    const approval = policy.mdxApprovals[note.permanentId + '-' + note.locale];
    return { locale: note.locale, assets: policy.assets, approvedLinks,
      ...(approval ? { format: 'mdx', reviewedMdxSha256: approval } : {}) };
  };
}

export function validateSciencePolicy(
  policy: SciencePolicy,
  records: readonly RecordBase[],
  assets: readonly { path: string; mime: string; approved: boolean; public: boolean }[],
  output: OutputManifest
): void {
  const published = new Set(records.filter((record) => record.entity === 'Note' && record.publicationStatus === 'Published')
    .map(({ permanentId, locale }) => permanentId + '-' + locale));
  for (const [id, sha] of Object.entries(policy.mdxApprovals)) {
    if (!published.has(id) || !/^[a-f0-9]{64}$/.test(sha)) throw new Error('NOTES_MDX_PIN: ' + id);
  }
  for (const [id, asset] of Object.entries(policy.assets)) {
    const extensions: Readonly<Record<string, string>> = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/webp': 'webp' };
    const match = asset.href.match(/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\.(png|jpeg|webp)$/);
    if (!/^[a-z0-9-]+$/.test(id) || !match || extensions[asset.mime] !== match[1] ||
        !output.allowedFiles.includes(asset.href.slice(1)) ||
        !assets.some((item) => item.path === 'public' + asset.href && item.mime === asset.mime && item.approved && item.public)) {
      throw new Error('NOTES_ASSET_POLICY: ' + id);
    }
  }
}
