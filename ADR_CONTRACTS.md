# G6-A implementation contracts
## ADR-01 Loader and consistency
Astro 5 Content Layer glob() loads only JSON records under src/data/public. The independent validator in src/lib/validate.ts enforces entity, locale, ID prefix, published minimums, cross-locale slug/source consistency, and references before route generation. No MDX execution or math renderer is enabled.
## ADR-02 permanent ID Registry
src/lib/registry.ts treats assignment as append-only. A retired ID cannot be assigned again. A second assignment and an allocation race are rejected. Registry events are infrastructure and are not a sixth business entity.
## ADR-04 static routes and history
src/lib/routes.ts generates English root routes and /zh/ routes from genuinely Published records. Work has a detail route, Milestone has no standalone route, Notes use /notes/{slug}/, and Collaboration/Link have no top-level route. Formerly published Draft records become noindex tombstones. Withdrawn records retain a noindex historical notice route. Historical route replacement is rejected. The code does not claim HTTP 301/410 behavior.
## ADR-06 public/private and assets
Only synthetic records exist under the public loader. The build output scanner rejects private/Draft marker strings. Dangerous URL schemes, executable markup, unapproved SVG, non-public assets, and unsupported asset MIME types fail closed. No private source tree is included.
## ADR-08 licensing
LICENSE applies to foundation program code. No real personal content, logo, A23, design assets, or production editorial content is included or licensed by this package.
## ADR-08 site contract
Target repository is KawasakiUser/kawasakiuser.github.io, user-root URL https://kawasakiuser.github.io/, and base /. The target repository was unavailable before this run and no Pages configuration claim is made.
