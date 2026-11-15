# G6-A implementation contracts

## ADR-01 Loader and consistency
Astro Content Layer glob() loads only JSON records under src/data/public/content. The prebuild validator reads that same directory, the independent Registry ledger, the Route History ledger, and the asset manifest. Published minimums and cross-record invariants are checked before Astro build.

## ADR-02 permanent ID Registry
src/lib/registry.ts treats assignment as append-only and reconciles every actual content record to an assigned Registry event. Missing IDs, orphan Registry entries, entity mismatches, reuse, retirement errors, and allocation races fail closed.

## ADR-04 static routes and history
src/lib/routes.ts generates English root routes and /zh/ routes from genuinely Published records. Work has a detail route, Milestone has no standalone route, Notes use /notes/{slug}/, and Collaboration/Link have no top-level route. A Draft or Withdrawn record with a persisted historical path receives a noindex tombstone or withdrawn route. Historical disappearance and replacement fail closed. The generated route manifest is persisted under artifacts/route-manifest.json.

## ADR-06 public/private and assets
Public JSON is validated directly, Draft records are rejected from the public source directory, every public content file must appear in the approved asset manifest, paths are canonicalized, and traversal/absolute paths/unsupported MIME/SVG/unapproved assets fail closed. CI runs real negative integration checks and a build-output scan.

## ADR-08 licensing
LICENSE applies to foundation program code only. No real personal content, logo, A23, design assets, or production editorial content is included or licensed.

## ADR-08 site contract
Target repository is KawasakiUser/kawasakiuser.github.io, user-root URL https://kawasakiuser.github.io/, and base /. Pages source remains Deploy from a branch with Branch None as a controlled release observation. No Pages deployment workflow was authored.
