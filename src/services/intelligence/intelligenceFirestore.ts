/**
 * EXTROVELA — Phase 11: Experience Intelligence Firestore Gateway
 *
 * Extends the existing single Firestore client (services/firebase/firebaseConfig)
 * with the derived-personalization subcollections. Follows the established
 * pattern from services/firebase/firestore.ts:
 *   - one gateway, no scattered collection() calls in UI or services
 *   - graceful degradation to localStorage when Firebase is not configured
 *
 * Firestore layout (all user-owned, all under /users/{userId}):
 *   experienceEvents/{eventId}          RAW, append-only
 *   preferenceSignals/{signalId}        DERIVED
 *   experienceGraphNodes/{nodeId}       DERIVED
 *   experienceGraphEdges/{edgeId}       DERIVED
 *   experienceProfile/current           DERIVED (single doc)
 *   experienceMemories/{memoryId}       DERIVED
 *   experienceJobs/{jobId}              DERIVED queue
 *   reflectionInsights/{insightId}      DERIVED
 *   settings/personalization            USER-OWNED settings
 */

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  query,
  getDocs,
  orderBy,
  limit as fsLimit,
  where,
  writeBatch,
  Firestore,
} from 'firebase/firestore';
import { getFirebaseApp } from '../firebase/firebaseConfig';
import logger from '../../utils/logger';
import type {
  ExperienceEvent,
  PreferenceSignal,
  ExperienceGraphNode,
  ExperienceGraphEdge,
  UserExperienceProfile,
  ExperienceMemoryRecord,
  ExperienceProcessingJob,
  ReflectionInsight,
  PersonalizationSettings,
} from '../../types/experienceIntelligence';

export const INTELLIGENCE_COLLECTIONS = {
  events: 'experienceEvents',
  signals: 'preferenceSignals',
  graphNodes: 'experienceGraphNodes',
  graphEdges: 'experienceGraphEdges',
  profile: 'experienceProfile',
  memories: 'experienceMemories',
  jobs: 'experienceJobs',
  insights: 'reflectionInsights',
} as const;

/** Local-cache keys, namespaced per user so two accounts never collide. */
const localKey = (userId: string, bucket: string) => `extrovela_ei_${bucket}_${userId}`;

function readLocal<T>(userId: string, bucket: string): T[] {
  try {
    const raw = localStorage.getItem(localKey(userId, bucket));
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocal<T>(userId: string, bucket: string, rows: T[]): void {
  try {
    localStorage.setItem(localKey(userId, bucket), JSON.stringify(rows));
  } catch (err) {
    logger.warn('Failed to persist intelligence data locally', { bucket, error: String(err) });
  }
}

function upsertLocal<T extends { id: string }>(userId: string, bucket: string, row: T): void {
  const rows = readLocal<T>(userId, bucket);
  const idx = rows.findIndex(r => r.id === row.id);
  if (idx >= 0) rows[idx] = row;
  else rows.push(row);
  writeLocal(userId, bucket, rows);
}

export class IntelligenceFirestoreGateway {
  private getDb(): Firestore | null {
    const app = getFirebaseApp();
    if (!app) return null;
    return getFirestore(app);
  }

  /** True when a real Firebase project is configured. */
  isRemoteAvailable(): boolean {
    return this.getDb() !== null;
  }

  // ─── Raw events (append-only) ──────────────────────────────
  async appendEvent(event: ExperienceEvent): Promise<void> {
    upsertLocal(event.userId, INTELLIGENCE_COLLECTIONS.events, event);

    const db = this.getDb();
    if (!db) return;
    try {
      await setDoc(
        doc(db, 'users', event.userId, INTELLIGENCE_COLLECTIONS.events, event.id),
        event
      );
    } catch (err) {
      logger.warn('Experience event queued locally; remote append failed', {
        eventType: event.type,
        error: String(err),
      });
    }
  }

  async getEvents(userId: string, max = 500): Promise<ExperienceEvent[]> {
    const db = this.getDb();
    if (!db) {
      return readLocal<ExperienceEvent>(userId, INTELLIGENCE_COLLECTIONS.events)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, max);
    }
    try {
      const q = query(
        collection(db, 'users', userId, INTELLIGENCE_COLLECTIONS.events),
        orderBy('createdAt', 'desc'),
        fsLimit(max)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as ExperienceEvent);
    } catch (err) {
      logger.warn('Falling back to local experience events', { error: String(err) });
      return readLocal<ExperienceEvent>(userId, INTELLIGENCE_COLLECTIONS.events).slice(0, max);
    }
  }

  async findEventByDedupeKey(userId: string, dedupeKey: string): Promise<ExperienceEvent | null> {
    const db = this.getDb();
    if (!db) {
      return (
        readLocal<ExperienceEvent>(userId, INTELLIGENCE_COLLECTIONS.events).find(
          e => e.dedupeKey === dedupeKey
        ) || null
      );
    }
    try {
      const q = query(
        collection(db, 'users', userId, INTELLIGENCE_COLLECTIONS.events),
        where('dedupeKey', '==', dedupeKey),
        fsLimit(1)
      );
      const snap = await getDocs(q);
      return snap.empty ? null : (snap.docs[0].data() as ExperienceEvent);
    } catch {
      return (
        readLocal<ExperienceEvent>(userId, INTELLIGENCE_COLLECTIONS.events).find(
          e => e.dedupeKey === dedupeKey
        ) || null
      );
    }
  }

  // ─── Preference signals ────────────────────────────────────
  async saveSignal(signal: PreferenceSignal): Promise<void> {
    upsertLocal(signal.userId, INTELLIGENCE_COLLECTIONS.signals, signal);
    const db = this.getDb();
    if (!db) return;
    try {
      await setDoc(
        doc(db, 'users', signal.userId, INTELLIGENCE_COLLECTIONS.signals, signal.id),
        signal,
        { merge: true }
      );
    } catch (err) {
      logger.warn('Preference signal stored locally only', { error: String(err) });
    }
  }

  async getSignals(userId: string): Promise<PreferenceSignal[]> {
    const db = this.getDb();
    if (!db) return readLocal<PreferenceSignal>(userId, INTELLIGENCE_COLLECTIONS.signals);
    try {
      const snap = await getDocs(
        collection(db, 'users', userId, INTELLIGENCE_COLLECTIONS.signals)
      );
      return snap.docs.map(d => d.data() as PreferenceSignal);
    } catch (err) {
      logger.warn('Falling back to local preference signals', { error: String(err) });
      return readLocal<PreferenceSignal>(userId, INTELLIGENCE_COLLECTIONS.signals);
    }
  }

  async deleteSignal(userId: string, signalId: string): Promise<void> {
    const rows = readLocal<PreferenceSignal>(userId, INTELLIGENCE_COLLECTIONS.signals);
    writeLocal(
      userId,
      INTELLIGENCE_COLLECTIONS.signals,
      rows.filter(r => r.id !== signalId)
    );
    const db = this.getDb();
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'users', userId, INTELLIGENCE_COLLECTIONS.signals, signalId));
    } catch (err) {
      logger.warn('Failed to delete remote preference signal', { error: String(err) });
    }
  }

  // ─── Experience graph ──────────────────────────────────────
  async saveGraphNode(node: ExperienceGraphNode): Promise<void> {
    upsertLocal(node.userId, INTELLIGENCE_COLLECTIONS.graphNodes, node);
    const db = this.getDb();
    if (!db) return;
    try {
      await setDoc(
        doc(db, 'users', node.userId, INTELLIGENCE_COLLECTIONS.graphNodes, node.id),
        node,
        { merge: true }
      );
    } catch (err) {
      logger.warn('Graph node stored locally only', { error: String(err) });
    }
  }

  async saveGraphEdge(edge: ExperienceGraphEdge): Promise<void> {
    upsertLocal(edge.userId, INTELLIGENCE_COLLECTIONS.graphEdges, edge);
    const db = this.getDb();
    if (!db) return;
    try {
      await setDoc(
        doc(db, 'users', edge.userId, INTELLIGENCE_COLLECTIONS.graphEdges, edge.id),
        edge,
        { merge: true }
      );
    } catch (err) {
      logger.warn('Graph edge stored locally only', { error: String(err) });
    }
  }

  async getGraphNodes(userId: string): Promise<ExperienceGraphNode[]> {
    const db = this.getDb();
    if (!db) return readLocal<ExperienceGraphNode>(userId, INTELLIGENCE_COLLECTIONS.graphNodes);
    try {
      const snap = await getDocs(
        collection(db, 'users', userId, INTELLIGENCE_COLLECTIONS.graphNodes)
      );
      return snap.docs.map(d => d.data() as ExperienceGraphNode);
    } catch {
      return readLocal<ExperienceGraphNode>(userId, INTELLIGENCE_COLLECTIONS.graphNodes);
    }
  }

  async getGraphEdges(userId: string): Promise<ExperienceGraphEdge[]> {
    const db = this.getDb();
    if (!db) return readLocal<ExperienceGraphEdge>(userId, INTELLIGENCE_COLLECTIONS.graphEdges);
    try {
      const snap = await getDocs(
        collection(db, 'users', userId, INTELLIGENCE_COLLECTIONS.graphEdges)
      );
      return snap.docs.map(d => d.data() as ExperienceGraphEdge);
    } catch {
      return readLocal<ExperienceGraphEdge>(userId, INTELLIGENCE_COLLECTIONS.graphEdges);
    }
  }

  // ─── Profile (single doc) ──────────────────────────────────
  async saveProfile(profile: UserExperienceProfile): Promise<void> {
    try {
      localStorage.setItem(
        localKey(profile.userId, INTELLIGENCE_COLLECTIONS.profile),
        JSON.stringify(profile)
      );
    } catch {
      /* non-fatal */
    }
    const db = this.getDb();
    if (!db) return;
    try {
      await setDoc(
        doc(db, 'users', profile.userId, INTELLIGENCE_COLLECTIONS.profile, 'current'),
        profile
      );
    } catch (err) {
      logger.warn('Experience profile stored locally only', { error: String(err) });
    }
  }

  async getProfile(userId: string): Promise<UserExperienceProfile | null> {
    const db = this.getDb();
    if (!db) {
      try {
        const raw = localStorage.getItem(localKey(userId, INTELLIGENCE_COLLECTIONS.profile));
        return raw ? (JSON.parse(raw) as UserExperienceProfile) : null;
      } catch {
        return null;
      }
    }
    try {
      const snap = await getDoc(
        doc(db, 'users', userId, INTELLIGENCE_COLLECTIONS.profile, 'current')
      );
      return snap.exists() ? (snap.data() as UserExperienceProfile) : null;
    } catch {
      try {
        const raw = localStorage.getItem(localKey(userId, INTELLIGENCE_COLLECTIONS.profile));
        return raw ? (JSON.parse(raw) as UserExperienceProfile) : null;
      } catch {
        return null;
      }
    }
  }

  // ─── Long-term experience memories ─────────────────────────
  async saveMemoryRecord(record: ExperienceMemoryRecord): Promise<void> {
    upsertLocal(record.userId, INTELLIGENCE_COLLECTIONS.memories, record);
    const db = this.getDb();
    if (!db) return;
    try {
      await setDoc(
        doc(db, 'users', record.userId, INTELLIGENCE_COLLECTIONS.memories, record.id),
        record,
        { merge: true }
      );
    } catch (err) {
      logger.warn('Experience memory stored locally only', { error: String(err) });
    }
  }

  async getMemoryRecords(userId: string): Promise<ExperienceMemoryRecord[]> {
    const db = this.getDb();
    if (!db) {
      return readLocal<ExperienceMemoryRecord>(userId, INTELLIGENCE_COLLECTIONS.memories).filter(
        m => !m.deletedAt
      );
    }
    try {
      const snap = await getDocs(
        collection(db, 'users', userId, INTELLIGENCE_COLLECTIONS.memories)
      );
      return snap.docs
        .map(d => d.data() as ExperienceMemoryRecord)
        .filter(m => !m.deletedAt);
    } catch {
      return readLocal<ExperienceMemoryRecord>(userId, INTELLIGENCE_COLLECTIONS.memories).filter(
        m => !m.deletedAt
      );
    }
  }

  async deleteMemoryRecord(userId: string, recordId: string): Promise<void> {
    const rows = readLocal<ExperienceMemoryRecord>(userId, INTELLIGENCE_COLLECTIONS.memories);
    writeLocal(
      userId,
      INTELLIGENCE_COLLECTIONS.memories,
      rows.filter(r => r.id !== recordId)
    );
    const db = this.getDb();
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'users', userId, INTELLIGENCE_COLLECTIONS.memories, recordId));
    } catch (err) {
      logger.warn('Failed to delete remote experience memory', { error: String(err) });
    }
  }

  // ─── Processing jobs ──────────────────────────────────────
  async saveJob(job: ExperienceProcessingJob): Promise<void> {
    upsertLocal(job.userId, INTELLIGENCE_COLLECTIONS.jobs, job);
    const db = this.getDb();
    if (!db) return;
    try {
      await setDoc(
        doc(db, 'users', job.userId, INTELLIGENCE_COLLECTIONS.jobs, job.id),
        job,
        { merge: true }
      );
    } catch {
      /* queue is best-effort; local copy is authoritative for retry */
    }
  }

  async getJobs(userId: string): Promise<ExperienceProcessingJob[]> {
    const db = this.getDb();
    if (!db) return readLocal<ExperienceProcessingJob>(userId, INTELLIGENCE_COLLECTIONS.jobs);
    try {
      const snap = await getDocs(collection(db, 'users', userId, INTELLIGENCE_COLLECTIONS.jobs));
      return snap.docs.map(d => d.data() as ExperienceProcessingJob);
    } catch {
      return readLocal<ExperienceProcessingJob>(userId, INTELLIGENCE_COLLECTIONS.jobs);
    }
  }

  // ─── Reflection insights ──────────────────────────────────
  async saveInsight(insight: ReflectionInsight): Promise<void> {
    upsertLocal(insight.userId, INTELLIGENCE_COLLECTIONS.insights, insight);
    const db = this.getDb();
    if (!db) return;
    try {
      await setDoc(
        doc(db, 'users', insight.userId, INTELLIGENCE_COLLECTIONS.insights, insight.id),
        insight,
        { merge: true }
      );
    } catch {
      /* local only */
    }
  }

  async getInsights(userId: string): Promise<ReflectionInsight[]> {
    const db = this.getDb();
    if (!db) return readLocal<ReflectionInsight>(userId, INTELLIGENCE_COLLECTIONS.insights);
    try {
      const snap = await getDocs(
        collection(db, 'users', userId, INTELLIGENCE_COLLECTIONS.insights)
      );
      return snap.docs.map(d => d.data() as ReflectionInsight);
    } catch {
      return readLocal<ReflectionInsight>(userId, INTELLIGENCE_COLLECTIONS.insights);
    }
  }

  // ─── Personalization settings ─────────────────────────────
  async saveSettings(settings: PersonalizationSettings): Promise<void> {
    try {
      localStorage.setItem(
        localKey(settings.userId, 'personalizationSettings'),
        JSON.stringify(settings)
      );
    } catch {
      /* non-fatal */
    }
    const db = this.getDb();
    if (!db) return;
    try {
      await setDoc(doc(db, 'users', settings.userId, 'settings', 'personalization'), settings, {
        merge: true,
      });
    } catch (err) {
      logger.warn('Personalization settings stored locally only', { error: String(err) });
    }
  }

  async getSettings(userId: string): Promise<PersonalizationSettings | null> {
    const db = this.getDb();
    const readCached = (): PersonalizationSettings | null => {
      try {
        const raw = localStorage.getItem(localKey(userId, 'personalizationSettings'));
        return raw ? (JSON.parse(raw) as PersonalizationSettings) : null;
      } catch {
        return null;
      }
    };
    if (!db) return readCached();
    try {
      const snap = await getDoc(doc(db, 'users', userId, 'settings', 'personalization'));
      return snap.exists() ? (snap.data() as PersonalizationSettings) : readCached();
    } catch {
      return readCached();
    }
  }

  // ─── Deletion propagation ─────────────────────────────────
  /**
   * Deletes every DERIVED artefact for a user while leaving raw events intact.
   * Used by "Reset personalization".
   */
  async deleteAllDerived(userId: string): Promise<{ deleted: number; remote: boolean }> {
    const derivedBuckets = [
      INTELLIGENCE_COLLECTIONS.signals,
      INTELLIGENCE_COLLECTIONS.graphNodes,
      INTELLIGENCE_COLLECTIONS.graphEdges,
      INTELLIGENCE_COLLECTIONS.memories,
      INTELLIGENCE_COLLECTIONS.jobs,
      INTELLIGENCE_COLLECTIONS.insights,
    ];

    let deleted = 0;
    for (const bucket of derivedBuckets) {
      deleted += readLocal<{ id: string }>(userId, bucket).length;
      writeLocal(userId, bucket, []);
    }
    try {
      localStorage.removeItem(localKey(userId, INTELLIGENCE_COLLECTIONS.profile));
    } catch {
      /* non-fatal */
    }

    const db = this.getDb();
    if (!db) return { deleted, remote: false };

    try {
      for (const bucket of derivedBuckets) {
        const snap = await getDocs(collection(db, 'users', userId, bucket));
        // Firestore batches cap at 500 writes.
        for (let i = 0; i < snap.docs.length; i += 450) {
          const batch = writeBatch(db);
          snap.docs.slice(i, i + 450).forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
        deleted += snap.docs.length;
      }
      await deleteDoc(doc(db, 'users', userId, INTELLIGENCE_COLLECTIONS.profile, 'current')).catch(
        () => undefined
      );
      return { deleted, remote: true };
    } catch (err) {
      logger.error('Remote derived-data deletion incomplete', err);
      return { deleted, remote: false };
    }
  }

  /**
   * Deletes raw events too. Used by account deletion and by
   * "Delete everything EXTROVELA has learned".
   */
  async deleteAllIncludingRaw(userId: string): Promise<{ deleted: number; remote: boolean }> {
    const derived = await this.deleteAllDerived(userId);
    let deleted = derived.deleted;

    deleted += readLocal<{ id: string }>(userId, INTELLIGENCE_COLLECTIONS.events).length;
    writeLocal(userId, INTELLIGENCE_COLLECTIONS.events, []);

    const db = this.getDb();
    if (!db) return { deleted, remote: false };

    try {
      const snap = await getDocs(
        collection(db, 'users', userId, INTELLIGENCE_COLLECTIONS.events)
      );
      for (let i = 0; i < snap.docs.length; i += 450) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + 450).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      deleted += snap.docs.length;
      return { deleted, remote: derived.remote };
    } catch (err) {
      logger.error('Remote raw-event deletion incomplete', err);
      return { deleted, remote: false };
    }
  }

  /**
   * Deletion propagation: removes derived artefacts whose lineage points at
   * the given raw event ids. Called when a memory or event is deleted.
   */
  async purgeDerivedForEvents(userId: string, eventIds: string[]): Promise<number> {
    if (eventIds.length === 0) return 0;
    const idSet = new Set(eventIds);
    let purged = 0;

    const signals = await this.getSignals(userId);
    for (const signal of signals) {
      const remaining = signal.sourceEventIds.filter(id => !idSet.has(id));
      if (remaining.length === signal.sourceEventIds.length) continue;
      if (remaining.length === 0) {
        await this.deleteSignal(userId, signal.id);
        purged += 1;
      } else {
        await this.saveSignal({
          ...signal,
          sourceEventIds: remaining,
          sampleCount: Math.max(1, signal.sampleCount - (signal.sourceEventIds.length - remaining.length)),
          updatedAt: new Date().toISOString(),
        });
        purged += 1;
      }
    }

    const memories = await this.getMemoryRecords(userId);
    for (const record of memories) {
      const remaining = record.sourceEventIds.filter(id => !idSet.has(id));
      if (remaining.length === record.sourceEventIds.length) continue;
      if (remaining.length === 0) {
        await this.deleteMemoryRecord(userId, record.id);
      } else {
        await this.saveMemoryRecord({
          ...record,
          sourceEventIds: remaining,
          updatedAt: new Date().toISOString(),
        });
      }
      purged += 1;
    }

    return purged;
  }
}

export const intelligenceFirestore = new IntelligenceFirestoreGateway();
export default intelligenceFirestore;
