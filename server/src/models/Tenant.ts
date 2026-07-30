import mongoose, { Schema, Document } from 'mongoose';

export interface ITenant extends Document {
  tenantId: string;
  name: string;
  slug: string;
  industry: string;
  plan: string;
  settings: Record<string, any>;
  cloudProvider: string;
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema = new Schema<ITenant>(
  {
    tenantId: { type: String, required: true, unique: true, default: () => `tenant_${Date.now()}_${Math.random().toString(36).substring(2, 9)}` },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    industry: { type: String, enum: ['ecommerce', 'healthcare', 'finance', 'iot', 'crm', 'generic'], default: 'generic' },
    plan: { type: String, enum: ['free', 'starter', 'professional', 'enterprise'], default: 'free' },
    settings: { type: Schema.Types.Mixed, default: {} },
    cloudProvider: { type: String, enum: ['aws', 'azure', 'gcp', 'multi'], default: 'aws' },
  },
  { timestamps: true }
);


TenantSchema.index({ plan: 1 });

export const Tenant = mongoose.model<ITenant>('Tenant', TenantSchema);
