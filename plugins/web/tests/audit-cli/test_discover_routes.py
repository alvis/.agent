"""Verify Next.js source-route discovery against the fixture tree."""

from pathlib import Path

from audit_cli.discover.routes import DYNAMIC_WARNING, discover_source_routes

_FIXTURE = Path(__file__).parent / "fixtures" / "nextjs_tree"


def test_nextjs_fixture_returns_expected_paths() -> None:
    routes = discover_source_routes(_FIXTURE)
    paths = [route.path for route in routes]
    assert paths == ["/", "/admin", "/products/sample-slug"]


def test_dynamic_route_is_flagged_with_warning() -> None:
    routes = discover_source_routes(_FIXTURE)
    dynamic = [route for route in routes if route.path == "/products/sample-slug"]
    assert len(dynamic) == 1
    assert dynamic[0].warning == DYNAMIC_WARNING


def test_static_routes_have_no_warning() -> None:
    routes = discover_source_routes(_FIXTURE)
    static = [route for route in routes if route.path in {"/", "/admin"}]
    assert all(route.warning is None for route in static)


def test_missing_project_path_returns_empty() -> None:
    assert discover_source_routes(_FIXTURE.parent / "does-not-exist") == []


def test_nextjs_src_app_tree_is_discovered(tmp_path: Path) -> None:
    (tmp_path / "next.config.ts").write_text("export default {};\n")
    app_dir = tmp_path / "src" / "app"
    (app_dir / "page.tsx").parent.mkdir(parents=True, exist_ok=True)
    (app_dir / "page.tsx").write_text("export default function Page() { return null; }\n")
    (app_dir / "blog" / "[slug]" / "page.tsx").parent.mkdir(parents=True, exist_ok=True)
    (app_dir / "blog" / "[slug]" / "page.tsx").write_text(
        "export default function BlogPage() { return null; }\n"
    )
    (app_dir / "(marketing)" / "pricing" / "page.tsx").parent.mkdir(
        parents=True, exist_ok=True
    )
    (app_dir / "(marketing)" / "pricing" / "page.tsx").write_text(
        "export default function PricingPage() { return null; }\n"
    )

    routes = discover_source_routes(tmp_path)

    paths = sorted(route.path for route in routes)
    assert paths == ["/", "/blog/sample-slug", "/pricing"]

    dynamic = [route for route in routes if route.path == "/blog/sample-slug"]
    assert len(dynamic) == 1
    assert dynamic[0].warning == DYNAMIC_WARNING
