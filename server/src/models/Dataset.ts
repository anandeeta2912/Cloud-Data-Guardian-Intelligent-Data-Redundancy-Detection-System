import mongoose, { Schema, Document } from 'mongoose';

export interface IDataset extends Document {
  tenantId: string;
  datasetId: string;
  name: string;
  slug: string;
  schemaDefinition: Record<string, any>;
  dedupRules: Record<string, any>;
  primaryKeyFields: string[];
  fuzzyMatchRules: Array<{ field: string; algorithm: string; threshold: number; weight: number }>;
  cloudDestination: Record<string, any>;
  retentionDays: number;
  status: 'active' | 'paused' | 'archived';
  falsePositiveThreshold: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const DatasetSchema = new Schema<IDataset>(
  {
    tenantId: { type: String, required: true, index: true },
    datasetId: { type: String, required: true, default: () => `ds_${Date.now()}_${Math.random().toString(36).substring(2, 9)}` },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    schemaDefinition: { type: Schema.Types.Mixed, required: true },
    dedupRules: { type: Schema.Types.Mixed, default: {} },
    primaryKeyFields: [{ type: String }],
    fuzzyMatchRules: [
      {
        field: { type: String, required: true },
        algorithm: { type: String, required: true },
        threshold: { type: Number, required: true, min: 0, max: 1 },
        weight: { type: Number, default: 1, min: 0 },
      },
    ],
    cloudDestination: { type: Schema.Types.Mixed, default: {} },
    retentionDays: { type: Number, default: 365, min: 1 },
    status: { type: String, enum: ['active', 'paused', 'archived'], default: 'active' },
    falsePositiveThreshold: { type: Number, default: 0.85, min: 0, max: 1 },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

DatasetSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
DatasetSchema.index({ tenantId: 1, datasetId: 1 }, { unique: true });
DatasetSchema.index({ tenantId: 1, status: 1 });
DatasetSchema.index({ tenantId: 1, name: 1 });

DatasetSchema.pre('save', function (next) {
  if (!this.datasetId) {
    this.datasetId = `ds_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  next();
});

export const Dataset = mongoose.model<IDataset>('Dataset', DatasetSchema);
