const Redis = require('ioredis');

// Create a Redis client instance
// The connection won't block the app from starting if Redis is down
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  // Retry strategy: wait up to 2 seconds, max 10 retries, then give up
  retryStrategy(times) {
    if (times > 10) {
      console.warn('⚠️  Redis connection failed after 10 retries. Continuing without cache.');
      return null;
    }
    return Math.min(times * 200, 2000);
  },
  // Don't throw errors for commands if disconnected, just return error
  enableOfflineQueue: false,
});

redisClient.on('connect', () => {
  console.log('✅ Redis connected successfully.');
});

redisClient.on('error', (err) => {
  // Suppress verbose connection errors if we know it's down, just warn once
  if (err.code === 'ECONNREFUSED') {
    // Only log the first one or occasionally to prevent console spam
    // console.warn('⚠️  Redis connection refused (is it running?)');
  } else {
    console.error('Redis Client Error:', err);
  }
});

/**
 * Get a value from the cache
 * @param {string} key 
 * @returns {Promise<any | null>} Parsed JSON or null if miss/error
 */
async function getCache(key) {
  if (redisClient.status !== 'ready') return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error(`Redis Get Error for key ${key}:`, err.message);
    return null;
  }
}

/**
 * Set a value in the cache with a time-to-live
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttlSeconds Default 3600 (1 hour)
 */
async function setCache(key, value, ttlSeconds = 3600) {
  if (redisClient.status !== 'ready') return;
  try {
    await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    console.error(`Redis Set Error for key ${key}:`, err.message);
  }
}

/**
 * Delete a specific key from the cache
 * @param {string} key 
 */
async function delCache(key) {
  if (redisClient.status !== 'ready') return;
  try {
    await redisClient.del(key);
  } catch (err) {
    console.error(`Redis Del Error for key ${key}:`, err.message);
  }
}

/**
 * Delete all keys matching a specific pattern (e.g., 'tags:*')
 * @param {string} pattern 
 */
async function invalidatePattern(pattern) {
  if (redisClient.status !== 'ready') return;
  try {
    const stream = redisClient.scanStream({
      match: pattern,
      count: 100
    });

    stream.on('data', async (keys) => {
      if (keys.length) {
        const pipeline = redisClient.pipeline();
        keys.forEach(function (key) {
          pipeline.del(key);
        });
        await pipeline.exec();
      }
    });

    stream.on('end', () => {
      // Done clearing pattern
    });
  } catch (err) {
    console.error(`Redis Invalidate Pattern Error for ${pattern}:`, err.message);
  }
}

module.exports = {
  redisClient,
  getCache,
  setCache,
  delCache,
  invalidatePattern
};
