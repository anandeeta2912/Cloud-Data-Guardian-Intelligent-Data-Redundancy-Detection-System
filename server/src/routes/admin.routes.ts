import { Router } from 'express';
import { SystemLog, Tenant } from '../models';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { AppError } from '../utils/errors';

const router = Router();

router.get('/logs', authenticate, authorize('admin', 'owner'), async (req: AuthRequest, res, next) => {
  try {
    const { level, service, page = '1', limit = '50' } = req.query;
    const filter: any = {};
    if (level) filter.level = level;
    if (service) filter.service = service;

    const logs = await SystemLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .skip((parseInt(page as string) - 1) * parseInt(limit as string))
      .lean();

    const total = await SystemLog.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total, totalPages: Math.ceil(total / parseInt(limit as string)) },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/health', async (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;