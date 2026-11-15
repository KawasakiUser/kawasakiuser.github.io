import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { ValidationError } from './errors';

const dangerousScheme = /^(?:javascript|data|vbscript|file):/i;
const executableMarkup = /<script\b|<iframe\b|<object\b|<embed\b|\bon[a-z]+\s*=|import\s+['"]|\{\s*[\w.]+\s*\(/i;
const allowedMimes = new Set(['application/json', 'image/png', 'image/jpeg', 'image/webp', 'image/avif']);

export function assertSafeText(value: string, field = 'text'): void {
  if (dangerousScheme.test(value.trim())) throw new ValidationError('UNSAFE_SCHEME', field + ' uses a dangerous scheme');
  if (executableMarkup.test(value)) throw new ValidationError('EXECUTABLE_MARKUP', field + ' contains executable markup');
}

export function validateAssetManifest(manifest: { path: string; approved: boolean; public: boolean; mime: string }[]): void {
  const root = resolve(process.cwd());
  for (const asset of manifest) {
    const normalized = resolve(root, asset.path);
    if (normalized !== root && !normalized.startsWith(root + sep)) {
      throw new ValidationError('ASSET_TRAVERSAL', 'Asset path escapes repository: ' + asset.path);
    }
    if (asset.path.startsWith('/') || asset.path.includes('..')) {
      throw new ValidationError('ASSET_PATH', 'Asset path is not canonical: ' + asset.path);
    }
    if (asset.mime === 'image/svg+xml') throw new ValidationError('SVG_REJECTED', 'SVG assets require separate approval: ' + asset.path);
    if (!existsSync(normalized)) throw new ValidationError('ASSET_MISSING', 'Asset does not exist: ' + asset.path);
    if (!asset.approved || !asset.public) throw new ValidationError('ASSET_NOT_PUBLIC', 'Asset not approved/public: ' + asset.path);
    if (!allowedMimes.has(asset.mime)) throw new ValidationError('ASSET_MIME', 'Unsupported asset MIME: ' + asset.mime);
  }
}
