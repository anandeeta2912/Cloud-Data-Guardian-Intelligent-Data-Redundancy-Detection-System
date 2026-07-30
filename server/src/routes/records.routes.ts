import { Router } from 'express';
import { Record } from '../models';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { AppError } from '../utils/errors';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { datasetId, page = '1', limit = '50', sortBy = 'ingestedAt', order = 'desc', source, startDate, endDate, search } = req.query;
    const filter: any = { tenantId: req.tenantId, isDeleted: false };
    if (datasetId) filter.datasetId = datasetId;
    if (source) filter.source = source;
    if (startDate && endDate) filter.ingestedAt = { $gte: new Date(startDate as string), $lte: new Date(endDate as string) };

    if (search) {
      const searchRegex = { $regex: search as string, $options: 'i' };
      const dataFieldConditions: any[] = [
        { 'data.Name': searchRegex },
        { 'data.name': searchRegex },
        { 'data.Email': searchRegex },
        { 'data.email': searchRegex },
        { 'data.Phone': searchRegex },
        { 'data.phone': searchRegex },
        { 'data.Department': searchRegex },
        { 'data.department': searchRegex },
      ];
      const topLevelConditions = [
        { recordHash: searchRegex },
        { source: searchRegex },
        { recordId: searchRegex },
      ];
      const allConditions = [...dataFieldConditions, ...topLevelConditions];
      allConditions.push({
        $expr: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: { $objectToArray: '$data' },
                  as: 'item',
                  cond: {
                    $and: [
                      { $eq: [{ $type: '$$item.v' }, 'string'] },
                      { $regexMatch: { input: '$$item.v', regex: search as string, options: 'i' } },
                    ],
                  },
                },
              },
            },
            0,
          ],
        },
      });
      filter.$or = allConditions;
    }

    const records = await Record.find(filter)
      .sort({ [sortBy as string]: order === 'asc' ? 1 : -1 })
      .limit(parseInt(limit as string))
      .skip((parseInt(page as string) - 1) * parseInt(limit as string))
      .lean();

    const total = await Record.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        records,
        pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total, totalPages: Math.ceil(total / parseInt(limit as string)) },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:recordId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const record = await Record.findOne({ tenantId: req.tenantId, _id: req.params.recordId, isDeleted: false }).lean();
    if (!record) {
      throw new AppError('Record not found.', 404, 'NOT_FOUND');
    }
    res.status(200).json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

router.patch('/:recordId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const existing = await Record.findOne({ tenantId: req.tenantId, _id: req.params.recordId, isDeleted: false });
    if (!existing) {
      throw new AppError('Record not found.', 404, 'NOT_FOUND');
    }
    const newRecord = await Record.create({
      tenantId: req.tenantId,
      datasetId: existing.datasetId,
      data: { ...existing.data, ...req.body.data },
      recordHash: existing.recordHash,
      source: req.body.source || existing.source,
      version: existing.version + 1,
      previousRecordId: existing._id,
    });
    res.status(200).json({ success: true, data: newRecord });
  } catch (error) {
    next(error);
  }
});

router.delete('/:recordId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await Record.findOneAndUpdate({ tenantId: req.tenantId, _id: req.params.recordId }, { isDeleted: true });
    res.status(200).json({ success: true, message: 'Record deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

export default router;