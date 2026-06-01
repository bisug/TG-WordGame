import { describe, expect, test } from "bun:test";

import { getLocalWordDetails } from "./local-word-details";

describe("local word details", () => {
  test("returns validated local details for known words", () => {
    const details = getLocalWordDetails("water");

    expect(details.meaning).toContain("clear liquid");
    expect(details.phonetic).toBeTruthy();
    expect(details.sentence).toBeTruthy();
  });

  test("uses curated override details for common inflected daily words", () => {
    const details = getLocalWordDetails("their");

    expect(details.meaning).toContain("Belonging");
    expect(details.sentence).toContain("their scores");
  });

  test("returns null fields for missing words", () => {
    expect(getLocalWordDetails("zzzzz")).toEqual({
      meaning: null,
      phonetic: null,
      sentence: null,
    });
  });
});
