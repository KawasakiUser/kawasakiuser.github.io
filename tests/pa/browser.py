"""Run on loopback only. Requires Python Playwright and a Chromium executable."""
import argparse
import csv
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import tempfile
from threading import Thread

from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("dist", type=Path)
parser.add_argument("screens", type=Path)
parser.add_argument("--chromium", default="/usr/bin/chromium")
parser.add_argument("--headless-shell", action="store_true", help="Chromium headless shell, without browser-level extension zoom")
parser.add_argument("--pins-only", action="store_true", help="Use the original seven PA fixture routes")
args = parser.parse_args()
root = args.dist.resolve()
assert root.is_dir()
args.screens.mkdir(parents=True, exist_ok=True)

class SilentHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

server = ThreadingHTTPServer(("127.0.0.1", 0), partial(SilentHandler, directory=str(root)))
thread = Thread(target=server.serve_forever, daemon=True)
thread.start()
origin = f"http://127.0.0.1:{server.server_port}"
families = {
    "projects-index": "/projects/",
    "project-detail": "/projects/foundation-fixture/",
    "archive-index": "/archive/",
    "work-detail": "/archive/work-fixture/",
}
samples = []
errors = []
try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=args.chromium, args=["--no-sandbox", "--single-process", "--no-zygote"] if args.headless_shell else ["--no-sandbox"])
        print(f"Chromium {browser.version}; loopback static HTTP; JavaScript disabled on rendered pages")
        context = browser.new_context(java_script_enabled=False, reduced_motion="reduce")
        context.route("**/*", lambda route: route.continue_() if route.request.url.startswith(origin + "/") else route.abort())
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))

        def go(path):
            response = page.goto(origin + path, wait_until="load")
            assert response and response.status == 200, path
            assert page.locator("main").count() == 1
            assert page.get_by_role("heading", level=1).count() == 1
            assert page.locator('meta[name="robots"]').get_attribute("content") == "noindex"
            assert page.locator("script").count() == 0
            ids = page.locator("[id]").evaluate_all("(nodes) => nodes.map(node => node.id)")
            assert len(ids) == len(set(ids)), (path, ids)
            return page.locator("main")

        for family, path in families.items():
            for locale in ("en", "zh"):
                if args.pins_only and family == "work-detail" and locale == "zh":
                    continue
                full = ("/zh" if locale == "zh" else "") + path
                for width in (320, 390, 820, 1440):
                    page.set_viewport_size({"width": width, "height": 900})
                    main = go(full)
                    assert page.locator("html").get_attribute("lang") == locale
                    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), (full, width)
                    assert main.locator("h1").is_visible()
                    assert page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches")
                    page.keyboard.press("Tab")
                    assert page.locator(":focus").get_attribute("href") == "#main"
                    page.keyboard.press("Enter")
                    assert page.locator(":focus").get_attribute("id") == "main", (full, width)
                    file = f"{family}_{locale}_{width}.png"
                    page.screenshot(path=args.screens / file, full_page=True)
                    samples.append((family, locale, width, full, file, "PASS"))

        page.emulate_media(forced_colors="active")
        go("/projects/")
        assert page.evaluate("matchMedia('(forced-colors: active)').matches")
        page.keyboard.press("Tab")
        page.keyboard.press("Enter")
        page.keyboard.press("Tab")
        assert page.locator(":focus").evaluate("(el) => getComputedStyle(el).outlineStyle") == "solid"
        page.screenshot(path=args.screens / "forced-colors-focus.png", full_page=True)
        page.emulate_media(forced_colors="none")

        if args.pins_only:
            assert "暂无" in go("/zh/archive/").inner_text()
            response = page.goto(origin + "/zh/archive/work-fixture/")
            assert response and response.status == 404
            print("PASS pinned inventory: zh Archive empty and missing zh Work URL returns 404")
        else:
            main = go("/archive/work-fixture/")
            assert main.get_by_role("heading", name="Version history").count() == 1
            assert main.get_by_role("link", name="Synthetic resource (PDF)").count() == 1
            assert "UNSAFE_LINK_SENTINEL" not in page.content()
            for language in ("en", "zh"):
                main = go(("/zh" if language == "zh" else "") + "/projects/")
                assert not main.locator('[href$="archived-synthetic/"]').count()
                for path in ("foundation-fixture", "archived-synthetic"):
                    full = ("/zh" if language == "zh" else "") + f"/projects/{path}/"
                    main = go(full)
                    assert main.locator('[id="ARC-7101"]').count() == 1
                    milestone = main.locator('a[href="#ARC-7101"]')
                    milestone.focus()
                    page.keyboard.press("Enter")
                    assert page.url.endswith("#ARC-7101")
                    assert page.locator(":focus").get_attribute("id") == "ARC-7101"
                    assert page.locator('link[rel="alternate"]').count() == 2
                    page.screenshot(path=args.screens / f"arc-{language}-{path}.png", full_page=True)
            assert not go("/archive/independent-synthetic/").locator('[href*="/projects/foundation"]').count()
            for path in ("/archive/withdrawn-synthetic/", "/zh/projects/tombstone-synthetic/"):
                main = go(path)
                assert not main.locator("article").count()
                assert not page.locator('link[rel="canonical"], link[rel="alternate"]').count()
                assert "WITHDRAWN_PAYLOAD_SENTINEL" not in page.content()
                page.screenshot(path=args.screens / (path.split("/")[-2] + ".png"), full_page=True)
            assert not go("/archive/").locator('[href*="withdrawn"], [href*="milestone"]').count()
            response = page.goto(origin + "/archive/shared-synthetic/")
            assert response and response.status == 404
            print("PASS synthetic states: two-locale ARC anchor reuse and focus, archived, standalone, withdrawn, tombstone, valid version/resource, Milestone 404")
        assert not errors, errors
        browser.close()

        # Chrome's browser-level zoom, verified against the same 1280px browser
        # viewport at 100% and 400%. This uses a disposable MV3 test extension.
        if args.headless_shell:
            print("NOT RUN browser-level 400% zoom: full Chromium with extension support unavailable. 320px reflow tested.")
        else:
            with tempfile.TemporaryDirectory(prefix="pa-zoom-") as scratch:
                extension = Path(scratch) / "extension"
                extension.mkdir()
                (extension / "manifest.json").write_text(json.dumps({
                    "manifest_version": 3, "name": "PA local zoom test", "version": "1.0",
                    "permissions": ["tabs"], "background": {"service_worker": "worker.js"}
                }))
                (extension / "worker.js").write_text("chrome.runtime.onInstalled.addListener(() => {});")
                zoom = playwright.chromium.launch_persistent_context(
                    str(Path(scratch) / "profile"), executable_path=args.chromium,
                    args=["--no-sandbox", f"--disable-extensions-except={extension}", f"--load-extension={extension}"],
                    viewport={"width": 1280, "height": 900})
                page = zoom.pages[0]
                worker = zoom.service_workers[0] if zoom.service_workers else zoom.wait_for_event("serviceworker", timeout=15000)
                page.goto(origin + "/projects/")
                initial = page.evaluate("innerWidth")
                assert initial == 1280, initial
                factor = worker.evaluate(f"""async () => {{
                    const tabs = await chrome.tabs.query({{}});
                    const tab = tabs.find(tab => tab.url.startsWith({json.dumps(origin)}));
                    await chrome.tabs.setZoom(tab.id, 4);
                    return chrome.tabs.getZoom(tab.id);
                }}""")
                assert factor == 4, factor
                page.wait_for_function("innerWidth === 320")
                for locale in ("en", "zh"):
                    for family, path in families.items():
                        if args.pins_only and family == "work-detail" and locale == "zh":
                            continue
                        full = ("/zh" if locale == "zh" else "") + path
                        assert page.goto(origin + full).status == 200
                        assert page.evaluate("innerWidth === 320 && document.documentElement.scrollWidth <= innerWidth"), full
                        page.screenshot(path=args.screens / f"zoom-400-{family}-{locale}.png", full_page=False)
                print(f"PASS real 400% browser zoom: CSS viewport {initial} → 320 px")
                zoom.close()
finally:
    server.shutdown()

with (args.screens / "responsive.csv").open("w", newline="") as stream:
    writer = csv.writer(stream)
    writer.writerow(("family", "locale", "width", "path", "screenshot", "result"))
    writer.writerows(samples)
print(f"PASS {len(samples)} responsive captures; skip-link keyboard, forced colors, no page JS, reduced motion")
