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
The public repository was created at https://github.com/KawasakiUser/kawasakiuser.github.io after the Owner reported GitHub login. Source upload is complete at remote commit 45f447ee0c4ef15e6d7b89c51f8ebde7ab0e2c08. No Actions run exists yet. Pages remains untouched.
## Explicit non-actions
No old repository change, A23 change, formal page implementation, real content publication, GitHub Pages deployment, public preview, or production launch occurred.
