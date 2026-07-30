import { Router } from 'express';
import { Webhook } from '../models';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { z } from 'zod';
import { NotificationService } from '../services/notification.service';
import { AppError } from '../utils/errors';

const router = Router();

router.post('/', authenticate, validateBody(z.object({
  url: z.string().url('Please enter a valid URL.'),
  events: z.array(z.string()).min(1, 'At least one event must be selected.'),
  secret: z.string().min(8, 'Secret must be at least 8 characters.'),
  headers: z.record(z.string()).optional(),
  retryPolicy: z.object({ maxRetries: z.number(), backoff: z.string(), timeoutMs: z.number() }).optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const webhook = await Webhook.create({ ...req.body, tenantId: req.tenantId! });
    res.status(201).json({ success: true, data: webhook });
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const webhooks = await Webhook.find({ tenantId: req.tenantId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: { webhooks } });
  } catch (error) {
    next(error);
  }
});

router.delete('/:webhookId', authenticate, authorize('admin', 'owner'), async (req: AuthRequest, res, next) => {
  try {
    await Webhook.findOneAndDelete({ _id: req.params.webhookId, tenantId: req.tenantId });
    res.status(200).json({ success: true, message: 'Webhook deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

router.post('/test', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await NotificationService.triggerWebhooks(req.tenantId!, 'record.accepted', { test: true, timestamp: Date.now() });
    res.status(200).json({ success: true, message: 'Test webhook triggered.' });
  } catch (error) {
    next(error);
  }
});

export default router;