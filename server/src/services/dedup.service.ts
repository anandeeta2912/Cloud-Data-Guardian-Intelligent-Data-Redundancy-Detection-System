import crypto from 'crypto';
import { Record, DuplicateLog, Dataset, SystemLog } from '../models';
import { AuthRequest } from '../middleware/auth.middleware';
import { config } from '../config';
import { computeSimilarityScore } from '../utils/similarity';
import { ValidationService } from './validation.service';
import { AppError } from '../utils/errors';

const FALSE_POSITIVE_LOWER_BOUND = 0.15;

export class DedupService {
  static async ingestRecord(req: AuthRequest, data: Record<string, any>, datasetId: string, source: string, idempotencyKey?: string) {
    const tenantId = req.tenantId!;
    const dataset = await Dataset.findOne({ tenantId, datasetId, status: 'active' });
    if (!dataset) {
      throw new AppError('Dataset not found.', 404, 'DATASET_NOT_FOUND');
    }

    const validation = await ValidationService.validateRecord(req, datasetId, data);
    const dataQualityScore = ValidationService.calculateDataQualityScore(data, dataset.schemaDefinition);

    if (!validation.valid) {
      await SystemLog.create({
        tenantId,
        level: 'warn',
        service: 'dedup_engine',
        action: 'record.rejected',
        message: `Validation failed for dataset ${datasetId}: ${validation.errors.map((e: any) => e.message).join(', ')}`,
        metadata: { datasetId, errors: validation.errors, dataQualityScore },
      });

      return {
        status: 'invalid',
        classification: 'invalid',
        confidence: 0,
        reason: `Schema validation failed: ${validation.errors.map((e: any) => e.message).join('; ')}`,
        errors: validation.errors,
        dataQualityScore,
        validationStatus: 'invalid',
      };
    }

    const canonicalData = this.canonicalize(data, dataset.primaryKeyFields);
    const recordHash = this.computeHash(canonicalData);

    if (idempotencyKey) {
      const existingDuplicate = await DuplicateLog.findOne({ tenantId, datasetId, recordHash });
      if (existingDuplicate) {
        return {
          status: 'duplicate',
          classification: existingDuplicate.classification,
          confidence: existingDuplicate.confidence,
          reason: existingDuplicate.classificationReason,
          matchType: existingDuplicate.matchType,
          similarityScore: existingDuplicate.similarityScore,
          matchedRecordId: existingDuplicate.matchedRecordId,
          duplicateId: existingDuplicate._id,
        };
      }
      const existingRecord = await Record.findOne({ tenantId, datasetId, recordHash });
      if (existingRecord) {
        return { status: 'accepted', classification: 'exact_duplicate', confidence: 100, reason: dataset.primaryKeyFields.length > 0 ? `Exact match on primary key fields: ${dataset.primaryKeyFields.join(', ')}` : 'Exact match on record content', record: existingRecord };
      }
    }

    const exactMatch = await Record.findOne({ tenantId, datasetId, recordHash });
    if (exactMatch) {
      const duplicateLog = await DuplicateLog.create({
        tenantId,
        datasetId,
        matchedRecordId: String(exactMatch._id),
        data,
        recordHash,
        similarityScore: 1.0,
        matchType: 'exact',
        rejectionReason: dataset.primaryKeyFields.length > 0 ? `Exact match on primary key fields: ${dataset.primaryKeyFields.join(', ')}` : 'Exact match on record content',
        classification: 'exact_duplicate',
        confidence: 100,
        classificationReason: dataset.primaryKeyFields.length > 0 ? `Exact match on primary key fields: ${dataset.primaryKeyFields.join(', ')}` : 'Exact match on record content',
        source,
      });

      await SystemLog.create({
        tenantId,
        level: 'info',
        service: 'dedup_engine',
        action: 'record.rejected',
        message: `Exact duplicate rejected for dataset ${datasetId}`,
        metadata: { datasetId, recordHash, matchedRecordId: String(exactMatch._id), classification: 'exact_duplicate', confidence: 100 },
      });

      return {
        status: 'duplicate',
        classification: 'exact_duplicate',
        confidence: 100,
        reason: dataset.primaryKeyFields.length > 0 ? `Exact match on primary key fields: ${dataset.primaryKeyFields.join(', ')}` : 'Exact match on record content',
        matchType: 'exact',
        similarityScore: 1.0,
        matchedRecordId: String(exactMatch._id),
        duplicateId: duplicateLog._id,
      };
    }

    const falsePositiveThreshold = dataset.falsePositiveThreshold || 0.85;
    const fuzzyResult = await this.findBestFuzzyMatch(tenantId, datasetId, data, dataset.fuzzyMatchRules || []);

    if (fuzzyResult.bestScore >= falsePositiveThreshold && fuzzyResult.bestMatch) {
      if (dataQualityScore > (fuzzyResult.existingQualityScore || 0)) {
        const newRecord = await Record.create({
          tenantId,
          datasetId,
          data,
          recordHash,
          source,
          validationStatus: 'valid',
          dataQualityScore,
        });

        await Record.findByIdAndUpdate(String(fuzzyResult.bestMatch._id), { isDeleted: true });

        const duplicateLog = await DuplicateLog.create({
          tenantId,
          datasetId,
          matchedRecordId: String(fuzzyResult.bestMatch._id),
          data,
          recordHash,
          similarityScore: fuzzyResult.bestScore,
          matchType: 'fuzzy',
          fieldBreakdown: fuzzyResult.fieldBreakdown,
          rejectionReason: `Fuzzy match superseded by higher quality record (incoming score: ${dataQualityScore.toFixed(3)} > existing: ${(fuzzyResult.existingQualityScore || 0).toFixed(3)})`,
          classification: 'near_duplicate',
          confidence: Math.round(fuzzyResult.bestScore * 1000) / 10,
          classificationReason: `Near-duplicate superseded by higher-quality incoming record (similarity: ${(fuzzyResult.bestScore * 100).toFixed(1)}%, incoming quality: ${(dataQualityScore * 100).toFixed(1)}% > existing: ${((fuzzyResult.existingQualityScore || 0) * 100).toFixed(1)}%)`,
          source,
        });

        await SystemLog.create({
          tenantId,
          level: 'info',
          service: 'dedup_engine',
          action: 'record.superseded',
          message: `Fuzzy duplicate superseded by higher quality record for dataset ${datasetId}`,
          metadata: { datasetId, recordHash, matchedRecordId: String(fuzzyResult.bestMatch._id), newRecordId: String(newRecord._id), similarityScore: fuzzyResult.bestScore, classification: 'near_duplicate', confidence: Math.round(fuzzyResult.bestScore * 1000) / 10 },
        });

        return {
          status: 'accepted',
          classification: 'near_duplicate',
          confidence: Math.round(fuzzyResult.bestScore * 1000) / 10,
          reason: `Near-duplicate superseded by higher-quality incoming record (similarity: ${(fuzzyResult.bestScore * 100).toFixed(1)}%, incoming quality: ${(dataQualityScore * 100).toFixed(1)}% > existing: ${((fuzzyResult.existingQualityScore || 0) * 100).toFixed(1)}%)`,
          record: newRecord,
          superseded: true,
          previousRecordId: String(fuzzyResult.bestMatch._id),
        };
      }

      const duplicateLog = await DuplicateLog.create({
        tenantId,
        datasetId,
        matchedRecordId: String(fuzzyResult.bestMatch._id),
        data,
        recordHash,
        similarityScore: fuzzyResult.bestScore,
        matchType: 'fuzzy',
        fieldBreakdown: fuzzyResult.fieldBreakdown,
        rejectionReason: fuzzyResult.rejectionReason,
        classification: 'near_duplicate',
        confidence: Math.round(fuzzyResult.bestScore * 1000) / 10,
        classificationReason: `Near-duplicate detected with similarity ${(fuzzyResult.bestScore * 100).toFixed(1)}% (threshold: ${(falsePositiveThreshold * 100).toFixed(0)}%). ${fuzzyResult.rejectionReason}`,
        source,
      });

      await SystemLog.create({
        tenantId,
        level: 'info',
        service: 'fuzzy_engine',
        action: 'record.rejected',
        message: `Fuzzy duplicate rejected (score: ${fuzzyResult.bestScore})`,
        metadata: { datasetId, recordHash, matchedRecordId: String(fuzzyResult.bestMatch._id), similarityScore: fuzzyResult.bestScore, classification: 'near_duplicate', confidence: Math.round(fuzzyResult.bestScore * 1000) / 10 },
      });

      return {
        status: 'duplicate',
        classification: 'near_duplicate',
        confidence: Math.round(fuzzyResult.bestScore * 1000) / 10,
        reason: `Near-duplicate detected with similarity ${(fuzzyResult.bestScore * 100).toFixed(1)}% (threshold: ${(falsePositiveThreshold * 100).toFixed(0)}%). ${fuzzyResult.rejectionReason}`,
        matchType: 'fuzzy',
        similarityScore: fuzzyResult.bestScore,
        matchedRecordId: String(fuzzyResult.bestMatch._id),
        fieldBreakdown: fuzzyResult.fieldBreakdown,
        rejectionReason: fuzzyResult.rejectionReason,
        duplicateId: duplicateLog._id,
      };
    }

    if (fuzzyResult.bestScore >= FALSE_POSITIVE_LOWER_BOUND && fuzzyResult.bestMatch) {
      const uniquenessConfidence = Math.round((1 - fuzzyResult.bestScore) * 1000) / 10;
      const record = await Record.create({
        tenantId,
        datasetId,
        data,
        recordHash,
        source,
        validationStatus: 'valid',
        dataQualityScore,
      });

      const fieldNames = fuzzyResult.fieldBreakdown ? Object.keys(fuzzyResult.fieldBreakdown).join(', ') : 'configured fields';
      const classificationReason = fuzzyResult.allRulesMet
        ? `Partial match found on ${fieldNames} but similarity ${(fuzzyResult.bestScore * 100).toFixed(1)}% is below near-duplicate threshold ${(falsePositiveThreshold * 100).toFixed(0)}%. All fuzzy rules triggered but confidence in uniqueness remains high (${uniquenessConfidence.toFixed(1)}%).`
        : `Partial match found on ${fieldNames} with similarity ${(fuzzyResult.bestScore * 100).toFixed(1)}%, which is below the near-duplicate threshold of ${(falsePositiveThreshold * 100).toFixed(0)}%. Record accepted as unique.`;

      await SystemLog.create({
        tenantId,
        level: 'info',
        service: 'dedup_engine',
        action: 'record.ingested',
        message: `Record ${record._id} stored as false positive`,
        metadata: { datasetId, recordHash, recordId: record.recordId, dataQualityScore, bestScore: fuzzyResult.bestScore, classification: 'false_positive', confidence: uniquenessConfidence, triggeredRules: fuzzyResult.allRulesMet },
      });

      await DuplicateLog.create({
        tenantId,
        datasetId,
        matchedRecordId: String(fuzzyResult.bestMatch._id),
        data,
        recordHash,
        similarityScore: fuzzyResult.bestScore,
        matchType: 'fuzzy',
        fieldBreakdown: fuzzyResult.fieldBreakdown,
        rejectionReason: classificationReason,
        classification: 'false_positive',
        confidence: Math.min(95, Math.max(50, uniquenessConfidence)),
        classificationReason,
        source,
      });

      return {
        status: 'accepted',
        classification: 'false_positive',
        confidence: Math.min(95, Math.max(50, uniquenessConfidence)),
        reason: classificationReason,
        matchType: 'fuzzy',
        similarityScore: fuzzyResult.bestScore,
        matchedRecordId: String(fuzzyResult.bestMatch._id),
        fieldBreakdown: fuzzyResult.fieldBreakdown,
        record,
      };
    }

    const record = await Record.create({
      tenantId,
      datasetId,
      data,
      recordHash,
      source,
      validationStatus: 'valid',
      dataQualityScore,
    });

    await SystemLog.create({
      tenantId,
      level: 'info',
      service: 'dedup_engine',
      action: 'record.ingested',
      message: `Record ${record._id} stored successfully`,
      metadata: { datasetId, recordHash, recordId: record.recordId, dataQualityScore, classification: 'unique', confidence: 100 },
    });

    return {
      status: 'accepted',
      classification: 'unique',
      confidence: 100,
      reason: `No similarity matches found above the minimum threshold of ${(FALSE_POSITIVE_LOWER_BOUND * 100).toFixed(0)}%. Record is unique.`,
      record,
    };
  }

  private static canonicalize(data: Record<string, any>, primaryKeyFields: string[]): Record<string, any> {
    if (primaryKeyFields.length === 0) {
      const canonical: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
          canonical[key] = this.normalizeValue(value);
        } else {
          canonical[key] = value;
        }
      }
      return canonical;
    }
    const canonical: Record<string, any> = {};
    for (const field of primaryKeyFields) {
      const value = data[field];
      if (typeof value === 'string') {
        canonical[field] = this.normalizeValue(value);
      } else {
        canonical[field] = value;
      }
    }
    return canonical;
  }

  private static normalizeValue(value: string): string {
    return value.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  private static computeHash(data: Record<string, any>): string {
    const str = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  private static async findBestFuzzyMatch(
    tenantId: string,
    datasetId: string,
    data: Record<string, any>,
    rules: Array<{ field: string; algorithm: string; threshold: number; weight: number }>
  ): Promise<{
    bestMatch: any;
    bestScore: number;
    fieldBreakdown: any;
    rejectionReason: string;
    existingQualityScore: number;
    allRulesMet: boolean;
  }> {
    if (rules.length === 0) {
      return { bestMatch: null, bestScore: 0, fieldBreakdown: {}, rejectionReason: '', existingQualityScore: 0, allRulesMet: false };
    }

    const ruleFields = [...new Set(rules.map((r) => r.field))];
    const fieldValues = ruleFields.map((f) => String(data[f] || ''));
    const hasAnyValue = fieldValues.some((v) => v.length > 0);

    if (!hasAnyValue) {
      return { bestMatch: null, bestScore: 0, fieldBreakdown: {}, rejectionReason: '', existingQualityScore: 0, allRulesMet: false };
    }

    const candidates = await Record.find({ tenantId, datasetId, isDeleted: false })
      .select('data dataQualityScore')
      .limit(500)
      .lean();

    if (candidates.length === 0) {
      return { bestMatch: null, bestScore: 0, fieldBreakdown: {}, rejectionReason: '', existingQualityScore: 0, allRulesMet: false };
    }

    let bestMatch: any = null;
    let bestScore = 0;
    let fieldBreakdown: any = {};
    let bestExistingQuality = 0;
    let rejectionReason = '';
    let bestAllRulesMet = false;

    for (const candidate of candidates) {
      const candidateData = candidate.data || {};
      const hasMatchingField = ruleFields.some((f) => {
        const sourceVal = this.normalizeValue(String(data[f] || ''));
        const targetVal = this.normalizeValue(String(candidateData[f] || ''));
        return sourceVal.length > 0 && targetVal.length > 0 && sourceVal === targetVal;
      });

      if (!hasMatchingField) {
        continue;
      }

      let totalWeightedScore = 0;
      let totalWeight = 0;
      const breakdown: any = {};
      let allRulesMet = true;

      for (const rule of rules) {
        const sourceVal = this.normalizeValue(String(data[rule.field] || ''));
        const targetVal = this.normalizeValue(String(candidateData[rule.field] || ''));

        if (sourceVal.length === 0 && targetVal.length === 0) {
          continue;
        }

        const score = computeSimilarityScore(sourceVal, targetVal, rule.algorithm);

        breakdown[rule.field] = { score, weight: rule.weight, algorithm: rule.algorithm };
        totalWeightedScore += score * rule.weight;
        totalWeight += rule.weight;

        if (score < rule.threshold) {
          allRulesMet = false;
        }
      }

      const finalScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestMatch = candidate;
        fieldBreakdown = breakdown;
        bestExistingQuality = candidate.dataQualityScore || 0;
        bestAllRulesMet = allRulesMet;
        rejectionReason = allRulesMet
          ? `Fuzzy match on ${Object.keys(fieldBreakdown).join(' + ')} (weighted score: ${bestScore.toFixed(3)})`
          : `Partial match on ${Object.keys(fieldBreakdown).join(' + ')} (weighted score: ${bestScore.toFixed(3)})`;
      }
    }

    return {
      bestMatch,
      bestScore: Math.round(bestScore * 1000) / 1000,
      fieldBreakdown,
      rejectionReason,
      existingQualityScore: bestExistingQuality,
      allRulesMet: bestAllRulesMet,
    };
  }
}
