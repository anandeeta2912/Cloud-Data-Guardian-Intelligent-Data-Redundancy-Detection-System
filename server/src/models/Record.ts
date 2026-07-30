import mongoose, { Schema, Document } from 'mongoose';

export interface IRecord extends Document {
  tenantId: string;
  datasetId: string;
  recordId: string;
  data: Record<string, any>;
  recordHash: string;
  source: string;
  ingestedAt: Date;
  version: number;
  previousRecordId?: string;
  isGoldenRecord: boolean;
  mergedFrom?: string[];
  cloudSyncedAt?: Date;
  cloudSyncStatus: 'pending' | 'synced' | 'failed' | 'conflict';
  isDeleted: boolean;
  validationStatus: 'pending' | 'valid' | 'invalid';
  dataQualityScore: number;
  createdAt: Date;
}

const RecordSchema = new Schema<IRecord>(
  {
    tenantId: { type: String, required: true, index: true },
    datasetId: { type: String, required: true, index: true },
    recordId: { type: String, required: true, default: () => `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}` },
    data: { type: Schema.Types.Mixed, required: true },
    recordHash: { type: String, required: true },
    source: { type: String, required: true, index: true },
    ingestedAt: { type: Date, required: true, default: Date.now, index: true },
    version: { type: Number, default: 1 },
    previousRecordId: { type: String },
    isGoldenRecord: { type: Boolean, default: false },
    mergedFrom: [{ type: String }],
    cloudSyncedAt: { type: Date },
    cloudSyncStatus: { type: String, enum: ['pending', 'synced', 'failed', 'conflict'], default: 'pending', index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    validationStatus: { type: String, enum: ['pending', 'valid', 'invalid'], default: 'pending', index: true },
    dataQualityScore: { type: Number, default: 0, min: 0, max: 1 },
  },
  { timestamps: true }
);

RecordSchema.index({ tenantId: 1, datasetId: 1, recordHash: 1 }, { unique: true });
RecordSchema.index({ tenantId: 1, datasetId: 1, recordId: 1 }, { unique: true });
RecordSchema.index({ tenantId: 1, datasetId: 1, isDeleted: 1 });
RecordSchema.index({ tenantId: 1, datasetId: 1, ingestedAt: -1 });
RecordSchema.index({ tenantId: 1, isDeleted: 1, ingestedAt: -1 });
RecordSchema.index({ data: 'text' });

RecordSchema.pre('save', function (next) {
  if (!this.recordId) {
    this.recordId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  next();
});

export const Record = mongoose.model<IRecord>('Record', RecordSchema);
