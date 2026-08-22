import { mock } from "bun:test";

const sharpPipeline = {
  resize: () => sharpPipeline,
  flatten: () => sharpPipeline,
  toFormat: () => sharpPipeline,
  toBuffer: async () => Uint8Array.from([6, 5, 4]),
};

mock.module("@google/genai@1", () => ({
  GoogleGenAI: class {},
}));
mock.module("openai@6", () => ({
  default: class {},
}));
mock.module("sharp@0.34", () => ({
  default: () => sharpPipeline,
}));
