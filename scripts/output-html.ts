import { fromHtml } from 'hast-util-from-html';
import type { Element, RootContent } from 'hast';

const urlAttributes = new Set([
  'href', 'xlinkhref', 'src', 'action', 'formaction', 'poster', 'cite', 'data', 'background',
  'longdesc', 'manifest', 'profile', 'codebase', 'classid', 'icon', 'usemap', 'itemid'
]);
const urlLists = new Set(['ping', 'archive', 'itemtype']);
const sourceSets = new Set(['srcset', 'imagesrcset']);
const blockedElements = new Set(['base', 'iframe', 'frame', 'object', 'embed', 'applet', 'animate', 'animatemotion', 'animatetransform', 'set', 'foreignobject']);
const base = 'https://kawasakiuser.github.io/';

function safeUrl(raw: string, attribute: string): boolean {
  const clean = raw.trim();
  if (/[\\\u0000-\u001f\u007f\ufffd]/u.test(clean) || clean.startsWith('//')) return false;
  // URL parsing matches browser scheme handling. Also reject percent-obfuscated scheme
  // prefixes in apparent relative URLs, without decoding path/query/fragment data.
  const firstSegment = clean.split(/[/?#]/, 1)[0] ?? '';
  const schemeProbe = firstSegment.replace(/%([\da-f]{2})/gi, (_, byte: string) => String.fromCharCode(parseInt(byte, 16)))
    .replace(/[\u0000-\u0020\u007f]/g, '');
  if (schemeProbe.includes(':') && !/^[a-z][a-z0-9+.-]*:/i.test(clean)) return false;
  try {
    const url = new URL(clean, base);
    if (url.protocol === 'https:' || url.protocol === 'http:') return true;
    return attribute === 'href' && (url.protocol === 'mailto:' || url.protocol === 'tel:');
  } catch {
    return false;
  }
}

export function validateOutputHtml(html: string, file: string, robots: string, approvedA23Script?: string): void {
  const executable = () => new Error('Build output contains executable or private content: ' + file);
  if (/SECRET_PRIVATE_DRAFT|PRIVATE_CONTENT|publicationStatus["']?:?\s*["']Draft/i.test(html)) throw executable();

  const policies: string[] = [];
  let a23ScriptCount = 0;
  function visit(nodes: RootContent[], inHead = false): void {
    for (const node of nodes) {
      if (node.type !== 'element') continue;
      const { tagName, properties, children } = node;
      const tag = tagName.toLowerCase();
      if (blockedElements.has(tag)) throw executable();
      if (tag === 'script') {
        // A23 is the ONLY executable exception: the deterministic Astro-generated
        // module, linked once on each noindex Home page. Other scripts remain blocked.
        const attrs = Object.keys(properties);
        const safeHome = file === 'index.html' || file === 'zh/index.html';
        const noInline = children.every((child) => child.type === 'text' && !child.value.trim());
        if (!safeHome || !approvedA23Script || !noInline ||
            String(properties.src) !== '/' + approvedA23Script ||
            String(properties.type).toLowerCase() !== 'module' ||
            attrs.some((attr) => attr !== 'src' && attr !== 'type') ||
            ++a23ScriptCount > 1) throw executable();
        continue;
      }
      if (tag === 'meta') {
        if (String(properties.httpEquiv).trim().toLowerCase() === 'refresh') throw executable();
        if (String(properties.name).trim().toLowerCase() === 'robots') {
          policies.push(inHead ? String(properties.content).trim().toLowerCase() : '');
        }
      }
      for (const [key, value] of Object.entries(properties)) {
        const attribute = key.toLowerCase();
        if (attribute.startsWith('on') || attribute === 'srcdoc') throw executable();
        const raw = Array.isArray(value) ? value.join(' ') : String(value);
        let urls: string[];
        if (urlAttributes.has(attribute)) urls = [raw];
        else if (urlLists.has(attribute)) urls = raw.trim().split(/\s+/);
        else if (sourceSets.has(attribute)) {
          // Engineering output only permits ordinary raster URLs in source sets.
          urls = raw.split(',').map((candidate) => candidate.trim().split(/\s+/, 1)[0] ?? '');
        } else continue;
        if (urls.some((url) => !safeUrl(url, attribute))) {
          throw new Error('OUTPUT_URL: unsafe ' + tag + '[' + attribute + '] in ' + file);
        }
      }
      visit(children, inHead || tag === 'head');
      const template = node as Element & { content?: { children: RootContent[] } };
      if (template.content) visit(template.content.children);
    }
  }
  visit(fromHtml(html).children);
  if (approvedA23Script && (file === 'index.html' || file === 'zh/index.html') && a23ScriptCount !== 1) {
    throw executable();
  }
  if (policies.length !== 1 || policies[0] !== robots) {
    throw new Error('Engineering branch output must remain noindex: ' + file);
  }
}
