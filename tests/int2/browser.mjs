import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { chromium } from 'playwright-core';

const root = resolve(process.argv[2] ?? 'dist');
const profile = process.argv[3] ?? 'stock';
assert.ok(['stock', 'science'].includes(profile));
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    const file = resolve(root, '.' + (path.endsWith('/') ? path + 'index.html' : path));
    if (!file.startsWith(root + sep)) throw new Error('outside local static build');
    const bytes = await readFile(file);
    res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : 'image/png');
    res.end(bytes);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = 'http://127.0.0.1:' + server.address().port;
const allFiles = (await readdir(root, { recursive: true })).filter((name) => name.endsWith('index.html'));
assert.equal(allFiles.length, profile === 'stock' ? 14 : 26);
const paths = allFiles.map((name) => '/' + name.replace(/index\.html$/, ''));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox']
});
const evidence = { profile, browser: browser.version(), layouts: [], menu: [], focus: [], linkCount: 0 };
const go = async (page, path) => {
  assert.equal((await page.goto(base + path)).status(), 200, path);
};
const focusTarget = (page) => page.evaluate(() => ({
  id: document.activeElement.id,
  href: document.activeElement.getAttribute('href'),
  className: document.activeElement.className
}));
const visibleOutline = (locator) => locator.evaluate((el) => {
  const style = getComputedStyle(el);
  const near = el.closest('.notes-section') ?? document.body;
  const rect = el.getBoundingClientRect();
  const inView = rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth;
  const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  return { visible: el.matches(':focus-visible'), width: parseFloat(style.outlineWidth), style: style.outlineStyle,
    color: style.outlineColor, background: getComputedStyle(near).backgroundColor, inView, unobscured: el.contains(hit) };
});
function contrast(a, b) {
  const channels = (rgb) => rgb.match(/[\d.]+/g).map(Number);
  const [r, g, blue, alpha = 1] = channels(a);
  const adjacent = channels(b);
  const composed = [r, g, blue].map((value, i) => value * alpha + adjacent[i] * (1 - alpha));
  const y = (rgb) => rgb.slice(0, 3).reduce((sum, channel, index) => {
    const n = channel / 255;
    return sum + [0.2126, 0.7152, 0.0722][index] * (n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
  }, 0);
  const values = [y(composed), y(adjacent)].sort((x, z) => x - z);
  return (values[1] + 0.05) / (values[0] + 0.05);
}

try {
  for (const width of [320, 390, 820, 1440]) {
    const mobile = width < 600;
    const context = await browser.newContext({
      viewport: { width, height: mobile ? 700 : 900 },
      isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1, javaScriptEnabled: false
    });
    const page = await context.newPage();
    for (const path of paths) {
      await go(page, path);
      const layout = await page.evaluate(() => ({
        viewport: window.innerWidth, visualViewport: window.visualViewport.width, scroll: document.documentElement.scrollWidth,
        lang: document.documentElement.lang, dpr: devicePixelRatio, noindex: document.querySelector('meta[name=robots]').content
      }));
      assert.equal(layout.viewport, width, JSON.stringify({ path, width, layout }));
      assert.equal(layout.visualViewport, width, JSON.stringify({ path, width, layout }));
      assert.ok(layout.scroll <= width, JSON.stringify({ path, width, layout }));
      if (layout.noindex === 'noindex') assert.equal(layout.lang, path.startsWith('/zh/') ? 'zh' : 'en', path);
      else assert.equal(layout.noindex, 'noindex,follow', path);
      evidence.layouts.push({ path, width, ...layout });

      if (width !== 1440) continue;
      const links = await page.locator('a[href], link[rel=alternate], link[rel=canonical]').evaluateAll((items) =>
        items.map((item) => item.getAttribute('href')));
      for (const href of links) {
        const url = new URL(href, base + path);
        if (![base, 'https://kawasakiuser.github.io'].includes(url.origin)) continue;
        assert.ok(paths.includes(url.pathname), path + ' broken route ' + href);
        if (url.hash) {
          const html = await readFile(resolve(root, '.' + url.pathname + 'index.html'), 'utf8');
          assert.ok(html.includes('id="' + decodeURIComponent(url.hash.slice(1)) + '"'), path + ' broken fragment ' + href);
        }
        evidence.linkCount++;
      }
      await page.keyboard.press('Tab');
      assert.equal((await focusTarget(page)).href, '#main', path);
      await page.keyboard.press('Enter');
      assert.equal((await focusTarget(page)).id, 'main', path);
    }
    if (mobile) {
      for (const prefix of ['', '/zh']) {
        await go(page, prefix + '/projects/');
        const nav = page.locator('#mobile-navigation');
        await page.keyboard.press('Tab');
        assert.equal((await focusTarget(page)).href, '#main');
        await page.keyboard.press('Enter');
        assert.equal((await focusTarget(page)).id, 'main');
        await page.keyboard.press('Shift+Tab');
        assert.equal((await focusTarget(page)).className.split(' ')[0], 'menu-toggle');
        await page.keyboard.press('Enter');
        assert.equal(await nav.evaluate((el) => el.matches(':popover-open')), true);
        assert.equal((await focusTarget(page)).href, prefix + '/projects/');
        assert.equal(await nav.locator('[aria-current=page]').getAttribute('href'), prefix + '/projects/');
        await page.keyboard.press('Tab');
        assert.equal((await focusTarget(page)).href, prefix + '/archive/');
        await page.keyboard.press('Shift+Tab');
        assert.equal((await focusTarget(page)).href, prefix + '/projects/');
        await page.keyboard.press('Escape');
        assert.equal(await nav.evaluate((el) => el.matches(':popover-open')), false);
        assert.match((await focusTarget(page)).className, /menu-toggle/);
        await page.keyboard.press('Space');
        assert.equal(await nav.evaluate((el) => el.matches(':popover-open')), true);
        await page.locator('.menu-toggle').click();
        assert.equal(await nav.evaluate((el) => el.matches(':popover-open')), false);
        await page.locator('.menu-toggle').click();
        await nav.locator('a[href$="/archive/"]').click();
        assert.equal(new URL(page.url()).pathname, prefix + '/archive/');
        assert.equal(await nav.evaluate((el) => el.matches(':popover-open')), false);
        evidence.menu.push({ width, locale: prefix ? 'zh' : 'en', skip: 'main', enter: 'first link', tab: 'archive', shiftTab: 'projects',
          escape: 'closed; trigger focused', space: 'opens', toggle: 'closes', link: 'navigates and closes', scripts: false });
      }
    }
    await context.close();
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  for (const forcedColors of ['none', 'active']) {
    await page.emulateMedia({ forcedColors });
    await go(page, '/');
    for (const selector of ['.desktop-nav a', '.notes-section .text-link']) {
      const locator = page.locator(selector).first();
      for (let count = 0; count < 20 && !await locator.evaluate((el) => el === document.activeElement); count++) await page.keyboard.press('Tab');
      assert.equal(await locator.evaluate((el) => el === document.activeElement), true, selector);
      const outline = await visibleOutline(locator);
      assert.ok(outline.visible && outline.width >= 2 && outline.style === 'solid' && outline.inView && outline.unobscured, JSON.stringify(outline));
      const ratio = contrast(outline.color, outline.background);
      assert.ok(ratio >= 3, JSON.stringify(outline));
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await locator.evaluate((el) => el === document.activeElement), true, selector);
      evidence.focus.push({ forcedColors, selector, contrast: ratio, ...outline });
    }
  }

  for (const [path, peer] of [
    ['/', '/zh/'], ['/zh/', '/'], ['/projects/foundation-fixture/', '/zh/projects/foundation-fixture/'],
    ['/archive/work-fixture/', '/zh/archive/'], ['/notes/note-fixture/', '/zh/notes/'],
    ['/zh/about/', '/about/']
  ]) {
    await go(page, path);
    const switcher = page.locator('.desktop-nav .locale-switch');
    assert.equal(await switcher.getAttribute('href'), peer);
    await switcher.click();
    assert.equal(new URL(page.url()).pathname, peer);
  }
  if (profile === 'science') {
    await go(page, '/zh/notes/synthetic-geometry/');
    assert.ok(await page.locator('math').count() > 0);
  }
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
