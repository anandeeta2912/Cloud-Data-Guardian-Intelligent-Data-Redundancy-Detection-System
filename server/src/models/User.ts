import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  tenantId: string;
  email: string;
  name: string;
  passwordHash: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer' | 'api_user';
  avatarUrl?: string;
  mfaEnabled: boolean;
  lastLogin?: Date;
  apiKeyHash?: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    tenantId: { type: String, required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['owner', 'admin', 'editor', 'viewer', 'api_user'], default: 'viewer' },
    avatarUrl: { type: String },
    mfaEnabled: { type: Boolean, default: false },
    lastLogin: { type: Date },
    apiKeyHash: { type: String },
  },
  { timestamps: true }
);

UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });
UserSchema.index({ tenantId: 1, role: 1 });
UserSchema.index({ tenantId: 1, name: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);
