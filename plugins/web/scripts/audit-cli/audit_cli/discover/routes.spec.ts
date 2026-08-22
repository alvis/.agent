import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { DYNAMIC_WARNING, discoverSourceRoutes } from "./routes";

const fixture = fileURLToPath(
  new URL("../../../../tests/audit-cli/fixtures/nextjs_tree", import.meta.url),
);

describe("source route discovery", () => {
  it("returns expected fixture paths", () => {
    const routes = discoverSourceRoutes(fixture);
    expect(routes.map((route) => route.path)).toEqual([
      "/",
      "/admin",
      "/products/sample-slug",
    ]);
  });

  it("marks dynamic routes with a warning", () => {
    const routes = discoverSourceRoutes(fixture);
    expect(
      routes.find((route) => route.path === "/products/sample-slug")?.warning,
    ).toBe(DYNAMIC_WARNING);
  });

  it("leaves static routes without warnings", () => {
    const routes = discoverSourceRoutes(fixture);
    expect(
      routes
        .filter((route) => route.path === "/" || route.path === "/admin")
        .every((route) => route.warning === null),
    ).toBe(true);
  });

  it("returns no routes for a missing project", () => {
    expect(discoverSourceRoutes(join(fixture, "does-not-exist"))).toEqual([]);
  });

  it("discovers routes from a Next.js src/app tree", () => {
    const project = mkdtempSync(join(tmpdir(), "audit-routes-"));
    try {
      writeFileSync(join(project, "next.config.ts"), "export default {};\n");
      const app = join(project, "src", "app");
      mkdirSync(join(app, "blog", "[slug]"), { recursive: true });
      mkdirSync(join(app, "(marketing)", "pricing"), { recursive: true });
      writeFileSync(
        join(app, "page.tsx"),
        "export default function Page() { return null; }\n",
      );
      writeFileSync(
        join(app, "blog", "[slug]", "page.tsx"),
        "export default function BlogPage() { return null; }\n",
      );
      writeFileSync(
        join(app, "(marketing)", "pricing", "page.tsx"),
        "export default function PricingPage() { return null; }\n",
      );

      const routes = discoverSourceRoutes(project);
      const paths = routes.map((route) => route.path).sort();
      expect(paths).toEqual(["/", "/blog/sample-slug", "/pricing"]);
      const dynamic = routes.filter(
        (route) => route.path === "/blog/sample-slug",
      );
      expect(dynamic).toHaveLength(1);
      expect(dynamic[0]?.warning).toBe(DYNAMIC_WARNING);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it("discovers Next pages routes while skipping API and private files", () => {
    const project = mkdtempSync(join(tmpdir(), "audit-pages-"));
    try {
      writeFileSync(join(project, "next.config.js"), "opaque config marker");
      mkdirSync(join(project, "pages", "products", "[id]"), {
        recursive: true,
      });
      writeFileSync(join(project, "pages", "index.tsx"), "opaque page marker");
      writeFileSync(
        join(project, "pages", "products", "[id]", "index.tsx"),
        "opaque page marker",
      );
      writeFileSync(
        join(project, "pages", "_app.tsx"),
        "opaque private marker",
      );
      mkdirSync(join(project, "pages", "api"), { recursive: true });
      writeFileSync(
        join(project, "pages", "api", "health.ts"),
        "opaque api marker",
      );

      const routes = discoverSourceRoutes(project);

      expect(routes.map((route) => route.path)).toEqual([
        "/",
        "/products/sample-slug",
      ]);
      expect(routes[1]?.framework).toBe("nextjs-pages");
      expect(routes[1]?.warning).toBe(DYNAMIC_WARNING);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it("discovers React Router declarations and normalizes dynamic and splat paths", () => {
    const project = mkdtempSync(join(tmpdir(), "audit-vite-"));
    try {
      writeFileSync(join(project, "vite.config.ts"), "opaque config marker");
      writeFileSync(
        join(project, "package.json"),
        '{"dependencies":{"react-router-dom":"x"}}',
      );
      mkdirSync(join(project, "src"), { recursive: true });
      writeFileSync(
        join(project, "src", "routes.tsx"),
        '<Route path="/products/:id" /><Route path="/docs/*" /> const route = { path: "/about/" };',
      );

      const routes = discoverSourceRoutes(project);

      expect(routes.map((route) => route.path)).toEqual([
        "/products/sample-slug",
        "/docs/sample-slug",
        "/about",
      ]);
      expect(routes.every((route) => route.framework === "vite-rr")).toBe(true);
      expect(
        routes.slice(0, 2).every((route) => route.warning === DYNAMIC_WARNING),
      ).toBe(true);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it("terminates deterministically when a source tree contains a symlink cycle", () => {
    const project = mkdtempSync(join(tmpdir(), "audit-routes-cycle-"));
    try {
      writeFileSync(join(project, "next.config.js"), "opaque config marker");
      const app = join(project, "app");
      mkdirSync(app, { recursive: true });
      writeFileSync(join(app, "page.tsx"), "opaque page marker");
      symlinkSync(app, join(app, "cycle"), "dir");

      expect(
        discoverSourceRoutes(project).map((route) => route.path),
      ).toEqual(["/"]);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});
