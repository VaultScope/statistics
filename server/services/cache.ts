import { createClient, RedisClientType } from 'redis';
import crypto from 'crypto';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

class CacheService {
  private client?: RedisClientType;
  private memoryCache: Map<string, { value: any; expires: number }> = new Map();
  private isRedisAvailable = false;
  private defaultTTL = 300; // 5 minutes
  private prefix = 'vaultscope:';

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = createClient({ url: redisUrl });
      
      this.client.on('error', (err: Error) => {
        console.error('Redis Client Error:', err);
        this.isRedisAvailable = false;
      });

      this.client.on('connect', () => {
        console.log('Redis connected successfully');
        this.isRedisAvailable = true;
      });

      await this.client.connect();
    } catch (error) {
      console.warn('Redis not available, using in-memory cache:', error);
      this.isRedisAvailable = false;
    }

    // Cleanup expired memory cache entries periodically
    setInterval(() => this.cleanupMemoryCache(), 60000); // Every minute
  }

  private cleanupMemoryCache() {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expires < now) {
        this.memoryCache.delete(key);
      }
    }
  }

  private generateKey(key: string | object): string {
    if (typeof key === 'object') {
      const hash = crypto.createHash('md5').update(JSON.stringify(key)).digest('hex');
      return `${this.prefix}obj:${hash}`;
    }
    return `${this.prefix}${key}`;
  }

  async get<T>(key: string | object): Promise<T | null> {
    const cacheKey = this.generateKey(key);

    if (this.isRedisAvailable && this.client) {
      try {
        const value = await this.client.get(cacheKey);
        if (value && typeof value === 'string') {
          return JSON.parse(value);
        }
      } catch (error) {
        console.error('Redis get error:', error);
      }
    }

    // Fallback to memory cache
    const entry = this.memoryCache.get(cacheKey);
    if (entry && entry.expires > Date.now()) {
      return entry.value;
    }

    return null;
  }

  async set<T>(key: string | object, value: T, options: CacheOptions = {}): Promise<void> {
    const cacheKey = this.generateKey(key);
    const ttl = options.ttl || this.defaultTTL;
    const serialized = JSON.stringify(value);

    if (this.isRedisAvailable && this.client) {
      try {
        await this.client.setEx(cacheKey, ttl, serialized);
        return;
      } catch (error) {
        console.error('Redis set error:', error);
      }
    }

    // Fallback to memory cache
    this.memoryCache.set(cacheKey, {
      value,
      expires: Date.now() + (ttl * 1000)
    });
  }

  async delete(key: string | object): Promise<void> {
    const cacheKey = this.generateKey(key);

    if (this.isRedisAvailable && this.client) {
      try {
        await this.client.del(cacheKey);
      } catch (error) {
        console.error('Redis delete error:', error);
      }
    }

    this.memoryCache.delete(cacheKey);
  }

  async flush(pattern?: string): Promise<void> {
    if (this.isRedisAvailable && this.client) {
      try {
        if (pattern) {
          const keys = await this.client.keys(`${this.prefix}${pattern}*`);
          if (keys.length > 0) {
            await this.client.del(keys);
          }
        } else {
          await this.client.flushDb();
        }
      } catch (error) {
        console.error('Redis flush error:', error);
      }
    }

    if (pattern) {
      const prefix = `${this.prefix}${pattern}`;
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(prefix)) {
          this.memoryCache.delete(key);
        }
      }
    } else {
      this.memoryCache.clear();
    }
  }

  // Cache wrapper for functions
  async remember<T>(
    key: string | object,
    fn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn();
    await this.set(key, result, options);
    return result;
  }

  // Cache wrapper with tags for invalidation
  async rememberWithTags<T>(
    key: string | object,
    tags: string[],
    fn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const result = await this.remember(key, fn, options);

    // Store tags association
    if (this.isRedisAvailable && this.client) {
      for (const tag of tags) {
        await this.client.sAdd(`${this.prefix}tag:${tag}`, this.generateKey(key));
      }
    }

    return result;
  }

  // Invalidate cache by tags
  async invalidateTags(tags: string[]): Promise<void> {
    if (this.isRedisAvailable && this.client) {
      for (const tag of tags) {
        const keys = await this.client.sMembers(`${this.prefix}tag:${tag}`);
        if (keys.length > 0) {
          await this.client.del(keys);
        }
        await this.client.del(`${this.prefix}tag:${tag}`);
      }
    }
  }

  // Get cache statistics
  async getStats() {
    const stats = {
      type: this.isRedisAvailable ? 'redis' : 'memory',
      memoryEntries: this.memoryCache.size,
      redisInfo: null as any
    };

    if (this.isRedisAvailable && this.client) {
      try {
        stats.redisInfo = await this.client.info();
      } catch (error) {
        console.error('Failed to get Redis info:', error);
      }
    }

    return stats;
  }

  async close() {
    if (this.client) {
      await this.client.quit();
    }
    this.memoryCache.clear();
  }
}

// Export singleton instance
export default new CacheService();