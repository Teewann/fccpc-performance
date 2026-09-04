/**
 * Zero-cost in-memory cache for the Node.js process.
 * Lives in the singleton Prisma module scope so it survives hot-reloads in dev.
 * Cache entries expire automatically — no stale data problems.
 */

type CacheEntry<T> = { value: T; expiresAt: number };

class MemCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this.store.delete(key); return null; }
    return entry.value;
  }

  set<T>(key: string, value: T, ttlMs = 30_000) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  del(key: string) { this.store.delete(key); }

  delPattern(prefix: string) {
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) this.store.delete(k);
    }
  }
}

const globalForCache = globalThis as unknown as { __memCache?: MemCache };
export const cache = globalForCache.__memCache ?? new MemCache();
if (process.env.NODE_ENV !== "production") globalForCache.__memCache = cache;