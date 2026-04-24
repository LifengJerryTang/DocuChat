import IORedis from 'ioredis';

export const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null, // required by BullMQ
});

redisConnection.on('connect', () => console.log('Redis connected'));
redisConnection.on('error', (err) => console.error('Redis error:', err));
