import { IUser } from '../models/User';

export interface SanitizedUser {
  userId: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  avatarUrl: string | undefined;
  mfaEnabled: boolean;
  lastLogin: Date | undefined;
}

export function sanitizeUser(user: IUser): SanitizedUser {
  const { passwordHash, ...safe } = user.toObject ? user.toObject() : user;
  return {
    userId: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
    avatarUrl: user.avatarUrl,
    mfaEnabled: user.mfaEnabled,
    lastLogin: user.lastLogin,
  };
}
