import { Request, Response, NextFunction } from 'express';

export const requestTimeout = (req: Request, res: Response, next: NextFunction): void => {
  const timeoutMs = parseInt(process.env.REQUEST_TIMEOUT_MS || '30000', 10);

  req.setTimeout(timeoutMs, () => {
    if (!res.headersSent) {
      res.status(408).json({ success: false, error: { code: 'REQUEST_TIMEOUT', message: 'Request timeout.' } });
    }
  });

  res.setTimeout(timeoutMs, () => {
    if (!res.headersSent) {
      res.status(408).json({ success: false, error: { code: 'REQUEST_TIMEOUT', message: 'Request timeout.' } });
    }
  });

  next();
};
