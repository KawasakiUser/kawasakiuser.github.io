# G6B Shared Integration Contract v1.0

## 1. Purpose and version boundary

This contract is the shared engineering seam for `G6B-PA`, `G6B-NOTES`, and `G6B-ABOUT`. It is implemented on `g6b/integration-canonical` and is consumed through the exported adapter functions in `src/lib/canonical.ts` and the build-time loader in `src/lib/integration.ts`.

The current branch contains Shell/Home only. Page-family teams consume the contract through their own feature branches and do not add page implementation to this branch.

## 2. Canonical data model

The five entities are `Project`, `ArchiveRecord`, `Note`, `Collaboration`, and `Link`. `Registry` and route history are infrastructure ledgers.

`RecordBase` is the raw input shape. `CanonicalRecord` is the validated page-facing shape and adds `canonicalId`, `globalKey`, and `legacyFixture` provenance. Published Notes require `title`, `summary`, `date`, `category`, `body`, and `publishedAt`. Published Archive Records require `title`, `summary`, `date`, `archiveKind`, `validityStatus`, and `publishedAt`. Withdrawn Work requires `withdrawnNotice`.

Global fields are checked across locale variants. They include `slug`, `sourceLocale`, `primaryType`, `lifecycle`, `archiveKind`, normalized Work `validityStatus`, project associations, and relation identities. Localized title, summary, body, and notices remain locale-specific.

## 3. Permanent IDs and Registry

| Entity | Canonical ID | Compatibility |
|---|---|---|
| Project | `PRJ-####` | none |
| Archive Record | `ARC-####` | none |
| Note | `NTE-####` | only pinned `NOT-0001` synthetic fixture |
| Collaboration | `COL-####` | none |
| Link | `LNK-####` | none |

The `NOT-0001` compatibility record is pinned by `src/lib/legacy-fixtures.ts`, its source path, slug, locale, entity, and SHA-256. A `NOT-` prefix does not grant compatibility. Unregistered `NOT-####` IDs fail closed. Registry events are append-only, cannot be assigned twice, cannot change entity, and cannot reactivate retired IDs.

## 4. Locale, publication, withdrawal, and history

`publicationStatus` belongs to a locale variant. `validityStatus` belongs to an Archive Record globally. `Project.lifecycle` is a separate project field. Route history is a fourth state axis.

`getPublicationView()` returns only locale records with `publicationStatus=Published` and valid Work status. `getSafeRelatedLinks()` returns only truly Published, valid targets in the requested locale. A withdrawn Work produces a `withdrawn` noindex route and never appears as an ordinary publication or related link. Historic Published paths remain preserved. Draft and withdrawn targets never receive fabricated translation fallback.

`getRouteManifest()` reports `page`, `source-fallback`, `tombstone`, `withdrawn`, and `missing` state. Source fallback metadata carries the source locale and source canonical and is noindex-safe.

## 5. Public adapter API

```ts
getCanonicalEntities(records): CanonicalRecord[]
getRegistryView(records, registry): RegistryView
getRouteManifest(records, history): RouteManifestEntry[]
getSafeRelatedLinks(record, records): { id, href, locale }[]
getPublicationView(records, locale): CanonicalRecord[]
assertApprovedAsset(asset, approvedSources): void
getOutputManifest(routeManifest, scope?): OutputManifest
assertOutputRouteApproved(route, scope): void
validateOutputManifest(manifest): void
```

Page teams must use these views instead of reading Registry or route-history files directly.

## 6. Multipage output contract

The output scanner is manifest-driven and fail-closed. `SHELL_OUTPUT_SCOPE` currently authorizes `/` → `index.html` and `/zh/` → `zh/index.html`. Future page-family work must provide an explicit `OutputScope` with an approved route and exact output files. `getOutputManifest()` derives the allowed file set from that scope. Wildcards, path traversal, duplicate routes, duplicate output files, and files outside the scope are rejected. `scripts/scan-build.ts` compares the complete `dist` tree against the generated manifest and scans HTML for noindex, executable markup, Draft markers, and private markers.

## 7. Component and file ownership

| Area | Shell owner | Page-team boundary |
|---|---|---|
| Canonical adapter, Registry, locale, route history, related-link resolver | `src/lib/canonical.ts`, `src/lib/integration.ts`, `src/lib/registry.ts`, `src/lib/routes.ts` | consume only |
| Content schema and validation | `src/content.config.ts`, `src/lib/validate.ts`, `scripts/validate.ts` | propose changes through one interface request |
| Output and public-source security | `scripts/public-gate.ts`, `scripts/scan-build.ts` | consume and add tests through Shell owner |
| Header, Footer, language control, shared CSS, Home | `src/components/shell/`, `src/pages/index.astro`, `src/pages/zh/index.astro` | do not fork shared shell |
| Projects/Archive pages | — | PA owns its page folders |
| Notes/MDX/math | — | NOTES owns its page and renderer folders |
| About/timeline/links | — | ABOUT owns its page folders |

## 8. Dependency and branch rules

- Node `>=22.23.4`
- Astro `5.18.2`
- TypeScript `5.9.3`
- `tsx` `4.20.6`
- Shared base commit for this closure is `a7c71fbf32a3d2b53e966964d0517351844065c7`.
- Consumers branch from the final `g6b/integration-canonical` commit or a PCS-designated descendant.
- No consumer branch pushes or merges to `main`.
- No consumer branch changes Pages settings, A23 assets, private content, or shared security files without a single controlled interface change.

