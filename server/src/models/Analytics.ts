import mongoose, { Schema, Document } from 'mongoose';

export interface IAnalytics extends Document {
  tenantId: string;
  datasetId?: string;
  metricType: string;
  timeBucket: string;
  bucketStart: Date;
  bucketEnd: Date;
  metrics: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const AnalyticsSchema = new Schema<IAnalytics>(
  {
    tenantId: { type: String, required: true, index: true },
    datasetId: { type: String, index: true },
    metricType: { type: String, required: true, index: true },
    timeBucket: { type: String, required: true, enum: ['minute', 'hour', 'day', 'week', 'month'] },
    bucketStart: { type: Date, required: true, index: -1 },
    bucketEnd: { type: Date, required: true },
    metrics: { type: Schema.Types.Mixed, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

AnalyticsSchema.index({ tenantId: 1, datasetId: 1, metricType: 1, bucketStart: -1 });
AnalyticsSchema.index({ tenantId: 1, bucketStart: -1 });
AnalyticsSchema.index({ metricType: 1, bucketStart: -1 });

export const Analytics = mongoose.model<IAnalytics>('Analytics', AnalyticsSchema);
