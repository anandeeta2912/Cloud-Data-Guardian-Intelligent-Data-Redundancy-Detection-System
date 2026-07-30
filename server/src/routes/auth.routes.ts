import { Router } from 'express';
import { AuthService } from '../services/auth.service';
import { validateBody } from '../middleware/validation.middleware';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { AppError } from '../utils/errors';
import { sanitizeUser } from '../utils/sanitize';

const router = Router();

const registerSchema = z.object({
  tenantName: z.string().min(2, 'Workspace name must be at least 2 characters.'),
  tenantSlug: z.string().min(2, 'Slug must be at least 2 characters.').max(50, 'Slug must be at most 50 characters.'),
  industry: z.string().optional(),
  adminName: z.string().min(2, 'Admin name must be at least 2 characters.'),
  adminEmail: z.string().email('Please enter a valid email address.'),
  adminPassword: z.string().min(8, 'Password must be at least 8 characters.'),
});

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
  tenantSlug: z.string().min(1, 'Workspace slug is required.'),
});

router.get('/me', authenticate, async (req: AuthRequest, res) => {
  res.status(200).json({ success: true, data: sanitizeUser(req.user!) });
});

router.post('/register', validateBody(registerSchema), async (req, res, next) => {
  try {
    const result = await AuthService.register(req.body);
    res.status(201).json({ success: true, data: { ...result, user: sanitizeUser(result.user) } });
  } catch (error) {
    next(error);
  }
});

router.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const result = await AuthService.login(req.body);
    res.status(200).json({ success: true, data: { ...result, user: sanitizeUser(result.user) } });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new AppError('refreshToken is required.', 422, 'VALIDATION_ERROR');
    }
    const tokens = await AuthService.refreshToken(refreshToken);
    res.status(200).json({ success: true, data: tokens });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', authenticate, async (req, res) => {
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

router.post('/api-keys', authenticate, authorize('admin', 'owner'), async (req: AuthRequest, res, next) => {
  try {
    const { name, permissions, rateLimit, expiresAt } = req.body;
    const result = await AuthService.createApiKey(req.user!._id.toString(), req.tenantId as string, { name, permissions, rateLimit, expiresAt });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/api-keys', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const keys = await AuthService.listApiKeys(req.tenantId!);
    const sanitized = keys.map((k: any) => ({
      keyId: k._id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      permissions: k.permissions,
      lastUsed: k.lastUsed,
      expiresAt: k.expiresAt,
      isRevoked: k.isRevoked,
      createdAt: k.createdAt,
    }));
    res.status(200).json({ success: true, data: { keys: sanitized } });
  } catch (error) {
    next(error);
  }
});

router.delete('/api-keys/:keyId', authenticate, authorize('admin', 'owner'), async (req: AuthRequest, res, next) => {
  try {
    await AuthService.revokeApiKey(req.tenantId!, req.params.keyId!);
    res.status(200).json({ success: true, message: 'API key revoked successfully.' });
  } catch (error) {
    next(error);
  }
});

export default router;