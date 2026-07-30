import { Router } from 'express';
import { DedupService } from '../services/dedup.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { z } from 'zod';
import { IngestionJob } from '../models';
import { AppError } from '../utils/errors';
import multer from 'multer';
import { parse } from 'csv-parse/sync';

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const uploadSchema = z.object({
  datasetId: z.string().min(1, 'Dataset ID is required.'),
  source: z.string().default('csv_upload'),
});

const ingestSchema = z.object({
  datasetId: z.string().min(1, 'Dataset ID is required.'),
  data: z.record(z.any()),
  source: z.string().default('api'),
  idempotencyKey: z.string().optional(),
});

const batchIngestSchema = z.object({
  datasetId: z.string().min(1, 'Dataset ID is required.'),
  records: z.array(z.object({ data: z.record(z.any()), source: z.string().optional() })).min(1, 'At least one record is required.').max(10000, 'Maximum 10000 records per batch.'),
  source: z.string().default('api'),
  webhookUrl: z.string().url('Please enter a valid URL.').optional(),
});

function parseFileBuffer(buffer: Buffer, filename: string): Record<string, any>[] {
  const text = buffer.toString('utf-8');
  const lower = filename.toLowerCase();

  if (lower.endsWith('.json')) {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  const records: Record<string, any>[] = [];
  const parsed = parse(text, { columns: true, skip_empty_lines: true, trim: true });
  for (const row of parsed) {
    records.push(row);
  }
  return records;
}

async function processBatchRecords(req: AuthRequest, datasetId: string, records: Array<Record<string, any>>, source: string, jobId: string) {
  const job = await IngestionJob.findById(jobId);
  if (!job) return;

  job.status = 'processing';
  job.startedAt = new Date();
  await job.save();

  const CHUNK_SIZE = 50;
  let unique = 0;
  let duplicates = 0;
  let invalid = 0;

  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);
    const results = await Promise.all(chunk.map((record) => DedupService.ingestRecord(req, record, datasetId, source)));

    for (const result of results) {
      if (result.status === 'accepted') unique++;
      else if (result.status === 'duplicate') duplicates++;
      else if (result.status === 'invalid') invalid++;
    }
  }

  job.uniqueRecords = unique;
  job.duplicateRecords = duplicates;
  job.failedRecords = invalid;
  job.status = 'completed';
  job.completedAt = new Date();
  await job.save();
}

router.post('/upload', authenticate, upload.single('file'), validateBody(uploadSchema), async (req: AuthRequest, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      throw new AppError('File is required.', 422, 'VALIDATION_ERROR');
    }

    const records = parseFileBuffer(file.buffer, file.originalname);
    if (records.length === 0) {
      throw new AppError('File contains no records.', 422, 'VALIDATION_ERROR');
    }

    const job = await IngestionJob.create({
      tenantId: req.tenantId!,
      datasetId: req.body.datasetId,
      status: 'processing',
      totalRecords: records.length,
    });

    let unique = 0;
    let duplicates = 0;
    let invalid = 0;

    for (const record of records) {
      const result = await DedupService.ingestRecord(req, record, req.body.datasetId, req.body.source);
      if (result.status === 'accepted') unique++;
      else if (result.status === 'duplicate') duplicates++;
      else if (result.status === 'invalid') invalid++;
    }

    job.uniqueRecords = unique;
    job.duplicateRecords = duplicates;
    job.failedRecords = invalid;
    job.status = 'completed';
    job.completedAt = new Date();
    await job.save();

    res.status(200).json({
      success: true,
      data: {
        jobId: job._id,
        totalRecords: records.length,
        uniqueRecords: unique,
        duplicateRecords: duplicates,
        invalidRecords: invalid,
        status: 'completed',
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/records', authenticate, validateBody(ingestSchema), async (req: AuthRequest, res, next) => {
  try {
    const result = await DedupService.ingestRecord(req, req.body.data, req.body.datasetId, req.body.source, req.body.idempotencyKey);

    if (result.status === 'invalid') {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Record validation failed.',
          data: {
            classification: result.classification,
            confidence: result.confidence,
            reason: result.reason,
            errors: result.errors,
            dataQualityScore: result.dataQualityScore,
            validationStatus: result.validationStatus,
          },
        },
      });
      return;
    }

    if (result.status === 'duplicate') {
      res.status(409).json({
        success: false,
        error: {
          code: result.classification === 'exact_duplicate' ? 'EXACT_DUPLICATE' : 'NEAR_DUPLICATE',
          message: result.classification === 'exact_duplicate' ? 'Record is an exact duplicate.' : 'Record is a near-duplicate.',
          data: {
            classification: result.classification,
            confidence: result.confidence,
            reason: result.reason,
            duplicateId: result.duplicateId,
            matchedRecordId: result.matchedRecordId,
            similarityScore: result.similarityScore,
            matchType: result.matchType,
            fieldBreakdown: result.fieldBreakdown,
            rejectionReason: result.rejectionReason,
          },
        },
      });
      return;
    }

    res.status(201).json({
      success: true,
      data: {
        status: 'accepted',
        classification: result.classification,
        confidence: result.confidence,
        reason: result.reason,
        recordId: (result.record as any).recordId,
        datasetId: req.body.datasetId,
        recordHash: (result.record as any).recordHash,
        source: req.body.source,
        ingestedAt: new Date(),
        message: result.superseded ? 'Record stored successfully, superseding lower quality duplicate.' : 'Record stored successfully.',
        superseded: result.superseded || false,
        previousRecordId: result.superseded ? result.previousRecordId : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/batch', authenticate, authorize('editor', 'admin', 'owner'), validateBody(batchIngestSchema), async (req: AuthRequest, res, next) => {
  try {
    const job = await IngestionJob.create({
      tenantId: req.tenantId!,
      datasetId: req.body.datasetId,
      status: 'queued',
      totalRecords: req.body.records.length,
    });

    processBatchRecords(req, req.body.datasetId, req.body.records, req.body.source, String(job._id)).catch((error) => {
      console.error('Batch processing failed:', error);
      IngestionJob.findByIdAndUpdate(job._id, { status: 'failed', errorLog: [String(error)] });
    });

    res.status(202).json({
      success: true,
      data: {
        jobId: job._id,
        datasetId: req.body.datasetId,
        totalRecords: req.body.records.length,
        status: 'queued',
        webhookUrl: req.body.webhookUrl,
        checkStatusUrl: `/api/v1/ingest/batch/${job._id}`,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/batch/:jobId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const job = await IngestionJob.findOne({ _id: req.params.jobId, tenantId: req.tenantId });
    if (!job) {
      throw new AppError('Job not found.', 404, 'NOT_FOUND');
    }
    res.status(200).json({ success: true, data: job });
  } catch (error) {
    next(error);
  }
});

export default router;
