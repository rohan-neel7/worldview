/**
 * Decoupled Bounded Cache Store with TTL Support
 * 
 * Provides an in-memory LRU (Least Recently Used) cache store bounded by maxItems,
 * with TTL expiration for items. Abstracted via clean interface methods so it can
 * easily be swapped out for a Redis / shared store adapter if horizontally scaled.
 */

export class BoundedCacheStore {
  constructor(options = {}) {
    this.maxItems = options.maxItems || 500;
    this.defaultTtlMs = options.defaultTtlMs || 60000; // 1 minute default
    this.cache = new Map();
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check expiration
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Refresh LRU order by deleting and re-inserting
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    // If key exists, delete it first to refresh position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxItems) {
      // Evict oldest item (first entry in Map iterator)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    const expiresAt = ttlMs > 0 ? Date.now() + ttlMs : null;
    this.cache.set(key, { value, expiresAt });
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}
