"""Discover routes from a source tree by framework auto-detection.

Pure function — given a project path, inspect marker files and walk the
matching route directory. Dynamic segments are substituted with a sample
placeholder and flagged with a per-route warning.
"""

from __future__ import annotations

import re
from pathlib import Path

from audit_cli.types import Route

DYNAMIC_PLACEHOLDER = "sample-slug"
DYNAMIC_WARNING = "dynamic route — supply real id via --seeds"

_NEXT_DYNAMIC_RE = re.compile(r"\[\.\.\.?([^\]]+)\]|\[([^\]]+)\]")
_SVELTE_DYNAMIC_RE = re.compile(r"\[([^\]]+)\]")
_VITE_ROUTE_RE = re.compile(r"""<Route\s+[^>]*path\s*=\s*["']([^"']+)["']""")
_RR_OBJECT_PATH_RE = re.compile(r"""path\s*:\s*["']([^"']+)["']""")


def discover_source_routes(project_path: str | Path) -> list[Route]:
    """Return source-derived routes for the given project root.

    Inspects marker files to detect supported frameworks and unions the
    discovered routes across every detected framework.
    """
    root = Path(project_path)
    routes: list[Route] = []

    if _has_marker(root, ("next.config.js", "next.config.mjs", "next.config.ts", "next.config.cjs")):
        routes.extend(_walk_nextjs(root))

    if _has_marker(root, ("vite.config.js", "vite.config.ts", "vite.config.mjs")) and _pkg_has_dep(
        root, "react-router-dom"
    ):
        routes.extend(_walk_vite_react_router(root))

    if _has_marker(root, ("remix.config.js", "remix.config.cjs", "remix.config.mjs")) or _pkg_has_dep(
        root, "@remix-run/react"
    ):
        routes.extend(_walk_remix(root))

    if _has_marker(root, ("svelte.config.js", "svelte.config.ts")) and _pkg_has_dep(
        root, "@sveltejs/kit"
    ):
        routes.extend(_walk_sveltekit(root))

    if _has_marker(root, ("astro.config.mjs", "astro.config.js", "astro.config.ts")):
        routes.extend(_walk_astro(root))

    if _has_marker(root, ("nuxt.config.js", "nuxt.config.ts")):
        routes.extend(_walk_nuxt(root))

    if not routes and (root / "index.html").is_file():
        routes.extend(_walk_static_html(root))

    return _dedupe_preserve_order(routes)


def _has_marker(root: Path, names: tuple[str, ...]) -> bool:
    return any((root / name).is_file() for name in names)


def _pkg_has_dep(root: Path, dep: str) -> bool:
    pkg = root / "package.json"
    if not pkg.is_file():
        return False
    text = pkg.read_text(encoding="utf-8", errors="ignore")
    return f'"{dep}"' in text


def _walk_nextjs(root: Path) -> list[Route]:
    routes: list[Route] = []
    for app_dir in (root / "app", root / "src" / "app"):
        if not app_dir.is_dir():
            continue
        for page in sorted(app_dir.rglob("page.*")):
            if page.suffix not in {".tsx", ".ts", ".jsx", ".js"}:
                continue
            rel = page.relative_to(app_dir).parent
            segments = [s for s in rel.parts if not _is_route_group(s)]
            path = "/" + "/".join(_substitute_dynamic(s) for s in segments)
            path = path.rstrip("/") or "/"
            warning = DYNAMIC_WARNING if _has_dynamic(rel.parts) else None
            routes.append(Route(path=path, source_file=str(page), framework="nextjs", warning=warning))

    for pages_dir in (root / "pages", root / "src" / "pages"):
        if not pages_dir.is_dir():
            continue
        for page in sorted(pages_dir.rglob("*")):
            if page.suffix not in {".tsx", ".ts", ".jsx", ".js"} or not page.is_file():
                continue
            if page.name.startswith("_"):
                continue
            if page.name.startswith("api") or "api" in page.relative_to(pages_dir).parts:
                continue
            rel = page.relative_to(pages_dir).with_suffix("")
            parts = list(rel.parts)
            if parts and parts[-1] == "index":
                parts.pop()
            segments = [_substitute_dynamic(p) for p in parts]
            path = "/" + "/".join(segments)
            path = path.rstrip("/") or "/"
            warning = DYNAMIC_WARNING if _has_dynamic(rel.parts) else None
            routes.append(Route(path=path, source_file=str(page), framework="nextjs-pages", warning=warning))

    return routes


def _walk_vite_react_router(root: Path) -> list[Route]:
    routes: list[Route] = []
    src = root / "src"
    if not src.is_dir():
        return routes
    for source in sorted(src.rglob("*")):
        if source.suffix not in {".tsx", ".ts", ".jsx", ".js"} or not source.is_file():
            continue
        text = source.read_text(encoding="utf-8", errors="ignore")
        for match in _VITE_ROUTE_RE.findall(text):
            path = _normalise_router_path(match)
            warning = DYNAMIC_WARNING if ":" in match or "*" in match else None
            routes.append(Route(path=path, source_file=str(source), framework="vite-rr", warning=warning))
        for match in _RR_OBJECT_PATH_RE.findall(text):
            if not match.startswith("/"):
                continue
            path = _normalise_router_path(match)
            warning = DYNAMIC_WARNING if ":" in match or "*" in match else None
            routes.append(Route(path=path, source_file=str(source), framework="vite-rr", warning=warning))
    return routes


def _walk_remix(root: Path) -> list[Route]:
    routes: list[Route] = []
    app_routes = root / "app" / "routes"
    if not app_routes.is_dir():
        return routes
    for source in sorted(app_routes.rglob("*")):
        if source.suffix not in {".tsx", ".ts", ".jsx", ".js"} or not source.is_file():
            continue
        rel = source.relative_to(app_routes).with_suffix("")
        flat = rel.as_posix().replace(".", "/")
        segments = flat.split("/")
        if segments and segments[-1] == "index":
            segments.pop()
        normalised = [_substitute_dynamic(s.replace("$", "[") + "]" if s.startswith("$") else s) for s in segments]
        path = "/" + "/".join(normalised)
        path = path.rstrip("/") or "/"
        warning = DYNAMIC_WARNING if any(s.startswith("$") for s in segments) else None
        routes.append(Route(path=path, source_file=str(source), framework="remix", warning=warning))
    return routes


def _walk_sveltekit(root: Path) -> list[Route]:
    routes: list[Route] = []
    src = root / "src" / "routes"
    if not src.is_dir():
        return routes
    for page in sorted(src.rglob("+page.svelte")):
        rel = page.relative_to(src).parent
        segments = [_substitute_dynamic(s) for s in rel.parts]
        path = "/" + "/".join(segments)
        path = path.rstrip("/") or "/"
        warning = DYNAMIC_WARNING if _SVELTE_DYNAMIC_RE.search(rel.as_posix()) else None
        routes.append(Route(path=path, source_file=str(page), framework="sveltekit", warning=warning))
    return routes


def _walk_astro(root: Path) -> list[Route]:
    routes: list[Route] = []
    src = root / "src" / "pages"
    if not src.is_dir():
        return routes
    for source in sorted(src.rglob("*")):
        if source.suffix not in {".astro", ".md", ".mdx", ".html"} or not source.is_file():
            continue
        rel = source.relative_to(src).with_suffix("")
        parts = list(rel.parts)
        if parts and parts[-1] == "index":
            parts.pop()
        segments = [_substitute_dynamic(p) for p in parts]
        path = "/" + "/".join(segments)
        path = path.rstrip("/") or "/"
        warning = DYNAMIC_WARNING if _has_dynamic(rel.parts) else None
        routes.append(Route(path=path, source_file=str(source), framework="astro", warning=warning))
    return routes


def _walk_nuxt(root: Path) -> list[Route]:
    routes: list[Route] = []
    src = root / "pages"
    if not src.is_dir():
        return routes
    for source in sorted(src.rglob("*.vue")):
        rel = source.relative_to(src).with_suffix("")
        parts = list(rel.parts)
        if parts and parts[-1] == "index":
            parts.pop()
        segments = [_substitute_dynamic(p) for p in parts]
        path = "/" + "/".join(segments)
        path = path.rstrip("/") or "/"
        warning = DYNAMIC_WARNING if any(p.startswith("_") or _has_dynamic((p,)) for p in rel.parts) else None
        routes.append(Route(path=path, source_file=str(source), framework="nuxt", warning=warning))
    return routes


def _walk_static_html(root: Path) -> list[Route]:
    routes: list[Route] = []
    for source in sorted(root.rglob("*.html")):
        rel = source.relative_to(root)
        if rel.name == "index.html" and rel.parent == Path("."):
            routes.append(Route(path="/", source_file=str(source), framework="static"))
            continue
        rel_no_ext = rel.with_suffix("")
        segments = list(rel_no_ext.parts)
        if segments and segments[-1] == "index":
            segments.pop()
        path = "/" + "/".join(segments)
        path = path.rstrip("/") or "/"
        routes.append(Route(path=path, source_file=str(source), framework="static"))
    return routes


def _is_route_group(segment: str) -> bool:
    return segment.startswith("(") and segment.endswith(")")


def _has_dynamic(parts: tuple[str, ...]) -> bool:
    return any(p.startswith("[") and p.endswith("]") for p in parts)


def _substitute_dynamic(segment: str) -> str:
    if segment.startswith("[") and segment.endswith("]"):
        return DYNAMIC_PLACEHOLDER
    return segment


def _normalise_router_path(raw: str) -> str:
    path = raw
    path = re.sub(r":([A-Za-z_][A-Za-z0-9_]*)\??", DYNAMIC_PLACEHOLDER, path)
    path = path.replace("*", DYNAMIC_PLACEHOLDER)
    if not path.startswith("/"):
        path = "/" + path
    path = path.rstrip("/") or "/"
    return path


def _dedupe_preserve_order(routes: list[Route]) -> list[Route]:
    seen: set[str] = set()
    out: list[Route] = []
    for route in routes:
        if route.path in seen:
            continue
        seen.add(route.path)
        out.append(route)
    return out
