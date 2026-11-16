# G6B PA / NOTES / ABOUT Onboarding Guide

## Start

1. Fetch `g6b/integration-canonical` from the repository.
2. Checkout the final closure commit recorded in the PCS delivery metadata.
3. Run `npm ci`, `npm run check`, and `npm run test` before creating the page branch.
4. Create one feature branch from that commit.

## Consume shared data

Use `loadIntegrationSnapshot()` for build-time loading, `getPublishedForLocale()` for public locale views, `getRouteManifest()` for route decisions, and `getSafeRelatedLinks()` for related links. Do not read `src/data/registry.json` or `src/data/route-history.json` directly in page components.

## Page responsibilities

- PA owns Projects, Archive, Work, and Project timeline UI.
- NOTES owns Notes reading, trusted MDX AST validation, and the scientific renderer comparison.
- ABOUT owns About, independent Milestone timeline, Collaboration, and Link presentation.
- SHELL owns Header, Footer, locale control, common CSS, Home, canonical adapters, output manifests, and security scripts.

## Safe output extension

Page teams add exact route/output pairs to a PCS-approved `OutputScope`. They do not broaden `SHELL_OUTPUT_SCOPE` by editing the scanner or adding a wildcard. Their branch must include route fixtures, output manifest evidence, and negative tests for an unapproved page and asset.

## Content and privacy

Use synthetic fixtures until the relevant content and release gates approve real records. Use `NTE-####` for new Notes. Preserve `NOT-0001` only as the pinned inherited fixture. Draft, private, Retired, and withdrawn records must not enter public publication views.

