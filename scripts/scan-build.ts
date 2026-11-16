import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import type { OutputManifest } from '../src/lib/canonical';

const dist = resolve('dist');
const manifest = JSON.parse(readFileSync(resolve('artifacts/output-manifest.json'), 'utf8')) as OutputManifest;
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
  if (!/<meta\s+name="robots"\s+content="noindex"\s*\/?\s*>/i.test(html)) throw new Error('Engineering branch output must remain noindex: ' + file);
  if (/<script\b|\bon[a-z]+\s*=|SECRET_PRIVATE_DRAFT|PRIVATE_CONTENT|publicationStatus["']?:?\s*["']Draft/i.test(html)) {
    throw new Error('Build output contains executable or private content: ' + file);
  }
}
console.log('PASS manifest-driven output allowlist: ' + actual.join(', '));
