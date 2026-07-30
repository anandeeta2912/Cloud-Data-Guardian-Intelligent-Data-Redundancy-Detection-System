import mongoose, { Schema, Document } from 'mongoose';

export interface IApiKey extends Document {
  tenantId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  permissions: Array<{ datasetId: string; actions: string[] }>;
  rateLimit: { requestsPerMinute: number; burstLimit: number };
  lastUsed?: Date;
  expiresAt?: Date;
  isRevoked: boolean;
  createdAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    keyHash: { type: String, required: true },
    keyPrefix: { type: String, required: true },
    permissions: [{ type: Schema.Types.Mixed, required: true }],
    rateLimit: {
      requestsPerMinute: { type: Number, default: 1000 },
      burstLimit: { type: Number, default: 5000 },
    },
    lastUsed: { type: Date },
    expiresAt: { type: Date },
    isRevoked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ApiKeySchema.index({ tenantId: 1, keyHash: 1 });
ApiKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ApiKey = mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
