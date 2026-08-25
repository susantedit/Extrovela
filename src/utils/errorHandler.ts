/**
 * EXTROVELA — Centralized Error Handling Architecture
 * 
 * Defines typed domain errors and provides user-friendly resolution messages
 * without ever exposing internal stack traces or database errors to the end-user.
 */

export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';

export class AppError extends Error {
  public readonly code: string;
  public readonly severity: ErrorSeverity;
  public readonly isOperational: boolean;
  public readonly userMessage: string;
  public readonly details?: Record<string, unknown>;

  constructor(params: {
    message: string;
    code: string;
    userMessage?: string;
    severity?: ErrorSeverity;
    isOperational?: boolean;
    details?: Record<string, unknown>;
  }) {
    super(params.message);
    this.name = this.constructor.name;
    this.code = params.code;
    this.severity = params.severity || 'error';
    this.isOperational = params.isOperational !== undefined ? params.isOperational : true;
    this.userMessage = params.userMessage || 'Something unexpected happened. Please try again.';
    this.details = params.details;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class NetworkError extends AppError {
  constructor(message = 'Network connection failure', details?: Record<string, unknown>) {
    super({
      message,
      code: 'NETWORK_ERROR',
      userMessage: 'Unable to reach the server. Please check your internet connection.',
      severity: 'warning',
      details,
    });
  }
}

export class AuthError extends AppError {
  constructor(message: string, code = 'AUTH_ERROR', userMessage = 'Authentication failed. Please sign in again.', details?: Record<string, unknown>) {
    super({
      message,
      code,
      userMessage,
      severity: 'error',
      details,
    });
  }
}

export class FirebaseServiceError extends AppError {
  constructor(message: string, code = 'FIREBASE_ERROR', details?: Record<string, unknown>) {
    super({
      message,
      code,
      userMessage: 'Could not synchronize with cloud storage. Operating in offline cache mode.',
      severity: 'warning',
      details,
    });
  }
}

export class ValidationError extends AppError {
  constructor(message: string, userMessage = 'Please verify your inputs.', details?: Record<string, unknown>) {
    super({
      message,
      code: 'VALIDATION_ERROR',
      userMessage,
      severity: 'warning',
      details,
    });
  }
}

export class TimeoutError extends AppError {
  constructor(message = 'Operation timed out', userMessage = 'The request took too long. Please try again.') {
    super({
      message,
      code: 'TIMEOUT_ERROR',
      userMessage,
      severity: 'warning',
    });
  }
}

/**
 * Resolves any thrown error into a clean user-facing string.
 */
export function getHumanReadableErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.userMessage;
  }
  if (error instanceof Error) {
    if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
      return 'Network connection is weak or unavailable. Working in offline mode.';
    }
  }
  return 'A temporary error occurred. Your progress is saved locally.';
}
