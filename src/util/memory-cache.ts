export class MemoryTtlCache<T> {
  private store = new Map<string, { value: T; expiresAt: number }>();

  /**
   * @param defaultTtlMs Default time-to-live for entries.
   * @param maxSize Optional hard cap on entry count. When exceeded, the
   *   oldest-inserted entries are evicted (FIFO). Prevents unbounded memory
   *   growth for long-lived caches keyed by user/chat ids.
   */
  constructor(
    private readonly defaultTtlMs: number,
    private readonly maxSize: number = Number.POSITIVE_INFINITY,
  ) {}

  /**
   * Defensive clone so callers mutating a returned value can't corrupt the
   * cache (and vice versa).
   *
   * Buffers/Uint8Arrays are returned as-is: cloning them per read is wasteful
   * for image-sized payloads, and JSON round-tripping would corrupt them into
   * `{"type":"Buffer","data":[...]}` plain objects. Callers must treat
   * returned Buffers as read-only.
   *
   * Other objects use structuredClone, which preserves Date/Map/Set (a JSON
   * round-trip would stringify nested Dates).
   */
  private clone(value: T): T {
    if (value === null || value === undefined) return value;
    const type = typeof value;
    if (type !== "object" && type !== "function") return value;
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) return value;
    try {
      return structuredClone(value);
    } catch {
      return value;
    }
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }

    return this.clone(entry.value);
  }

  set(key: string, value: T, ttlMs = this.defaultTtlMs) {
    // Re-inserting an existing key moves it to the end of the Map's insertion
    // order, so eviction below always drops the oldest-inserted entry.
    this.store.set(key, {
      value: this.clone(value),
      expiresAt: Date.now() + ttlMs,
    });

    while (this.store.size > this.maxSize) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  delete(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}
