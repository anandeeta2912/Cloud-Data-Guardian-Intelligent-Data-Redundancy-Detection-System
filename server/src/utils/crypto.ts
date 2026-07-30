import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const hashApiKey = async (key: string): Promise<string> => {
  return bcrypt.hash(key, 12);
};

export const generateJwt = (payload: { userId: string; tenantId: string }): string => {
  // @ts-ignore
  return jwt.sign(payload, config.jwt.accessSecret, { expiresIn: config.jwt.accessExpiry });
};

export const generateRefreshToken = (payload: { userId: string; tenantId: string }): string => {
  // @ts-ignore
  return jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiry });
};

export const verifyJwt = (token: string): { userId: string; tenantId: string } => {
  const result = jwt.verify(token, config.jwt.accessSecret as string);
  return result as { userId: string; tenantId: string };
};

export const verifyRefreshToken = (token: string): { userId: string; tenantId: string } => {
  const result = jwt.verify(token, config.jwt.refreshSecret as string);
  return result as { userId: string; tenantId: string };
};

export const generateSignature = (payload: Record<string, any>, secret: string): string => {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
};

export const generateRandomString = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};
