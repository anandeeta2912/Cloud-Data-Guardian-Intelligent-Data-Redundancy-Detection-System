import { Request, Response, NextFunction } from 'express';
import { User, ApiKey } from '../models';
import { config } from '../config';
import { SystemLog } from '../models/SystemLog';
import { IUser } from '../models/User';
import { IApiKey } from '../models/ApiKey';
import { verifyJwt } from '../utils/crypto';
import { AppError } from '../utils/errors';

export interface AuthRequest extends Request {
  user?: IUser;
  tenantId?: string;
  apiKey?: IApiKey;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new AppError('Missing authorization header.', 401, 'UNAUTHORIZED');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2) {
      throw new AppError('Invalid authorization header format.', 401, 'UNAUTHORIZED');
    }

    const [type, token] = parts;

    if (type === 'Bearer') {
      const decoded = verifyJwt(token!);
      if (!decoded.userId) {
        throw new AppError('Invalid token payload.', 401, 'UNAUTHORIZED');
      }
      const user = await User.findById(decoded.userId);
      if (!user) {
        throw new AppError('User not found.', 401, 'UNAUTHORIZED');
      }
      req.user = user;
      req.tenantId = user.tenantId;
      next();
      return;
    }

    if (type === 'ApiKey') {
      const apiKey = await ApiKey.findOne({ keyHash: token, isRevoked: false });
      if (!apiKey || (apiKey.expiresAt && apiKey.expiresAt < new Date())) {
        throw new AppError('Invalid or expired API key.', 401, 'UNAUTHORIZED');
      }
      apiKey.lastUsed = new Date();
      await apiKey.save();
      req.apiKey = apiKey;
      req.tenantId = apiKey.tenantId;
      next();
      return;
    }

    throw new AppError('Invalid authorization type.', 401, 'UNAUTHORIZED');
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    return next(new AppError('Invalid or expired token.', 401, 'UNAUTHORIZED'));
  }
};
