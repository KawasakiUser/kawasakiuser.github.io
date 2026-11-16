# G6-A → G6B Canonical Migration Matrix

| G6-A behavior | G6B treatment | Evidence |
|---|---|---|
| Note IDs accepted only as `NOT-####` | Preserve inherited `NOT-####` fixture and mark `legacyFixture`; accept `NTE-####` for new canonical Notes | `adaptRecord`, `INT-01` |
| One publication enum included Withdrawn | Keep locale publication separate and add independent Work validity field | `RecordBase`, `INT-02` |
| `RecordBase` was the page-facing model | `CanonicalRecord` is the page-facing model with explicit fixture provenance | `INTEGRATION_API.md` |
| Route output was a list of current pages | Route manifest includes page, fallback, tombstone, withdrawn, and missing semantics | `artifacts/route-manifest.json` |
| Build scanner allowed one scaffold file | Scanner uses generated output manifest and fails closed on any extra output | `scripts/scan-build.ts`, `SEC-07` |
| Asset approval was declaration plus source inventory | `assertApprovedAsset` checks canonical path, existence, independent allowlist membership, and SHA-256 | `src/lib/canonical.ts` |
| Home was a noindex placeholder | Shell/Home is implemented on an engineering branch, with A23 as an explicitly protected neutral slot | `src/pages/index.astro`, `src/pages/zh/index.astro` |

