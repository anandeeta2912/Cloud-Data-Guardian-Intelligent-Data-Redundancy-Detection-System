import { Router } from 'express';
import { Dataset, Record, DuplicateLog } from '../models';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { z } from 'zod';
import { AppError } from '../utils/errors';

const router = Router();

const createDatasetSchema = z.object({
  name: z.string().min(2, 'Dataset name must be at least 2 characters.'),
  slug: z.string().min(2, 'Slug must be at least 2 characters.').max(50, 'Slug must be at most 50 characters.'),
  schemaDefinition: z.record(z.any()),
  dedupRules: z.record(z.any()).optional(),
  primaryKeyFields: z.array(z.string()).optional(),
  fuzzyMatchRules: z.array(z.object({ field: z.string(), algorithm: z.string(), threshold: z.number().min(0, 'Threshold must be at least 0').max(1, 'Threshold must be at most 1'), weight: z.number().min(0, 'Weight must be at least 0') })).optional(),
  cloudDestination: z.record(z.any()).optional(),
  retentionDays: z.number().min(1, 'Retention must be at least 1 day.').optional(),
});

router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { page = '1', limit = '20', status = 'active', sortBy = 'createdAt', order = 'desc' } = req.query;
    const tenantId = req.tenantId!;

    const datasets = await Dataset.find({ tenantId, status })
      .sort({ [sortBy as string]: order === 'asc' ? 1 : -1 })
      .limit(parseInt(limit as string))
      .skip((parseInt(page as string) - 1) * parseInt(limit as string))
      .lean();

    const datasetIds = datasets.map((d) => d.datasetId);

    const [recordCounts, duplicateCounts] = await Promise.all([
      Record.aggregate([
        { $match: { tenantId, datasetId: { $in: datasetIds } } },
        { $group: { _id: '$datasetId', totalRecords: { $sum: 1 } } },
      ]),
      DuplicateLog.aggregate([
        { $match: { tenantId, datasetId: { $in: datasetIds } } },
        { $group: { _id: '$datasetId', totalDuplicates: { $sum: 1 } } },
      ]),
    ]);

    const recordMap = new Map(recordCounts.map((r: any) => [r._id, r.totalRecords]));
    const duplicateMap = new Map(duplicateCounts.map((d: any) => [d._id, d.totalDuplicates]));

    const enrichedDatasets = datasets.map((ds) => ({
      ...ds,
      totalRecords: recordMap.get(ds.datasetId) || 0,
      totalDuplicates: duplicateMap.get(ds.datasetId) || 0,
    }));

    const total = await Dataset.countDocuments({ tenantId, status });

    res.status(200).json({
      success: true,
      data: {
        datasets: enrichedDatasets,
        pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total, totalPages: Math.ceil(total / parseInt(limit as string)) },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, authorize('editor', 'admin', 'owner'), validateBody(createDatasetSchema), async (req: AuthRequest, res, next) => {
  try {
    const { dedupRules, primaryKeyFields, fuzzyMatchRules, ...rest } = req.body;
    const datasetData: any = { ...rest, tenantId: req.tenantId!, createdBy: req.user!._id };
    if (dedupRules?.primaryKeyFields) datasetData.primaryKeyFields = dedupRules.primaryKeyFields;
    if (dedupRules?.fuzzyMatchRules) datasetData.fuzzyMatchRules = dedupRules.fuzzyMatchRules;
    if (primaryKeyFields) datasetData.primaryKeyFields = primaryKeyFields;
    if (fuzzyMatchRules) datasetData.fuzzyMatchRules = fuzzyMatchRules;
    if (dedupRules && !dedupRules.primaryKeyFields && !dedupRules.fuzzyMatchRules) datasetData.dedupRules = dedupRules;
    const dataset = await Dataset.create(datasetData);
    res.status(201).json({ success: true, data: dataset });
  } catch (error: any) {
    if (error.code === 11000) {
      throw new AppError('Dataset slug already exists.', 409, 'DUPLICATE_SLUG');
    }
    next(error);
  }
});

router.get('/:datasetId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const dataset = await Dataset.findOne({ tenantId: req.tenantId!, datasetId: req.params.datasetId }).lean();
    if (!dataset) {
      throw new AppError('Dataset not found.', 404, 'NOT_FOUND');
    }
    res.status(200).json({ success: true, data: dataset });
  } catch (error) {
    next(error);
  }
});

router.patch('/:datasetId', authenticate, authorize('editor', 'admin', 'owner'), async (req: AuthRequest, res, next) => {
  try {
    const { dedupRules, primaryKeyFields, fuzzyMatchRules, ...rest } = req.body;
    const updateData: any = { ...rest };
    if (dedupRules?.primaryKeyFields) updateData.primaryKeyFields = dedupRules.primaryKeyFields;
    if (dedupRules?.fuzzyMatchRules) updateData.fuzzyMatchRules = dedupRules.fuzzyMatchRules;
    if (primaryKeyFields) updateData.primaryKeyFields = primaryKeyFields;
    if (fuzzyMatchRules) updateData.fuzzyMatchRules = fuzzyMatchRules;
    if (dedupRules && !dedupRules.primaryKeyFields && !dedupRules.fuzzyMatchRules) updateData.dedupRules = dedupRules;
    const dataset = await Dataset.findOneAndUpdate({ tenantId: req.tenantId!, datasetId: req.params.datasetId }, updateData, { new: true });
    if (!dataset) {
      throw new AppError('Dataset not found.', 404, 'NOT_FOUND');
    }
    res.status(200).json({ success: true, data: dataset });
  } catch (error) {
    next(error);
  }
});

router.delete('/:datasetId', authenticate, authorize('admin', 'owner'), async (req: AuthRequest, res, next) => {
  try {
    await Dataset.findOneAndUpdate({ tenantId: req.tenantId!, datasetId: req.params.datasetId }, { status: 'archived' });
    res.status(200).json({ success: true, message: 'Dataset archived successfully.' });
  } catch (error) {
    next(error);
  }
});

export default router;