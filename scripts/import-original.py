#!/usr/bin/env python3
"""One-time, explicit import of the owner's published Figma Sites website.

Normal development/builds never contact the original website. This script keeps
the original rendering data intact, so responsive layout and animation values
are not approximated by a second implementation.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from hashlib import sha256
from html import unescape
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import urlsplit, parse_qsl

ROOT = Path(__file__).resolve().parent.parent
ORIGIN = "https://www.meridesign.cn"
BUNDLE = "57601274-0046-46ba-bd25-2596db6a99b5"
ROUTES = ["/", "/home-en", "/user-guide", "/user-guide-en",
          "/usage-specification", "/usage-specification-en",
          "/consistency", "/consistency-en", "/update-log", "/update-log-en"]


def download(path, browser_image=False):
    headers = ['-H', 'Accept: image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'] if browser_image else []
    result = subprocess.run(["curl", "--silent", "--show-error", "--fail", "--location",
                             "--retry", "2", "--max-time", "60", *headers, ORIGIN + path],
                            capture_output=True)
    if result.returncode:
        raise RuntimeError(f"{path}: {result.stderr.decode(errors='replace')}")
    return result.stdout


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data if isinstance(data, bytes) else data.encode())


def local_asset_path(url):
    parts = urlsplit(unescape(url))
    path = Path(parts.path)
    if parts.path.startswith('/_videos/') and not path.suffix:
        path = path.with_suffix('.mp4')
    query = sorted(parse_qsl(parts.query))
    if query:
        suffix = "-".join(f"{k}{v}" for k, v in query)
        path = path.with_name(f"{path.stem}--{suffix}{path.suffix}")
    return str(path)


def strings(value):
    if isinstance(value, dict):
        for v in value.values():
            yield from strings(v)
    elif isinstance(value, list):
        for v in value:
            yield from strings(v)
    elif isinstance(value, str):
        yield value


def import_page(route):
    slug = route.strip("/") or "home"
    html = download(route)
    data_path = f"/_json/{BUNDLE}/{route.strip('/') or '_index'}.json"
    scene = json.loads(download(data_path))
    write(ROOT / "src/pages" / f"{slug}.html", html)
    write(ROOT / "src/design" / f"{slug}.json", json.dumps(scene, ensure_ascii=False, indent=2) + "\n")
    # Editing a unique text entry updates every matching component/variant.
    text_entries = {}

    def collect(value):
        if isinstance(value, dict):
            if isinstance(value.get("characters"), str) and value["characters"]:
                text = value["characters"]
                if text not in text_entries:
                    text_entries[text] = {"id": value.get("id", "override"),
                                          "name": value.get("name", text[:40]),
                                          "original": text, "text": text}
            for v in value.values():
                collect(v)
        elif isinstance(value, list):
            for v in value:
                collect(v)

    collect(scene["nodeById"])
    write(ROOT / "src/content" / f"{slug}.json",
          json.dumps(list(text_entries.values()), ensure_ascii=False, indent=2) + "\n")
    return route, html.decode(), scene


def main():
    resources = set()
    pages = []
    all_links = set()
    baselines = {}
    with ThreadPoolExecutor(max_workers=5) as pool:
        for task in as_completed([pool.submit(import_page, route) for route in ROUTES]):
            route, html, scene = task.result()
            pages.append({"route": route, "slug": route.strip("/") or "home",
                          "rootId": scene["roots"][0]})
            slug = route.strip('/') or 'home'
            baselines[slug] = sha256((ROOT / 'src/design' / f'{slug}.json').read_bytes()).hexdigest()
            all_links.update(unescape(url) for url in re.findall(r'href="(https?://[^\"]+)"', html))
            for value in strings(scene):
                if value.startswith(('https://', 'http://')) and len(value) < 1000:
                    all_links.add(value)
            print("Imported page", route, flush=True)
            resources.update(unescape(p) for p in re.findall(
                r'(/_(?:assets|woff|user_fonts|runtimes|components|videos)/[^\s"\'<>\\),;]+)', html))
            for font in scene.get("fonts", {}).values():
                if font.get("subsets"):
                    subsets = font["subsets"]
                    resources.update(subsets["baseUrl"] + s["file"] for s in subsets["subsetMappings"])
                else:
                    resources.add(font["url"] if font["url"].startswith('/') else '/_user_fonts/v1/' + font['url'])
            for asset in scene.get("assets", {}).values():
                if asset.get("url"):
                    prefix = "/_videos/v1/" if asset.get("type") == "VIDEO_ASSET" else "/_assets/v11/"
                    resources.add(prefix + asset["url"])
            if scene.get("sourceCodeHash"):
                resources.update(f"/_components/v2/{scene['sourceCodeHash']}.{ext}" for ext in ("js", "css"))
            for text in strings(scene):
                if text.startswith(("/_videos/", "/_user_fonts/")):
                    resources.add(text)

    manifest = []

    def import_asset(url):
        output = local_asset_path(url)
        target = ROOT / "public" / output.lstrip("/")
        is_image = urlsplit(url).path.endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif'))
        modern_target = target.with_suffix('.avif')
        if is_image:
            body = modern_target.read_bytes() if modern_target.exists() else download(url, browser_image=True)
            if b'ftypavif' in body[:32] or b'ftypavis' in body[:32]:
                target = modern_target
                output = str(Path(output).with_suffix('.avif'))
        else:
            body = target.read_bytes() if target.exists() else download(url)
        write(target, body)
        return {"url": url, "file": output, "bytes": len(body), "sha256": sha256(body).hexdigest()}

    with ThreadPoolExecutor(max_workers=8) as pool:
        tasks = {pool.submit(import_asset, url): url for url in sorted(resources)}
        for task in as_completed(tasks):
            record = task.result()
            manifest.append(record)
            print(f"Resource {len(manifest)}/{len(resources)} {record['url']} ({record['bytes']})", flush=True)

    ordered_pages = sorted(pages, key=lambda p: ROUTES.index(p["route"]))
    write(ROOT / "src/routes.json", json.dumps(ordered_pages, ensure_ascii=False, indent=2) + "\n")
    write(ROOT / "src/assets-manifest.json", json.dumps(sorted(manifest, key=lambda a: a["url"]), indent=2) + "\n")
    write(ROOT / "src/import-baseline.json", json.dumps({
        'origin': ORIGIN, 'importedAt': '2026-10-28', 'bundleId': BUNDLE,
        'scenes': baselines,
    }, indent=2) + '\n')
    write(ROOT / 'src/content/links.json', json.dumps([
        {'original': url, 'url': url} for url in sorted(all_links)
    ], ensure_ascii=False, indent=2) + '\n')
    print(f"Imported {len(pages)} pages, {len(manifest)} resources; {sum(a['bytes'] for a in manifest):,} bytes.")


if __name__ == "__main__":
    main()
