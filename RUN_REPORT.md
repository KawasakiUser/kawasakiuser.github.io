# G6-A R1 correction report

Date: 2026-11-15
Authorization: PCS-G6A-R1-IAR-20261115 under Owner 01A/02A
Scope: P1 corrections only. No page templates, A23, real content, Logo, or Pages release.

## Corrections completed

- Actual content JSON is the canonical validation input.
- Permanent Registry reconciliation is bidirectional and entity-aware.
- Forward references are order independent.
- Project associations reject dangling IDs and wrong targets.
- Shared slug/source invariants apply across Draft and Published locale states.
- sourceLocale drives real fallback for either en or zh.
- Published ArchiveRecord requires Work or Milestone.
- Asset path canonicalization and approved manifest checks are enforced.
- Prebuild validation consumes actual records, ledgers, and assets.
- Route History generates and persists artifacts/route-manifest.json.
- Historical published routes become noindex tombstones instead of disappearing.
- CI runs a negative integration suite before build.
- MIT license scope and permission notice are complete.

## Evidence

- Node v24.22.1 and npm 11.9.0
- npm ci passed
- astro check passed with 0 errors, warnings, or hints
- 37 automated tests passed, including all 10 PCS R1 negative tests
- negative integration command passed
- actual data validation passed for 7 records, 6 Registry entries, and 4 generated routes
- static build and output scan passed
- evidence/R1_COMMAND_LOG.txt contains the complete command sequence

## Release boundary

The scaffold remains noindex and contains no formal production pages. GitHub-managed Pages status remains separately controlled with Branch None. No Pages release, A23 change, real content publication, or G6-B work occurred.

## Remaining controlled items

- PCS must independently recheck the R1 commit and CI run.
- Browser/AT/performance/page-template tests remain future gates.
- GitHub Pages remains a later release decision.
