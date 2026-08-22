import { createServer } from "node:http";

import { fetchSitemapUrls } from "./sitemap";

describe("sitemap and robots discovery", () => {
  it("returns an explicit error for an invalid base URL", async () => {
    await expect(
      Promise.resolve(fetchSitemapUrls("not-a-url")),
    ).resolves.toEqual({
      urls: [],
      sitemaps_tried: [],
      errors: ["invalid base URL"],
    });
  });

  it("collects same-host URLs from robots, nested sitemaps, and the default sitemap", async () => {
    const server = createServer((request, response) => {
      response.setHeader("content-type", "application/xml");
      if (request.url === "/robots.txt") {
        response.setHeader("content-type", "text/plain");
        response.end(
          `Sitemap: http://127.0.0.1:${server.address()?.port}/custom.xml\n`,
        );
      } else if (request.url === "/custom.xml") {
        response.end(
          `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>http://127.0.0.1:${server.address()?.port}/nested.xml</loc></sitemap></sitemapindex>`,
        );
      } else if (request.url === "/nested.xml") {
        response.end(
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>http://127.0.0.1:${server.address()?.port}/nested/</loc></url><url><loc>https://foreign.example/nope</loc></url></urlset>`,
        );
      } else {
        response.end(
          `<sm:urlset xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9"><sm:url><sm:loc>http://127.0.0.1:${server.address()?.port}/home</sm:loc></sm:url><sm:url><sm:loc>http://127.0.0.1:${server.address()?.port}/home</sm:loc></sm:url></sm:urlset>`,
        );
      }
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("server did not bind");

    try {
      const result = await fetchSitemapUrls(
        `http://127.0.0.1:${address.port}/`,
      );
      expect(result.urls).toEqual([
        `http://127.0.0.1:${address.port}/home`,
        `http://127.0.0.1:${address.port}/nested/`,
      ]);
      expect(result.urls).not.toContain("https://foreign.example/nope");
      expect(result.sitemaps_tried).toEqual(
        expect.arrayContaining([
          `http://127.0.0.1:${address.port}/sitemap.xml`,
          `http://127.0.0.1:${address.port}/custom.xml`,
        ]),
      );
      expect(result.errors).toEqual([]);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("swallows unreachable sitemap and robots endpoints", async () => {
    const result = await fetchSitemapUrls("http://127.0.0.1:1/");

    expect(result.urls).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.sitemaps_tried).toEqual(["http://127.0.0.1:1/sitemap.xml"]);
  });

  it("reports malformed XML while continuing discovery", async () => {
    const server = createServer((_request, response) =>
      response.end("<not-xml"),
    );
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("server did not bind");

    try {
      const result = await fetchSitemapUrls(
        `http://127.0.0.1:${address.port}`,
      );
      expect(result.urls).toEqual([]);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("parse error at");
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("rejects malformed inner XML under an otherwise valid sitemap root", async () => {
    const server = createServer((_request, response) =>
      response.end(
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>http://127.0.0.1/one</url></urlset>',
      ),
    );
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("server did not bind");

    try {
      const result = await fetchSitemapUrls(
        `http://127.0.0.1:${address.port}/`,
      );
      expect(result.urls).toEqual([]);
      expect(result.errors).toEqual([expect.stringContaining("malformed XML")]);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it.each([
    ["decimal out of range", "&#1114112;"],
    ["hex out of range", "&#x110000;"],
    ["surrogate", "&#xD800;"],
    ["decimal zero", "&#0;"],
    ["hex zero", "&#x0;"],
    ["invalid numeric syntax", "&#xZZ;"],
  ])(
    "returns a controlled malformed result for %s XML references",
    async (_label, reference) => {
      const server = createServer((_request, response) =>
        response.end(
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/item?ref=${reference}</loc></url></urlset>`,
        ),
      );
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("server did not bind");

      try {
        const resultPromise = fetchSitemapUrls(
          `http://127.0.0.1:${address.port}/`,
        );
        await expect(resultPromise).resolves.not.toBeNull();
        const result = await resultPromise;
        expect(result.urls).toEqual([]);
        expect(result.errors).toHaveLength(1);
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
    },
  );

  it("rejects a raw less-than character in ordinary loc text", async () => {
    const server = createServer((_request, response) =>
      response.end(
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>http://127.0.0.1/a?x=<&amp;</loc></url></urlset>',
      ),
    );
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("server did not bind");

    try {
      const result = await fetchSitemapUrls(
        `http://127.0.0.1:${address.port}/`,
      );
      expect(result.urls).toEqual([]);
      expect(result.errors).toHaveLength(1);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it.each([
    ["&amp;#1114112;", "&#1114112;"],
    ["&amp;lt;", "&lt;"],
  ])(
    "decodes escaped XML entities exactly once (%s)",
    async (encoded, decoded) => {
      const server = createServer((_request, response) =>
        response.end(
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>http://127.0.0.1:${server.address()?.port}/item?ref=${encoded}</loc></url></urlset>`,
        ),
      );
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("server did not bind");

      try {
        const result = await fetchSitemapUrls(
          `http://127.0.0.1:${address.port}/`,
        );
        expect(result).toMatchObject({
          urls: [`http://127.0.0.1:${address.port}/item?ref=${decoded}`],
          errors: [],
        });
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
    },
  );

  it.each(["a?x=&lt;", "a?x=&#1114112;", "a?x=<"])(
    "preserves literal entity-looking CDATA text (%s)",
    async (suffix) => {
      const server = createServer((_request, response) =>
        response.end(
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc><![CDATA[http://127.0.0.1:${server.address()?.port}/${suffix}]]></loc></url></urlset>`,
        ),
      );
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("server did not bind");

      try {
        const location = `http://127.0.0.1:${address.port}/${suffix}`;
        const result = await fetchSitemapUrls(
          `http://127.0.0.1:${address.port}/`,
        );
        expect(result).toMatchObject({ urls: [location], errors: [] });
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
    },
  );
});
