import sharp from "sharp@0.34";

import { ImagineError } from "./providers/base";

export async function convert_image_format(
  bytes: Uint8Array,
  output_format: string,
): Promise<Uint8Array> {
  try {
    const pipeline = sharp(bytes);
    if (output_format === "jpeg") pipeline.flatten({ background: "#fff" });
    return new Uint8Array(await pipeline.toFormat(output_format).toBuffer());
  } catch (cause) {
    throw new ImagineError("Converting image format failed.", 1, { cause });
  }
}

export async function downscale_image(
  bytes: Uint8Array,
  max_dim: number,
  output_format: string,
): Promise<Uint8Array> {
  try {
    const format = output_format === "jpg" ? "jpeg" : output_format;
    return new Uint8Array(
      await sharp(bytes)
        .resize({
          width: max_dim,
          height: max_dim,
          fit: "inside",
          withoutEnlargement: true,
        })
        .flatten(format === "jpeg" ? { background: "#fff" } : false)
        .toFormat(format)
        .toBuffer(),
    );
  } catch (cause) {
    throw new ImagineError("Downscaling image failed.", 1, { cause });
  }
}
