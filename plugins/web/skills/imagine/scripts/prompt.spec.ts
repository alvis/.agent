import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ImagineError } from "./providers/base";
import {
  PROMPT_FIELDS,
  _augment_prompt,
  _augment_prompt_fields,
  _fields_from_args,
  _read_prompt,
} from "./prompt";

describe("Imagine prompt contracts", () => {
  const roots: string[] = [];
  afterEach(async () => {
    for (const root of roots.splice(0))
      await rm(root, { recursive: true, force: true });
  });

  it("enforces prompt source exclusivity and trims prompt files", async () => {
    const root = await mkdtemp(join(tmpdir(), "imagine-prompt-"));
    roots.push(root);
    const file = join(root, "prompt.txt");
    await writeFile(file, "  opaque prompt source  \n");

    expect(_read_prompt("  direct prompt  ", null)).toBe("direct prompt");
    expect(_read_prompt(null, file)).toBe("opaque prompt source");
    expect(() => _read_prompt("direct", file)).toThrow(ImagineError);
    expect(() => _read_prompt(null, join(root, "missing.txt"))).toThrow(
      "Prompt file not found",
    );
    expect(() => _read_prompt(null, null)).toThrow("Missing prompt");
  });

  it("extracts every declared prompt field and augments in stable order", () => {
    const args = {
      augment: true,
      use_case: "marketing",
      scene: "studio",
      subject: "product",
      style: "editorial",
      composition: "centered",
      lighting: "soft",
      palette: "blue",
      materials: "glass",
      text: "opaque label",
      constraints: "clean",
      negative: "noise",
    };
    expect(Object.keys(_fields_from_args(args))).toEqual([...PROMPT_FIELDS]);
    expect(_augment_prompt(args, "opaque request")).toBe(
      [
        "Use case: marketing",
        "Primary request: opaque request",
        "Scene/background: studio",
        "Subject: product",
        "Style/medium: editorial",
        "Composition/framing: centered",
        "Lighting/mood: soft",
        "Color palette: blue",
        "Materials/textures: glass",
        'Text (verbatim): "opaque label"',
        "Constraints: clean",
        "Avoid: noise",
      ].join("\n"),
    );
  });

  it("keeps references under no-augment and omits empty fields", () => {
    const fields = { scene: "", text: "", style: "editorial" };
    expect(
      _augment_prompt_fields(false, "opaque request", fields, {
        references: ["opaque-reference.bin"],
      }),
    ).toBe(
      [
        "Style reference: use the provided reference image(s) to guide the visual style, color palette, and texture of the output.",
        "opaque request",
      ].join("\n"),
    );
    expect(_augment_prompt_fields(true, "request", fields)).toBe(
      ["Primary request: request", "Style/medium: editorial"].join("\n"),
    );
  });
});
