import { join } from "node:path";

import { discoverPluginAgents, main, tally } from "./analyze_agent_usage.ts";
import {
  createTemporaryDirectory,
  removeTemporaryDirectory,
  writeFixture,
} from "./test-support.ts";

describe("fn:tally", () => {
  it("should map unqualified installed agent usage to its unique owner", () => {
    const defined = new Map([
      ["web:frontend-implementer", {
        agent: "frontend-implementer",
        path: "frontmatter.json",
        plugin: "web",
      }],
    ]);
    const invocation = {
      agent: "frontend-implementer",
      canonicalId: "frontend-implementer",
      plugin: "built-in",
      sessionId: "session",
      sourceFile: "session.jsonl",
      timestamp: undefined,
    };

    const stats = tally([invocation], defined, 1);

    expect(stats.tallies.get("web:frontend-implementer")?.count).toBe(1);
    expect(stats.tallies.has("frontend-implementer")).toBe(false);
  });
});

describe("fn:discoverPluginAgents", () => {
  it("should discover distributed agent metadata by owner", async () => {
    const root = await createTemporaryDirectory("agent-usage-");
    try {
      const metadata = await writeFixture(
        root,
        "plugins/web/agents/frontend-implementer/frontmatter/meta.json",
        JSON.stringify({ name: "frontend-implementer" }),
      );

      const agents = await discoverPluginAgents(join(root, "plugins"));

      expect([...agents.keys()]).toEqual(["web:frontend-implementer"]);
      expect(agents.get("web:frontend-implementer")?.path).toBe(metadata);
    } finally {
      await removeTemporaryDirectory(root);
    }
  });

  it("should ignore malformed or nameless frontmatter and a missing root", async () => {
    const root = await createTemporaryDirectory("agent-usage-");
    try {
      await writeFixture(root, "plugins/web/agents/malformed/frontmatter/meta.json", "{");
      await writeFixture(root, "plugins/web/agents/nameless/frontmatter/meta.json", "{}");

      expect(await discoverPluginAgents(join(root, "plugins"))).toEqual(new Map());
      expect(await discoverPluginAgents(join(root, "missing"))).toEqual(new Map());
    } finally {
      await removeTemporaryDirectory(root);
    }
  });
});

describe("fn:main argument parsing", () => {
  it("should reject a non-integer --top value with exit code 2", () => {
    expect(main(["--top", "abc"])).toBe(2);
  });

  it("should accept the inline = form of value options like argparse did", async () => {
    const root = await createTemporaryDirectory("agent-usage-args-");
    try {
      expect(await main(["--top=3", "--projects", root])).toBe(0);
    } finally {
      await removeTemporaryDirectory(root);
    }
  });

  it("should reject non-integer values in both forms for every numeric option", () => {
    expect(main(["--top=not-a-number"])).toBe(2);
    expect(main(["--show-unused-agents", "soon"])).toBe(2);
    expect(main(["--show-unused-agents=later"])).toBe(2);
    expect(main(["--top="])).toBe(2);
  });

  it("should reject an unrecognized argument with exit code 2", () => {
    expect(main(["--bogus"])).toBe(2);
  });

  it("should reject a value option without its value with exit code 2", () => {
    expect(main(["--top"])).toBe(2);
  });

  it("should accept --json as a standalone flag", async () => {
    const root = await createTemporaryDirectory("agent-usage-json-");
    try {
      expect(await main(["--json", "--projects", root, "--plugins", root])).toBe(0);
    } finally {
      await removeTemporaryDirectory(root);
    }
  });
});
