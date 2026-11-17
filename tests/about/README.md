# About engineering candidate

Base commit: `6cad7f9689dd9166de36f95d14d4ce698a9eddb7`. PCS permitted page-family consumption in [PR #2](https://github.com/KawasakiUser/kawasakiuser.github.io/pull/2#pullrequestreview-5921448216).

The branch supplies an Astro layout, a conditional page view and an ARC timeline. It integrates the shared snapshot, publication view, related-link resolver, ARC anchor assertion, and Shell. `activation.patch` proposes two locale entrypoints and a single shared prebuild scope hook. Apply it only in a disposable checkout for verification pending PCS/SHELL review. A regular branch build retains the Shell scope, so it validates the base without emitting About.

```sh
npm ci
npm run check
npm test
npm run validate:negative
npm run build
python3 tests/about/verify.py /absolute/path/to/evidence
```

The last command requires Python Playwright and system Chromium (override with `ABOUT_CHROMIUM`). It stages the patch in a temporary copy, runs Astro with the real prebuild and scan commands, then tests the pinned inputs and a separate bilingual synthetic dataset. The test-only projection and synthetic source hashes are local to that copy. Screenshots and generated manifests go to the specified evidence directory. No remote browser preview is created.

## ABOUT-INT-01 · PCS/SHELL integration request

Accept the exact `/about/ → about/index.html` and `/zh/about/ → zh/about/index.html` mappings in the combined output scope. Route entries retain engineering `noindex`. Use the combined scanned scope for About related links and let the shared Shell accept verified current/alternate paths. Until then the shared switch goes to the other language’s Home and the shared About links go to the Home preview. Resolve native mobile menu and footer conformance in the same Shell composite review.

Supply complete authorized Collaboration/Link projections (including canonical Link URLs and metadata) through a shared interface for real-content integration. Synthetic tests supply reviewed Link display fields explicitly and exercise rejection of unapproved records or unsafe URLs. G5 requires actual Milestone dates and permanent serials of at least four digits. The current adapter and PA guard accept exactly four, so validate wider serials across Registry/schema and both timeline consumers before accepting such IDs. Keep shared input, route and output gates active throughout.
