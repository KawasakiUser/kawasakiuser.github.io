# INT-2 Notes verification

Pinned input for the red probe is [PR #8 validation head](https://github.com/KawasakiUser/kawasakiuser.github.io/pull/8/commits/08c6a5d4556ff2fa315d72d95ecac7f3ee71f0f8).
The initial candidate runs four page families in one Astro build with 14 HTML outputs; the only Note detail is the inherited synthetic fixture.

## Use the actual composite pipeline

```sh
npm ci
npm run check
npm run test
npm run validate
npm run validate:negative
npm run build
node tests/notes/int2/baseline-probe.mjs
npm run test:notes:int2
NOTES_INT2_RECORDS=artifacts/notes-int2/fixture-records.json npm run test:notes:renderers
NOTES_INT2_BROWSER=1 CHROMIUM_PATH=/usr/bin/chromium NOTES_RENDERER_DIR=artifacts/notes-comparison node tests/notes/browser.mjs artifacts/notes-int2
```

The older `test:notes:candidate` recipe is the Wave 2 standalone laboratory at PR #4. For the composite, use `test:notes:int2`.

The INT-2 script copies the real source tree and assembles a temporary fixture projection.
It verifies source files against `inventory.json`, computes exact synthetic record and raster byte pins, adds synthetic Registry/history, and inserts the explicitly enumerated test-only routes and raster path into the disposable composite output scope.
The stock Astro pages, source/asset gates, Notes prebuild and output scanner run on that copy. No artificial target-locale rows are inserted on the positive path.
The clean branch output scope still enumerates the 14 prior HTML files. The scientific fixture scope adds 12 Notes routes and one raster target in the temporary checkout only.
Intentional repinning in negative cases reaches the semantic gate; hash and MDX-approval tamper cases leave the independent pin stale. Tests never mount a deploy or web preview service. Browser runs serve files on loopback.

## Shared ownership

- SHELL/ARCH review the proposed Note-only route generation, historical precedence, public projection of a translated-only Note, exact fallback robots scan and the optional genuine peer link in SiteShell.
- An absent original-language record is legal in the Note public projection. The immutable logical source locale remains present and consistent across rows. Only an actually Published original with a real active source output is eligible to appear at an absent never-public target.
- An old target-language history entry suppresses generation of a new fallback for that target; its exact path remains in the ledger. Tombstones and withdrawals use safe notice pages. The unlisted legacy NOT fixture gains no new static route.
- NOTES shares one configuration for the preflight and Astro rendering. Default science policy is empty. A raster opt-in must appear in the shared pinned asset manifest and in the exact output scope. A data-only MDX opt-in must match the independently reviewed body digest for a Published identity and locale. PDF remains outside the candidate.
- Lack of a genuine peer yields an explicitly labeled section-index link. A real fallback displays the Published original with actual document/article language, a target-language shell, a notice, a source canonical, `noindex,follow`, and no translated hreflang.
- QUALITY owns independent browser and real AT. ARCH/PCS review the renderer recommendation through ADR-05. All fixtures are synthetic.
