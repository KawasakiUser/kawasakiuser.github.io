import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateOutputHtml } from '../scripts/output-html';

const component = readFileSync('src/components/shell/A23Cover.astro', 'utf8');
const page = readFileSync('src/components/shell/HomePage.astro', 'utf8');
const motion = readFileSync('src/lib/a23-field.js', 'utf8');
const approved = '_astro/A23Cover.astro_astro_type_script_index_0_lang.Abc12345.js';
const html = (script: string) => '<!doctype html><html lang="en"><head><meta name="robots" content="noindex"></head><body>' + script + '</body></html>';
const tag = '<script type="module" src="/' + approved + '"></script>';

test('A23 Owner latest Chinese title and exact red scope are preserved', () => {
  assert.match(component, /<span>创造那些经得起时间考验，<\/span>/);
  assert.match(component, /<span>依然有用的，<\/span>/);
  assert.match(component, /<span class="a23-accent">价值<\/span>/);
  assert.doesNotMatch(component, /价值。/);
  assert.match(component, /Build the work that remains useful\./);
  assert.match(component, /<span class="a23-accent">useful\.<\/span>/);
  assert.equal((component.match(/<h1\b/g) ?? []).length, 1);
  assert.doesNotMatch(page, /Protected A23 Cover slot|受保护的 A23 Cover 插槽/);
  assert.match(page, /<A23Cover locale=\{locale\}/);
});

test('A23 field retains all 4 original languages and lifecycle suppression', () => {
  for (const lang of ["lang:'en'", "lang:'zh'", "lang:'jp'", "lang:'ru'"]) assert.ok(motion.includes(lang), lang);
  assert.match(motion, /prefers-reduced-motion: reduce/);
  assert.match(motion, /forced-colors: active/);
  assert.match(motion, /visibilitychange/);
  assert.match(motion, /IntersectionObserver/);
  assert.match(motion, /cancelAnimationFrame/);
});

test('restricted A23 external module accepted only on noindex Home routes', () => {
  assert.doesNotThrow(() => validateOutputHtml(html(tag), 'index.html', 'noindex', approved));
  assert.doesNotThrow(() => validateOutputHtml(html(tag), 'zh/index.html', 'noindex', approved));
  assert.throws(() => validateOutputHtml(html(tag), 'about/index.html', 'noindex', approved), /executable or private/);
});

test('injected and unapproved scripts are still blocked even on Home', () => {
  for (const malicious of [
    '<script>alert(1)</script>',
    '<script type="module" src="/_astro/unapproved.js"></script>',
    '<script type="module" src="/' + approved + '">alert(1)</script>',
    '<script type="module" src="/' + approved + '" onload="alert(1)"></script>',
    tag + tag,
  ]) {
    assert.throws(() => validateOutputHtml(html(malicious), 'index.html', 'noindex', approved), /executable or private/);
  }
  assert.throws(() => validateOutputHtml(html(''), 'index.html', 'noindex', approved), /executable or private/);
});
