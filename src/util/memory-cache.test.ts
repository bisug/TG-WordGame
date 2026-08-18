import { describe, expect, test } from "bun:test";
import { MemoryTtlCache } from "./memory-cache";

describe("MemoryTtlCache", () => {
  test("stores and returns primitives", () => {
    const cache = new MemoryTtlCache<string>(60_000);
    cache.set("k", "v");
    expect(cache.get("k")).toBe("v");
  });

  test("returns undefined for missing or expired keys", () => {
    const cache = new MemoryTtlCache<string>(1);
    cache.set("k", "v");
    expect(cache.get("missing")).toBeUndefined();
    // TTL of 1ms has elapsed by the time we read
    Bun.sleepSync(5);
    expect(cache.get("k")).toBeUndefined();
  });

  test("clones plain objects so mutations don't leak into the cache", () => {
    const cache = new MemoryTtlCache<{ n: number }>(60_000);
    cache.set("k", { n: 1 });
    const first = cache.get("k");
    expect(first).toEqual({ n: 1 });
    if (first) first.n = 99;
    expect(cache.get("k")).toEqual({ n: 1 });
  });

  test("preserves Buffer identity (no JSON corruption)", () => {
    const cache = new MemoryTtlCache<Buffer>(60_000);
    const buf = Buffer.from([1, 2, 3, 4]);
    cache.set("img", buf);

    const out = cache.get("img");
    expect(Buffer.isBuffer(out)).toBe(true);
    expect(out).toBe(buf);
    // Must be usable as binary data, not a {"type":"Buffer"} object
    expect(new Uint8Array(out as Buffer)).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  test("preserves Uint8Array values", () => {
    const cache = new MemoryTtlCache<Uint8Array>(60_000);
    const arr = new Uint8Array([9, 8, 7]);
    cache.set("img", arr);
    expect(cache.get("img")).toBe(arr);
  });

  test("preserves Date values as Date instances", () => {
    const cache = new MemoryTtlCache<{ date: Date }>(60_000);
    const date = new Date("2026-01-02T00:00:00Z");
    cache.set("k", { date });
    const out = cache.get("k");
    expect(out?.date).toBeInstanceOf(Date);
    expect(out?.date.getTime()).toBe(date.getTime());
  });

  test("delete and clear remove entries", () => {
    const cache = new MemoryTtlCache<string>(60_000);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.delete("a");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe("2");
    cache.clear();
    expect(cache.get("b")).toBeUndefined();
  });
});
