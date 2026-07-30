import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, Tenant, ApiKey } from '../models';
import { config } from '../config';
import { SystemLog } from '../models/SystemLog';
import { hashPassword, generateJwt, generateRefreshToken, hashApiKey } from '../utils/crypto';
import { AppError } from '../utils/errors';

export class AuthService {
  static async register(data: { tenantName: string; tenantSlug: string; industry: string; adminName: string; adminEmail: string; adminPassword: string }) {
    const existingTenant = await Tenant.findOne({ slug: data.tenantSlug });
    if (existingTenant) {
      throw new AppError('Workspace slug is already taken.', 409, 'TENANT_SLUG_EXISTS');
    }

    const tenant = await Tenant.create({
      name: data.tenantName,
      slug: data.tenantSlug,
      industry: data.industry || 'generic',
      plan: 'free',
    });

    const passwordHash = await hashPassword(data.adminPassword);
    const user = await User.create({
      tenantId: tenant.tenantId,
      email: data.adminEmail,
      name: data.adminName,
      passwordHash,
      role: 'owner',
    });

    const tokens = {
      accessToken: generateJwt({ userId: user._id.toString(), tenantId: tenant.tenantId }),
      refreshToken: generateRefreshToken({ userId: user._id.toString(), tenantId: tenant.tenantId }),
      expiresIn: 900,
    };

    await SystemLog.create({
      tenantId: tenant.tenantId,
      userId: user._id,
      level: 'info',
      service: 'auth_service',
      action: 'tenant.registered',
      message: `Tenant ${data.tenantName} registered`,
    });

    return { tenant, user, tokens };
  }

  static async login(data: { email: string; password: string; tenantSlug: string }) {
    const tenant = await Tenant.findOne({ slug: data.tenantSlug });
    if (!tenant) {
      throw new AppError('Email or password is incorrect.', 401, 'INVALID_CREDENTIALS');
    }

    const user = await User.findOne({ tenantId: tenant.tenantId, email: data.email });
    if (!user) {
      throw new AppError('Email or password is incorrect.', 401, 'INVALID_CREDENTIALS');
    }

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) {
      throw new AppError('Email or password is incorrect.', 401, 'INVALID_CREDENTIALS');
    }

    user.lastLogin = new Date();
    await user.save();

    const tokens = {
      accessToken: generateJwt({ userId: user._id.toString(), tenantId: tenant.tenantId }),
      refreshToken: generateRefreshToken({ userId: user._id.toString(), tenantId: tenant.tenantId }),
      expiresIn: 900,
    };

    await SystemLog.create({
      tenantId: tenant.tenantId,
      userId: user._id,
      level: 'info',
      service: 'auth_service',
      action: 'user.login',
      message: `User ${user.email} logged in`,
    });

    return { user, tokens };
  }

  static async refreshToken(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret as string) as { userId: string; tenantId: string };
      const user = await User.findById(decoded.userId);
      if (!user) throw new AppError('Invalid or expired refresh token.', 401, 'INVALID_REFRESH_TOKEN');

      const tokens = {
        accessToken: generateJwt({ userId: user._id.toString(), tenantId: user.tenantId }),
        refreshToken: generateRefreshToken({ userId: user._id.toString(), tenantId: user.tenantId }),
        expiresIn: 900,
      };
      return tokens;
    } catch {
      throw new AppError('Invalid or expired refresh token.', 401, 'INVALID_REFRESH_TOKEN');
    }
  }

  static async createApiKey(userId: string, tenantId: string, data: { name: string; permissions: any[]; rateLimit?: any; expiresAt?: Date }) {
    const keyId = `key_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const rawKey = `cdg_live_sk_${Date.now()}_${Math.random().toString(36).substring(2, 16)}`;
    const keyHash = await hashApiKey(rawKey);
    const keyPrefix = rawKey.substring(0, 12);

    const apiKey = await ApiKey.create({
      tenantId,
      name: data.name,
      keyHash,
      keyPrefix,
      permissions: data.permissions,
      rateLimit: data.rateLimit || { requestsPerMinute: 1000, burstLimit: 5000 },
      expiresAt: data.expiresAt,
    });

    return { apiKey, rawKey };
  }

  static async listApiKeys(tenantId: string) {
    return ApiKey.find({ tenantId }).sort({ createdAt: -1 });
  }

  static async revokeApiKey(tenantId: string, keyId: string) {
    const apiKey = await ApiKey.findOne({ _id: keyId, tenantId });
    if (!apiKey) throw new AppError('API key not found.', 404, 'API_KEY_NOT_FOUND');
    apiKey.isRevoked = true;
    await apiKey.save();
    return apiKey;
  }
}
