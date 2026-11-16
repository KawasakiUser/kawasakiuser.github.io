import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { ValidationError } from '../src/lib/errors';
import type { RecordBase } from '../src/lib/types';
import { assertApprovedAsset } from '../src/lib/canonical';
import { LEGACY_FIXTURE_PINS } from '../src/lib/legacy-fixtures';

interface ApprovedSource { path: string; sha256: string }
interface SourceAllowlist { scope: string; status: string; files: ApprovedSource[] }
interface AssetDeclaration { path: string; approved: boolean; public: boolean; mime: string }

const repo = resolve(process.cwd());
const clean = (path: string) => path.replace(/\\/g, '/');

function requireCanonicalPath(path: string): string {
  if (!path || path.startsWith('/') || path.includes('\\') || path.includes('\0') || path.split('/').some((p) => p === '.' || p === '..' || p === '')) {
    throw new ValidationError('PUBLIC_PATH', 'Noncanonical public path: ' + path);
  }
  const abs = resolve(repo, path);
  if (!abs.startsWith(repo + sep)) throw new ValidationError('PUBLIC_PATH', 'Path escapes repository: ' + path);
  return abs;
}

function enumerate(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  function visit(path: string): void {
    if (lstatSync(path).isSymbolicLink()) throw new ValidationError('PUBLIC_SYMLINK', 'Symlink in publishable source: ' + path);
    if (lstatSync(path).isDirectory()) {
      for (const name of readdirSync(path)) visit(resolve(path, name));
    } else if (lstatSync(path).isFile()) {
      found.push(clean(relative(repo, path)));
    } else throw new ValidationError('PUBLIC_TYPE', 'Unexpected file type: ' + path);
  }
  visit(dir);
  return found;
}

/** Enforces a separately reviewed *synthetic-only* fixture allowlist.
 *  An `approved:true` in an asset declaration is NOT independent authorization.
 *  Any future real content must get a separately reviewed catalog update.
 */
export function validatePublicSourceGate(records: readonly RecordBase[], assets: readonly AssetDeclaration[]): void {
  const allowlist = JSON.parse(readFileSync('src/data/manifests/public-source-allowlist.json', 'utf8')) as SourceAllowlist;
  if (allowlist.scope !== 'G6-A-02A-SYNTHETIC-ONLY' || !Array.isArray(allowlist.files)) {
    throw new ValidationError('PUBLIC_INVENTORY', 'Unexpected public-source approval catalog');
  }
  const approved = new Map<string, string>();
  for (const item of allowlist.files) {
    requireCanonicalPath(item.path);
    if (approved.has(item.path) || !/^[0-9a-f]{64}$/.test(item.sha256)) {
      throw new ValidationError('PUBLIC_INVENTORY', 'Duplicate/invalid source inventory entry: ' + item.path);
    }
    approved.set(item.path, item.sha256);
  }

  const actual = [
    ...enumerate(resolve(repo, 'src/data/public')),
    ...enumerate(resolve(repo, 'public')),
    ...enumerate(resolve(repo, 'src/assets'))
  ];
  const seen = new Set<string>();
  for (const path of actual) {
    if (seen.has(path)) throw new ValidationError('PUBLIC_DUPLICATE', 'Duplicate path: ' + path);
    seen.add(path);
    // Refuse any non-Published content even if someone added the file to a manifest.
    if (path.startsWith('src/data/public/content/') && path.endsWith('.json')) {
      const row = JSON.parse(readFileSync(requireCanonicalPath(path), 'utf8')) as RecordBase;
      if (row.publicationStatus !== 'Published') throw new ValidationError('PUBLIC_DRAFT', 'Public source contains non-Published record: ' + path);
      if (path !== `src/data/public/content/${row.permanentId}-${row.locale}.json`) {
        throw new ValidationError('PUBLIC_FILENAME', 'Record ID/locale does not match filename: ' + path);
      }
    }
    if (!approved.has(path)) throw new ValidationError('UNLISTED_PUBLIC_FILE', 'Unlisted publishable source file: ' + path);
    const digest = createHash('sha256').update(readFileSync(requireCanonicalPath(path))).digest('hex');
    if (approved.get(path) !== digest) throw new ValidationError('PUBLIC_HASH', 'Public source does not match reviewed bytes: ' + path);
  }
  for (const path of approved.keys()) if (!seen.has(path)) {
    throw new ValidationError('MISSING_PUBLIC_FILE', 'Catalogued publishable file missing: ' + path);
  }

  for (const pin of LEGACY_FIXTURE_PINS) {
    if (!approved.has(pin.sourcePath) || approved.get(pin.sourcePath) !== pin.sha256) {
      throw new ValidationError('LEGACY_PIN', 'Legacy fixture pin is absent or stale: ' + pin.permanentId);
    }
    const record = records.find((candidate) => candidate.permanentId === pin.permanentId && candidate.locale === pin.locale);
    if (!record || record.entity !== pin.entity || record.sourceLocale !== pin.sourceLocale || record.slug !== pin.slug) {
      throw new ValidationError('LEGACY_PIN', 'Legacy fixture record does not match its pinned source: ' + pin.permanentId);
    }
  }

  const actualJson = actual.filter((path) => path.startsWith('src/data/public/content/') && path.endsWith('.json'));
  if (actualJson.length !== records.length) throw new ValidationError('PUBLIC_RECORD_SET', 'Public JSON file count differs from loaded records');
  const declared = new Set<string>();
  for (const asset of assets) {
    requireCanonicalPath(asset.path);
    if (declared.has(asset.path)) throw new ValidationError('PUBLIC_DECLARATION', 'Duplicate asset declaration: ' + asset.path);
    declared.add(asset.path);
    if (!approved.has(asset.path)) throw new ValidationError('PUBLIC_NOT_AUTHORIZED', 'Self-declared approval is not authority: ' + asset.path);
    if (!asset.approved || !asset.public) throw new ValidationError('PUBLIC_DECLARATION', 'Asset not marked publishable: ' + asset.path);
    if (asset.path.endsWith('.json') && asset.mime !== 'application/json') {
      throw new ValidationError('PUBLIC_MIME', 'JSON asset has wrong MIME: ' + asset.path);
    }
    assertApprovedAsset(asset, [...approved].map(([path, sha256]) => ({ path, sha256 })));
  }
  if (declared.size !== approved.size || [...approved.keys()].some((path) => !declared.has(path))) {
    throw new ValidationError('PUBLIC_DECLARATION', 'Asset manifest and approved file inventory differ');
  }
  // No private authoring content belongs in this public GitHub repository at all.
  for (const path of ['src/data/private', 'src/private', 'private']) {
    if (enumerate(resolve(repo, path)).length) throw new ValidationError('PRIVATE_IN_PUBLIC_REPO', 'Private authoring files present in public repository: ' + path);
  }
}
