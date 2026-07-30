import { Router } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { AppError } from '../utils/errors';

const router = Router();

router.get('/overview', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { datasetId, startDate, endDate } = req.query;
    const data = await AnalyticsService.getOverview(req, datasetId as string | undefined);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/similarity', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { datasetId } = req.query;
    const data = await AnalyticsService.getSimilarityDistribution(req, datasetId as string | undefined);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/timeseries', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { datasetId, startDate, endDate } = req.query;
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    const data = await AnalyticsService.getTimeSeries(req, datasetId as string | undefined, start, end);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/datasets/:datasetId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const data = await AnalyticsService.getDatasetStats(req, req.params.datasetId as string);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;