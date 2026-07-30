import { AuthRequest } from './auth.middleware';
import { Response, NextFunction } from 'express';
import { config } from '../config';
import { SystemLog } from '../models/SystemLog';
import { logger } from '../utils/logger';

export const rateLimiter = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const key = req.apiKey
    ? `ratelimit:apikey:${req.apiKey._id}`
    : `ratelimit:user:${req.user?._id}`;

  const limit = req.apiKey?.rateLimit?.requestsPerMinute || config.rateLimit.maxRequests;
  const windowMs = config.rateLimit.windowMs;

  try {
    const redis = (req.app as any).locals.redis as any;
    if (!redis) {
      next();
      return;
    }

    const current = await redis.incr(key);
    if (current === 1) {
      await redis.pexpire(key, windowMs);
    }

    const ttl = await redis.pttl(key);
    res.setHeader('X-RateLimit-Limit', limit.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current).toString());
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + ttl).toISOString());

    if (current > limit) {
      await SystemLog.create({
        tenantId: req.tenantId,
        level: 'warn',
        service: 'api_gateway',
        action: 'rate_limit.exceeded',
        message: `Rate limit exceeded for ${req.apiKey ? 'API key' : 'user'}`,
        metadata: { current, limit, path: req.originalUrl },
        sourceIp: req.ip,
      });

      logger.warn({ requestId: (req as any).id, rateLimitExceeded: true, current, limit, path: req.originalUrl });
      res.status(429).json({ success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests.' } });
      return;
    }

    next();
  } catch (error) {
    next();
  }
};
