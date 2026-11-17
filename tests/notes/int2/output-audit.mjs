import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fromHtml } from 'hast-util-from-html';

const site = 'https://kawasakiuser.github.io';

function elements(node) {
  return [
    ...(node.type === 'element' ? [node] : []),
    ...(node.children ?? []).flatMap(elements)
  ];
}
function fileFor(path) { return path.slice(1) + 'index.html'; }

export function auditCompositeNotes(evidence, catalogue) {
  const json = (name) => JSON.parse(readFileSync(join(evidence, name + '.json'), 'utf8'));
  const output = json('output-manifest');
  const { routes } = json('route-manifest');
  const identities = json('canonical-entities');
  const registry = json('registry');
  const root = join(evidence, 'dist');
  const files = readdirSync(root, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(root.length + 1)).sort();
  assert.deepEqual(files, [...output.allowedFiles].sort());
  assert.equal(files.filter((file) => file.endsWith('.html')).length, 26);
  assert.deepEqual(files.filter((file) => !file.endsWith('.html')), ['notes-fixtures/radial.png']);
  const pins = json('public-source-allowlist').files;
  const bytes = readFileSync(join(root, 'notes-fixtures/radial.png'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), pins.find((pin) => pin.path === 'public/notes-fixtures/radial.png').sha256);
  assert.deepEqual(identities.filter((row) => row.permanentId === 'NTE-0101').map(({ locale, sourceLocale, slug, globalKey, legacyFixture }) =>
    [locale, sourceLocale, slug, globalKey, legacyFixture]), [
    ['en', 'en', 'synthetic-geometry', 'NTE-0101:synthetic-geometry', false],
    ['zh', 'en', 'synthetic-geometry', 'NTE-0101:synthetic-geometry', false]
  ]);
  assert.equal(registry.filter((row) => row.permanentId === 'NTE-0101').length, 1);
  assert.equal(identities.find((row) => row.permanentId === 'NOT-0001').legacyFixture, true);
  const verdicts = [];
  for (const [path, state] of Object.entries(catalogue.scope)) {
    const route = routes.find((entry) => entry.path === path);
    assert.equal(route?.state, state);
    const html = readFileSync(join(root, fileFor(path)), 'utf8');
    const all = elements(fromHtml(html));
    const of = (tag) => all.filter((node) => node.tagName === tag);
    const attr = (node, key) => node.properties[key];
    const hrefs = of('a').map((node) => attr(node, 'href'));
    const ids = all.map((node) => attr(node, 'id')).filter(Boolean);
    const links = of('link');
    const canon = links.filter((node) => attr(node, 'rel')?.includes('canonical')).map((node) => attr(node, 'href'));
    const alts = links.filter((node) => attr(node, 'hrefLang')).map((node) => [attr(node, 'hrefLang'), attr(node, 'href')]);
    const switcher = of('a').find((node) => attr(node, 'className')?.includes('locale-switch'));
    const language = attr(of('html')[0], 'lang');
    const robots = of('meta').find((node) => attr(node, 'name') === 'robots')?.properties.content;
    assert.equal(robots, state === 'source-fallback' ? 'noindex,follow' : 'noindex');
    assert.equal(of('main').length, 1);
    assert.equal(of('h1').length, 1);
    assert.equal(ids.length, new Set(ids).size);
    assert.ok(!all.some((node) => ['script', 'iframe', 'svg', 'object', 'embed', 'base', 'form'].includes(node.tagName) ||
      Object.keys(node.properties).some((key) => /^on[a-z]/i.test(key))));
    assert.doesNotMatch(html, /SECRET_PRIVATE_DRAFT|DRAFT TEST MARKER|PRIVATE_CONTENT|publicationStatus|\/src\/data\//);
    for (const href of hrefs) {
      if (href.startsWith('#')) assert.ok(ids.includes(decodeURIComponent(href.slice(1))), path + ' dead fragment ' + href);
      else if (href.startsWith('/') && !href.startsWith('//')) assert.ok(files.includes(fileFor(href)), path + ' unbuilt link ' + href);
      else assert.match(href, /^https:\/\//);
    }
    if (state === 'source-fallback') {
      assert.equal(language, route.sourceLocale);
      assert.equal(attr(of('body')[0], 'lang'), route.locale);
      assert.equal(attr(of('article')[0], 'lang'), route.sourceLocale);
      assert.ok(of('aside').some((node) => attr(node, 'className')?.includes('notes-notice')));
      assert.deepEqual(canon, [site + route.sourceCanonical]);
      assert.deepEqual(alts, []);
      assert.equal(attr(switcher, 'href'), route.sourceCanonical);
    } else if (state !== 'page') {
      assert.equal(of('article').length, 0);
      assert.equal(language, route.locale);
      assert.deepEqual(canon, []);
      assert.deepEqual(alts, []);
    } else {
      assert.equal(language, route.locale);
      assert.equal(attr(of('article')[0], 'lang'), route.locale);
      const peers = routes.filter((row) => row.entity === 'Note' && row.permanentId === route.permanentId &&
        row.state === 'page' && files.includes(fileFor(row.path)));
      assert.deepEqual(alts.sort(), peers.map((row) => [row.locale, site + row.path]).sort());
      assert.deepEqual(canon, [site + path]);
      const peer = peers.find((row) => row.locale !== route.locale);
      assert.equal(attr(switcher, 'href'), peer?.path ?? (route.locale === 'zh' ? '/notes/' : '/zh/notes/'));
      assert.equal(Boolean(attr(switcher, 'ariaLabel')), !peer);
      assert.ok(!hrefs.some((href) => routes.some((row) => row.path === href && row.state === 'source-fallback')));
    }
    if (path.endsWith('/synthetic-geometry/')) {
      for (const id of ['eq-kerr', 'eq-einstein', 'eq-dispersion']) {
        assert.ok(ids.includes(id) && hrefs.includes('#' + id));
      }
      assert.ok(of('math').length === 19 && of('mtable').length === 3);
      assert.equal(of('caption').length, 1);
      assert.equal(of('th').filter((node) => attr(node, 'scope') === 'col').length, 3);
      assert.equal(of('code').length, 1);
      assert.equal(of('figure').length, 1);
      assert.ok(of('img').every((node) => attr(node, 'alt') && attr(node, 'src') === '/notes-fixtures/radial.png'));
      assert.ok(hrefs.includes('https://arxiv.org/abs/1410.2130'));
      assert.ok(hrefs.includes(route.locale === 'zh' ? '/zh/archive/' : '/archive/'));
    }
    if (path.endsWith('/synthetic-components/')) {
      assert.equal(of('cite').length, 1);
      assert.equal(of('math').length, 1);
      assert.equal(of('figure').length, 1);
      assert.match(html, /Synthetic data-only component/);
    }
    verdicts.push({ path, id: route.permanentId, state, language, robots, canonical: canon[0], alternate: alts,
      headerLink: attr(switcher, 'href'), math: of('math').length, htmlBytes: Buffer.byteLength(html),
      sha256: createHash('sha256').update(html).digest('hex') });
  }
  for (const path of ['/notes/synthetic-translated-only/', '/zh/notes/note-fixture/', '/zh/notes/never-published/']) {
    assert.ok(!files.includes(fileFor(path)), path + ' was unexpectedly emitted');
    assert.ok(!routes.some((row) => row.path === path && row.state !== 'missing'));
  }
  for (const path of ['notes/index.html', 'zh/notes/index.html']) {
    const html = readFileSync(join(root, path), 'utf8');
    const links = elements(fromHtml(html)).filter((node) => node.tagName === 'a').map((node) => node.properties.href);
    assert.ok(!links.some((href) => routes.some((row) => row.path === href && row.state !== 'page')));
  }
  return { status: 'PASS', htmlFiles: 26, imageFiles: 1, routes: verdicts };
}
