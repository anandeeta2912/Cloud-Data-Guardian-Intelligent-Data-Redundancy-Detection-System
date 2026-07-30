import mongoose from 'mongoose';
import { createClient } from 'redis';
import { config } from './index';
import { logger } from '../utils/logger';

export const connectDatabase = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(config.mongodb.uri as string);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected. Attempting reconnect...');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB error:', err);
});

export const connectRedis = async (): Promise<ReturnType<typeof createClient>> => {
  const client = createClient({
    url: config.redis.url,
    socket: {
      reconnectStrategy: () => false,
    },
  });
  client.on('error', (err) => logger.warn({ error: 'Redis client error', details: err.message }));
  client.on('connect', () => logger.info('Redis Connected'));
  client.on('end', () => logger.info('Redis connection closed'));
  await client.connect();
  return client;
};
