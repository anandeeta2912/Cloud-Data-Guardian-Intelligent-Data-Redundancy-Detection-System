import { Router } from 'express';
import { User } from '../models';
import { IUser } from '../models/User';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { AppError } from '../utils/errors';
import { sanitizeUser } from '../utils/sanitize';

const router = Router();

router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    res.status(200).json({ success: true, data: sanitizeUser(req.user!) });
  } catch (error) {
    next(error);
  }
});

router.patch('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { name, avatarUrl } = req.body;
    const user = await User.findByIdAndUpdate(req.user!._id, { name, avatarUrl }, { new: true });
    if (!user) throw new AppError('User not found.', 404, 'NOT_FOUND');
    res.status(200).json({ success: true, data: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticate, authorize('admin', 'owner'), async (req: AuthRequest, res, next) => {
  try {
    const { role, page = '1', limit = '20', sortBy = 'createdAt', order = 'desc' } = req.query;
    const filter: any = { tenantId: req.tenantId };
    if (role) filter.role = role;

    const users = await User.find(filter)
      .sort({ [sortBy as string]: order === 'asc' ? 1 : -1 })
      .limit(parseInt(limit as string))
      .skip((parseInt(page as string) - 1) * parseInt(limit as string))
      .lean();

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        users: users.map((u: any) => sanitizeUser(u as IUser)),
        pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total, totalPages: Math.ceil(total / parseInt(limit as string)) },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/invite', authenticate, authorize('admin', 'owner'), async (req: AuthRequest, res, next) => {
  try {
    const { email, name, role } = req.body;
    const existing = await User.findOne({ tenantId: req.tenantId, email });
    if (existing) {
      throw new AppError('User already exists.', 409, 'USER_EXISTS');
    }
    const user = await User.create({ tenantId: req.tenantId!, email, name, role: role || 'viewer' });
    res.status(201).json({ success: true, data: { userId: user._id, email: user.email, role: user.role } });
  } catch (error) {
    next(error);
  }
});

router.patch('/:userId/role', authenticate, authorize('admin', 'owner'), async (req: AuthRequest, res, next) => {
  try {
    const user = await User.findOneAndUpdate({ _id: req.params.userId, tenantId: req.tenantId }, { role: req.body.role }, { new: true });
    if (!user) {
      throw new AppError('User not found.', 404, 'NOT_FOUND');
    }
    res.status(200).json({ success: true, data: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.delete('/:userId', authenticate, authorize('admin', 'owner'), async (req: AuthRequest, res, next) => {
  try {
    await User.findOneAndDelete({ _id: req.params.userId, tenantId: req.tenantId });
    res.status(200).json({ success: true, message: 'User removed successfully.' });
  } catch (error) {
    next(error);
  }
});

export default router;