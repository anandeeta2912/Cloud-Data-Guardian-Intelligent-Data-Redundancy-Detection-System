import mongoose, { Schema, Document } from 'mongoose';

export interface ISystemLog extends Document {
  tenantId?: string;
  userId?: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  service: string;
  action: string;
  message: string;
  metadata: Record<string, any>;
  traceId?: string;
  spanId?: string;
  sourceIp?: string;
  userAgent?: string;
  errorStack?: string;
  createdAt: Date;
}

const SystemLogSchema = new Schema<ISystemLog>(
  {
    tenantId: { type: String, index: true },
    userId: { type: String },
    level: { type: String, enum: ['debug', 'info', 'warn', 'error', 'fatal'], required: true, index: true },
    service: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    message: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    traceId: { type: String, index: true },
    spanId: { type: String },
    sourceIp: { type: String },
    userAgent: { type: String },
    errorStack: { type: String },
  },
  { timestamps: true }
);

SystemLogSchema.index({ tenantId: 1, createdAt: -1 });
SystemLogSchema.index({ level: 1, service: 1, createdAt: -1 });
SystemLogSchema.index({ action: 1, createdAt: -1 });
SystemLogSchema.index({ createdAt: -1 }, { expireAfterSeconds: 7776000 });

export const SystemLog = mongoose.model<ISystemLog>('SystemLog', SystemLogSchema);
