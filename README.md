# G6-A Astro engineering foundation

Bounded foundation only. No production page templates, A23, logo, real personal content, or Pages deployment.

Requirements: Node 22.23.4+, npm 9.6.5+.

Commands:

    npm ci
    npm run check
    npm run test
    npm run validate
    npm run build

The content layer uses Astro's built-in glob loader. The prebuild validation reads actual JSON under src/data/public/content, src/data/registry.json, src/data/route-history.json, and the approved asset manifest. src/lib contains schema, registry, locale, route-history, ARC-anchor, and security checks. Synthetic fixtures are the only records in src/data/public.

Target root-site contract: https://kawasakiuser.github.io with Astro base /. GitHub Pages publishing is absent from CI.
