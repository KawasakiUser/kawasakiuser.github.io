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
const a23Pattern = /^_astro\/A23Cover\.astro_astro_type_script_index_0_lang\.[A-Za-z0-9_-]{8}\.js$/;
const a23Assets = found.filter((name) => a23Pattern.test(name));
if (a23Assets.length !== 1) {
  throw new Error('Expected exactly one audited A23 module output, found ' + a23Assets.length);
}
const a23Asset = a23Assets[0]!;
const moduleContent = readFileSync(resolve(dist, a23Asset), 'utf8');
if (moduleContent.length < 500 || moduleContent.length > 100_000 ||
    /SECRET_PRIVATE_DRAFT|PRIVATE_CONTENT|sourceMappingURL/i.test(moduleContent)) {
  throw new Error('A23 module content failed bounded source safety scan');
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
