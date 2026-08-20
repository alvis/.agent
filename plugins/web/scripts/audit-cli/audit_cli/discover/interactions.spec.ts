import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  discoverHoverTargets,
  discoverInteractions,
  DiscoverOptions,
} from "./interactions";
import { readJson } from "../../test-support-lane2";

const fixtures = fileURLToPath(
  new URL("../../../../tests/audit-cli/fixtures/", import.meta.url),
);

describe("interaction discovery", () => {
  it("deduplicates identical buttons", async () => {
    const snapshot = await readJson<Record<string, unknown>>(
      join(fixtures, "ax_snapshot_dup_buttons.json"),
    );
    const plan = discoverInteractions(snapshot);
    expect(
      plan.candidates.map((candidate) => [candidate.role, candidate.name]),
    ).toEqual([["button", "Add to cart"]]);
  });

  it("drops social links and retains non-denylisted cross-origin links", async () => {
    const snapshot = await readJson<Record<string, unknown>>(
      join(fixtures, "ax_snapshot_with_social.json"),
    );
    const plan = discoverInteractions(snapshot);
    expect(plan.dropped_social).toContain("https://x.com/example");
    expect(plan.candidates.some((candidate) => candidate.role === "link")).toBe(
      false,
    );
    expect(plan.cross_origin_candidates).toContain("https://partner.com/login");
  });

  it("retains link candidates in all-pages mode", async () => {
    const snapshot = await readJson<Record<string, unknown>>(
      join(fixtures, "ax_snapshot_with_social.json"),
    );
    const plan = discoverInteractions(
      snapshot,
      new DiscoverOptions({ all_pages: true }),
    );
    const links = plan.candidates.filter(
      (candidate) => candidate.role === "link",
    );
    expect(links.some((candidate) => candidate.name === "Partner portal")).toBe(
      true,
    );
    expect(links.some((candidate) => candidate.name === "Follow on X")).toBe(
      false,
    );
  });

  it("discovers refs-shaped candidates and hover targets", () => {
    const snapshot = {
      refs: {
        e17: { name: "Open menu", role: "button" },
        e18: { name: "Overview", role: "link" },
      },
      snapshot: '- button "Open menu" [ref=e17]\\n- link "Overview" [ref=e18]',
    };
    expect(
      discoverInteractions(snapshot).candidates.map((candidate) => [
        candidate.uid,
        candidate.role,
        candidate.name,
      ]),
    ).toEqual([[17, "button", "Open menu"]]);
    expect(discoverHoverTargets(snapshot)).toEqual([17, 18]);
  });

  it("excludes same-origin links outside all-pages mode", () => {
    const snapshot = {
      refs: {
        e4: { name: "Open navigation menu", role: "button" },
        e5: { name: "Overview", role: "link", url: "http://127.0.0.1:3200/" },
        e6: {
          name: "Company",
          role: "link",
          url: "http://127.0.0.1:3200/about",
        },
        e7: {
          name: "Careers",
          role: "link",
          url: "http://127.0.0.1:3200/careers",
        },
      },
    };

    const plan = discoverInteractions(
      snapshot,
      new DiscoverOptions({
        all_pages: false,
        same_origin_host: "127.0.0.1:3200",
      }),
    );

    expect(
      plan.candidates.map((candidate) => [candidate.role, candidate.name]),
    ).toEqual([["button", "Open navigation menu"]]);
  });

  it("ignores Next.js dev tools in discovery and hover targets", () => {
    const snapshot = {
      refs: {
        e4: { name: "Open navigation menu", role: "button" },
        e35: { name: "Open Next.js Dev Tools", role: "button" },
      },
    };
    expect(
      discoverInteractions(snapshot).candidates.map((candidate) => [
        candidate.uid,
        candidate.name,
      ]),
    ).toEqual([[4, "Open navigation menu"]]);
    expect(discoverHoverTargets(snapshot)).toEqual([4]);
  });

  it("keeps cross-origin candidates only when all-pages mode is enabled", () => {
    const snapshot = {
      nodes: [
        {
          uid: 1,
          role: "link",
          name: "Partner",
          url: "https://partner.example/login",
        },
        {
          uid: 2,
          role: "link",
          name: "Social",
          url: "https://www.x.com/example",
        },
      ],
    };

    const plan = discoverInteractions(
      snapshot,
      new DiscoverOptions({ all_pages: true, same_origin_host: "example.com" }),
    );

    expect(plan.cross_origin_candidates).toEqual([
      "https://partner.example/login",
    ]);
    expect(plan.dropped_social).toEqual(["https://www.x.com/example"]);
    expect(plan.candidates.map((candidate) => candidate.uid)).toEqual([1]);
  });

  it("deduplicates by normalized role, name, expansion, and ancestors while preserving order", () => {
    const snapshot = {
      nodes: [
        {
          uid: 1,
          role: "BUTTON",
          name: " Save ",
          expanded: false,
          ancestors: [["toolbar", "Main"]],
        },
        {
          uid: 2,
          role: "button",
          name: "save",
          expanded: false,
          ancestors: [["toolbar", "Main"]],
        },
        {
          uid: 3,
          role: "button",
          name: "Save",
          expanded: true,
          ancestors: [["toolbar", "Main"]],
        },
      ],
    };

    const plan = discoverInteractions(snapshot);

    expect(plan.candidates.map((candidate) => candidate.uid)).toEqual([1, 3]);
    expect(plan.candidates[0]?.fingerprint).toEqual(expect.any(String));
    expect(plan.candidates[1]?.fingerprint).toEqual(expect.any(String));
    expect(plan.candidates[0]?.fingerprint).not.toBe(
      plan.candidates[1]?.fingerprint,
    );
  });

  it("returns empty plans and hover targets for malformed snapshots", () => {
    for (const snapshot of [
      {},
      { nodes: null, refs: ["not-a-node"] },
      {
        nodes: [
          { uid: "e1", role: "button" },
          null,
          { uid: 0, role: "unknown" },
        ],
      },
    ]) {
      expect(discoverInteractions(snapshot)).toEqual({
        candidates: [],
        cross_origin_candidates: [],
        dropped_social: [],
      });
      expect(discoverHoverTargets(snapshot)).toEqual([]);
    }
  });
});
