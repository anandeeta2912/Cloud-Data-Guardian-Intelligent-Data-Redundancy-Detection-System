import { Router } from 'express';
import { ReportService } from '../services/report.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { AppError } from '../utils/errors';

const router = Router();

router.get('/csv/:datasetId', authenticate, authorize('editor', 'admin', 'owner'), async (req: AuthRequest, res, next) => {
  try {
    const { type = 'duplicates' } = req.query;
    const result = await ReportService.generateCSV(req, req.params.datasetId as string, type as any);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
    res.status(200).send(result.content);
  } catch (error) {
    next(error);
  }
});

router.get('/excel/:datasetId', authenticate, authorize('editor', 'admin', 'owner'), async (req: AuthRequest, res, next) => {
  try {
    const result = await ReportService.generateExcel(req, req.params.datasetId as string);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
    res.status(200).send(result.buffer);
  } catch (error) {
    next(error);
  }
});

router.get('/pdf/:datasetId', authenticate, authorize('editor', 'admin', 'owner'), async (req: AuthRequest, res, next) => {
  try {
    const result = await ReportService.generatePDF(req, req.params.datasetId as string);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
    res.status(200).send(result.buffer);
  } catch (error) {
    next(error);
  }
});

export default router;