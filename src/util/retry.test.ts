import { expect, test } from "bun:test";

import { retryWithBackoff } from "./retry";

test("retries until the operation succeeds", async () => {
  let attempts = 0;
  const delays: number[] = [];
  const result = await retryWithBackoff(
    async () => {
      attempts++;
      if (attempts < 3) throw new Error("429");
      return "ok";
    },
    [0, 10, 20],
    async (ms) => {
      delays.push(ms);
    },
  );

  expect(result).toBe("ok");
  expect(attempts).toBe(3);
  expect(delays).toEqual([10, 20]);
});

test("gives up after the last scheduled attempt", async () => {
  let attempts = 0;
  const result = await retryWithBackoff(
    async () => {
      attempts++;
      throw new Error("429");
    },
    [0, 10],
    async () => {},
  );

  expect(result).toBeUndefined();
  expect(attempts).toBe(2);
});
