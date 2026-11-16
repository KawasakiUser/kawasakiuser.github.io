# G6B Shared Integration API — Contract v1.0

This branch owns the shared domain adapter consumed by the Home shell and the future page-family branches. The adapter accepts the actual JSON content directory, `src/data/registry.json`, and `src/data/route-history.json` at validation/build time.

## Stable exports

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

`CanonicalRecord` retains the original permanent ID and adds `canonicalId`, `globalKey`, and an explicit `legacyFixture` marker. The inherited synthetic `NOT-####` Note fixture is accepted only as a legacy fixture. New canonical Note IDs use `NTE-####`.

The adapter preserves separate state axes. Locale publication uses `Draft | Published | Withdrawn`. Archive records may carry `validityStatus` independently. Project lifecycle, Registry state, and route-history state remain independent. `getRouteManifest` reports `page`, `source-fallback`, `tombstone`, `withdrawn`, and `missing` states. A source fallback carries `sourceLocale` and `sourceCanonical` and is noindex-safe.

`getSafeRelatedLinks` resolves only a truly Published target in the requested locale. It omits unpublished, withdrawn, and unresolved targets. `getPublicationView` is the only page-facing publication filter and never returns Draft or Withdrawn records.

`getOutputManifest` accepts an explicit `OutputScope`. The Shell scope authorizes exactly `index.html` and `zh/index.html`. Future page teams add exact route/output pairs through a PCS-approved scope. `scripts/scan-build.ts` compares the complete `dist` tree against this manifest and rejects extra paths, symlinks, executable markup, and private/draft markers.

## Consumer rules

- Page teams import these views instead of reading Registry or route-history ledgers directly.
- Page teams do not rename `NOT-` fixtures or claim them as approved real `NTE-` records.
- Fallback metadata must expose the source language and use `noindex`.
- Only the Shell owner changes canonical adapter, route, output, and shared asset-gate files.
