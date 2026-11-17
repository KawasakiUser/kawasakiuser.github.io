"""Add synthetic browser coverage to a disposable copy of the activation tree."""
import hashlib
import json
from pathlib import Path
import sys

root = Path(sys.argv[1]).resolve()
assert (root / ".pa-disposable").is_file(), "Use only a disposable activation tree"
assert not (root / ".git").exists(), "Use an unversioned test copy"

def read(path):
    return json.loads((root / path).read_text())

def write(path, value):
    (root / path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")

registry = read("src/data/registry.json")
history = read("src/data/route-history.json")
allowlist_path = "src/data/manifests/public-source-allowlist.json"
assets_path = "src/data/manifests/assets.json"
allowlist = read(allowlist_path)
assets = read(assets_path)
fixture_dir = "src/data/public/content/"

def record(identifier, locale):
    return read(f"{fixture_dir}{identifier}-{locale}.json")

def pin(value):
    path = f"{fixture_dir}{value['permanentId']}-{value['locale']}.json"
    write(path, value)
    digest = hashlib.sha256((root / path).read_bytes()).hexdigest()
    allowlist["files"] = [entry for entry in allowlist["files"] if entry["path"] != path]
    allowlist["files"].append({"path": path, "sha256": digest})
    if not any(entry["path"] == path for entry in assets):
        assets.append({"path": path, "approved": True, "public": True, "mime": "application/json"})
    if not any(entry["permanentId"] == value["permanentId"] for entry in registry):
        register(value["permanentId"], value["entity"], "Assigned")

def register(identifier, entity, state):
    registry.append({"permanentId": identifier, "entity": entity, "state": state, "recordedAt": "2026-01-09"})

work = record("ARC-0001", "en")
milestone = record("ARC-0002", "en")
pin(dict(work, locale="zh", title="合成成果样例", summary="用于浏览器验证的合成成果。"))
for language, title in (("en", "Synthetic archived project"), ("zh", "已归档的合成项目")):
    pin(dict(record("PRJ-0001", language), permanentId="PRJ-7101", slug="archived-synthetic",
             title=title, lifecycle="archived"))
for language, title in (("en", "Synthetic shared milestone"), ("zh", "可复用的合成里程碑")):
    pin(dict(milestone, locale=language, permanentId="ARC-7101", slug="shared-synthetic", title=title,
             projectIds=["PRJ-0001", "PRJ-7101"]))

pin(dict(work, permanentId="ARC-7102", slug="independent-synthetic", projectIds=[],
         title="Synthetic independent Work"))
pin(dict(work, permanentId="ARC-7103", slug="withdrawn-synthetic", validityStatus="Withdrawn",
         title="WITHDRAWN_PAYLOAD_SENTINEL", summary="WITHDRAWN_PAYLOAD_SENTINEL",
         body="WITHDRAWN_PAYLOAD_SENTINEL", withdrawnNotice="SYNTHETIC notice field"))
register("PRJ-7102", "Project", "Assigned")
register("PRJ-7102", "Project", "Retired")
history.extend([
    {"path": "/archive/withdrawn-synthetic/", "permanentId": "ARC-7103", "locale": "en",
     "firstPublishedAt": "2026-01-02", "currentState": "Withdrawn"},
    {"path": "/zh/projects/tombstone-synthetic/", "permanentId": "PRJ-7102", "locale": "zh",
     "firstPublishedAt": "2026-01-02", "currentState": "Tombstone"},
])
write("src/data/registry.json", registry)
write("src/data/route-history.json", history)
write(allowlist_path, allowlist)
write(assets_path, assets)

scope = root / "src/components/projects/output-scope.ts"
needle = "  '/archive/work-fixture/'\n"
assert scope.read_text().count(needle) == 1
extra = [
    "/zh/archive/work-fixture/", "/projects/archived-synthetic/", "/zh/projects/archived-synthetic/",
    "/archive/independent-synthetic/", "/archive/withdrawn-synthetic/", "/zh/projects/tombstone-synthetic/"
]
scope.write_text(scope.read_text().replace(needle, needle.rstrip() + ",\n" +
                                           ",\n".join(f"  '{path}'" for path in extra) + "\n"))

# Explicitly tagged test-only provenance, with an inert, reserved-origin URL.
page = root / "src/pages/archive/[slug].astro"
needle = "<PaPage {...Astro.props} />"
assert page.read_text().count(needle) == 1
page.write_text(page.read_text().replace(needle, """<PaPage {...Astro.props} view={{
  detail: Astro.props.view.detail,
  provenance: Astro.props.view.detail.record?.canonicalId === 'ARC-0001' ? {
    resources: [{ label: 'Synthetic resource (PDF)', href: 'https://example.invalid/synthetic.pdf' },
      { label: 'UNSAFE_LINK_SENTINEL', href: 'javascript:alert(1)' }],
    versions: [{ label: 'Synthetic version 2', date: '2026-01-02', summary: 'Synthetic description.' }]
  } : undefined
}} />"""))
