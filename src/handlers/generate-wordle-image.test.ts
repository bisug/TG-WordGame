// Runtime coverage for the satori -> sharp pipeline. Typecheck and bundling
// both pass when a satori upgrade breaks SVG generation or sharp can no longer
// rasterize it, so this is the only check that actually renders a PNG.
//
// The handler module reads config/env at import time, so the two required vars
// are stubbed before the dynamic import. Nothing here touches Postgres or
// Redis: the clients are merely constructed, never queried.
import { beforeAll, describe, expect, test } from "bun:test";
import sharp from "sharp";

process.env.BOT_TOKEN ??= "0:test";
process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";
process.env.REDIS_URI ??= "redis://127.0.0.1:6379";

const PNG_MAGIC = "89504e470d0a1a0a";
const TILE_SIZE = 60;
const GAP = 8;
const PADDING = 20;
const ROWS = 6;

let generateWordleImage: typeof import("./on-message").generateWordleImage;

const guessEntry = (id: number, guess: string) => ({
  id,
  guess,
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Grid geometry mirrors generateWordleImage: every daily word is 5 letters and
// empty rows are padded up to six, so both dimensions are fixed.
const expectedWidth = (wordLength: number) =>
  PADDING * 2 + wordLength * TILE_SIZE + (wordLength - 1) * GAP;
const expectedHeight = PADDING * 2 + ROWS * TILE_SIZE + (ROWS - 1) * GAP;

beforeAll(async () => {
  ({ generateWordleImage } = await import("./on-message"));
});

describe("generateWordleImage", () => {
  test("renders a valid PNG sized to the five-letter grid", async () => {
    const png = await generateWordleImage([guessEntry(1, "crane")], "crane");

    expect(png.subarray(0, 8).toString("hex")).toBe(PNG_MAGIC);
    expect(png.length).toBeGreaterThan(0);

    const metadata = await sharp(png).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(expectedWidth(5));
    expect(metadata.height).toBe(expectedHeight);
  });

  test("renders a full board including duplicate-letter feedback", async () => {
    // "eerie" against "creep" exercises the repeated-letter path in scoreGuess
    // through the image code path, not just the unit test.
    const guesses = ["crane", "spill", "eerie", "geese", "tepee"].map(
      (guess, index) => guessEntry(index + 1, guess),
    );

    const png = await generateWordleImage(guesses, "creep");

    expect(png.subarray(0, 8).toString("hex")).toBe(PNG_MAGIC);
    const metadata = await sharp(png).metadata();
    expect(metadata.width).toBe(expectedWidth(5));
    expect(metadata.height).toBe(expectedHeight);
  });

  test("caches by solution and guess sequence", async () => {
    const guesses = [guessEntry(1, "slate"), guessEntry(2, "tribe")];

    const first = await generateWordleImage(guesses, "tribe");
    const second = await generateWordleImage(guesses, "tribe");
    const different = await generateWordleImage(guesses, "crane");

    expect(second).toBe(first);
    expect(different).not.toBe(first);
  });
});
