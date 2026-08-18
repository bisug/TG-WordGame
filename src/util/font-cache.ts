import { readFile } from "node:fs/promises";
import { join } from "node:path";

const FONT_PATH = join(process.cwd(), "src", "fonts", "roboto.ttf");
let fontDataPromise: Promise<Buffer> | null = null;

export function getFontData(): Promise<Buffer> {
  if (!fontDataPromise) {
    fontDataPromise = readFile(FONT_PATH).catch((err) => {
      // Don't cache a rejection: one transient FS error would otherwise kill
      // every image generation until a process restart.
      fontDataPromise = null;
      throw err;
    });
  }
  return fontDataPromise;
}

export function prewarmFont(): void {
  // Start loading the font in the background without awaiting
  // This ensures the font is ready when first image is generated
  getFontData().catch(() => {
    // Ignore errors - will be retried on actual use
  });
}
