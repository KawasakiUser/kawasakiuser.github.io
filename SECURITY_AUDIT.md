# R1 security audit

- The validator reads actual src/data/public/content JSON, not only in-memory fixtures.
- Public Draft records fail before build.
- Every actual public content JSON path must be listed in src/data/manifests/assets.json.
- Asset paths reject absolute paths, traversal, missing files, unapproved/public false entries, SVG, and unsupported MIME.
- Registry and content IDs are reconciled in both directions with entity matching.
- Build output scanning rejects Draft/private markers, executable script markers, and private/draft output paths.
- scripts/negative-integration.ts exercises orphan project IDs, empty Registry, Draft slug divergence, asset traversal, missing Archive variant, and historical tombstone behavior.
- CI retains contents: read and has no Pages publishing action.
- GitHub-managed Pages runs are recorded separately. Current Pages source is owner-reported Branch None. No authored Pages deployment exists.
