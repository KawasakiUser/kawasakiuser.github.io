# Security audit
- Public source is limited to Astro/TypeScript code, synthetic fixtures, CI, README, and MIT license.
- No handoff/source archives, personal data, real Drafts, Logo, A23, or unapproved images are copied into the source tree.
- CI declares only contents: read and has no Pages deploy action, pages: write, id-token: write, or production branch publish.
- assertSafeText rejects javascript:, data:, vbscript:, file:, executable tags, event attributes, imports, and expression-like executable markup.
- validateAssetManifest rejects non-public/unapproved files and SVG. The approved fixture is a synthetic PNG declaration only.
- npm run build runs a fail-closed output scan. The scan passed with one noindex foundation page.
- Browser, GitHub Pages, and production deployment checks were not run before this session because the connected GitHub session was unauthenticated. Repository creation is now complete, while Pages remains deliberately untouched.
