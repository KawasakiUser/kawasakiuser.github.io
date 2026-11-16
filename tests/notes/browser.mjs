import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { chromium } from 'playwright-core';
import axe from 'axe-core';

const evidence = resolve(process.argv[2] ?? 'artifacts/notes-lab');
const root = join(evidence, 'dist');
const out = resolve(process.argv[3] ?? 'artifacts/notes-browser');
mkdirSync(out, { recursive: true });
const manifest = JSON.parse(readFileSync(join(evidence, 'output-manifest.json'), 'utf8'));
const origin = 'https://kawasakiuser.github.io';
const type = { '.html': 'text/html; charset=utf-8', '.png': 'image/png' };
const server = createServer((req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const mapped = pathname.startsWith('/specimens/') && process.env.NOTES_RENDERER_DIR ? resolve(process.env.NOTES_RENDERER_DIR) : root;
    const assetPath = mapped === root ? pathname : pathname.slice('/specimens'.length);
    const file = resolve(mapped, '.' + assetPath + (assetPath.endsWith('/') ? 'index.html' : ''));
    if (!file.startsWith(mapped + sep) || !statSync(file).isFile()) throw new Error('missing');
    res.writeHead(200, { 'Content-Type': type[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = 'http://127.0.0.1:' + server.address().port;
const launchOptions = { executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox'] };
const browser = await chromium.launch(launchOptions);
const records = { chromium: browser.version(), matrix: [], states: {}, a11y: {}, zoom: {} };
const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: 'reduce', deviceScaleFactor: 1 });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
const geometry = async (target) => target.evaluate(() => ({
  cssWidth: document.documentElement.clientWidth,
  bodyWidth: document.documentElement.scrollWidth,
  motion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  overflowRegions: Array.from(document.querySelectorAll('.notes-scroll')).filter((node) => node.scrollWidth > node.clientWidth).length,
  viewportScale: visualViewport.scale,
  devicePixelRatio
}));
const screens = process.env.NOTES_EXTRA_STATES !== '1';
const pathFor = (locale, kind) => (locale === 'zh' ? '/zh' : '') + '/notes/' + (kind === 'detail' ? 'synthetic-geometry/' : '');
const expected = (p) => manifest.approvedRoutes.includes(p);
try {
  for (const locale of ['en', 'zh']) {
    for (const kind of ['index', 'detail']) {
      const url = pathFor(locale, kind);
      if (!expected(url)) continue;
      for (const width of [320, 390, 820, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal((await page.goto(base + url)).status(), 200);
        const metrics = await geometry(page);
        assert.ok(metrics.motion && metrics.bodyWidth <= width, JSON.stringify(metrics));
        assert.equal(await page.locator('html').getAttribute('lang'), locale);
        assert.equal(await page.locator('h1').count(), 1);
        assert.equal(await page.locator('script').count(), 0);
        if (kind === 'detail') {
          assert.ok(await page.locator('math').count() >= 10);
          assert.equal(await page.locator('article').getAttribute('lang'), locale);
          assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), origin + url);
          assert.equal(await page.locator('link[hreflang]').count(), expected(pathFor(locale === 'en' ? 'zh' : 'en', 'detail')) ? 2 : 1);
          assert.equal(await page.locator('figure img').evaluate((img) => img.complete && img.naturalWidth > 0), true);
          assert.equal(await page.locator('th[scope=col]').count(), 3);
          assert.equal(await page.locator('a[href="#eq-kerr"]').count(), 1);
          if (width === 320) assert.ok(metrics.overflowRegions >= 1);
        }
        if (screens) await page.screenshot({ fullPage: true, path: join(out, [locale, kind, width].join('-') + '.png') });
        records.matrix.push({ locale, kind, width, ...metrics });
      }
    }
  }

  const history = '/zh/notes/synthetic-history/';
  const withdrawn = '/notes/synthetic-withdrawn/';
  const fallback = '/zh/notes/synthetic-original/';
  for (const path of [history, withdrawn, fallback, '/zh/notes/never-published/', '/zh/notes/synthetic-components/']) {
    const response = await page.goto(base + path);
    assert.equal(response.status(), expected(path) ? 200 : 404);
    if (expected(path)) {
      assert.equal(await page.locator('meta[name=robots]').getAttribute('content'), 'noindex');
      assert.equal(await page.locator('link[hreflang]').count(), 0);
      if (path === fallback) {
        assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), origin + '/notes/synthetic-original/');
        assert.equal(await page.locator('article').getAttribute('lang'), 'en');
        assert.equal(await page.locator('html').getAttribute('lang'), 'zh');
      } else {
        assert.equal(await page.locator('link[rel=canonical], .scientific-prose').count(), 0);
      }
      await page.setViewportSize({ width: 390, height: 800 });
      if (screens || path === fallback) await page.screenshot({ fullPage: true, path: join(out, path.split('/').at(-2) + '.png') });
    }
    records.states[path] = response.status();
  }
  if (!expected(pathFor('zh', 'detail'))) {
    await page.goto(base + '/zh/notes/');
    assert.match(await page.locator('main').innerText(), /目前还没有已发布的中文笔记/);
    assert.equal(await page.locator('.notes-index-list').count(), 0);
    await page.screenshot({ path: join(out, 'zh-empty-390.png'), fullPage: true });
    records.states['/zh/notes/'] = 'empty';
  }

  if (screens) {
    for (const locale of ['en', 'zh']) {
      await page.setViewportSize({ width: 320, height: 900 });
      await page.goto(base + pathFor(locale, 'detail'));
      await page.keyboard.press('Tab');
      assert.equal(await page.locator(':focus').getAttribute('href'), '#main');
      await page.keyboard.press('Enter');
      assert.equal(await page.locator(':focus').getAttribute('id'), 'main');
      const region = page.locator('.notes-scroll').first();
      assert.ok(await region.evaluate((el) => el.scrollWidth > el.clientWidth));
      let firstRegionReached = false;
      for (let tabs = 0; tabs < 35; tabs++) {
        await page.keyboard.press('Tab');
        if (await region.evaluate((el) => el === document.activeElement)) { firstRegionReached = true; break; }
      }
      assert.ok(firstRegionReached, 'formula region unreachable by keyboard');
      await page.keyboard.press('ArrowRight');
      await new Promise((done) => setTimeout(done, 300));
      const scrollLeft = await region.evaluate((el) => el.scrollLeft);
      assert.ok(scrollLeft > 0, 'ArrowRight did not scroll the focused formula (' + locale + ')');
      await page.keyboard.press('Tab');
      assert.equal(await region.evaluate((el) => el === document.activeElement), false);
      await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
      await page.keyboard.press('Shift+Tab');
      const focus = await region.evaluate((el) => ({
        forced: matchMedia('(forced-colors: active)').matches,
        active: document.activeElement === el,
        visible: el.matches(':focus-visible'),
        style: getComputedStyle(el).outlineStyle,
        width: getComputedStyle(el).outlineWidth
      }));
      assert.ok(focus.forced && focus.active && focus.visible && focus.style !== 'none' && focus.width !== '0px', JSON.stringify(focus));
      await page.screenshot({ path: join(out, locale + '-forced-colors.png') });
      await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'no-preference' });
      assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
      const ax = await cdp.send('Accessibility.getFullAXTree');
      const roles = Object.fromEntries(['MathMLMath', 'math', 'Math', 'heading', 'region', 'table', 'columnheader', 'image'].map((role) =>
        [role, ax.nodes.filter((node) => node.role?.value === role && !node.ignored).length]));
      assert.ok(roles.MathMLMath + roles.math + roles.Math > 0, JSON.stringify(roles));
      assert.ok(roles.heading && roles.region >= 3 && roles.table && roles.columnheader === 3 && roles.image);
      assert.ok(ax.nodes.some((node) => node.role?.value === 'region' && node.name?.value &&
        /scrollable equation|可横向滚动的公式/.test(node.name.value)));
      writeFileSync(join(out, locale + '-ax.json'), JSON.stringify(ax, null, 2));
      const auditContext = await browser.newContext({ viewport: { width: 390, height: 900 } });
      const audit = await auditContext.newPage();
      await audit.goto(base + pathFor(locale, 'detail'));
      await audit.addScriptTag({ content: axe.source });
      const result = await audit.evaluate(() => window.axe.run({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } }));
      assert.deepEqual(result.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map((node) => node.target) })), []);
      records.a11y[locale] = { roles, axeViolations: result.violations.length, axeIncomplete: result.incomplete.map(({ id }) => id), status: 'browser AX and automated rules; human screen reader not run' };
      await auditContext.close();
    }
  }

  if (screens && process.env.NOTES_RENDERER_DIR) {
    await page.setViewportSize({ width: 320, height: 900 });
    records.renderer = [];
    for (const engine of ['katex', 'mathjax']) for (const locale of ['en', 'zh']) {
      assert.equal((await page.goto(base + '/specimens/' + engine + '-' + locale + '.html')).status(), 200);
      await page.waitForLoadState('networkidle');
      const metrics = await geometry(page);
      assert.ok(metrics.bodyWidth <= 320 && metrics.overflowRegions >= 1, JSON.stringify(metrics));
      assert.ok(await page.locator('math').count() > 10);
      await page.screenshot({ path: join(out, engine + '-' + locale + '-320.png'), fullPage: true });
      records.renderer.push({ engine, locale, ...metrics });
    }
  }

  if (screens) {
    const profile = mkdtempSync(join(tmpdir(), 'notes-zoom-'));
    let persistent;
    try {
      const extension = join(profile, 'extension');
      mkdirSync(extension);
      writeFileSync(join(extension, 'manifest.json'), JSON.stringify({ name: 'Notes reflow test', version: '1.0.0', manifest_version: 3,
        permissions: ['tabs'], background: { service_worker: 'background.js' } }));
      writeFileSync(join(extension, 'background.js'), 'chrome.runtime.onInstalled.addListener(() => {});');
      persistent = await chromium.launchPersistentContext(join(profile, 'browser'), {
        ...launchOptions, viewport: null, javaScriptEnabled: false,
        args: [...launchOptions.args, '--window-size=1280,1024', '--disable-extensions-except=' + extension, '--load-extension=' + extension]
      });
      const worker = persistent.serviceWorkers()[0] ?? await persistent.waitForEvent('serviceworker', { timeout: 10000 });
      const zoomPage = persistent.pages()[0];
      for (const locale of ['en', 'zh']) {
        await zoomPage.goto(base + pathFor(locale, 'detail'));
        const before = await geometry(zoomPage);
        const observed = await worker.evaluate(async (url) => {
          const tabs = await chrome.tabs.query({});
          const tab = tabs.find((entry) => entry.url === url);
          if (!tab) throw new Error('active Notes tab not found');
          await chrome.tabs.setZoom(tab.id, 4);
          return chrome.tabs.getZoom(tab.id);
        }, zoomPage.url());
        assert.equal(observed, 4);
        await zoomPage.waitForFunction(() => window.devicePixelRatio >= 4);
        const after = await geometry(zoomPage);
        assert.ok(after.cssWidth <= 320 && after.cssWidth >= 300 && after.bodyWidth <= after.cssWidth, JSON.stringify({ before, after }));
        await zoomPage.screenshot({ fullPage: true, path: join(out, locale + '-browser-400.png') });
        records.zoom[locale] = { factor: observed, before, after };
      }
    } catch (error) {
      records.zoom.actualBrowserZoom = 'NOT RUN';
      records.zoom.error = String(error);
    } finally {
      await persistent?.close();
      rmSync(profile, { recursive: true, force: true });
    }
    if (records.zoom.actualBrowserZoom === 'NOT RUN') {
      const equivalent = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 256 }, deviceScaleFactor: 4 });
      const reflow = await equivalent.newPage();
      records.zoom.equivalent320Css = {};
      for (const locale of ['en', 'zh']) {
        await reflow.goto(base + pathFor(locale, 'detail'));
        const metrics = await geometry(reflow);
        assert.ok(metrics.cssWidth === 320 && metrics.bodyWidth <= 320 && metrics.devicePixelRatio === 4, JSON.stringify(metrics));
        await reflow.screenshot({ path: join(out, locale + '-320css-at-4dpr.png') });
        records.zoom.equivalent320Css[locale] = metrics;
      }
      await equivalent.close();
    }
  }
  writeFileSync(join(out, 'results.json'), JSON.stringify(records, null, 2) + '\n');
  console.log(JSON.stringify(records, null, 2));
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
