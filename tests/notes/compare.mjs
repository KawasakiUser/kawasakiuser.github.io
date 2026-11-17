import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { gzipSync } from 'node:zlib';
import { mathjax } from '@mathjax/src/js/mathjax.js';
import { STATE } from '@mathjax/src/js/core/MathItem.js';
import { SerializedMmlVisitor } from '@mathjax/src/js/core/MmlTree/SerializedMmlVisitor.js';
import { TeX } from '@mathjax/src/js/input/tex.js';
import { liteAdaptor } from '@mathjax/src/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js';
import speech from 'speech-rule-engine';
import { renderScience } from '../../src/lib/science-render/render.ts';

const out = resolve(process.argv[2] ?? 'artifacts/notes-comparison');
mkdirSync(out, { recursive: true });
const css = readFileSync('src/components/notes/notes.css', 'utf8');
const fixture = JSON.parse(readFileSync('tests/notes/fixtures/assets.json', 'utf8'));
const assets = Object.fromEntries(Object.entries(fixture).map(([key, { href, mime }]) => [key, { href, mime }]));
const fixtures = ['en', 'zh'].map((locale) => ({
  locale, source: readFileSync('tests/notes/fixtures/geometry-' + locale + '.md', 'utf8')
}));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')).packages;
const versions = Object.fromEntries(['katex', '@mathjax/src', 'speech-rule-engine'].map((name) =>
  [name, lock['node_modules/' + name].version]));
RegisterHTMLHandler(liteAdaptor());
const input = new TeX({ packages: ['base', 'ams'], maxBuffer: 8192, maxMacros: 300, formatError(_jax, error) { throw error; } });
const document = mathjax.document('', { InputJax: input });
const serializer = new SerializedMmlVisitor();
function mathJax(tex, display) {
  const node = document.convert(tex, { display, end: STATE.CONVERT });
  node.walkTree(({ attributes }) => {
    attributes?.unset('data-latex');
    attributes?.unset('data-latex-item');
  });
  return serializer.visitTree(node, document);
}
const engines = { katex: undefined, mathjax: mathJax };
const results = {};
for (const [engine, renderer] of Object.entries(engines)) {
  const render = ({ source, locale }) => renderScience(source, { locale, assets, renderer }).html;
  const start = performance.now();
  const output = fixtures.map(render);
  const firstMs = performance.now() - start;
  const times = [];
  for (let run = 0; run < 21; run++) {
    const started = performance.now();
    assert.deepEqual(fixtures.map(render), output);
    times.push(performance.now() - started);
  }
  times.sort((a, b) => a - b);
  const errors = {};
  for (const [name, value] of [
    ['malformed', '$\\frac{a}$'],
    ['remoteAsset', '$\\includegraphics{https://example.org/figure.png}$'],
    ['missingRef', '$\\eqref{eq:missing}$']
  ]) {
    assert.throws(() => render({ source: value, locale: 'en' }), (error) => { errors[name] = error.message; return true; });
  }
  results[engine] = { firstMs, warmedMedianMs: times[10], warmedP95Ms: times[19], errors, fixtures: {} };
  for (const [{ locale }, body] of fixtures.map((entry, index) => [entry, output[index]])) {
    const blocks = body.match(/<math\b[\s\S]*?<\/math>/g);
    const count = blocks.length;
    assert.ok(count > 10);
    assert.equal((body.match(/<math\b[^>]*display="block"/g) ?? []).length, 2);
    assert.ok(body.includes('href="#eq-kerr"') && body.includes('id="eq-kerr"'));
    assert.ok(body.includes('href="#eq-einstein"') && body.includes('id="eq-einstein"'));
    assert.ok(!/<script|<svg/i.test(body));
    const sentences = {};
    const speechLocale = locale === 'zh' ? 'zh' : 'en';
    await speech.setupEngine({ locale: speechLocale, domain: 'mathspeak' });
    await speech.engineReady();
    const environment = speech.engineSetup();
    if (environment.locale === speechLocale) {
      sentences.kerr = speech.toSpeech(blocks.find((item) => /display="block"/.test(item)));
      sentences.inline = speech.toSpeech(blocks[0]);
    }
    results[engine].fixtures[locale] = {
      bytes: Buffer.byteLength(body), gzipBytes: gzipSync(body).length,
      mathBytes: blocks.reduce((total, block) => total + Buffer.byteLength(block), 0),
      mathCount: count, speechRequested: speechLocale, speechActual: environment.locale, speech: sentences
    };
    const title = locale === 'zh' ? '科学样例' : 'Science specimen';
    writeFileSync(join(out, engine + '-' + locale + '.html'),
      '<!doctype html><html lang="' + locale + '"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + '</title><style>*{box-sizing:border-box}body{margin:0}' + css +
      '</style><main class="notes-surface"><article class="notes-reader scientific-prose"><h1>' + title + '</h1>' + body + '</article></main></html>');
  }
}
writeFileSync(join(out, 'comparison.json'), JSON.stringify({ node: process.version, versions, results }, null, 2) + '\n');
console.log(JSON.stringify({ versions, results }, null, 2));
