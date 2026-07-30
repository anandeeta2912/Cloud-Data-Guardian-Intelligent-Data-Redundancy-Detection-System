import { Request, Response, NextFunction } from 'express';
import { SystemLog } from '../models/SystemLog';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export const errorHandler = async (err: Error, req: any, res: Response, next: NextFunction): Promise<void> => {
  const { tenantId, user, id } = req;

  const statusCode = (err as any).statusCode || 500;
  const code = (err as any).code || 'INTERNAL_ERROR';
  const message = err.message || 'Internal server error';

  if (statusCode >= 500) {
    try {
      await SystemLog.create({
        tenantId,
        userId: user?._id,
        level: 'error',
        service: 'api_gateway',
        action: 'error.handler',
        message,
        metadata: { url: req.originalUrl, method: req.method, requestId: id },
        sourceIp: req.ip,
        userAgent: req.get('user-agent'),
        errorStack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      });
    } catch (logError) {
      logger.error({ requestId: id, error: 'Failed to write error log', details: (logError as Error).message });
    }

    logger.error({ requestId: id, error: message, url: req.originalUrl, method: req.method });
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};
