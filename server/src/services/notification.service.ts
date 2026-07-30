import nodemailer from 'nodemailer';
import { Webhook } from '../models';
import { config } from '../config';
import { SystemLog } from '../models/SystemLog';
import { generateSignature } from '../utils/crypto';
import { logger } from '../utils/logger';

export class NotificationService {
  private static transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: false,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });

  static async sendEmail(to: string, subject: string, html: string) {
    if (!config.smtp.host) return;
    try {
      await this.transporter.sendMail({ from: config.smtp.user, to, subject, html });
    } catch (error) {
      logger.error('Email send error:', error);
    }
  }

  static async sendSlackNotification(message: string) {
    if (!config.slack.webhookUrl) return;
    try {
      await fetch(config.slack.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
      });
    } catch (error) {
      logger.error('Slack notification error:', error);
    }
  }

  static async triggerWebhooks(tenantId: string, event: string, payload: Record<string, any>) {
    const webhooks = await Webhook.find({ tenantId, isActive: true, events: { $in: [event] } });
    for (const webhook of webhooks) {
      try {
        const signature = generateSignature(payload, webhook.secret);
        await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CDG-Signature': signature,
            ...webhook.headers,
          },
          body: JSON.stringify({ event, timestamp: Date.now(), payload }),
        });
        webhook.lastTriggeredAt = new Date();
        webhook.failureCount = 0;
        await webhook.save();
      } catch (error) {
        webhook.failureCount += 1;
        if (webhook.failureCount >= webhook.retryPolicy.maxRetries) {
          webhook.isActive = false;
        }
        await webhook.save();

        await SystemLog.create({
          tenantId,
          level: 'error',
          service: 'notification_service',
          action: 'webhook.failed',
          message: `Webhook to ${webhook.url} failed`,
          metadata: { webhookId: webhook._id, event, error: (error as Error).message },
        });
      }
    }
  }
}
