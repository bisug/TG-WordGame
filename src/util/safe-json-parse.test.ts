import { describe, expect, test } from "bun:test";

import { safeJsonParse } from "./formatting";

describe("safeJsonParse", () => {
  test("returns parsed JSON when valid", () => {
    expect(safeJsonParse('{"ok":true}', { ok: false })).toEqual({ ok: true });
  });

  test("returns fallback for empty or invalid input", () => {
    expect(safeJsonParse(null, { ok: false })).toEqual({ ok: false });
    expect(safeJsonParse("{", { ok: false })).toEqual({ ok: false });
  });
});
