import { QuestStatus, QuestSession, SkipReason } from '../../types/quest';

export type { QuestStatus, QuestSession, SkipReason };

const ALLOWED_TRANSITIONS: Record<QuestStatus, QuestStatus[]> = {
  generated: ['viewed', 'expired', 'skipped'],
  viewed: ['accepted', 'skipped', 'expired'],
  accepted: ['started', 'skipped', 'expired'],
  started: ['inProgress', 'abandoned', 'skipped'],
  inProgress: ['paused', 'completed', 'abandoned'],
  paused: ['inProgress', 'abandoned'],
  completed: [], // Terminal
  skipped: [],   // Terminal
  abandoned: [], // Terminal
  expired: [],   // Terminal
};

export class QuestStateMachine {
  static canTransition(from: QuestStatus, to: QuestStatus): boolean {
    return ALLOWED_TRANSITIONS[from]?.includes(to) || false;
  }

  static transition(
    session: QuestSession,
    newStatus: QuestStatus,
    extra?: { skipReason?: SkipReason; skipNote?: string; abandonNote?: string }
  ): QuestSession {
    if (!this.canTransition(session.status, newStatus)) {
      throw new Error(`Invalid quest state transition from "${session.status}" to "${newStatus}"`);
    }

    const now = new Date().toISOString();
    return {
      ...session,
      status: newStatus,
      updatedAt: now,
      completedAt: newStatus === 'completed' ? now : session.completedAt,
      pausedAt: newStatus === 'paused' ? now : session.pausedAt,
      skipReason: extra?.skipReason || session.skipReason,
      skipNote: extra?.skipNote || session.skipNote,
      abandonNote: extra?.abandonNote || session.abandonNote,
    };
  }

  static createSession(params: {
    userId: string;
    questId: string;
    questTitle: string;
    totalDurationMinutes?: number;
  }): QuestSession {
    const now = new Date().toISOString();
    return {
      id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId: params.userId,
      questId: params.questId,
      questTitle: params.questTitle,
      status: 'generated',
      startedAt: now,
      durationSeconds: 0,
      elapsedSeconds: 0,
      totalDurationMinutes: params.totalDurationMinutes || 30,
      isPhoneFreeMode: false,
      currentStepIndex: 0,
      createdAt: now,
      updatedAt: now,
    };
  }
}

