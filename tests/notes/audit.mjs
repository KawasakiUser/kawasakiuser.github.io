import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fromHtml } from 'hast-util-from-html';

const folder = resolve(process.argv[2] ?? 'artifacts/notes-lab');
const manifest = JSON.parse(readFileSync(join(folder, 'output-manifest.json'), 'utf8'));
const candidate = JSON.parse(readFileSync(join(folder, 'notes-candidate.json'), 'utf8'));
const root = join(folder, 'dist');
const list = (path) => readdirSync(join(root, path)).flatMap((name) => {
  const next = path ? path + '/' + name : name;
  return statSync(join(root, next)).isDirectory() ? list(next) : [next];
});
assert.deepEqual(list('').sort(), manifest.allowedFiles.toSorted());
const records = [];
const site = 'https://kawasakiuser.github.io';
const routeFrom = (file) => '/' + file.replace(/index\.html$/, '');
const exists = (route) => manifest.approvedRoutes.includes(route);
function nodes(node) {
  return [node, ...(node.children ?? []).flatMap(nodes)];
}
for (const file of manifest.allowedFiles) {
  const bytes = readFileSync(join(root, file));
  const detail = { file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  records.push(detail);
  if (!/^(?:zh\/)?notes\//.test(file) || !file.endsWith('.html')) continue;
  const html = bytes.toString('utf8');
  assert.doesNotMatch(html, /SECRET_PRIVATE_DRAFT|DRAFT TEST MARKER|PRIVATE_CONTENT|publicationStatus|\/src\/data\//);
  const all = nodes(fromHtml(html)).filter(({ type }) => type === 'element');
  const element = (tagName) => all.filter((node) => node.tagName === tagName);
  assert.equal(element('h1').length, 1);
  assert.equal(element('main').length, 1);
  assert.equal(element('meta').find((node) => node.properties.name === 'robots').properties.content, 'noindex');
  assert.ok(!all.some((node) => ['script', 'iframe', 'svg', 'object', 'embed', 'base', 'form'].includes(node.tagName) ||
    Object.keys(node.properties).some((key) => /^on[a-z]/i.test(key))));
  const ids = all.map((node) => node.properties.id).filter(Boolean);
  assert.equal(ids.length, new Set(ids).size);
  for (const link of element('a')) {
    const { href } = link.properties;
    if (href.startsWith('#')) assert.ok(ids.includes(decodeURIComponent(href.slice(1))), file + ' dead anchor ' + href);
    else if (/^\/(?:zh\/)?notes\//.test(href)) assert.ok(exists(href), file + ' dead Notes link ' + href);
    else assert.match(href, /^(?:\/(?!\/)|https:\/\/)/);
  }
  for (const image of element('img')) {
    assert.ok(image.properties.alt.trim());
    assert.ok(manifest.allowedFiles.includes(image.properties.src.slice(1)));
  }
  const route = candidate.routes.find((entry) => entry.path === routeFrom(file));
  const canonical = element('link').filter((node) => node.properties.rel?.includes('canonical'));
  const hreflang = element('link').filter((node) => node.properties.hrefLang);
  if (!route || ['tombstone', 'withdrawn'].includes(route.state)) {
    assert.equal(canonical.length, 0);
    assert.equal(hreflang.length, 0);
    assert.equal(element('article').length, route ? 0 : element('li').filter((node) => nodes(node).some(({ tagName }) => tagName === 'article')).length);
  } else if (route.state === 'source-fallback') {
    assert.deepEqual(canonical.map((node) => node.properties.href), [site + route.sourceCanonical]);
    assert.equal(element('article')[0].properties.lang, route.sourceLocale);
    assert.equal(hreflang.length, 0);
  } else {
    assert.deepEqual(canonical.map((node) => node.properties.href), [site + route.path]);
    const expected = candidate.routes.filter((entry) => entry.permanentId === route.permanentId && entry.state === 'page' && exists(entry.path));
    assert.deepEqual(hreflang.map((node) => [node.properties.hrefLang, node.properties.href]).sort(),
      expected.map(({ locale, path }) => [locale, site + path]).sort());
    assert.equal(element('article')[0].properties.lang, route.locale);
  }
  detail.route = routeFrom(file);
  detail.state = route?.state ?? 'index';
  detail.language = element('html')[0].properties.lang;
  detail.mathNodes = element('math').length;
}
assert.ok(!manifest.allowedFiles.some((file) => /sitemap|\.js$|\.pdf$|\.svg$/.test(file)));
console.log(JSON.stringify({ status: 'PASS', scope: manifest.scopeId, files: records }, null, 2));
