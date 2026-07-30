import { Analytics, Record, DuplicateLog, Dataset, IngestionJob, ValidationReport } from '../models';
import { AuthRequest } from '../middleware/auth.middleware';
import { SystemLog } from '../models/SystemLog';

export class AnalyticsService {
  static async getOverview(req: AuthRequest, datasetId?: string) {
    const tenantId = req.tenantId!;
    const matchStage: any = { tenantId };
    if (datasetId) matchStage.datasetId = datasetId;

    const [totalDuplicates, totalUnique] = await Promise.all([
      DuplicateLog.countDocuments(matchStage),
      Record.countDocuments(matchStage),
    ]);
    const totalIngested = totalDuplicates + totalUnique;

    const duplicatePercentage = totalIngested > 0 ? ((totalDuplicates / totalIngested) * 100).toFixed(2) : '0.00';

    const avgSimilarity = await DuplicateLog.aggregate([
      { $match: { ...matchStage, similarityScore: { $exists: true } } },
      { $group: { _id: null, avgScore: { $avg: '$similarityScore' } } },
    ]);

    const topSources = await DuplicateLog.aggregate([
      { $match: matchStage },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const recentActivity = await Record.find(matchStage)
      .sort({ ingestedAt: -1 })
      .limit(10)
      .lean();

    return {
      totalIngested,
      totalUnique,
      totalDuplicates,
      duplicatePercentage: parseFloat(duplicatePercentage),
      avgSimilarityScore: avgSimilarity.length > 0 ? avgSimilarity[0].avgScore : 0,
      topSources,
      recentActivity,
    };
  }

  static async getSimilarityDistribution(req: AuthRequest, datasetId?: string) {
    const tenantId = req.tenantId!;
    const matchStage: any = { tenantId };
    if (datasetId) matchStage.datasetId = datasetId;

    const distribution = await DuplicateLog.aggregate([
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
    ]);

    const result: Record<string, number> = {};
    distribution.forEach((d: any) => { result[d._id] = d.count; });

    return result;
  }

  static async getTimeSeries(req: AuthRequest, datasetId?: string, startDate?: Date, endDate?: Date) {
    const tenantId = req.tenantId!;

    const matchStage: any = { tenantId };
    if (datasetId) matchStage.datasetId = datasetId;
    if (startDate || endDate) matchStage.ingestedAt = {};
    if (startDate) matchStage.ingestedAt.$gte = startDate;
    if (endDate) matchStage.ingestedAt.$lte = endDate;

    const data = await Record.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$ingestedAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return data.map((d: any) => ({ date: d._id, count: d.count }));
  }

  static async getDatasetStats(req: AuthRequest, datasetId: string) {
    const tenantId = req.tenantId!;

    const [totalRecords, totalDuplicates, lastIngested] = await Promise.all([
      Record.countDocuments({ tenantId, datasetId }),
      DuplicateLog.countDocuments({ tenantId, datasetId }),
      Record.findOne({ tenantId, datasetId }).sort({ ingestedAt: -1 }).select('ingestedAt'),
    ]);

    const dataset = await Dataset.findOne({ tenantId, datasetId }).select('name createdAt');

    return {
      datasetId,
      name: dataset?.name,
      totalRecords,
      totalDuplicates,
      duplicatePercentage: totalRecords + totalDuplicates > 0 ? ((totalDuplicates / (totalRecords + totalDuplicates)) * 100).toFixed(2) : '0.00',
      lastIngestedAt: lastIngested?.ingestedAt,
      createdAt: dataset?.createdAt,
    };
  }

  static async ingestAnalyticsEvent(req: AuthRequest, data: { metricType: string; timeBucket: string; metrics: Record<string, any>; datasetId?: string }) {
    const now = new Date();
    const bucketEnd = new Date(now);

    let bucketStart: Date;
    switch (data.timeBucket) {
      case 'hour':
        bucketStart = new Date(now.setMinutes(0, 0, 0));
        break;
      case 'day':
        bucketStart = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        bucketStart = new Date(now.setDate(now.getDate() - now.getDay()));
        bucketStart.setHours(0, 0, 0, 0);
        break;
      case 'month':
        bucketStart = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        bucketStart = new Date(now.setHours(0, 0, 0, 0));
    }

    await Analytics.findOneAndUpdate(
      {
        tenantId: req.tenantId,
        datasetId: data.datasetId,
        metricType: data.metricType,
        bucketStart,
      },
      {
        $set: {
          bucketEnd,
          metrics: data.metrics,
          updatedAt: now,
        },
      },
      { upsert: true, new: true }
    );

    await SystemLog.create({
      tenantId: req.tenantId,
      level: 'debug',
      service: 'analytics_engine',
      action: 'analytics.updated',
      message: `Analytics event for ${data.metricType}`,
      metadata: { metricType: data.metricType, datasetId: data.datasetId },
    });
  }
}
