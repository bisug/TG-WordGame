import { describe, expect, test } from "bun:test";
import { getFeedback, getFeedbackRows } from "./feedback";

describe("getFeedbackRows", () => {
  test("all correct positions are green", () => {
    const rows = getFeedbackRows([{ guess: "CRANE" }], "CRANE");
    expect(rows).toEqual(["🟩 🟩 🟩 🟩 🟩 CRANE"]);
  });

  test("absent letters are red", () => {
    const rows = getFeedbackRows([{ guess: "XXXXX" }], "CRANE");
    expect(rows).toEqual(["🟥 🟥 🟥 🟥 🟥 XXXXX"]);
  });

  test("present but misplaced letters are yellow", () => {
    const rows = getFeedbackRows([{ guess: "EARTH" }], "CRANE");
    // E is in CRANE but not at pos 0 -> yellow; A at pos 1 -> yellow;
    // R at pos 2 -> yellow; T, H absent -> red
    expect(rows).toEqual(["🟨 🟨 🟨 🟥 🟥 EARTH"]);
  });

  test("duplicate letters are not over-marked", () => {
    // Solution ERASE has two E's. Guess SPEED has three E's (pos 2, 3, 4...
    // actually pos 2,3 and D): no exact matches, so only two of the E's can
    // be yellow; the third must be red.
    const rows = getFeedbackRows([{ guess: "SPEED" }], "ERASE");
    expect(rows).toEqual(["🟨 🟥 🟨 🟨 🟥 SPEED"]);
  });

  test("exact matches consume letters before the yellow pass", () => {
    // Solution GEESE has three E's. Guess EERIE: pos 1 and pos 4 match
    // exactly (green), leaving one E for pos 0 (yellow); R and I are red.
    const rows = getFeedbackRows([{ guess: "EERIE" }], "GEESE");
    expect(rows).toEqual(["🟨 🟩 🟥 🟥 🟩 EERIE"]);
  });

  test("guess is uppercased in output", () => {
    const rows = getFeedbackRows([{ guess: "crane" }], "CRANE");
    expect(rows).toEqual(["🟩 🟩 🟩 🟩 🟩 CRANE"]);
  });

  test("mixed exact and misplaced duplicates", () => {
    // Solution ALLOT: L at pos 1 exact (green); L at pos 0 yellow (second L);
    // A at pos 2 yellow; M and final A red (only one A in solution).
    const rows = getFeedbackRows([{ guess: "LLAMA" }], "ALLOT");
    expect(rows).toEqual(["🟨 🟩 🟨 🟥 🟥 LLAMA"]);
  });

  test("multiple guesses produce one row each", () => {
    const rows = getFeedbackRows(
      [{ guess: "XXXXX" }, { guess: "CRANE" }],
      "CRANE",
    );
    expect(rows).toHaveLength(2);
    expect(rows[1]).toBe("🟩 🟩 🟩 🟩 🟩 CRANE");
  });
});

describe("getFeedback", () => {
  test("joins rows with newlines", () => {
    const out = getFeedback([{ guess: "CRANE" }, { guess: "XXXXX" }], "CRANE");
    expect(out).toBe("🟩 🟩 🟩 🟩 🟩 CRANE\n🟥 🟥 🟥 🟥 🟥 XXXXX");
  });

  test("empty input yields empty string", () => {
    expect(getFeedback([], "CRANE")).toBe("");
  });
});
