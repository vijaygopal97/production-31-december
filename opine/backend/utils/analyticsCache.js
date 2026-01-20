/**
 * Redis Cache for Analytics & Statistics
 * 
 * Top-Tier Tech Company Solution (Meta, Google, Amazon pattern)
 * 
 * This cache stores expensive analytics/aggregation results to prevent
 * repeated expensive database queries when loading statistics.
 * 
 * Cache Strategy:
 * - TTL: 5-10 minutes (analytics change infrequently, but need reasonable freshness)
 * - Primary Storage: Redis (distributed, shared across workers/servers)
 * - Fallback: In-memory Map (if Redis unavailable - graceful degradation)
 * - Cache Key Pattern: analytics:${type}:${identifier}:${paramsHash}
 * - Cleanup: Automatic via TTL expiration
 * - Invalidation: Event-based (when underlying data changes)
 */

const redisOps = require('./redisClient');
const crypto = require('crypto');

class AnalyticsCache {
  constructor() {
    this.cache = new Map(); // In-memory fallback cacheKey -> { data, expiresAt }
    this.cleanupInterval = null;
    
    // Start cleanup interval (runs every 10 minutes) - only for in-memory fallback
    this.startCleanup();
  }

  /**
   * Generate cache key from type, identifier, and parameters
   * @param {string} type - Cache type (e.g., 'qa_performance', 'survey_stats', 'ac_stats')
   * @param {string} identifier - Unique identifier (e.g., userId, surveyId, companyId)
   * @param {Object} params - Additional parameters for cache key uniqueness
   * @returns {string} - Cache key
   */
  generateKey(type, identifier, params = {}) {
    const paramsStr = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    
    // Create hash of params for shorter keys
    const paramsHash = paramsStr ? crypto.createHash('md5').update(paramsStr).digest('hex').substring(0, 8) : 'default';
    
    return `analytics:${type}:${identifier}:${paramsHash}`;
  }

  /**
   * Get cached analytics data
   * @param {string} type - Cache type
   * @param {string} identifier - Unique identifier
   * @param {Object} params - Additional parameters
   * @returns {Promise<Object|null>} - Cached data or null if not found/expired
   */
  async get(type, identifier, params = {}) {
    const key = this.generateKey(type, identifier, params);
    
    // Try Redis first (primary cache)
    // Note: redisOps.get() already parses JSON automatically
    try {
      const cached = await redisOps.get(key);
      if (cached) {
        return cached;
      }
    } catch (error) {
      // Redis failed, fall back to in-memory
      console.warn(`⚠️ AnalyticsCache: Redis get failed, using in-memory fallback: ${error.message}`);
    }
    
    // Fallback to in-memory cache
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Store analytics data in cache
   * @param {string} type - Cache type
   * @param {string} identifier - Unique identifier
   * @param {Object} params - Additional parameters
   * @param {Object} data - The analytics data to cache
   * @param {number} ttlSeconds - Time to live in seconds (default: 5 minutes)
   */
  async set(type, identifier, params, data, ttlSeconds = 5 * 60) {
    const key = this.generateKey(type, identifier, params);
    
    // Try Redis first (primary cache)
    // Note: redisOps.set() automatically serializes JSON
    try {
      await redisOps.set(key, data, ttlSeconds);
    } catch (error) {
      // Redis failed, fall back to in-memory
      console.warn(`⚠️ AnalyticsCache: Redis set failed, using in-memory fallback: ${error.message}`);
      const expiresAt = Date.now() + (ttlSeconds * 1000);
      this.cache.set(key, { data, expiresAt });
    }
  }

  /**
   * Invalidate cache for a specific type and identifier
   * @param {string} type - Cache type
   * @param {string} identifier - Unique identifier
   * @param {Object} params - Additional parameters (optional, will invalidate all params if not provided)
   */
  async invalidate(type, identifier, params = null) {
    const key = params ? this.generateKey(type, identifier, params) : null;
    
    if (key) {
      // Delete specific key
      try {
        await redisOps.del(key);
      } catch (error) {
        console.warn(`⚠️ AnalyticsCache: Redis delete failed (non-critical): ${error.message}`);
      }
      this.cache.delete(key);
    } else {
      // Delete all keys with this type and identifier (for in-memory only)
      const prefix = `analytics:${type}:${identifier}:`;
      const keysToDelete = [];
      
      for (const [cacheKey] of this.cache.entries()) {
        if (cacheKey.startsWith(prefix)) {
          keysToDelete.push(cacheKey);
        }
      }
      
      keysToDelete.forEach(key => this.cache.delete(key));
      
      // Note: For Redis, pattern deletion would require SCAN (expensive)
      // Instead, rely on TTL expiration (5-10 minutes is acceptable)
      // Individual cache entries will expire naturally
      
      if (keysToDelete.length > 0) {
        console.log(`🧹 AnalyticsCache: Cleared ${keysToDelete.length} in-memory entries for ${type}:${identifier}`);
      }
    }
  }

  /**
   * Invalidate all analytics cache for a company
   * Called when company-wide changes occur
   * @param {string} companyId - Company ID
   */
  async invalidateCompany(companyId) {
    // For in-memory: Clear all entries with this companyId
    const keysToDelete = [];
    
    // Try to match keys that might contain companyId
    for (const [key] of this.cache.entries()) {
      if (key.includes(`:${companyId}:`) || key.endsWith(`:${companyId}`)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`🧹 AnalyticsCache: Cleared ${keysToDelete.length} in-memory entries for company ${companyId}`);
    }
    
    // Note: Redis entries will expire via TTL (5-10 minutes)
  }

  /**
   * Clear all cache entries (useful for testing or manual cache invalidation)
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache size (for monitoring)
   * @returns {number} - Number of entries in in-memory fallback cache
   */
  size() {
    return this.cache.size;
  }

  /**
   * Start cleanup interval to remove expired entries from in-memory fallback
   */
  startCleanup() {
    // Run cleanup every 10 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 10 * 60 * 1000); // 10 minutes
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Remove expired entries from in-memory fallback cache
   */
  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 AnalyticsCache: Cleaned up ${cleanedCount} expired in-memory entries (${this.cache.size} remaining)`);
    }
  }
}

// Export singleton instance
const analyticsCache = new AnalyticsCache();

module.exports = analyticsCache;




