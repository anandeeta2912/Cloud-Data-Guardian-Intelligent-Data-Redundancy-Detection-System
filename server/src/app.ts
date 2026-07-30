import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import mongoose from 'mongoose';
import { config } from './config';
import { connectDatabase } from './config/database';
import { logger, requestLogger } from './middleware/logger.middleware';
import { errorHandler } from './middleware/error.middleware';
import { notFound } from './middleware/notFound.middleware';
import { requestId } from './middleware/requestId.middleware';
import { rateLimiter } from './middleware/rateLimiter.middleware';
import { requestTimeout } from './middleware/timeout.middleware';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/users.routes';
import datasetRoutes from './routes/datasets.routes';
import ingestRoutes from './routes/ingest.routes';
import recordRoutes from './routes/records.routes';
import duplicateRoutes from './routes/duplicates.routes';
import validateRoutes from './routes/validate.routes';
import analyticsRoutes from './routes/analytics.routes';
import reportRoutes from './routes/reports.routes';
import webhookRoutes from './routes/webhooks.routes';
import adminRoutes from './routes/admin.routes';

const app: Application = express();

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hidePoweredBy: true,
}));

const corsOptions = {
  origin: config.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(compression());
app.use(express.json({ limit: '10mb', strict: true }));
app.use(express.urlencoded({ extended: true, limit: '10mb', parameterLimit: 10000 }));
app.use(mongoSanitize());
app.use(xss());

const limiter = rateLimit({ windowMs: config.rateLimit.windowMs, max: config.rateLimit.maxRequests, standardHeaders: true, legacyHeaders: false });
app.use('/api/', limiter);
app.use(rateLimiter);

app.use(requestId);
app.use(requestTimeout);
app.use(requestLogger);

app.get('/health', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy';
    const redis = (req.app.locals as any).redis;
    let redisStatus = 'disabled';
    if (redis) {
      try {
        await redis.ping();
        redisStatus = 'healthy';
      } catch {
        redisStatus = 'unhealthy';
      }
    }
    res.status(200).json({ 
      status: dbStatus === 'healthy' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        redis: redisStatus,
      }
    });
  } catch (error) {
    res.status(503).json({ status: 'error', timestamp: new Date().toISOString() });
  }
});

app.use(`/api/${config.apiVersion}/auth`, authRoutes);
app.use(`/api/${config.apiVersion}/users`, userRoutes);
app.use(`/api/${config.apiVersion}/datasets`, datasetRoutes);
app.use(`/api/${config.apiVersion}/ingest`, ingestRoutes);
app.use(`/api/${config.apiVersion}/records`, recordRoutes);
app.use(`/api/${config.apiVersion}/duplicates`, duplicateRoutes);
app.use(`/api/${config.apiVersion}/validate`, validateRoutes);
app.use(`/api/${config.apiVersion}/analytics`, analyticsRoutes);
app.use(`/api/${config.apiVersion}/reports`, reportRoutes);
app.use(`/api/${config.apiVersion}/webhooks`, webhookRoutes);
app.use(`/api/${config.apiVersion}/admin`, adminRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
