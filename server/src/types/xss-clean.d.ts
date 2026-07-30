declare module 'xss-clean' {
  import { Request, Response, NextFunction } from 'express';
  const xssClean: () => (req: Request, res: Response, next: NextFunction) => void;
  export default xssClean;
}