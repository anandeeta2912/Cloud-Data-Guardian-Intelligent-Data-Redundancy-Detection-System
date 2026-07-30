import { AuthRequest } from './auth.middleware';
import { Response, NextFunction } from 'express';
import { User } from '../models';
import { SystemLog } from '../models/SystemLog';
import { AppError } from '../utils/errors';

type Role = 'owner' | 'admin' | 'editor' | 'viewer' | 'api_user';

const roleHierarchy: Record<Role, number> = {
  owner: 5,
  admin: 4,
  editor: 3,
  viewer: 2,
  api_user: 1,
};

export const authorize = (...allowedRoles: Role[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }

    const userRole = req.user.role as Role;
    const hasRole = allowedRoles.some((role) => roleHierarchy[userRole] >= roleHierarchy[role]);

    if (!hasRole) {
      await SystemLog.create({
        tenantId: req.tenantId,
        userId: req.user._id,
        level: 'warn',
        service: 'api_gateway',
        action: 'access.denied',
        message: `User ${req.user.email} attempted to access ${req.method} ${req.path}`,
        metadata: { allowedRoles, userRole },
        sourceIp: req.ip,
        userAgent: req.get('user-agent'),
      });

      throw new AppError('Insufficient permissions.', 403, 'FORBIDDEN');
    }

    next();
  };
};
