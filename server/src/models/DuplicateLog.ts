import mongoose, { Schema, Document } from 'mongoose';

export interface IDuplicateLog extends Document {
  tenantId: string;
  datasetId: string;
  matchedRecordId?: string;
  data: Record<string, any>;
  recordHash: string;
  similarityScore?: number;
  matchType: 'exact' | 'fuzzy' | 'semantic';
  fieldBreakdown?: Record<string, { score: number; weight: number; algorithm?: string }>;
  rejectionReason: string;
  classification: 'exact_duplicate' | 'near_duplicate' | 'false_positive' | 'unique';
  confidence: number;
  classificationReason: string;
  source: string;
  ingestedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewAction?: 'accepted_as_unique' | 'force_merged' | 'dismissed';
  createdAt: Date;
}

const DuplicateLogSchema = new Schema<IDuplicateLog>(
  {
    tenantId: { type: String, required: true, index: true },
    datasetId: { type: String, required: true, index: true },
    matchedRecordId: { type: String, index: true },
    data: { type: Schema.Types.Mixed, required: true },
    recordHash: { type: String, required: true },
    similarityScore: { type: Number, min: 0, max: 1 },
    matchType: { type: String, enum: ['exact', 'fuzzy', 'semantic'], required: true },
    fieldBreakdown: { type: Schema.Types.Mixed },
    rejectionReason: { type: String, required: true },
    classification: { type: String, enum: ['exact_duplicate', 'near_duplicate', 'false_positive', 'unique'], required: true },
    confidence: { type: Number, required: true, min: 0, max: 100 },
    classificationReason: { type: String, required: true },
    source: { type: String, required: true, index: true },
    ingestedAt: { type: Date, required: true, default: Date.now, index: true },
    reviewedAt: { type: Date },
    reviewedBy: { type: String },
    reviewAction: { type: String, enum: ['accepted_as_unique', 'force_merged', 'dismissed'] },
  },
  { timestamps: true }
);

DuplicateLogSchema.index({ tenantId: 1, datasetId: 1, recordHash: 1 });
DuplicateLogSchema.index({ tenantId: 1, datasetId: 1, similarityScore: -1 });
DuplicateLogSchema.index({ tenantId: 1, ingestedAt: -1 });
DuplicateLogSchema.index({ matchType: 1, tenantId: 1 });
DuplicateLogSchema.index({ tenantId: 1, datasetId: 1, classification: 1 });
DuplicateLogSchema.index({ rejectionReason: 1 });
DuplicateLogSchema.index({ tenantId: 1, datasetId: 1, source: 1 });
DuplicateLogSchema.index({ tenantId: 1, source: 1 });

export const DuplicateLog = mongoose.model<IDuplicateLog>('DuplicateLog', DuplicateLogSchema);
