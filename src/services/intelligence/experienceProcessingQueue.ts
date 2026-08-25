/**
 * EXTROVELA — Phase 11: Experience Processing Queue
 *
 * Derived-data updates never run on the UI's critical path. Recording an event
 * enqueues a job; the queue drains asynchronously (idle callback, app
 * background, or explicit flush).
 *
 * Guarantees:
 *  - IDEMPOTENT: a job whose dedupeKey has already succeeded is skipped, not re-run.
 *  - BOUNDED RETRIES: maxAttempts with exponential backoff; then terminal 'failed'.
 *  - CRASH-SAFE: jobs persist through intelligenceFirestore, so an interrupted
 *    drain resumes on next launch.
 *  - SERIALIZED PER USER: one drain at a time, so signal updates never race.
 */

import logger from '../../utils/logger';
import { intelligenceFirestore } from './intelligenceFirestore';
import { preferenceSignalService } from './preferenceSignalService';
import { experienceGraphService } from './experienceGraphService';
import { userExperienceProfileService } from './userExperienceProfileService';
import { experienceMemoryService } from './experienceMemoryService';
import type {
  ExperienceJobType,
  ExperienceProcessingJob,
} from '../../types/experienceIntelligence';

const DEFAULT_MAX_ATTEMPTS = 3;
/** Backoff in ms per attempt index. */
const BACKOFF_MS = [0, 2000, 8000];

/** Per-user drain locks so concurrent flushes cannot interleave signal writes. */
const drainLocks = new Set<string>();

export interface EnqueueInput {
  userId: string;
  type: ExperienceJobType;
  dedupeKey: string;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
}

export class ExperienceProcessingQueue {
  /** Adds a job unless an identical dedupeKey already exists in a terminal-success state. */
  async enqueue(input: EnqueueInput): Promise<ExperienceProcessingJob | null> {
    const jobs = await intelligenceFirestore.getJobs(input.userId);
    const existing = jobs.find(j => j.dedupeKey === input.dedupeKey);

    if (existing) {
      if (existing.status === 'succeeded' || existing.status === 'skipped') {
        logger.debug('Job skipped: dedupeKey already processed', { jobType: input.type });
        return null;
      }
      if (existing.status === 'pending' || existing.status === 'running') {
        return existing;
      }
      // A previously failed job may be retried by re-enqueueing.
    }

    const now = new Date().toISOString();
    const job: ExperienceProcessingJob = {
      id: existing?.id || `job_${now.replace(/[^0-9]/g, '')}_${Math.random().toString(36).slice(2, 8)}`,
      userId: input.userId,
      type: input.type,
      dedupeKey: input.dedupeKey,
      status: 'pending',
      attempts: 0,
      maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      payload: input.payload,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await intelligenceFirestore.saveJob(job);
    return job;
  }

  /**
   * Drains all pending jobs for a user. Safe to call repeatedly; a second
   * concurrent call for the same user returns immediately.
   */
  async drain(userId: string): Promise<{ processed: number; failed: number; skipped: number }> {
    if (drainLocks.has(userId)) {
      logger.debug('Drain already in progress for this user');
      return { processed: 0, failed: 0, skipped: 0 };
    }
    drainLocks.add(userId);

    let processed = 0;
    let failed = 0;
    let skipped = 0;

    try {
      const jobs = (await intelligenceFirestore.getJobs(userId))
        .filter(j => j.status === 'pending')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      for (const job of jobs) {
        const result = await this.runJob(job);
        if (result === 'succeeded') processed += 1;
        else if (result === 'skipped') skipped += 1;
        else failed += 1;
      }
    } finally {
      drainLocks.delete(userId);
    }

    if (processed || failed) {
      logger.debug('Experience queue drained', { processed, failed, skipped });
    }
    return { processed, failed, skipped };
  }

  private async runJob(job: ExperienceProcessingJob): Promise<'succeeded' | 'failed' | 'skipped'> {
    const attempts = job.attempts + 1;
    const running: ExperienceProcessingJob = {
      ...job,
      status: 'running',
      attempts,
      updatedAt: new Date().toISOString(),
    };
    await intelligenceFirestore.saveJob(running);

    const backoff = BACKOFF_MS[Math.min(job.attempts, BACKOFF_MS.length - 1)];
    if (backoff > 0) {
      await new Promise(resolve => setTimeout(resolve, backoff));
    }

    try {
      await this.execute(running);
      await intelligenceFirestore.saveJob({
        ...running,
        status: 'succeeded',
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });
      return 'succeeded';
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const terminal = attempts >= running.maxAttempts;
      await intelligenceFirestore.saveJob({
        ...running,
        status: terminal ? 'failed' : 'pending',
        lastError: message.slice(0, 240),
        updatedAt: new Date().toISOString(),
      });
      logger.warn('Experience job failed', {
        jobType: running.type,
        attempts,
        terminal,
        error: message,
      });
      return terminal ? 'failed' : 'skipped';
    }
  }

  private async execute(job: ExperienceProcessingJob): Promise<void> {
    switch (job.type) {
      case 'processEvent': {
        const eventId = job.payload?.eventId as string | undefined;
        if (!eventId) throw new Error('processEvent job missing eventId');

        const events = await intelligenceFirestore.getEvents(job.userId, 1000);
        const event = events.find(e => e.id === eventId);
        if (!event) throw new Error(`Raw event ${eventId} not found`);

        await preferenceSignalService.applyEvent(event);
        await experienceGraphService.applyEvent(event);
        return;
      }

      case 'updateSignals': {
        const eventId = job.payload?.eventId as string | undefined;
        const events = await intelligenceFirestore.getEvents(job.userId, 1000);
        const event = eventId ? events.find(e => e.id === eventId) : events[0];
        if (!event) throw new Error('updateSignals job has no event to apply');
        await preferenceSignalService.applyEvent(event);
        return;
      }

      case 'updateGraph': {
        const eventId = job.payload?.eventId as string | undefined;
        const events = await intelligenceFirestore.getEvents(job.userId, 1000);
        const event = eventId ? events.find(e => e.id === eventId) : events[0];
        if (!event) throw new Error('updateGraph job has no event to apply');
        await experienceGraphService.applyEvent(event);
        return;
      }

      case 'rebuildProfile':
      case 'backfillProfile':
        await userExperienceProfileService.rebuildAndSave(job.userId);
        return;

      case 'refreshMemories':
        await experienceMemoryService.refreshMemories(job.userId);
        return;

      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  }

  /** Schedules a drain without blocking the caller. */
  scheduleDrain(userId: string): void {
    const run = () => {
      void this.drain(userId).catch(err =>
        logger.warn('Background drain failed', { error: String(err) })
      );
    };

    const idle = (globalThis as { requestIdleCallback?: (cb: () => void) => number })
      .requestIdleCallback;
    if (typeof idle === 'function') idle(run);
    else setTimeout(run, 250);
  }

  async getJobStats(userId: string): Promise<Record<string, number>> {
    const jobs = await intelligenceFirestore.getJobs(userId);
    return jobs.reduce<Record<string, number>>((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {});
  }
}

export const experienceProcessingQueue = new ExperienceProcessingQueue();
export default experienceProcessingQueue;
