import app from './app';
import { connectDatabase, connectRedis } from './config/database';
import { config } from './config';
import { logger } from './utils/logger';

const validateEnvironment = (): void => {
  const required = ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

const gracefulShutdown = (server: any, message: string): void => {
  logger.info(`${message}: closing HTTP server`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

const startServer = async (): Promise<void> => {
  try {
    validateEnvironment();
    await connectDatabase();
    try {
      const redis = await connectRedis();
      (app.locals as any).redis = redis;
    } catch (redisError) {
      logger.warn('Redis connection failed. Rate limiting will be disabled.', redisError);
    }
    const server = app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port} in ${config.env} mode`);
    });

    process.on('SIGTERM', () => gracefulShutdown(server, 'SIGTERM signal received'));
    process.on('SIGINT', () => gracefulShutdown(server, 'SIGINT signal received'));
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
