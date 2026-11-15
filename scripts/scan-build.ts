import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

// G6-A is a noindex engineering scaffold. Any additional output needs a
// separately authorized design/content/release gate and an updated allowlist.
const dist = resolve('dist');
const found: string[] = [];
function visit(path: string): void {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) throw new Error('Unexpected build-output symlink: ' + path);
  if (stat.isDirectory()) for (const name of readdirSync(path)) visit(resolve(path, name));
  else if (stat.isFile()) found.push(relative(dist, path).replace(/\\/g, '/'));
  else throw new Error('Unsupported build output: ' + path);
}
visit(dist);
if (found.length !== 1 || found[0] !== 'index.html') {
  throw new Error('Unexpected build output paths: ' + found.join(', '));
}
const html = readFileSync(resolve(dist, 'index.html'), 'utf8');
if (!/<meta\s+name="robots"\s+content="noindex"\s*\/?\s*>/i.test(html)) {
  throw new Error('G6-A scaffold must remain noindex');
}
if (!html.includes('This scaffold contains no production page content.')) {
  throw new Error('Unexpected G6-A scaffold content');
}
for (const forbidden of ['PRIVATE_CONTENT', 'SECRET_PRIVATE_DRAFT', 'publicationStatus":"Draft', '<script', 'onerror=']) {
  if (html.includes(forbidden)) throw new Error('Build output contains forbidden content: ' + forbidden);
}
const visibleText = html.replace(/<!doctype[^>]*>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
if (visibleText !== 'Engineering foundation Engineering foundation This scaffold contains no production page content.') {
  throw new Error('Unexpected G6-A scaffold visible text: ' + visibleText);
}
console.log('PASS strict output allowlist: index.html only, approved visible text, noindex scaffold');
