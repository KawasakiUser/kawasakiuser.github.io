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
const allowed = [...manifest.allowedFiles].sort();
const actual = [...found].sort();
if (JSON.stringify(actual) !== JSON.stringify(allowed)) {
  throw new Error('Unexpected build output paths. expected=' + allowed.join(', ') + ' actual=' + actual.join(', '));
}
for (const file of actual.filter((name) => name.endsWith('.html'))) {
  const html = readFileSync(resolve(dist, file), 'utf8');
  const route = '/' + file.replace(/index\.html$/, '');
  const fallback = manifest.routeStates.some((entry) => entry.path === route && entry.state === 'source-fallback');
  validateOutputHtml(html, file, fallback ? 'noindex,follow' : 'noindex');
}
console.log('PASS manifest-driven output allowlist: ' + actual.join(', '));
