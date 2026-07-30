import { Request, Response, NextFunction } from 'express';

export const notFound = (req: Request, res: Response, next: NextFunction): void => {
  const error = new Error(`Not Found - ${req.originalUrl}`) as any;
  error.statusCode = 404;
  error.code = 'NOT_FOUND';
  next(error);
};
