import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { SystemLog } from '../models/SystemLog';

export const validateBody = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed.',
            data: {
              errors: error.errors.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
                value: e.path.length > 0 ? (req.body as any)[e.path[0] as string] : undefined,
              })),
            },
          },
        });
        return;
      }
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Validation error.' } });
    }
  };
};
