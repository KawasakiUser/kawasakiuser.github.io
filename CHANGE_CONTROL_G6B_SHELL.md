# G6B Shell Change Control

- Base: `1a065cabc9467fe7e52697cff5ce003701d62169` from `KawasakiUser/kawasakiuser.github.io/main`.
- Branch: `g6b/integration-canonical`.
- Scope implemented: shared canonical adapter, pinned legacy-ID compatibility, Published Note completeness, global fact parity, withdrawn Work semantics, explicit route/output scopes, manifest-driven output scan, negative integration cases, shared Header/Footer, Home 01–05 bilingual shell.
- Synthetic fixtures only. No private or real unpublished content was added.
- A23 source art and prototype files were not modified or embedded. Home 01 uses a labeled neutral protected slot.
- No Pages configuration, deployment, public preview, `main` push, or merge was performed.
- OD-04 English and Chinese About copy is used verbatim from the accepted source record.
- Chinese Notes navigation has no dead `#notes` anchor when no published Chinese Notes section exists. Notes section numbering uses the approved pale foreground on Navy.
- Delivery SHA manifest excludes its own manifest entry explicitly and is independently verified by `npm run verify:delivery`.
- `HOME-TOKEN-01`, PCS independent QA, runtime browser QA, and release authorization remain open outside this implementation branch.
