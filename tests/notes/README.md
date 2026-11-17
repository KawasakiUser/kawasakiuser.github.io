# Scientific Notes candidate

Notes consumes the canonical adapter accepted in [PCS GATE-INT-1](https://github.com/KawasakiUser/kawasakiuser.github.io/pull/2#pullrequestreview-5921448216) at `6cad7f9689dd9166de36f95d14d4ce698a9eddb7`. The draft PR is a review unit for Notes-owned code, fixtures, and exact candidate scope. Route templates are mounted only in the disposable test checkout. The normal repository build continues to exercise the Shell output scope.

## Verify

```sh
npm ci
npm run check
npm run test
npm run validate:negative
npm run build
npm run test:notes:candidate
npm run test:notes:renderers
node tests/notes/lab.mjs empty artifacts/notes-empty
node tests/notes/lab.mjs fallback artifacts/notes-fallback
node tests/notes/audit.mjs artifacts/notes-empty
node tests/notes/audit.mjs artifacts/notes-fallback
CHROMIUM_PATH=/usr/bin/chromium NOTES_RENDERER_DIR=artifacts/notes-comparison node tests/notes/browser.mjs
```

The lab shell runs unchanged shared validation first, then validates the scientific AST and exact candidate scope on the actual staged public source. Astro compiles the static pages and the original scanner audits all emitted files. Closing the candidate requires activating the notes hook and pinned output scope through the shared entry point. The fixture inventory pins source bytes. Negative cases repin intentional malicious fixtures in the disposable checkout to reach the semantic gate. Independent pins are preserved for the unauthorized mutation cases.

## Article contract

- Published list and detail data come from the shared publication and route views. The accepted record supplies title, summary, ISO date, category, source locale and body. Astro receives the route outcome and the active route scope. History notices contain no article payload. The ordinary published variant exposes canonical and hreflang for actual built versions. Engineering HTML carries noindex. No sitemap is emitted.
- The body uses GFM Markdown, semantic citations, local footnotes, `##` as the first article heading, and sequential heading levels. Heading fragments are deterministic. A section outline appears when there are at least three top-level article sections. A standalone Markdown image needs `asset:<id>`, useful alt text and a caption in its link title. A table needs a preceding `Table: …` or `表：…` caption. Fenced code is delivered as text.
- Inline and display math use dollar delimiters. Numbered displays end with `\tag{1}\label{eq:slug}` and inline references use `$\eqref{eq:slug}$`. Labels and numbers are unique within the article. Authors describe key equations in adjacent prose. KaTeX native MathML is the candidate implementation, with bounded controls and a restricted operator set. MathJax native MathML is the benchmark alternative. Renderer and delimiter decisions remain ADR-05 proposals.
- MDX uses exact reviewed body SHA-256, parsed AST and declarative components with fixed literal props. The renderer constructs HTML/MathML from validated nodes. MDX content never enters a JS or JSX compiler. An asset ID must resolve through a reviewed adapter. PDF markup is supported, but Shell's current source validator refuses PDF bytes. The normal candidate output contains only a pinned synthetic PNG.
- UI uses inherited G3 Paper, Ink, Navy, shared Header and Footer, and static L0 behavior. The editorial index uses one underlined title link per note. Long articles get an in-flow outline, which avoids persistent sidebar navigation. Page styles use no new global tokens.

## PCS/SHELL integration request

1. Review the explicit route/file pairs in `candidate-scope.json` and the pinned synthetic records. Supply a shared hook for Notes prebuild and output scope, then mount the four route templates over the shared snapshot. Keep existing scan and source gates in effect. The draft source-only PR does not activate any public output.
2. Emit the eligible unhistorical alternate-locale route from the shared manifest when the published source exists and a public target row is absent. The current manifest path creation iterates present records, while the source gate rejects public Draft rows. The local fallback evidence exercises the shared adapter with a content-free temporary descriptor in memory. It does not approve such a descriptor as a public record. Keep history precedence and the existing synthetic legacy pin.
3. Expose a shared Header language destination so it can use the true alternate Notes route on translated details and Notes indexes. Current page-body links point to genuine translations; the shared Header switch still points to localized Home. Route availability remains the shared source for navigation. A PDF would require an independently approved type/content policy as well as an exact byte pin. Current candidate neither emits a PDF nor changes that validation.

All fixtures are synthetic. Neither raw working research nor personal assets are needed to run these tests. Real publishing, final renderer approval and independent accessibility assessment remain separate project gates.
