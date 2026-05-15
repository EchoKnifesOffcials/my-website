// redis.js - Redis client for rate limiting and caching
const redis = require('redis');

let redisClient = null;

async function connectRedis() {
    try {
        redisClient = redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379',
            password: process.env.REDIS_PASSWORD,
            retry_strategy: (options) => {
                if (options.error && options.error.code === 'ECONNREFUSED') {
                    console.error('Redis connection refused');
                    return new Error('Redis connection refused');
                }
                if (options.total_retry_time > 1000 * 60 * 60) {
                    return new Error('Redis retry time exhausted');
                }
                if (options.attempt > 10) {
                    return undefined;
                }
                return Math.min(options.attempt * 100, 3000);
            }
        });
        
        await redisClient.connect();
        console.log('Connected to Redis');
        
        return redisClient;
    } catch (error) {
        console.error('Redis connection error:', error);
        return null;
    }
}

// Rate limiting using Redis
async function checkRedisRateLimit(key, limit, windowMs) {
    if (!redisClient) return true; // Fallback to in-memory if Redis is down
    
    const now = Date.now();
    const windowStart = now - windowMs;
    
    try {
        // Remove old entries
        await redisClient.zRemRangeByScore(key, 0, windowStart);
        
        // Add current request
        await redisClient.zAdd(key, { score: now, value: `${now}:${Math.random()}` });
        
        // Count requests in window
        const count = await redisClient.zCard(key);
        
        // Set expiry on the key
        await redisClient.expire(key, Math.ceil(windowMs / 1000));
        
        return count <= limit;
    } catch (error) {
        console.error('Redis rate limit error:', error);
        return true; // Fail open
    }
}

module.exports = { connectRedis, checkRedisRateLimit, getRedisClient: () => redisClient };
