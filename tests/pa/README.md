# PA route activation and verification

PA is based on PCS-approved shared SHA `6cad7f9689dd9166de36f95d14d4ce698a9eddb7`. The feature branch is a reviewable code submission. Applying `activation.patch` in a disposable tree connects the index/detail route entrypoints and supplies the explicit seven-path PA scope to the existing shared manifest producer. Keep the shared validator change in the patch for PCS/SHELL review. The production scanner, data, build settings and Pages workflows are inherited.

From a checkout of this branch, with Node and its lockfile dependencies installed:

```bash
npm ci
npm run check
npm run test
npm run validate:negative
npm run build

pa_checkout="$PWD"
pa_run="$(mktemp -d)"
git archive HEAD | tar -x -C "$pa_run"
git -C "$pa_run" apply "$pa_checkout/tests/pa/activation.patch"
ln -s "$pa_checkout/node_modules" "$pa_run/node_modules"
(cd "$pa_run" && npm run check && npm run validate:negative && npm run build)
python3 tests/pa/browser.py "$pa_run/dist" "$pa_run/browser-pinned" --pins-only
touch "$pa_run/.pa-disposable"
python3 tests/pa/prepare-fixtures.py "$pa_run"
(cd "$pa_run" && npm run check && npm run build)
python3 tests/pa/browser.py "$pa_run/dist" "$pa_run/browser-extra"
```

The browser test requires Python Playwright and a compatible Chromium. To run with a standalone Chromium headless shell, pass `--chromium /absolute/path/to/chrome-headless-shell --headless-shell`. That mode checks 320px reflow but skips browser-level extension zoom. Both modes use loopback for the rendered site. Synthetic browser data stays in the disposable tree. The pinned dataset has a valid English Work, two Project locales and an empty zh Archive.

The pinned shared policy rejects Draft JSON at the public-input boundary. Unit tests exercise shared route state with in-memory synthetic Draft cases. The activation proof uses an actual history-only tombstone and a synthetic Withdrawn Work. No synthetic Draft, Version resource, or new Registry allocation is added to repository content.

## PCS/SHELL cross-workstream request PA-INT-01

- Review the exact seven PA path/file pairs and the single manifest producer wiring in `activation.patch`.
- Give the single shared Shell nav/locale hooks for the new index paths. PA currently renders an explicit localized index/detail link in its page body. The shared Shell nav still uses Home anchors and the global locale link remains a site-level Home switch.
- Supply absent-target source fallback in the exported route manifest without putting Draft JSON in public inputs and ensure Withdrawn routing requires genuine historical publication. Reproduce with source-only ARC-0001 (the manifest lacks the permitted target fallback), and a synthetic Withdrawn Work with no historical entries (the route helper still emits a notice). PA scope only accepts explicitly listed fixture paths and displays no withdrawn record payload. Published alternate and safe optional relations still use the shared API and exact output scope.
- A public version/resource projection and optional Project dates will be connected when supported by the shared adapter. The Work view can display pre-approved provenance and is exercised with synthetic data. Persistent real Work taxonomy remains an ADR-07 decision.
