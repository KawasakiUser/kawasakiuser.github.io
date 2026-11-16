"""Build and exercise the About candidate through the real shared publication gates."""
from argparse import ArgumentParser
from contextlib import contextmanager
from hashlib import sha256
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
import json
import os
from pathlib import Path
import shutil
import subprocess
from tempfile import TemporaryDirectory
from threading import Thread

from playwright.sync_api import expect, sync_playwright

REPO = Path(__file__).resolve().parents[2]
PA_COMMIT = "6145daaebb8d3b1088b4c6ff7b44668c13648046"
LOCALES = {"en": "/about/", "zh": "/zh/about/"}
WIDTHS = (320, 390, 820, 1440)
ABOUT_FILES = ["about/index.html", "index.html", "zh/about/index.html", "zh/index.html"]
PROJECTION = """{
    introduction: [locale === 'zh' ? '这是一段用于测试排版的合成介绍。' : 'Synthetic introduction for layout testing.'],
    methods: locale === 'zh'
      ? [{ title: '问题', text: '合成示例。' }, { title: '方法', text: '合成示例。' }, { title: '记录', text: '合成示例。' }]
      : [{ title: 'Questions', text: 'Synthetic example.' }, { title: 'Methods', text: 'Synthetic example.' }, { title: 'Records', text: 'Synthetic example.' }],
    links: new Map([['LNK-0001', {
      name: locale === 'zh' ? '合成参考资料' : 'Synthetic reference',
      href: 'https://example.invalid/reference'
    }]]),
    contact: locale === 'zh' ? '合成示例邮箱：sample@example.invalid' : 'Synthetic example: sample@example.invalid'
  }"""


def read_json(path):
    return json.loads(path.read_text())


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False) + "\n")


def run(cwd, evidence, label, command, reject=None):
    outcome = subprocess.run(command, cwd=cwd, text=True, stdout=subprocess.PIPE,
                             stderr=subprocess.STDOUT, timeout=180)
    (evidence / f"{label}.log").write_text(
        f"$ {' '.join(command)}\nExit: {outcome.returncode}\n{outcome.stdout}"
    )
    if reject:
        assert outcome.returncode != 0 and reject in outcome.stdout, outcome.stdout
    else:
        assert outcome.returncode == 0, outcome.stdout
    print(f"PASS {label}", flush=True)


def copy_repo(root):
    for name in ("src", "scripts", "tests", "package.json", "package-lock.json",
                 "tsconfig.json", "astro.config.mjs"):
        source = REPO / name
        if source.is_dir():
            shutil.copytree(source, root / name)
        else:
            shutil.copy2(source, root / name)
    (root / "node_modules").symlink_to(REPO / "node_modules", target_is_directory=True)
    subprocess.run(["git", "apply", str(REPO / "tests/about/activation.patch")],
                   cwd=root, check=True)


def synthetic_records(root):
    data = root / "src/data"
    content = data / "public/content"
    assets_file = data / "manifests/assets.json"
    allowlist_file = data / "manifests/public-source-allowlist.json"
    registry_file = data / "registry.json"
    assets, allowlist, registry = map(read_json, (assets_file, allowlist_file, registry_file))

    def add(record):
        path = content / f"{record['permanentId']}-{record['locale']}.json"
        write_json(path, record)
        relative = path.relative_to(root).as_posix()
        digest = sha256(path.read_bytes()).hexdigest()
        allowlist["files"] = [item for item in allowlist["files"] if item["path"] != relative]
        allowlist["files"].append({"path": relative, "sha256": digest})
        if not any(item["path"] == relative for item in assets):
            assets.append({"path": relative, "approved": True, "public": True, "mime": "application/json"})
        if not any(item["permanentId"] == record["permanentId"] for item in registry):
            registry.append({"permanentId": record["permanentId"], "entity": record["entity"],
                             "state": "Assigned", "recordedAt": "2026-01-03"})

    arc = read_json(content / "ARC-0002-en.json")
    coll = read_json(content / "COL-0001-en.json")
    link = read_json(content / "LNK-0001-en.json")
    project = read_json(content / "PRJ-0001-en.json")
    add(dict(project, permanentId="PRJ-0002", slug="synthetic-second-project", title="Synthetic second project"))
    for locale in LOCALES:
        add(dict(arc, locale=locale, title="合成里程碑" if locale == "zh" else "Synthetic milestone",
                 summary="用于测试响应式布局的合成记录。" if locale == "zh" else "Synthetic record for responsive layout."))
        add(dict(arc, locale=locale, permanentId="ARC-0003", slug="synthetic-a", date="2026-02-01",
                 title="很长的合成里程碑" + "宽度验证" * 22 if locale == "zh" else "Synthetic" + "LongWord" * 18,
                 summary="合成摘要。" if locale == "zh" else "Synthetic same-date example A."))
        add(dict(arc, locale=locale, permanentId="ARC-0004", slug="synthetic-b", date="2026-02-01",
                 title="同日合成事件" if locale == "zh" else "Synthetic same-date example B",
                 summary="合成摘要。" if locale == "zh" else "Synthetic summary."))
        add(dict(arc, locale=locale, permanentId="ARC-0005", slug="synthetic-associated",
                 date="2026-02-02", projectIds=["PRJ-0001", "PRJ-0002"],
                 title="合成项目事件" if locale == "zh" else "Synthetic shared Project event"))
        add(dict(coll, locale=locale, title="合成合作条目" if locale == "zh" else "Synthetic collaboration",
                 summary="此条目用于测试模块显示。" if locale == "zh" else "Synthetic description for section testing."))
        add(dict(link, locale=locale, title="合成链接" if locale == "zh" else "Synthetic link"))

    for path, value in ((assets_file, assets), (allowlist_file, allowlist), (registry_file, registry)):
        write_json(path, value)
    for locale, route in LOCALES.items():
        path = root / f"src/pages{route}index.astro"
        source = path.read_text()
        path.write_text(source.replace(
            f"const view = makeAboutView(loadIntegrationSnapshot(), '{locale}');",
            f"const locale = '{locale}' as const;\nconst view = makeAboutView(loadIntegrationSnapshot(), locale, {PROJECTION});"
        ))


def build(root, evidence, state):
    run(root, evidence, state + "-build", ["npm", "run", "build"])
    actual = sorted(p.relative_to(root / "dist").as_posix() for p in (root / "dist").rglob("*") if p.is_file())
    assert actual == ABOUT_FILES, actual
    for filename in ("route-manifest.json", "output-manifest.json"):
        shutil.copy2(root / "artifacts" / filename, evidence / f"{state}-{filename}")


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


@contextmanager
def static_server(root):
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=root / "dist"))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


def verify_browser(root, evidence, state):
    with static_server(root) as base, sync_playwright() as api:
        browser = api.chromium.launch(executable_path=os.environ.get("ABOUT_CHROMIUM", "/usr/bin/chromium"),
                                      args=["--no-sandbox"])
        lines = [f"Chromium {browser.version} | JavaScript disabled | screenshots from localhost"]
        widths = WIDTHS if state == "synthetic" else (320, 1440)
        for locale, route in LOCALES.items():
            for width in widths:
                context = browser.new_context(viewport={"width": width, "height": 900},
                                              java_script_enabled=False, reduced_motion="reduce")
                context.route("**/*", lambda request: request.continue_() if request.request.url.startswith(base + "/")
                              else request.abort())
                page = context.new_page()
                page.goto(base + route)
                assert page.locator("html").get_attribute("lang") == locale
                assert page.locator("h1").count() == 1
                assert page.locator('meta[name="robots"]').get_attribute("content") == "noindex"
                assert not page.locator("script, link[rel=canonical], link[hreflang]").count()
                assert page.evaluate("document.documentElement.scrollWidth === innerWidth")
                ids = page.locator("[id]").evaluate_all("(elements) => elements.map(e => e.id)")
                assert len(ids) == len(set(ids)), ids
                if state == "synthetic":
                    assert page.locator(".contents a").count() == 6
                    assert page.locator("time").evaluate_all("(els) => els.map(e => e.dateTime)") == [
                        "2026-02-01", "2026-02-01", "2026-01-03"]
                    assert page.locator("ol.timeline > li").evaluate_all("(els) => els.map(e => e.id)") == [
                        "ARC-0003", "ARC-0004", "ARC-0002"]
                    assert page.locator('#links a').get_attribute("href") == "https://example.invalid/reference"
                    assert page.locator("#contact").count() == 1
                    if width == 320:
                        tree = page.locator("main").aria_snapshot()
                        assert "heading" in tree and "list" in tree and "link" in tree
                        (evidence / f"chromium-aria-{locale}.yaml").write_text(tree + "\n")
                else:
                    for section in ("introduction", "methods", "collaborations", "links", "contact"):
                        assert not page.locator(f"#{section}").count()
                    assert page.locator("time").count() == (1 if locale == "en" else 0)
                    assert not page.locator(".contents").count()
                for target in page.locator('main a[href^="#"]').evaluate_all("(els) => els.map(e => e.hash.slice(1))"):
                    assert target in ids, target
                page.screenshot(path=evidence / f"{state}-{locale}-{width}.png", full_page=True)
                lines.append(f"PASS {state} {locale} {width}px, locale DOM, no overflow, heading, fragments, noindex")
                if state == "synthetic" and width == 320:
                    page.keyboard.press("Tab")
                    assert page.locator(".skip-link").evaluate("(e) => document.activeElement === e")
                    page.keyboard.press("Enter")
                    assert page.locator("main").evaluate("(e) => document.activeElement === e")
                    page.emulate_media(forced_colors="active", reduced_motion="reduce")
                    page.keyboard.press("Tab")
                    first_link = page.locator(".contents a").first
                    expect(first_link).to_be_focused()
                    expect(first_link).to_have_css("outline-width", "3px")
                    expect(first_link).to_have_css("outline-style", "solid")
                    page.keyboard.press("Enter")
                    assert page.evaluate("location.hash") == "#introduction"
                    assert page.locator("#introduction").evaluate("(e) => document.activeElement === e")
                    page.goto(base + route + "#ARC-0003")
                    target = page.locator("#ARC-0003")
                    assert target.evaluate("(e) => e.matches(':target') && getComputedStyle(e).outlineStyle === 'solid'")
                    assert page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches")
                    assert page.evaluate("document.getAnimations().length") == 0
                    assert page.evaluate("document.documentElement.scrollWidth === innerWidth")
                    page.screenshot(path=evidence / f"forced-colors-{locale}-320.png", full_page=False)
                    lines.append(f"PASS {locale} keyboard skip, focus, TOC, direct ARC target, forced colors and reduced motion")
                context.close()
        browser.close()
    (evidence / f"{state}-browser.log").write_text("\n".join(lines) + "\n")
    print(f"PASS {state} browser matrix", flush=True)


def cross_pa(root, evidence):
    """Exercise the two workstreams against the same canonical synthetic records."""
    paths = ("page-model.ts", "output-scope.ts")
    dest = root / "src/components/projects"
    dest.mkdir(exist_ok=True)
    for name in paths:
        source = subprocess.check_output(
            ["git", "show", f"{PA_COMMIT}:src/components/projects/{name}"], cwd=REPO
        )
        (dest / name).write_bytes(source)
    path = root / "tests/cross-about-pa.ts"
    path.write_text("""import assert from 'node:assert/strict';
import { makeAboutView } from '../src/components/about/page-model';
import { makePaViews } from '../src/components/projects/page-model';
import { makePaOutputScope } from '../src/components/projects/output-scope';
import { loadIntegrationSnapshot } from '../src/lib/integration';
const data = loadIntegrationSnapshot();
const paths = ['/projects/foundation-fixture/', '/projects/synthetic-second-project/'];
const routes = paths.map((path) => data.routes.find((entry) => entry.path === path && entry.state === 'page'));
assert.ok(routes.every(Boolean));
const pa = makePaViews(data, makePaOutputScope(data.routes, paths));
for (const route of routes) {
  assert.deepEqual(pa.detail(route!).milestones.map(({ id }) => id), ['ARC-0005']);
}
assert.deepEqual(makeAboutView(data, 'en').milestones.map(({ id }) => id), ['ARC-0003', 'ARC-0004', 'ARC-0002']);
assert.equal(data.routes.some(({ permanentId }) => permanentId === 'ARC-0005'), false);
console.log('PASS same ARC-0005 anchor on two Project pages, omitted on About, no standalone route');
""")
    run(root, evidence, "cross-pa", ["node", "--import", "tsx", "tests/cross-about-pa.ts"])


def negatives(root, evidence):
    dir_path = root / "src/data/public/content"
    source = dir_path / "ARC-0002-en.json"
    original = source.read_bytes()
    for label, record, diagnostic in (
        ("draft-arc", dict(read_json(source), publicationStatus="Draft"), "PUBLIC_DRAFT"),
        ("tampered-arc", dict(read_json(source), title="Unapproved synthetic change"), "PUBLIC_HASH")
    ):
        write_json(source, record)
        run(root, evidence, label, ["npm", "run", "build"], reject=diagnostic)
    source.write_bytes(original)
    rogue = root / "src/pages/about/unapproved.astro"
    rogue.write_text("<p>Synthetic unapproved nested output</p>")
    run(root, evidence, "extra-about-route", ["npm", "run", "build"], reject="Unexpected build output paths")
    rogue.unlink()
    page = root / "src/pages/about/index.astro"
    page.write_text(page.read_text() + "\n<script>console.log('synthetic probe');</script>\n")
    # Force executable markup into the generated HTML without depending on Astro's bundling behavior.
    page.write_text(page.read_text().replace("<script>", "<script is:inline>"))
    run(root, evidence, "executable-about-output", ["npm", "run", "build"],
        reject="Build output contains executable or private content")


if __name__ == "__main__":
    parser = ArgumentParser()
    parser.add_argument("evidence", type=Path)
    args = parser.parse_args()
    evidence = args.evidence.resolve()
    evidence.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix="about-candidate-") as dirname:
        root = Path(dirname)
        copy_repo(root)
        run(root, evidence, "activated-check", ["npm", "run", "check"])
        build(root, evidence, "baseline")
        verify_browser(root, evidence, "baseline")
        synthetic_records(root)
        build(root, evidence, "synthetic")
        verify_browser(root, evidence, "synthetic")
        cross_pa(root, evidence)
        negatives(root, evidence)
