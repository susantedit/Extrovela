/**
 * EXTROVELA — Cloud Firestore Repository Service (Phase 4)
 * 
 * Centralizes all Firestore database read/write operations behind typed repository helpers.
 * Never scatter raw Firestore collection calls across UI components.
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
  where,
  orderBy,
  limit,
  Timestamp,
  Firestore,
} from 'firebase/firestore';
import { getFirebaseApp } from './firebaseConfig';
import { Memory, Quest, UserProfile, UserPreferences } from '../../types';
import { QuestSession } from '../../types/quest';
import { ExperienceRecap } from '../../types/recap';
import { MemoryCollection } from '../../types/collections';
import { ShareTokenIndex, PublicSharePayload } from '../../types/share';
import logger from '../../utils/logger';

export class FirestoreService {
  private getDb(): Firestore | null {
    const app = getFirebaseApp();
    if (!app) return null;
    return getFirestore(app);
  }

  // ─── User Profile & Preferences ────────────────────────────
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const db = this.getDb();
    if (!db) {
      const saved = localStorage.getItem('extrovela_user_profile');
      return saved ? JSON.parse(saved) : null;
    }

    try {
      const snap = await getDoc(doc(db, 'users', userId));
      return snap.exists() ? (snap.data() as UserProfile) : null;
    } catch (err) {
      logger.error('Failed to get user profile from Firestore', err);
      return null;
    }
  }

  async saveUserProfile(profile: UserProfile): Promise<void> {
    const db = this.getDb();
    if (!db) {
      localStorage.setItem('extrovela_user_profile', JSON.stringify(profile));
      return;
    }

    try {
      const userRef = doc(db, 'users', profile.id);
      await setDoc(userRef, profile, { merge: true });
      logger.info('User profile saved to Firestore', { userId: profile.id });
    } catch (error) {
      logger.error('Error saving user profile to Firestore', error);
      localStorage.setItem('extrovela_user_profile', JSON.stringify(profile));
    }
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    const db = this.getDb();
    if (!db) {
      const saved = localStorage.getItem('extrovela_user_preferences');
      return saved ? JSON.parse(saved) : null;
    }

    try {
      const snap = await getDoc(doc(db, 'users', userId, 'preferences', 'profile'));
      return snap.exists() ? (snap.data() as UserPreferences) : null;
    } catch (err) {
      logger.error('Failed to get user preferences from Firestore', err);
      return null;
    }
  }

  async saveUserPreferences(userId: string, preferences: UserPreferences): Promise<void> {
    const db = this.getDb();
    if (!db) {
      localStorage.setItem('extrovela_user_preferences', JSON.stringify(preferences));
      return;
    }

    try {
      const prefRef = doc(db, 'users', userId, 'preferences', 'profile');
      await setDoc(prefRef, preferences, { merge: true });
      logger.info('User preferences saved to Firestore', { userId });
    } catch (err) {
      logger.error('Error saving user preferences to Firestore', err);
    }
  }

  // ─── Quest Sessions & Lifecycle ──────────────────────────────
  async saveQuestSession(userId: string, session: QuestSession): Promise<void> {
    const db = this.getDb();
    if (!db) {
      const local = JSON.parse(localStorage.getItem('extrovela_quest_sessions') || '[]');
      const idx = local.findIndex((s: any) => s.id === session.id);
      if (idx >= 0) local[idx] = session;
      else local.unshift(session);
      localStorage.setItem('extrovela_quest_sessions', JSON.stringify(local));
      return;
    }

    try {
      const sessionRef = doc(db, 'users', userId, 'questSessions', session.id);
      await setDoc(sessionRef, session, { merge: true });
      logger.info('Quest session synced to Firestore', { sessionId: session.id, status: session.status });
    } catch (error) {
      logger.error('Error syncing quest session to Firestore', error);
    }
  }

  // ─── Memories ──────────────────────────────────────────────
  async saveMemory(userId: string, memory: Memory): Promise<void> {
    const db = this.getDb();
    if (!db) {
      const local = JSON.parse(localStorage.getItem('extrovela_memories') || '[]');
      localStorage.setItem('extrovela_memories', JSON.stringify([memory, ...local]));
      return;
    }

    try {
      const memRef = doc(db, 'users', userId, 'memories', memory.id);
      await setDoc(memRef, memory);
      logger.info('Memory synced to Firestore', { memoryId: memory.id });
    } catch (error) {
      logger.error('Error syncing memory to Firestore', error);
    }
  }

  async deleteMemory(userId: string, memoryId: string): Promise<void> {
    const db = this.getDb();
    if (!db) {
      const local: Memory[] = JSON.parse(localStorage.getItem('extrovela_memories') || '[]');
      localStorage.setItem('extrovela_memories', JSON.stringify(local.filter(m => m.id !== memoryId)));
      return;
    }

    try {
      const memRef = doc(db, 'users', userId, 'memories', memoryId);
      await deleteDoc(memRef);
      logger.info('Memory deleted from Firestore', { memoryId });
    } catch (error) {
      logger.error('Error deleting memory from Firestore', error);
    }
  }

  async getUserMemories(userId: string): Promise<Memory[]> {
    const db = this.getDb();
    if (!db) {
      return JSON.parse(localStorage.getItem('extrovela_memories') || '[]');
    }

    try {
      const memCol = collection(db, 'users', userId, 'memories');
      const q = query(memCol, orderBy('completedAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as Memory);
    } catch (error) {
      logger.warn('Failed to query Firestore memories, falling back to local storage', { error });
      return JSON.parse(localStorage.getItem('extrovela_memories') || '[]');
    }
  }

  // ─── Phase 12: Experience Recaps ───────────────────────────
  // Owner-only subcollection. periodStart is immutable per Firestore rules, so we
  // never rewrite it on update — setDoc(merge) only ever advances status/version.
  async saveExperienceRecap(userId: string, recap: ExperienceRecap): Promise<void> {
    const db = this.getDb();
    if (!db) {
      const key = `extrovela_recaps_${userId}`;
      const local: ExperienceRecap[] = JSON.parse(localStorage.getItem(key) || '[]');
      const idx = local.findIndex(r => r.id === recap.id);
      if (idx >= 0) local[idx] = recap;
      else local.unshift(recap);
      localStorage.setItem(key, JSON.stringify(local));
      return;
    }
    try {
      const ref = doc(db, 'users', userId, 'experienceRecaps', recap.id);
      await setDoc(ref, recap, { merge: true });
      logger.info('Experience recap synced to Firestore', { recapId: recap.id, status: recap.status });
    } catch (error) {
      logger.error('Error syncing experience recap to Firestore', error);
    }
  }

  async getExperienceRecaps(userId: string): Promise<ExperienceRecap[]> {
    const db = this.getDb();
    if (!db) {
      return JSON.parse(localStorage.getItem(`extrovela_recaps_${userId}`) || '[]');
    }
    try {
      const col = collection(db, 'users', userId, 'experienceRecaps');
      const q = query(col, orderBy('periodStart', 'desc'), limit(60));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as ExperienceRecap);
    } catch (error) {
      logger.warn('Failed to query recaps, falling back to local storage', { error });
      return JSON.parse(localStorage.getItem(`extrovela_recaps_${userId}`) || '[]');
    }
  }

  async getExperienceRecap(userId: string, recapId: string): Promise<ExperienceRecap | null> {
    const db = this.getDb();
    if (!db) {
      const local: ExperienceRecap[] = JSON.parse(localStorage.getItem(`extrovela_recaps_${userId}`) || '[]');
      return local.find(r => r.id === recapId) || null;
    }
    try {
      const snap = await getDoc(doc(db, 'users', userId, 'experienceRecaps', recapId));
      return snap.exists() ? (snap.data() as ExperienceRecap) : null;
    } catch (error) {
      logger.warn('Failed to read recap from Firestore', { error });
      return null;
    }
  }

  // ─── Phase 12: Memory Collections ──────────────────────────
  async saveMemoryCollection(userId: string, coll: MemoryCollection): Promise<void> {
    const db = this.getDb();
    if (!db) {
      const key = `extrovela_collections_${userId}`;
      const local: MemoryCollection[] = JSON.parse(localStorage.getItem(key) || '[]');
      const idx = local.findIndex(c => c.id === coll.id);
      if (idx >= 0) local[idx] = coll;
      else local.unshift(coll);
      localStorage.setItem(key, JSON.stringify(local));
      return;
    }
    try {
      const ref = doc(db, 'users', userId, 'memoryCollections', coll.id);
      await setDoc(ref, coll, { merge: true });
      logger.info('Memory collection synced to Firestore', { collectionId: coll.id });
    } catch (error) {
      logger.error('Error syncing memory collection to Firestore', error);
    }
  }

  async getMemoryCollections(userId: string): Promise<MemoryCollection[]> {
    const db = this.getDb();
    if (!db) {
      return JSON.parse(localStorage.getItem(`extrovela_collections_${userId}`) || '[]');
    }
    try {
      const col = collection(db, 'users', userId, 'memoryCollections');
      const snap = await getDocs(query(col, limit(100)));
      return snap.docs.map(d => d.data() as MemoryCollection);
    } catch (error) {
      logger.warn('Failed to query collections, falling back to local storage', { error });
      return JSON.parse(localStorage.getItem(`extrovela_collections_${userId}`) || '[]');
    }
  }

  async deleteMemoryCollection(userId: string, collectionId: string): Promise<void> {
    const db = this.getDb();
    if (!db) {
      const key = `extrovela_collections_${userId}`;
      const local: MemoryCollection[] = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify(local.filter(c => c.id !== collectionId)));
      return;
    }
    try {
      await deleteDoc(doc(db, 'users', userId, 'memoryCollections', collectionId));
    } catch (error) {
      logger.error('Error deleting memory collection from Firestore', error);
    }
  }

  // ─── Phase 12: Share tokens (owner-only index) ─────────────
  // This is the OWNER's private index so they can list and revoke their links; it
  // may hold internal linkage. The PUBLIC document is saved by savePublicShareLink.
  async saveShareToken(userId: string, tokenDoc: ShareTokenIndex): Promise<void> {
    const db = this.getDb();
    if (!db) {
      const key = `extrovela_share_tokens_${userId}`;
      const local: ShareTokenIndex[] = JSON.parse(localStorage.getItem(key) || '[]');
      const idx = local.findIndex(t => t.id === tokenDoc.id);
      if (idx >= 0) local[idx] = tokenDoc;
      else local.unshift(tokenDoc);
      localStorage.setItem(key, JSON.stringify(local));
      return;
    }
    try {
      const ref = doc(db, 'users', userId, 'shareTokens', tokenDoc.id);
      await setDoc(ref, tokenDoc, { merge: true });
    } catch (error) {
      logger.error('Error syncing share token to Firestore', error);
    }
  }

  async getShareTokens(userId: string): Promise<ShareTokenIndex[]> {
    const db = this.getDb();
    if (!db) {
      return JSON.parse(localStorage.getItem(`extrovela_share_tokens_${userId}`) || '[]');
    }
    try {
      const col = collection(db, 'users', userId, 'shareTokens');
      const snap = await getDocs(query(col, limit(200)));
      return snap.docs.map(d => d.data() as ShareTokenIndex);
    } catch (error) {
      logger.warn('Failed to query share tokens', { error });
      return JSON.parse(localStorage.getItem(`extrovela_share_tokens_${userId}`) || '[]');
    }
  }

  async revokeShareToken(userId: string, tokenId: string): Promise<void> {
    const db = this.getDb();
    if (!db) {
      const key = `extrovela_share_tokens_${userId}`;
      const local: ShareTokenIndex[] = JSON.parse(localStorage.getItem(key) || '[]');
      const next = local.map(t => (t.id === tokenId ? { ...t, revoked: true } : t));
      localStorage.setItem(key, JSON.stringify(next));
      return;
    }
    try {
      await setDoc(doc(db, 'users', userId, 'shareTokens', tokenId), { revoked: true }, { merge: true });
    } catch (error) {
      logger.error('Error revoking share token', error);
    }
  }

  // ─── Phase 12: Public share links (top-level, unauthenticated read) ─────
  // expiresAt is written as a Firestore Timestamp so the rule's `request.time <
  // resource.data.expiresAt` comparison works; locally we keep the ISO string.
  async savePublicShareLink(token: string, payload: PublicSharePayload): Promise<void> {
    const db = this.getDb();
    if (!db) {
      const map = JSON.parse(localStorage.getItem('extrovela_share_links') || '{}');
      map[token] = payload;
      localStorage.setItem('extrovela_share_links', JSON.stringify(map));
      return;
    }
    try {
      const toWrite: Record<string, unknown> = { ...payload };
      if (payload.expiresAt) toWrite.expiresAt = Timestamp.fromDate(new Date(payload.expiresAt));
      await setDoc(doc(db, 'shareLinks', token), toWrite);
      logger.info('Public share link published', { tokenPreview: token.slice(0, 6) });
    } catch (error) {
      logger.error('Error publishing public share link', error);
      throw error;
    }
  }

  async getPublicShareLink(token: string): Promise<PublicSharePayload | null> {
    const db = this.getDb();
    if (!db) {
      const map = JSON.parse(localStorage.getItem('extrovela_share_links') || '{}');
      return map[token] || null;
    }
    try {
      const snap = await getDoc(doc(db, 'shareLinks', token));
      if (!snap.exists()) return null;
      const data = snap.data() as Record<string, unknown>;
      if (data.expiresAt instanceof Timestamp) {
        data.expiresAt = (data.expiresAt as Timestamp).toDate().toISOString();
      }
      return data as unknown as PublicSharePayload;
    } catch (error) {
      logger.warn('Failed to read public share link', { error });
      return null;
    }
  }

  async revokePublicShareLink(token: string): Promise<void> {
    const db = this.getDb();
    if (!db) {
      const map = JSON.parse(localStorage.getItem('extrovela_share_links') || '{}');
      if (map[token]) {
        map[token].revoked = true;
        localStorage.setItem('extrovela_share_links', JSON.stringify(map));
      }
      return;
    }
    try {
      await setDoc(doc(db, 'shareLinks', token), { revoked: true }, { merge: true });
    } catch (error) {
      logger.error('Error revoking public share link', error);
      throw error;
    }
  }

  async deletePublicShareLink(token: string): Promise<void> {
    const db = this.getDb();
    if (!db) {
      const map = JSON.parse(localStorage.getItem('extrovela_share_links') || '{}');
      delete map[token];
      localStorage.setItem('extrovela_share_links', JSON.stringify(map));
      return;
    }
    try {
      await deleteDoc(doc(db, 'shareLinks', token));
    } catch (error) {
      logger.error('Error deleting public share link', error);
    }
  }
}

export const firestore = new FirestoreService();
export const firestoreService = firestore;
export default firestore;

