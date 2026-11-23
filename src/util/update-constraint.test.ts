import type { Context } from "grammy";
import { expect, test } from "bun:test";

import { getUpdateConstraint } from "./update-constraint";

const ctx = (value: Record<string, unknown>) => value as unknown as Context;

test("callback queries are keyed by chat so state mutations are ordered", () => {
  expect(
    getUpdateConstraint(
      ctx({ callbackQuery: { id: "1" }, chatId: -1001, from: { id: 7 } }),
    ),
  ).toBe("-1001");
});

test("callback queries without a chat fall back to the sender", () => {
  expect(getUpdateConstraint(ctx({ callbackQuery: {}, from: { id: 7 } }))).toBe(
    "7",
  );
});

test("private chat updates keep running unconstrained", () => {
  expect(
    getUpdateConstraint(ctx({ chat: { type: "private" }, chatId: 7 })),
  ).toBeUndefined();
});

test("group updates are keyed by chat", () => {
  expect(
    getUpdateConstraint(ctx({ chat: { type: "group" }, chatId: -1001 })),
  ).toBe("-1001");
});
