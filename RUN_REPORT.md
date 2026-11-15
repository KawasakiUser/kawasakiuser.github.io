# G6-A one-pass engineering report
Date: 2026-11-15
Authorization: PCS-OD-PREG6-01A-02A-20261115
Scope: Astro/TypeScript foundation, five-entity validation, locale routes, permanent ID Registry, route history, public/private and asset safety, CI, tests.
## Delivered
- Astro static foundation with locked package-lock.json.
- Astro built-in glob loader for public synthetic fixtures.
- Project, ArchiveRecord Work/Milestone, Note, Collaboration, Link contracts.
- Independent permanent-ID registry and append-only checks.
- en root and /zh/ route policy with source fallback, tombstone, Withdrawn, ARC anchor and route-collision checks.
- Fail-closed unsafe text and asset checks.
- CI with least-privilege read-only contents permission and no deployment step.
- No formal production page templates. The only page is a noindex engineering scaffold.
## Executed evidence
npm ci, npm run check, npm run test, npm run validate, and npm run build all exited 0. The command log records Node v24.22.1, npm 11.9.0, Astro diagnostics with 0 errors/warnings/hints, 27 passing tests, validation PASS, static build PASS, and output scan PASS.
The supplied 46-row acceptance matrix is copied into TEST_RESULTS.csv. Foundation-applicable tests are PASSED. Future page, browser, staging, rollback, and release-gate rows remain NOT RUN.
## Remote repository status
The public repository was created at https://github.com/KawasakiUser/kawasakiuser.github.io after the Owner reported GitHub login. Source upload is complete at remote commit 2f8be2aa8c8ff03ba4049ea5b59b98671aff45d5. Foundation CI run 43723937438 completed successfully. The Owner saved GitHub Pages Source as Deploy from a branch with Branch set to None. No new Pages workflow run appeared after that save. Historical automatic runs remain recorded in evidence/REMOTE_RUNS.json. Pages is currently kept disabled for G6-A.
## Explicit non-actions
No old repository change, A23 change, formal page implementation, real content publication, GitHub Pages deployment, public preview, or production launch occurred.
