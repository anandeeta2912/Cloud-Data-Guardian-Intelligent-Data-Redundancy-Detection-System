import mongoose, { Schema, Document } from 'mongoose';

export interface IValidationReport extends Document {
  tenantId: string;
  datasetId: string;
  ingestionJobId?: string;
  batchMetadata: Record<string, any>;
  schemaValidation: Record<string, any>;
  piiDetection: Record<string, any>;
  dataQuality: Record<string, any>;
  failedRecords: Array<{ rowNumber: number; data: Record<string, any>; errors: string[] }>;
  summary: Record<string, any>;
  status: 'processing' | 'completed' | 'failed' | 'partial_success';
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  error?: string;
  createdAt: Date;
}

const ValidationReportSchema = new Schema<IValidationReport>(
  {
    tenantId: { type: String, required: true, index: true },
    datasetId: { type: String, required: true, index: true },
    ingestionJobId: { type: String },
    batchMetadata: { type: Schema.Types.Mixed, required: true },
    schemaValidation: { type: Schema.Types.Mixed, default: {} },
    piiDetection: { type: Schema.Types.Mixed, default: {} },
    dataQuality: { type: Schema.Types.Mixed, default: {} },
    failedRecords: [{ type: Schema.Types.Mixed }],
    summary: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: ['processing', 'completed', 'failed', 'partial_success'], default: 'processing', index: true },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date },
    durationMs: { type: Number },
    error: { type: String },
  },
  { timestamps: true }
);

ValidationReportSchema.index({ tenantId: 1, datasetId: 1, createdAt: -1 });
ValidationReportSchema.index({ ingestionJobId: 1 });
ValidationReportSchema.index({ tenantId: 1, status: 1 });

export const ValidationReport = mongoose.model<IValidationReport>('ValidationReport', ValidationReportSchema);
