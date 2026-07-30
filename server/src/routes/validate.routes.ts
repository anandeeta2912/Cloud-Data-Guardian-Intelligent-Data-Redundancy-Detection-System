import { Router } from 'express';
import { ValidationService } from '../services/validation.service';
import { ValidationReport } from '../models';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { z } from 'zod';
import { AppError } from '../utils/errors';

const router = Router();

router.post('/record', authenticate, validateBody(z.object({ datasetId: z.string().min(1, 'Dataset ID is required.'), data: z.record(z.any()) })), async (req: AuthRequest, res, next) => {
  try {
    const result = await ValidationService.validateRecord(req, req.body.datasetId, req.body.data);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/batch', authenticate, validateBody(z.object({ datasetId: z.string().min(1, 'Dataset ID is required.'), records: z.array(z.object({ data: z.record(z.any()) })).min(1, 'At least one record is required.') })), async (req: AuthRequest, res, next) => {
  try {
    const result = await ValidationService.validateBatch(req, req.body.datasetId, req.body.records);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/reports', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { datasetId, page = '1', limit = '20', status } = req.query;
    const filter: any = { tenantId: req.tenantId };
    if (datasetId) filter.datasetId = datasetId;
    if (status) filter.status = status;

    const reports = await ValidationReport.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .skip((parseInt(page as string) - 1) * parseInt(limit as string))
      .lean();

    const total = await ValidationReport.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        reports,
        pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total, totalPages: Math.ceil(total / parseInt(limit as string)) },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/reports/:validationId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const report = await ValidationReport.findOne({ _id: req.params.validationId, tenantId: req.tenantId }).lean();
    if (!report) {
      throw new AppError('Validation report not found.', 404, 'NOT_FOUND');
    }
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
});

export default router;