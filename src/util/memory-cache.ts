export class MemoryTtlCache<T> {
  private store = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly defaultTtlMs: number) {}

  /**
   * Fast clone for primitives and plain objects.
   * Avoids structuredClone overhead for the common case of cached strings/buffers.
   */
  private clone(value: T): T {
    if (value === null || value === undefined) return value;
    const type = typeof value;
    if (type !== "object" && type !== "function") return value;
    try {
      return JSON.parse(JSON.stringify(value)) as T;
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
    this.store.set(key, {
      value: this.clone(value),
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}
