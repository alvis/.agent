# Recraft — API reference

## Contents

- [Authentication](#authentication)
- [Models](#models)
- [Endpoints](#endpoints)
- [Size Tables](#size-tables)
- [Named Styles](#named-styles)
- [Custom Style Creation (V3 only)](#custom-style-creation-v3-only)
- [Controls (via `extra_body`)](#controls-via-extra_body)
- [Response Format](#response-format)
- [Pricing (approximate)](#pricing-approximate)
- [Limits](#limits)
- [MCP Tools](#mcp-tools)

## Authentication

- Base URL: `https://external.api.recraft.ai/v1`
- Auth: Bearer token via `RECRAFT_API_TOKEN` environment variable
- Uses OpenAI-compatible SDK with custom `base_url`

## Models

| Model                  | Type   | Capabilities                                                     |
| ---------------------- | ------ | ---------------------------------------------------------------- |
| `recraftv4`            | Raster | Latest model, high-quality generation                            |
| `recraftv4_vector`     | Vector | SVG output, logos & icons                                        |
| `recraftv4_pro`        | Raster | Higher resolution (2x), premium quality                          |
| `recraftv4_pro_vector` | Vector | High-res SVG output                                              |
| `recraftv3`            | Raster | Supports named styles, custom styles, image-to-image, inpainting |
| `recraftv3_vector`     | Vector | SVG with named styles support                                    |
| `recraftv2`            | Raster | Legacy, extensive style substyles                                |
| `recraftv2_vector`     | Vector | Legacy SVG generation                                            |

## Endpoints

| Endpoint                  | Method | Purpose                                             |
| ------------------------- | ------ | --------------------------------------------------- |
| `/v1/images/generations`  | POST   | Text-to-image (OpenAI-compatible)                   |
| `/v1/images/imageToImage` | POST   | Image-to-image transformation (V3 only)             |
| `/v1/images/inpaint`      | POST   | Inpainting with mask (V3 only)                      |
| `/v1/styles`              | POST   | Create custom style from reference images (V3 only) |

## Size Tables

### V4 Sizes

| Aspect | Size      |
| ------ | --------- |
| 1:1    | 1024x1024 |
| 2:1    | 1536x768  |
| 1:2    | 768x1536  |
| 3:2    | 1280x832  |
| 2:3    | 832x1280  |
| 4:3    | 1216x896  |
| 3:4    | 896x1216  |
| 5:4    | 1152x896  |
| 4:5    | 896x1152  |
| 16:9   | 1344x768  |
| 9:16   | 768x1344  |
| 6:10   | 832x1344  |
| 14:10  | 1280x896  |
| 10:14  | 896x1280  |

### V4 Pro Sizes

| Aspect | Size      |
| ------ | --------- |
| 1:1    | 2048x2048 |
| 2:1    | 3072x1536 |
| 1:2    | 1536x3072 |
| 3:2    | 2560x1664 |
| 2:3    | 1664x2560 |
| 4:3    | 2432x1792 |
| 3:4    | 1792x2432 |
| 16:9   | 2688x1536 |
| 9:16   | 1536x2688 |

### V3/V2 Sizes (all explicit)

`1024x1024`, `1365x1024`, `1024x1365`, `1536x1024`, `1024x1536`, `1820x1024`, `1024x1820`, `1024x2048`, `2048x1024`, `1434x1024`, `1024x1434`, `1024x1280`, `1280x1024`, `1024x1707`, `1707x1024`

## Named Styles

### V3 Styles

`any`, `realistic_image`, `digital_illustration`, `vector_illustration`, `icon`

### V2 Styles (includes substyles)

`realistic_image`, `digital_illustration`, `vector_illustration`, `icon`, `realistic_image/b_and_w`, `realistic_image/hard_flash`, `realistic_image/hdr`, `realistic_image/natural_light`, `realistic_image/studio_portrait`, `realistic_image/enterprise`, `realistic_image/motion_blur`, `digital_illustration/pixel_art`, `digital_illustration/hand_drawn`, `digital_illustration/grain`, `digital_illustration/infantile_sketch`, `digital_illustration/2d_art_poster`, `digital_illustration/handmade_3d`, `digital_illustration/hand_drawn_outline`, `digital_illustration/engraving_color`, `digital_illustration/2d_art_poster_2`

## Custom Style Creation (V3 only)

1. Upload 1+ reference images via `POST /v1/styles` with `style` base parameter
2. Receive `style_id` in response
3. Pass `style_id` in subsequent generation requests via `extra_body`

## Controls (via `extra_body`)

- `style`: Named style string (V2/V3)
- `style_id`: UUID of custom style
- `negative_prompt`: Text describing undesired elements (V2/V3)
- `controls.colors`: Dominant color palette
- `controls.background_color`: Background color hex
- `controls.artistic_level`: Artistic freedom level
- `controls.no_text`: Boolean to suppress text in output

## Response Format

Standard OpenAI-compatible response with `b64_json` encoding. Vector models return base64-encoded SVG content.

## Pricing (approximate)

- V4: ~$0.04/image
- V4 Pro: ~$0.08/image
- V3: ~$0.04/image
- Vector models: ~$0.08/image

## Limits

- Input images/masks < 50 MB

## MCP Tools

When the Recraft MCP server is available, prefer MCP tools over the CLI for Recraft operations:

| MCP Tool                           | Purpose                                        | When to use                                                                                                           |
| ---------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `mcp__recraft__create_style`       | Extract reusable style from reference image(s) | Only when generating with Recraft V3 models (`recraftv3`, `recraftv3_vector`) and the user provides a reference image |
| `mcp__recraft__generate_image`     | Generate image with optional style             | Recraft generation with an extracted `styleID`                                                                        |
| `mcp__recraft__image_to_image`     | Transform existing image                       | Style transfer, image-to-image with Recraft                                                                           |
| `mcp__recraft__remove_background`  | Remove image background                        | Background extraction tasks                                                                                           |
| `mcp__recraft__replace_background` | Replace image background                       | Background replacement tasks                                                                                          |
| `mcp__recraft__vectorize_image`    | Convert raster to vector                       | SVG/vector conversion                                                                                                 |
| `mcp__recraft__creative_upscale`   | Upscale with creative enhancement              | Quality enhancement with artistic interpretation                                                                      |
| `mcp__recraft__crisp_upscale`      | Upscale with detail preservation               | Quality enhancement preserving original details                                                                       |

**MCP vs CLI decision**: Use MCP tools when working within Recraft's ecosystem (style extraction + generation). Use the CLI (`bun "$IMAGINE" --provider recraft`) when you need cross-provider batch runs, custom output paths, or flags not exposed by MCP. The CLI resolves its OpenAI-compatible client through the inline `openai@6` import; do not install or pin a separate SDK.
