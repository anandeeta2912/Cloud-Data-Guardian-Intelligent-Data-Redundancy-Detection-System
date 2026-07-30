import mongoose, { Schema, Document } from 'mongoose';

export interface IIngestionJob extends Document {
  tenantId: string;
  datasetId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'partial';
  totalRecords: number;
  uniqueRecords: number;
  duplicateRecords: number;
  failedRecords: number;
  errorLog: string[];
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

const IngestionJobSchema = new Schema<IIngestionJob>(
  {
    tenantId: { type: String, required: true, index: true },
    datasetId: { type: String, required: true, index: true },
    status: { type: String, enum: ['queued', 'processing', 'completed', 'failed', 'partial'], default: 'queued', index: true },
    totalRecords: { type: Number, default: 0 },
    uniqueRecords: { type: Number, default: 0 },
    duplicateRecords: { type: Number, default: 0 },
    failedRecords: { type: Number, default: 0 },
    errorLog: [{ type: String }],
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

IngestionJobSchema.index({ tenantId: 1, datasetId: 1, status: 1, createdAt: -1 });

export const IngestionJob = mongoose.model<IIngestionJob>('IngestionJob', IngestionJobSchema);
