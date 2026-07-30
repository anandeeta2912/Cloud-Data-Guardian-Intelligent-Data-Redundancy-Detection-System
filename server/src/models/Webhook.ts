import mongoose, { Schema, Document } from 'mongoose';

export interface IWebhook extends Document {
  tenantId: string;
  url: string;
  events: string[];
  secret: string;
  headers: Record<string, string>;
  retryPolicy: { maxRetries: number; backoff: string; timeoutMs: number };
  isActive: boolean;
  lastTriggeredAt?: Date;
  failureCount: number;
  createdAt: Date;
}

const WebhookSchema = new Schema<IWebhook>(
  {
    tenantId: { type: String, required: true, index: true },
    url: { type: String, required: true },
    events: [{ type: String, required: true }],
    secret: { type: String, required: true },
    headers: { type: Schema.Types.Mixed, default: {} },
    retryPolicy: {
      maxRetries: { type: Number, default: 5 },
      backoff: { type: String, enum: ['exponential', 'linear', 'fixed'], default: 'exponential' },
      timeoutMs: { type: Number, default: 5000 },
    },
    isActive: { type: Boolean, default: true },
    lastTriggeredAt: { type: Date },
    failureCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

WebhookSchema.index({ tenantId: 1, isActive: 1 });

export const Webhook = mongoose.model<IWebhook>('Webhook', WebhookSchema);
