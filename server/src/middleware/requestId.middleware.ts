import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare module 'express-serve-static-core' {
  interface Request {
    id: string;
  }
}

export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const id = randomUUID();
  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
};
