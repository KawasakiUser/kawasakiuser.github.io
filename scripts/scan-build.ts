import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { validateOutputManifest, type OutputManifest } from '../src/lib/canonical';

import { validateOutputHtml } from './output-html';

const dist = resolve('dist');
const manifest = JSON.parse(readFileSync(resolve('artifacts/output-manifest.json'), 'utf8')) as OutputManifest;
validateOutputManifest(manifest);
const found: string[] = [];
function visit(path: string): void {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) throw new Error('Unexpected build-output symlink: ' + path);
  if (stat.isDirectory()) for (const name of readdirSync(path)) visit(resolve(path, name));
  else if (stat.isFile()) found.push(relative(dist, path).replace(/\\/g, '/'));
  else throw new Error('Unsupported build output: ' + path);
}
visit(dist);
// Only the audited A23 browser module may add an asset to the static output.
// Do not widen the general route/asset manifest: keep every other generated
// script, arbitrary file, and symlink rejected by the existing exact allowlist.
// PINNED REVIEWED ARTIFACT, NOT SELF-DERIVED FROM dist:
// Exact output bytes were independently archived in the 2026-11-18
// WP-G6B-QUALITY Gate-B R1 package, built from Draft PR #15 HEAD
// d7381fcc4e1885b82b7b2fb24ff4a642b78d435b. The module file
// was verified against the independent package's SHA-256 manifest.
// Any authorized source/bundler change needs a new independent artifact
// review and a separately reviewed update to BOTH fixed pins below.
const approvedA23 = Object.freeze({
  path: '_astro/A23Cover.astro_astro_type_script_index_0_lang.CYvy5oHw.js',
  sha256: 'fad680170b0e58b74a6551d1e3c54c8125512f4132c1e7137c4e634ea8e6aa6c',
});
const a23Pattern = /^_astro\/A23Cover\.astro_astro_type_script_index_0_lang\.[A-Za-z0-9_-]{8}\.js$/;
const a23Assets = found.filter((name) => a23Pattern.test(name));
if (a23Assets.length !== 1 || a23Assets[0] !== approvedA23.path) {
  throw new Error('A23_MODULE_IDENTITY: emitted filename differs from independently reviewed A23 module');
}
const a23Asset = approvedA23.path;
const moduleBytes = readFileSync(resolve(dist, a23Asset));
const moduleContent = moduleBytes.toString('utf8');
if (moduleBytes.length < 500 || moduleBytes.length > 100_000 ||
    /SECRET_PRIVATE_DRAFT|PRIVATE_CONTENT|sourceMappingURL/i.test(moduleContent) ||
    createHash('sha256').update(moduleBytes).digest('hex') !== approvedA23.sha256) {
  throw new Error('A23_MODULE_INTEGRITY: emitted bytes differ from independently reviewed A23 module');
}
const allowed = [...manifest.allowedFiles, a23Asset].sort();
const actual = [...found].sort();
if (JSON.stringify(actual) !== JSON.stringify(allowed)) {
  throw new Error('Unexpected build output paths. expected=' + allowed.join(', ') + ' actual=' + actual.join(', '));
}
for (const file of actual.filter((name) => name.endsWith('.html'))) {
  const html = readFileSync(resolve(dist, file), 'utf8');
  const route = '/' + file.replace(/index\.html$/, '');
  const fallback = manifest.routeStates.some((entry) => entry.path === route && entry.state === 'source-fallback');
  validateOutputHtml(html, file, fallback ? 'noindex,follow' : 'noindex', a23Asset);
}
console.log('PASS manifest-driven output allowlist: ' + actual.join(', '));
