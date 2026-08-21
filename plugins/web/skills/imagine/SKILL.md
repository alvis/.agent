---
name: imagine
description: "Generate or edit images through the bundled multi-provider CLI, or write structured prompts and analyze visual styles from references. Use for concept art, product shots, covers, UI assets, transparent or vector output, inpainting, background changes, batch variants, and prompt-only work. Keep image generation separate from web design decisions and visual audits."
requirements:
  intelligence: medium
argument-hint: "[prompt, instruction, or reference image for style analysis]"
---

# Image generation

Set `WEB_IMAGINE_SKILL_DIR` to the absolute directory containing this loaded
`SKILL.md` before invoking its script.

Generate or edit images for the current project — website assets, game assets, UI mockups, product mockups, wireframes, logos, photorealistic images, infographics. Defaults to **Google Gemini** (`gemini-3.1-flash-image-preview`), with **OpenAI** (`gpt-image-1.5`) via `--provider openai` and **Recraft** (`recraftv4`) via `--provider recraft`. Prefer the bundled CLI for deterministic, reproducible runs. `design` owns web design decisions; `audit` owns visual audits.

## Boundaries

- Use for: generating new images (concept art, product shots, covers, website heroes); editing existing images (inpainting, masked edits, lighting or weather transformations, background replacement, object removal, compositing, transparent background); style-guided generation or editing from a reference image (`--reference`); batch runs; crafting or refining a structured image prompt without producing an image; analyzing or extracting a reusable visual style from a reference image.
- Do not use for: web design direction or page layout decisions (`design`) and visual quality audits (`audit`).

<IMPORTANT>
Never modify `scripts/image-gen.ts` or files under `scripts/providers/`. If something is missing, ask the user before doing anything else. Never ask the user to paste an API key in chat — ask them to set it locally and confirm when ready.
</IMPORTANT>

## Inputs

- **Required**: a prompt, an edit instruction with an input image, or a reference image for style analysis.
- **Optional**: reference image(s) for style matching, mask for inpainting, provider/model flags, batch prompt list. All image inputs (`--image`, `--mask`, `--reference`) accept local file paths and `https://` URLs.
- **Prerequisites**: Bun with package auto-install enabled and network access for inline latest-major imports. Google resolves `@google/genai@1`; OpenAI and Recraft resolve `openai@6`; format conversion and downscaling resolve `sharp@0.34` when needed.
  - Google (default): requires `GOOGLE_API_KEY` (create at <https://aistudio.google.com/apikey>)
  - OpenAI: requires `OPENAI_API_KEY` (create at <https://platform.openai.com/api-keys>)
  - Recraft: requires `RECRAFT_API_TOKEN` (create at <https://app.recraft.ai/profile/api>)

  If a key is missing, walk the user through creating it in the provider UI and setting the environment variable for their OS/shell. If Bun cannot resolve an inline import, name the package and major version plus the blocked registry or network prerequisite; do not add project dependencies.

Set the CLI path at the start of any generation workflow; all invocations below assume it:

```bash
export IMAGINE="${WEB_IMAGINE_SKILL_DIR}/scripts/image-gen.ts"
```

Run `bun "$IMAGINE" generate --help` to see all available params for the current provider.

## Provider and command selection

Provider — first match wins:

- Mask-based editing → `--provider openai`
- Transparent background control (`--background transparent`) → `--provider openai`
- Fine-grained quality/compression/fidelity control → `--provider openai`
- Named artistic styles (Illustration, Pop Art, etc.) → `--provider recraft`
- Custom style ID from reference images → `--provider recraft` with explicit V3 model (`recraftv3` or `recraftv3_vector`) — opt-in, not the default Recraft path
- Style-matched generation from reference images with other providers → analyze the reference visually and encode it as style prompt constraints
- Vector/SVG output → `--provider recraft` with a `_vector` model
- Specific exact pixel dimensions → `--provider recraft` (14+ size presets)
- Otherwise → Google (default, no `--provider` flag)

Command:

- Input image provided, or the user says "edit/retouch/inpaint/mask/translate/localize/change only X" → `generate --image`, e.g. `bun "$IMAGINE" generate --image input.png --prompt "Replace the background with a warm sunset gradient"`
- Reference style to apply → add `--reference`, e.g. `bun "$IMAGINE" generate --reference style.png --prompt "A man riding a motorcycle on a white background"`
- Many different prompts/assets → `generate-batch`
- Else → `generate`

Assume the user wants a new image unless they explicitly ask for an edit. Provider parameter tables live in [references/providers/google.md](references/providers/google.md), [references/providers/openai.md](references/providers/openai.md), and [references/providers/recraft.md](references/providers/recraft.md); CLI commands, flags, and recipes in [references/cli.md](references/cli.md).

## Workflow

1. **Ask for a reference image** — before anything else, ask whether the user has a reference image or style to match. Do not skip this step.
2. **Extract style** — if a reference is provided, determine the intended provider and model first, then follow [references/style-extraction.md](references/style-extraction.md): Recraft V3 models use `mcp__recraft__create_style` to obtain a `styleID`; all other models get a visually analyzed style prompt (medium, palette, texture, lighting, composition, mood, line quality, detail level) confirmed by the user. Describe the extracted style back to the user before proceeding.
3. **Decide provider + command** — use the selection rules above.
4. **Collect inputs** — gather prompt(s), exact text (verbatim), constraints/avoid list, and any input image(s)/mask(s). For multi-image edits, label each input by index and role; for edits, list invariants explicitly.
5. **Craft the structured prompt** — the primary deliverable; see the next section. Only make implicit details explicit; do not invent new requirements.
6. **Present the prompt for review** — show it to the user for approval. If the request is prompt-only, stop here and deliver the prompt.
7. **Execute** — run the bundled CLI (`bun "$IMAGINE" ...`) with sensible defaults, or Recraft MCP tools when working within Recraft's ecosystem (see the MCP Tools section of [references/providers/recraft.md](references/providers/recraft.md) for the tool table and the MCP-vs-CLI decision). For batch runs, write a temporary JSONL, run once, then delete. Remote inputs use per-run sibling directories in the system temporary directory with the `imagine_dl_*` prefix; write final artifacts under `output/imagine/` when working in this repo; use `--out` or `--out-dir` with stable, descriptive filenames.
8. **Inspect & iterate** — for complex edits/generations, inspect outputs and validate subject, style, composition, text accuracy, and invariants/avoid items. Make a single targeted change per iteration; only ask a question if a missing detail blocks success.
9. **Deliver** — save/return final outputs and note the final prompt + flags used.
10. Run the verification below; when a check fails, fix the cause (usually one targeted prompt or flag change) and re-run that check. Repeat until every check passes or a concrete blocker remains (missing key, unavailable dependency, provider rejection), then report the blocker instead of looping.

## Structured prompt spec

Classify each request into one of these use-case slugs and keep the slug consistent across prompts and references.

Generate:

- photorealistic-natural — candid/editorial lifestyle scenes with real texture and natural lighting.
- product-mockup — product/packaging shots, catalog imagery, merch concepts.
- ui-mockup — app/web interface mockups that look shippable.
- infographic-diagram — diagrams/infographics with structured layout and text.
- logo-brand — logo/mark exploration, vector-friendly.
- illustration-story — comics, children's book art, narrative scenes.
- stylized-concept — style-driven concept art, 3D/stylized renders.
- historical-scene — period-accurate/world-knowledge scenes.

Edit:

- text-localization — translate/replace in-image text, preserve layout.
- identity-preserve — try-on, person-in-scene; lock face/body/pose.
- precise-object-edit — remove/replace a specific element (incl. interior swaps).
- lighting-weather — time-of-day/season/atmosphere changes only.
- background-extraction — transparent background / clean cutout.
- style-transfer — apply reference style while changing subject/scene.
- compositing — multi-image insert/merge with matched lighting/perspective.
- sketch-to-render — drawing/line art to photoreal render.

Template (include only relevant lines; combined `Lighting/mood:` or separate `Lighting:` + `Vibe/mood:` lines are both accepted):

```
Use case: <taxonomy slug>
Asset type: <where the asset will be used>
Primary request: <user's main prompt>
Scene/background: <environment>
Subject: <main subject>
Style/medium: <photo/illustration/3D/etc>
Composition/framing: <wide/close/top-down; placement>
Lighting: <direction, quality, color temperature>
Vibe/mood: <emotional tone — nostalgic, dramatic, serene, ethereal, etc.>
Color palette: <palette notes>
Materials/textures: <surface details>
Quality: <low/medium/high/auto>
Input fidelity (edits): <low/high>
Text (verbatim): "<exact text>"
Constraints: <must keep/must avoid>
Avoid: <negative constraints>
```

Augmentation rules — augment, never invent:

- Keep it short; add only details the user already implied or provided elsewhere. "A hero image for a landing page" may gain implied layout constraints ("generous negative space on the right for headline text"); it may not gain a mascot, a new subject, or invented brand names/logos.
- Order the spec from global to local: scene/environment first, then subject framing, then fine details (lighting, camera, materials), then constraints/avoid. This reduces randomness in outputs.
- Tailor constraints/composition/quality to the taxonomy slug; use the slug to find the matching example in [references/sample-prompts.md](references/sample-prompts.md).
- If the user gives a broad request (e.g., "Generate images for this website"), propose tasteful, context-appropriate assets and map each to a slug.
- For edits, explicitly list invariants ("change only X; keep Y unchanged") and repeat them every iteration to reduce drift.
- If any critical detail is missing and blocks success, ask a question; otherwise proceed.

Prompting practices (all providers):

- Structure prompts scene → subject → details → constraints; include the intended use (ad, UI mock, infographic) to set polish level.
- Use camera/composition language for photorealism; quote exact text with typography + placement, spelling tricky words letter-by-letter with verbatim rendering required.
- For multi-image inputs, reference images by index and describe how to combine them.
- Start latency-sensitive runs at quality=low; use quality=high for text-heavy or detail-critical outputs; consider `--input-fidelity high` (OpenAI only) for strict identity/layout locks.
- If results feel "tacky", add a brief `Avoid:` line (stock-photo vibe; cheesy lens flare; oversaturated neon; harsh bloom; oversharpening; clutter) and specify restraint ("editorial", "premium", "subtle").
- Use short prompts (2-3 elements) for exploration; structured prompts (all 7 elements: Subject, Composition, Context, Medium, Style, Vibe, Attributes) for production. If a result feels random, add spatial anchors, lighting direction, or mood — not more detail.
- Format-specific cheat sheets (photorealism, illustration, vector/logo, graphic design, 3D) and further principles: [references/prompting.md](references/prompting.md). Copy/paste specs and asset-type templates (website assets, game assets, wireframes, logo): [references/sample-prompts.md](references/sample-prompts.md).

## Verification

- Output files exist at the expected `--out`/`--out-dir` paths and open as valid images (or SVG for vector models).
- Each output satisfies the approved spec: subject, style, composition, verbatim text, and every constraint/avoid item; edit invariants held.
- The final prompt and flags used are recorded alongside the deliverables.
- Temporary batch JSONL and intermediates under the temp directory are deleted.

## Completion

Return the final output paths, the provider/model and command used, the final structured prompt and flags, and any iterations performed. For prompt-only requests, deliver the approved structured prompt. Report `partial` or `blocked` with the concrete missing prerequisite (API key, dependency, provider capability) instead of claiming success.
