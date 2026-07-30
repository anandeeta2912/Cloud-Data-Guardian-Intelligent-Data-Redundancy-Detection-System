import { Router } from 'express';
import { DuplicateLog, Record } from '../models';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { z } from 'zod';
import { AppError } from '../utils/errors';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { datasetId, page = '1', limit = '50', matchType, minScore, startDate, endDate, source, search, classification } = req.query;
    const filter: any = { tenantId: req.tenantId };
    if (datasetId) filter.datasetId = datasetId;
    if (matchType) filter.matchType = matchType;
    if (classification) filter.classification = classification;
    if (minScore) filter.similarityScore = { $gte: parseFloat(minScore as string) };
    if (startDate) filter.ingestedAt = { $gte: new Date(startDate as string) };
    if (endDate) filter.ingestedAt = { ...filter.ingestedAt, $lte: new Date(endDate as string) };
    if (source) filter.source = source;
    if (search) {
      filter.$or = [
        { recordHash: { $regex: search, $options: 'i' } },
        { rejectionReason: { $regex: search, $options: 'i' } },
      ];
    }

    const duplicates = await DuplicateLog.find(filter)
      .sort({ ingestedAt: -1 })
      .limit(parseInt(limit as string))
      .skip((parseInt(page as string) - 1) * parseInt(limit as string))
      .lean();

    const total = await DuplicateLog.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        duplicates,
        pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total, totalPages: Math.ceil(total / parseInt(limit as string)) },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/stats', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { datasetId, startDate, endDate } = req.query;
    const matchStage: any = { tenantId: req.tenantId };
    if (datasetId) matchStage.datasetId = datasetId;
    if (startDate || endDate) matchStage.ingestedAt = {};
    if (startDate) matchStage.ingestedAt.$gte = new Date(startDate as string);
    if (endDate) matchStage.ingestedAt.$lte = new Date(endDate as string);

    const [totalDuplicates, exactDuplicates, fuzzyDuplicates, semanticDuplicates, avgScore, scoreDistribution, topSources, totalUnique] = await Promise.all([
      DuplicateLog.countDocuments(matchStage),
      DuplicateLog.countDocuments({ ...matchStage, matchType: 'exact' }),
      DuplicateLog.countDocuments({ ...matchStage, matchType: 'fuzzy' }),
      DuplicateLog.countDocuments({ ...matchStage, matchType: 'semantic' }),
      DuplicateLog.aggregate([{ $match: { ...matchStage, similarityScore: { $exists: true } } }, { $group: { _id: null, avg: { $avg: '$similarityScore' } } }]),
      DuplicateLog.aggregate([
        { $match: { ...matchStage, similarityScore: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: {
              $switch: {
                branches: [
                  { case: { $gte: ['$similarityScore', 0.99] }, then: '100' },
                  { case: { $gte: ['$similarityScore', 0.8] }, then: '81-99' },
                  { case: { $gte: ['$similarityScore', 0.6] }, then: '61-80' },
                  { case: { $gte: ['$similarityScore', 0.4] }, then: '41-60' },
                  { case: { $gte: ['$similarityScore', 0.2] }, then: '21-40' },
                ],
                default: '0-20',
              },
            },
            count: { $sum: 1 },
          },
        },
      ]),
      DuplicateLog.aggregate([{ $match: matchStage }, { $group: { _id: '$source', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
      Record.countDocuments(matchStage),
    ]);

    const distribution: Record<string, number> = {};
    scoreDistribution.forEach((d: any) => { distribution[d._id] = d.count; });

    res.status(200).json({
      success: true,
      data: {
        totalDuplicates,
        exactDuplicates,
        fuzzyDuplicates,
        semanticDuplicates,
        duplicatePercentage: totalDuplicates + totalUnique > 0 ? ((totalDuplicates / (totalDuplicates + totalUnique)) * 100).toFixed(2) : '0.00',
        avgSimilarityScore: avgScore.length > 0 ? avgScore[0].avg : 0,
        scoreDistribution: distribution,
        topSources,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:duplicateId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const duplicate = await DuplicateLog.findOne({ _id: req.params.duplicateId, tenantId: req.tenantId }).lean();
    if (!duplicate) {
      throw new AppError('Duplicate log not found.', 404, 'NOT_FOUND');
    }
    res.status(200).json({ success: true, data: duplicate });
  } catch (error) {
    next(error);
  }
});

const reviewSchema = z.object({
  action: z.enum(['accepted_as_unique', 'force_merged', 'dismissed'], { invalid_type_error: 'Invalid review action.' }),
  notes: z.string().optional(),
});

router.patch('/:duplicateId/review', authenticate, validateBody(reviewSchema), async (req: AuthRequest, res, next) => {
  try {
    const duplicate = await DuplicateLog.findOneAndUpdate(
      { _id: req.params.duplicateId, tenantId: req.tenantId },
      { reviewedAt: new Date(), reviewedBy: req.user!._id, reviewAction: req.body.action },
      { new: true }
    );
    if (!duplicate) {
      throw new AppError('Duplicate log not found.', 404, 'NOT_FOUND');
    }
    res.status(200).json({ success: true, data: duplicate });
  } catch (error) {
    next(error);
  }
});

export default router;