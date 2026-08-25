/**
 * EXTROVELA — Privacy-Aware Centralized Logger
 * 
 * Provides structured logging with levels (debug, info, warn, error).
 * Automatically strips passwords, auth tokens, and raw coordinates in production
 * to comply with Apple App Privacy and Google Play Data Safety guidelines.
 */

import config from '../config/env';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Keys whose values must never be logged. Longer, unambiguous tokens are matched
// as substrings; short coordinate keys are matched EXACTLY, because substring-
// matching them ('lat') would wrongly redact innocent fields ('latency',
// 'related', 'template', 'translate').
const SENSITIVE_SUBSTRINGS = [
  'password', 'token', 'secret', 'apikey', 'auth', 'bearer',
  'coordinates', 'latitude', 'longitude', 'geolocation', 'reflection',
];
const SENSITIVE_EXACT = new Set(['lat', 'lng', 'lon', 'location', 'geo', 'coords']);

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_EXACT.has(lower) || SENSITIVE_SUBSTRINGS.some(s => lower.includes(s));
}

function sanitizeData(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const isSensitive = isSensitiveKey(key);
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

class Logger {
  private isProduction = config.isProduction;

  debug(message: string, context?: Record<string, unknown>): void {
    if (!this.isProduction) {
      console.debug(`[EXTROVELA:DEBUG] ${message}`, context ? sanitizeData(context) : '');
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    // Suppressed in production to minimize the log surface (privacy + noise).
    // Warnings and errors always emit; redaction still applies when they do.
    if (this.isProduction) return;
    console.info(`[EXTROVELA:INFO] ${message}`, context ? sanitizeData(context) : '');
  }

  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(`[EXTROVELA:WARN] ${message}`, context ? sanitizeData(context) : '');
  }

  error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    const sanitizedContext = context ? sanitizeData(context) : undefined;
    if (error instanceof Error) {
      console.error(`[EXTROVELA:ERROR] ${message}: ${error.message}`, {
        name: error.name,
        stack: this.isProduction ? undefined : error.stack,
        context: sanitizedContext,
      });
    } else {
      console.error(`[EXTROVELA:ERROR] ${message}`, error, sanitizedContext);
    }
  }
}

export const logger = new Logger();
export default logger;
