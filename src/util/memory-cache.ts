export class MemoryTtlCache<T> {
  private store = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly defaultTtlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }

    return structuredClone(entry.value);
  }

  set(key: string, value: T, ttlMs = this.defaultTtlMs) {
    this.store.set(key, {
      value: structuredClone(value),
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
