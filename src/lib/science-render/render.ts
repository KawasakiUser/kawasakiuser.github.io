import { createHash } from 'node:crypto';
import type { Element, ElementContent, Root as HtmlRoot } from 'hast';
import type { Root, Table } from 'mdast';
import { fromHtml } from 'hast-util-from-html';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkMdx from 'remark-mdx';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import type { Locale } from '../types';
import { assertScienceTex, renderKatex, type MathRenderer } from './math';

export interface ScienceAsset {
  readonly href: string;
  readonly mime: 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf';
}

export interface ScienceOptions {
  locale: Locale;
  format?: 'markdown' | 'mdx';
  /** The caller supplies a separately reviewed hash, never a digest calculated from the current input. */
  reviewedMdxSha256?: string;
  assets?: Readonly<Record<string, ScienceAsset>>;
  approvedLinks?: ReadonlySet<string>;
  renderer?: MathRenderer;
}

interface SyntaxNode {
  type: string;
  value?: string;
  depth?: number;
  children?: SyntaxNode[];
  url?: string;
  title?: string | null;
  alt?: string | null;
  name?: string | null;
  attributes?: { type: string; name?: string; value?: unknown }[];
}

const markdown = unified().use(remarkParse).use(remarkGfm).use(remarkMath);
const mdx = unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkMdx);
const supported = new Set((
  'root paragraph heading text emphasis strong delete blockquote list listItem thematicBreak break ' +
  'code inlineCode table tableRow tableCell link linkReference definition image footnoteDefinition footnoteReference inlineMath math'
).split(' '));
const controls: Record<string, readonly string[]> = {
  Figure: ['asset', 'alt', 'caption'],
  PdfLink: ['asset', 'label'],
  Equation: ['tex', 'description'],
  Callout: ['text'],
  Cite: ['href', 'label']
};

const el = (tagName: string, children: ElementContent[], properties: Element['properties'] = {}): Element =>
  ({ type: 'element', tagName, properties, children });
const txt = (value: string): ElementContent => ({ type: 'text', value });
const equationLabel = /^eq:[a-z][a-z0-9-]{0,63}$/;
const mathAttributes = new Set(('xmlns display displaystyle scriptlevel mathvariant dir encoding ' +
  'columnalign columnspacing rowalign rowspacing width height depth lspace rspace stretchy symmetric ' +
  'fence separator accent accentunder movablelimits largeop minsize maxsize notation indentshift ' +
  'dataBreakAlign dataMjxTexclass').split(' '));
const mathElements = new Set(('math semantics annotation mrow mi mn mo mtext mspace ms mfrac msqrt mroot ' +
  'msub msup msubsup munder mover munderover mmultiscripts mtable mtr mtd mprescripts none ' +
  'mstyle mpadded mphantom menclose mfenced munderover').split(' '));

function mathOutput(markup: string): ElementContent[] {
  const tree = fromHtml(markup, { fragment: true });
  function verify(node: ElementContent): void {
    if (node.type === 'text') return;
    if (node.type !== 'element' || !mathElements.has(node.tagName) ||
        Object.keys(node.properties).some((key) => !mathAttributes.has(key)) ||
        (node.tagName === 'annotation' && node.properties.encoding !== 'application/x-tex')) {
      throw new Error('MATH_OUTPUT: unexpected element or attribute');
    }
    node.children.forEach(verify);
  }
  const outer = tree.children[0];
  const math = outer?.type === 'element' && outer.tagName === 'span' &&
    outer.children.length === 1 && String(outer.properties.className) === 'katex'
    ? outer.children[0] : outer;
  if (tree.children.length !== 1 || math?.type !== 'element' || math.tagName !== 'math' ||
      math.properties.xmlns !== 'http://www.w3.org/1998/Math/MathML') {
    throw new Error('MATH_OUTPUT: expected one native MathML element');
  }
  verify(math);
  return [math];
}

export function renderScience(source: string, options: ScienceOptions): { html: string; headings: { id: string; title: string; depth: number }[] } {
  const { locale, format = 'markdown', assets = {}, approvedLinks = new Set(), renderer = renderKatex } = options;
  if (!source.trim() || Buffer.byteLength(source) > 128 * 1024) throw new Error('NOTE_SOURCE: empty or oversized');
  if (format !== 'markdown' && format !== 'mdx') throw new Error('NOTE_FORMAT');
  if (format === 'mdx' && createHash('sha256').update(source).digest('hex') !== options.reviewedMdxSha256) {
    throw new Error('MDX_TRUST: exact reviewed source required');
  }
  const tree = (format === 'mdx' ? mdx : markdown).parse(source);
  const root: SyntaxNode = tree;
  const equations = new Map<string, string>();
  const displays = new WeakMap<SyntaxNode, { tex: string; label?: string; number?: string }>();
  const blocks = new WeakMap<SyntaxNode, Element>();
  const headings: { id: string; title: string; depth: number }[] = [];
  const usedIds = new Set<string>();
  const localFragments = new Set<string>();
  const tableCaptions = new WeakMap<SyntaxNode, string>();
  const hiddenCaptions = new WeakSet<SyntaxNode>();
  const mathLabel = locale === 'zh' ? '可横向滚动的公式' : 'Horizontally scrollable equation';
  const scroll = (child: Element, label: string) =>
    el('div', [child], { className: ['notes-scroll'], role: 'region', ariaLabel: label, tabIndex: 0 });

  function asset(id: string, kind: 'image' | 'pdf'): ScienceAsset {
    const item = Object.hasOwn(assets, id) ? assets[id] : undefined;
    const suffix = item && ({ 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/webp': 'webp', 'application/pdf': 'pdf' })[item.mime];
    if (!item || !suffix || !/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\.(?:png|jpeg|webp|pdf)$/.test(item.href) ||
        !item.href.endsWith('.' + suffix) || (kind === 'pdf') !== (item.mime === 'application/pdf')) {
      throw new Error('NOTE_ASSET: ' + id);
    }
    return item;
  }

  function safeLink(value: string): string {
    if (value.startsWith('#') && /^#[\p{L}\p{N}-]+$/u.test(value)) {
      localFragments.add(value.slice(1));
      return value;
    }
    if (value.startsWith('asset:')) return asset(value.slice(6), 'pdf').href;
    if (/^\/(?:[a-z0-9-]+\/)*$/.test(value) && approvedLinks.has(value)) return value;
    if (/^https:\/\/[^\s\\]+$/.test(value)) {
      const url = new URL(value);
      if (!url.username && !url.password) return url.href;
    }
    throw new Error('NOTE_URL: unsafe or unapproved destination');
  }

  function figure(id: string, alt: string, caption: string): Element {
    if (!alt.trim() || !caption.trim()) throw new Error('NOTE_FIGURE: meaningful alt and caption required');
    return el('figure', [el('img', [], { src: asset(id, 'image').href, alt, loading: 'lazy', decoding: 'async' }),
      el('figcaption', [txt(caption)])]);
  }

  function captureDisplay(node: SyntaxNode, raw: string): void {
    const label = raw.match(/\\label\{(eq:[a-z][a-z0-9-]{0,63})\}\s*$/)?.[1];
    const withoutLabel = label ? raw.replace(/\\label\{[^}]+\}\s*$/, '') : raw;
    const number = withoutLabel.match(/\\tag\{([1-9][0-9]{0,2})\}\s*$/)?.[1];
    if (label && (!number || equations.has(label) || [...equations.values()].includes(number))) {
      throw new Error('TEX_LABEL: duplicate or unnumbered label');
    }
    if (number && !label) throw new Error('TEX_LABEL: numbered equations require a label');
    if (label && number) equations.set(label, number);
    const tex = (number ? withoutLabel.replace(/\\tag\{[^}]+\}\s*$/, '') : withoutLabel).trim();
    assertScienceTex(tex);
    displays.set(node, { tex, label, number });
  }

  function readComponent(node: SyntaxNode): void {
    const name = node.name;
    if (!name || !Object.hasOwn(controls, name) || node.type !== 'mdxJsxFlowElement' || node.children?.length) {
      throw new Error('MDX_COMPONENT: ' + (name ?? '(fragment)'));
    }
    const expected = controls[name]!;
    const props = new Map<string, string>();
    for (const prop of node.attributes ?? []) {
      if (prop.type !== 'mdxJsxAttribute' || !prop.name || !expected.includes(prop.name) ||
          props.has(prop.name) || typeof prop.value !== 'string' || !prop.value.trim()) {
        throw new Error('MDX_ATTRIBUTE: ' + (prop.name ?? '(expression)'));
      }
      props.set(prop.name, prop.value);
    }
    if (props.size !== expected.length) throw new Error('MDX_ATTRIBUTE: required prop missing for ' + name);
    const value = (key: string) => props.get(key)!;
    if (name === 'Figure') blocks.set(node, figure(value('asset'), value('alt'), value('caption')));
    if (name === 'PdfLink') blocks.set(node, el('p', [el('a', [txt(value('label'))], { href: asset(value('asset'), 'pdf').href })]));
    if (name === 'Equation') captureDisplay(node, value('tex'));
    if (name === 'Callout') blocks.set(node, el('aside', [el('p', [txt(value('text'))])]));
    if (name === 'Cite') blocks.set(node, el('p', [el('cite', [el('a', [txt(value('label'))], { href: safeLink(value('href')) })])]));
    if (name === 'Equation') blocks.set(node, el('p', [txt(value('description'))]));
  }

  function validate(node: SyntaxNode, parent?: SyntaxNode): void {
    if (node.type.startsWith('mdxJsx')) {
      if (parent?.type !== 'root') throw new Error('MDX_COMPONENT: top-level component required');
      readComponent(node);
    } else if (!supported.has(node.type)) {
      throw new Error('NOTE_AST: ' + node.type);
    }
    if (node.type === 'link' || node.type === 'definition') node.url = safeLink(node.url ?? '');
    if (node.type === 'image') {
      if (parent?.type !== 'paragraph' || parent.children?.length !== 1 || !node.url?.startsWith('asset:')) {
        throw new Error('NOTE_ASSET: use a standalone approved figure');
      }
      blocks.set(parent, figure(node.url.slice(6), node.alt ?? '', node.title ?? ''));
    }
    if (node.type === 'math') captureDisplay(node, node.value ?? '');
    if (node.type === 'inlineMath' && !/^\\eqref\{eq:[a-z][a-z0-9-]{0,63}\}$/.test(node.value ?? '')) {
      assertScienceTex(node.value ?? '');
    }
    if (node.type === 'heading') {
      const depth = node.depth ?? 0;
      if (parent?.type !== 'root' || depth < 2 || depth > (headings.at(-1)?.depth ?? 1) + 1) {
        throw new Error('NOTE_HEADING: use top-level headings, begin at H2 and keep levels sequential');
      }
      const headingText = (part: SyntaxNode): string => part.value ?? part.children?.map(headingText).join('') ?? '';
      const title = headingText(node).trim();
      if (!title) throw new Error('NOTE_HEADING: empty title');
      const base = 'section-' + (title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'heading');
      let id = base;
      for (let suffix = 2; usedIds.has(id); suffix++) id = base + '-' + suffix;
      usedIds.add(id);
      headings.push({ id, title, depth });
    }
    if (node.type === 'table') {
      const previous = parent?.children?.[(parent.children.indexOf(node) ?? 0) - 1];
      const caption = previous?.type === 'paragraph' && previous.children?.length === 1
        ? previous.children[0]?.value?.match(/^(?:Table:\s+|表：)(.+)$/u)?.[1]?.trim() : undefined;
      if (!caption) throw new Error('NOTE_TABLE: add a preceding Table: / 表： caption');
      tableCaptions.set(node, caption);
      hiddenCaptions.add(previous!);
    }
    node.children?.forEach((child) => validate(child, node));
  }
  validate(root);

  function display(node: SyntaxNode): Element {
    const data = displays.get(node);
    if (!data) throw new Error('TEX_INPUT: display was not validated');
    const contents = mathOutput(renderer(data.tex, true));
    if (data.label) contents.push(el('span', [txt('(' + data.number + ')')], { className: ['equation-number'] }));
    return scroll(el('div', contents, { id: data.label?.replace(':', '-'), className: ['notes-equation'] }), mathLabel);
  }

  let headingIndex = 0;
  const footnoteLabel = locale === 'zh' ? '注释' : 'Footnotes';
  const processor = unified().use(remarkRehype, {
    clobberPrefix: 'note-foot-',
    footnoteLabel,
    footnoteBackLabel: (index, rereference) => locale === 'zh' ? '返回正文 ' + index + '-' + rereference : 'Back to reference ' + index + '-' + rereference,
    handlers: {
      paragraph(state, node) {
        if (hiddenCaptions.has(node)) return undefined;
        return blocks.get(node) ?? el('p', state.all(node));
      },
      heading(state, node) {
        const heading = headings[headingIndex++];
        if (!heading) throw new Error('NOTE_HEADING: unvalidated heading');
        return el('h' + heading.depth, [...state.all(node), txt(' '), el('a', [txt('#')], {
          href: '#' + heading.id, ariaLabel: (locale === 'zh' ? '本节链接：' : 'Link to section: ') + heading.title,
          className: ['section-link']
        })], { id: heading.id, tabIndex: -1 });
      },
      code(_state, node) {
        const label = locale === 'zh' ? '可横向滚动的代码' : 'Horizontally scrollable code';
        return scroll(el('pre', [el('code', [txt(node.value)])]), label);
      },
      table(state, node) {
        const caption = tableCaptions.get(node)!;
        const [headers, ...rows] = (node as Table).children;
        if (!headers) throw new Error('NOTE_TABLE: header row required');
        const header = el('thead', [el('tr', headers.children.map((cell) => el('th', state.all(cell), { scope: 'col' })))]);
        const body = el('tbody', rows.map((row) => el('tr', row.children.map((cell) => el('td', state.all(cell))))));
        return scroll(el('table', [el('caption', [txt(caption)]), header, body]), caption);
      },
      math(_state, node) { return display(node); },
      inlineMath(_state, node) {
        const key = node.value.match(/^\\eqref\{(.+)\}$/)?.[1];
        if (!key) return mathOutput(renderer(node.value, false));
        if (!equationLabel.test(key) || !equations.has(key)) throw new Error('TEX_REFERENCE: unknown equation ' + key);
        return el('a', [txt('(' + equations.get(key) + ')')], { href: '#' + key.replace(':', '-') });
      },
      mdxJsxFlowElement(_state, node) {
        const block = blocks.get(node);
        if (!block) throw new Error('MDX_COMPONENT: missing reviewed block');
        return node.name === 'Equation' ? [block, display(node)] : block;
      }
    }
  }).use(rehypeStringify);
  const htmlTree = processor.runSync(tree as Root) as HtmlRoot;
  for (const fragment of localFragments) {
    if (!usedIds.has(fragment) && ![...equations.keys()].some((key) => key.replace(':', '-') === fragment)) {
      throw new Error('NOTE_ANCHOR: unknown target ' + fragment);
    }
  }
  return { html: processor.stringify(htmlTree), headings };
}
