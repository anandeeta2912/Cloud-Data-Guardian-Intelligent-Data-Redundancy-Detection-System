import Joi from 'joi';
import crypto from 'crypto';
import { ValidationReport, Dataset, Record } from '../models';
import { AuthRequest } from '../middleware/auth.middleware';
import { SystemLog } from '../models/SystemLog';
import { detectPII } from '../utils/pii';
import { AppError } from '../utils/errors';

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const PHONE_REGEX = /^\+?[\d\s\-().]{10,}$/;
const CONTROL_CHAR_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/;

export class ValidationService {
  static async validateRecord(req: AuthRequest, datasetId: string, data: Record<string, any>) {
    const dataset = await Dataset.findOne({ tenantId: req.tenantId, datasetId });
    if (!dataset) {
      throw new AppError('Dataset not found.', 404, 'DATASET_NOT_FOUND');
    }

    const schema = dataset.schemaDefinition;
    const errors: any[] = [];
    const warnings: any[] = [];

    if (schema && schema.properties) {
      const joiSchema = this.buildJoiSchema(schema);
      const { error } = joiSchema.validate(data, { abortEarly: false, allowUnknown: true });
      if (error) {
        errors.push(...error.details.map((d) => ({
          field: d.path.join('.'),
          message: d.message,
          value: data[d.path[0] as string],
          rule: d.type,
        })));
      }
    }

    const emailErrors = this.validateEmails(data, schema);
    errors.push(...emailErrors);

    const phoneErrors = this.validatePhones(data, schema);
    errors.push(...phoneErrors);

    const emptyErrors = this.validateEmptyFields(data, schema);
    errors.push(...emptyErrors);

    const invalidCharErrors = this.validateInvalidCharacters(data, schema);
    errors.push(...invalidCharErrors);

    const piiResult = detectPII(data);

    const duplicateResult = await this.validateDuplicate(req, datasetId, data, dataset.primaryKeyFields || []);
    if (duplicateResult.isDuplicate) {
      warnings.push({
        type: 'duplicate',
        message: 'Exact duplicate record detected',
        matchedRecordId: duplicateResult.matchedRecordId,
        similarityScore: duplicateResult.similarityScore,
      });
    }

    const nullCounts: Record<string, number> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined || value === '') {
        nullCounts[key] = (nullCounts[key] || 0) + 1;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      piiDetected: piiResult,
      dataQuality: { nullCounts },
      duplicate: duplicateResult,
    };
  }

  static calculateDataQualityScore(data: Record<string, any>, schema: Record<string, any>): number {
    const fields = Object.keys(data);
    if (fields.length === 0) return 0;

    let filledFields = 0;
    let validFormatBonus = 0;

    for (const key of fields) {
      const value = data[key];
      if (value !== null && value !== undefined && value !== '') {
        filledFields++;

        const fieldSchema = schema?.properties?.[key];
        if (fieldSchema) {
          if (fieldSchema.format === 'email' && typeof value === 'string' && EMAIL_REGEX.test(value)) {
            validFormatBonus += 0.05;
          } else if (fieldSchema.format === 'phone' && typeof value === 'string' && PHONE_REGEX.test(value)) {
            validFormatBonus += 0.05;
          } else if (fieldSchema.format === 'uri' && typeof value === 'string' && /^https?:\/\/.+/.test(value)) {
            validFormatBonus += 0.05;
          } else if (fieldSchema.type === 'number' || fieldSchema.type === 'integer') {
            const num = Number(value);
            if (!isNaN(num) && (fieldSchema.minimum === undefined || num >= fieldSchema.minimum) && (fieldSchema.maximum === undefined || num <= fieldSchema.maximum)) {
              validFormatBonus += 0.03;
            }
          }
        }
      }
    }

    const completeness = filledFields / fields.length;
    const score = Math.min(1, completeness + validFormatBonus);
    return Math.round(score * 1000) / 1000;
  }

  static async validateBatch(req: AuthRequest, datasetId: string, records: Array<Record<string, any>>) {
    const results = [];
    let validCount = 0;
    let invalidCount = 0;

    for (let i = 0; i < records.length; i++) {
      const result = await this.validateRecord(req, datasetId, records[i]!.data!);
      results.push({ rowIndex: i, ...result });
      if (result.valid) validCount++;
      else invalidCount++;
    }

    return { totalRecords: records.length, validRecords: validCount, invalidRecords: invalidCount, results };
  }

  static async createValidationReport(req: AuthRequest, data: {
    tenantId: string;
    datasetId: string;
    ingestionJobId?: string;
    batchMetadata: Record<string, any>;
    validationResults: any;
  }) {
    const report = await ValidationReport.create({
      tenantId: data.tenantId,
      datasetId: data.datasetId,
      ingestionJobId: data.ingestionJobId,
      batchMetadata: data.batchMetadata,
      schemaValidation: data.validationResults,
      piiDetection: data.validationResults.piiDetected,
      dataQuality: data.validationResults.dataQuality,
      failedRecords: data.validationResults.results?.filter((r: any) => !r.valid).map((r: any) => ({
        rowNumber: r.rowIndex + 1,
        data: r.data,
        errors: r.errors,
      })) || [],
      summary: {
        total: data.validationResults.totalRecords || data.batchMetadata.totalRecords || 0,
        passed: data.validationResults.validRecords || 0,
        failed: data.validationResults.invalidRecords || 0,
        duplicateCount: 0,
      },
      status: 'completed',
      startedAt: new Date(),
      completedAt: new Date(),
      durationMs: 0,
    });

    await SystemLog.create({
      tenantId: data.tenantId,
      level: 'info',
      service: 'validation_layer',
      action: 'validation.completed',
      message: `Validation report ${report._id} completed`,
      metadata: { datasetId: data.datasetId, passed: report.summary.passed, failed: report.summary.failed },
    });

    return report;
  }

  private static buildJoiSchema(schema: any): Joi.AnySchema {
    let joiSchema: any = Joi.object();

    if (schema.properties) {
      const shape: any = {};
      for (const [key, def] of Object.entries(schema.properties)) {
        const fieldDef = def as any;
        let fieldSchema: any = Joi.any();

        switch (fieldDef.type) {
          case 'string':
            fieldSchema = Joi.string();
            if (fieldDef.format === 'email') fieldSchema = fieldSchema.email();
            if (fieldDef.format === 'phone') fieldSchema = fieldSchema.pattern(/^\+?[\d\s\-().]{10,}$/, 'phone number');
            if (fieldDef.format === 'uri') fieldSchema = fieldSchema.uri();
            if (fieldDef.pattern) fieldSchema = fieldSchema.pattern(new RegExp(fieldDef.pattern));
            if (fieldDef.minLength) fieldSchema = fieldSchema.min(fieldDef.minLength);
            if (fieldDef.maxLength) fieldSchema = fieldSchema.max(fieldDef.maxLength);
            if (fieldDef.required) fieldSchema = fieldSchema.min(1, 'Required field cannot be empty');
            break;
          case 'number':
          case 'integer':
            fieldSchema = Joi.number();
            if (fieldDef.minimum !== undefined) fieldSchema = fieldSchema.min(fieldDef.minimum);
            if (fieldDef.maximum !== undefined) fieldSchema = fieldSchema.max(fieldDef.maximum);
            break;
          case 'boolean':
            fieldSchema = Joi.boolean();
            break;
          case 'array':
            fieldSchema = Joi.array();
            break;
          case 'object':
            fieldSchema = Joi.object();
            break;
          default:
            fieldSchema = Joi.any();
        }

        if (fieldDef.enum) {
          fieldSchema = fieldSchema.valid(...fieldDef.enum);
        }

        shape[key] = fieldDef.required ? fieldSchema.required() : fieldSchema.optional();
      }
        joiSchema = joiSchema.keys(shape);
    }

    if (schema.required) {
      joiSchema = joiSchema.required();
    }

    return joiSchema;
  }

  private static validateEmails(data: Record<string, any>, schema: any): any[] {
    const errors: any[] = [];
    const properties = schema?.properties || {};

    for (const [key, value] of Object.entries(data)) {
      const fieldSchema = properties[key];
      const isEmailField = fieldSchema?.format === 'email' ||
                           key.toLowerCase().includes('email') ||
                           key.toLowerCase().includes('e-mail');

      if (isEmailField && typeof value === 'string' && value.trim() !== '') {
        if (!EMAIL_REGEX.test(value)) {
          errors.push({
            field: key,
            message: `Invalid email format: ${value}`,
            value,
            rule: 'email.format',
          });
        }
      }
    }

    return errors;
  }

  private static validatePhones(data: Record<string, any>, schema: any): any[] {
    const errors: any[] = [];
    const properties = schema?.properties || {};
    const phoneFieldNames = ['phone', 'mobile', 'tel', 'telephone', 'cell', 'fax'];

    for (const [key, value] of Object.entries(data)) {
      const fieldSchema = properties[key];
      const isPhoneField = fieldSchema?.format === 'phone' ||
                           phoneFieldNames.some(name => key.toLowerCase().includes(name));

      if (isPhoneField && typeof value === 'string' && value.trim() !== '') {
        if (!PHONE_REGEX.test(value)) {
          errors.push({
            field: key,
            message: `Invalid phone format: ${value}`,
            value,
            rule: 'phone.format',
          });
        }
      }
    }

    return errors;
  }

  private static validateEmptyFields(data: Record<string, any>, schema: any): any[] {
    const errors: any[] = [];
    const requiredFields = schema?.required || [];

    for (const field of requiredFields) {
      const value = data[field];
      if (value === null || value === undefined || value === '') {
        errors.push({
          field,
          message: `Required field is empty: ${field}`,
          value,
          rule: 'required.empty',
        });
      }
    }

    return errors;
  }

  private static validateInvalidCharacters(data: Record<string, any>, schema: any): any[] {
    const errors: any[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && value.length > 0 && CONTROL_CHAR_REGEX.test(value)) {
        errors.push({
          field: key,
          message: `Value contains invalid control characters`,
          value,
          rule: 'invalid.characters',
        });
      }
    }

    return errors;
  }

  private static async validateDuplicate(req: AuthRequest, datasetId: string, data: Record<string, any>, primaryKeyFields: string[]): Promise<{ isDuplicate: boolean; matchedRecordId?: string; similarityScore?: number }> {
    if (!primaryKeyFields.length) {
      return { isDuplicate: false };
    }

    const canonicalData = this.canonicalize(data, primaryKeyFields);
    const recordHash = this.computeHash(canonicalData);

    const existing = await Record.findOne({ tenantId: req.tenantId, datasetId, recordHash, isDeleted: false });
    if (existing) {
      return { isDuplicate: true, matchedRecordId: String(existing._id), similarityScore: 1.0 };
    }

    return { isDuplicate: false };
  }

  private static canonicalize(data: Record<string, any>, primaryKeyFields: string[]): Record<string, any> {
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
}
