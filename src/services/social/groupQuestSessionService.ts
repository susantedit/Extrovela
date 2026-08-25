import { GroupQuestSession, QuestParticipant, SharedExperience, GroupQuestState } from '../../types/social';
import { socialRepository } from '../../repositories/SocialRepository';
import logger from '../../utils/logger';

export class GroupQuestSessionService {
  static async createGroupSession(
    questId: string,
    creatorId: string,
    creatorName: string,
    initialFriends: Array<{ id: string; name: string }> = [],
    maxParticipants = 6
  ): Promise<GroupQuestSession> {
    const sessionId = `group_session_${Date.now()}`;
    const participants: QuestParticipant[] = [
      {
        id: `part_${creatorId}`,
        questId,
        userId: creatorId,
        displayName: creatorName,
        role: 'creator',
        status: 'active',
        joinedAt: new Date().toISOString(),
      },
      ...initialFriends.map(f => ({
        id: `part_${f.id}`,
        questId,
        userId: f.id,
        displayName: f.name,
        role: 'participant' as const,
        status: 'accepted' as const,
        joinedAt: new Date().toISOString(),
      })),
    ];

    if (participants.length > maxParticipants) {
      throw new Error(`Participant limit of ${maxParticipants} exceeded.`);
    }

    const session: GroupQuestSession = {
      id: sessionId,
      questId,
      creatorId,
      state: 'waiting',
      participants,
    };

    await socialRepository.saveGroupSession(session);
    logger.info('Group quest session created', { sessionId, creatorId, count: participants.length });
    return session;
  }

  static async joinGroupSession(
    sessionId: string,
    user: { id: string; name: string },
    maxParticipants = 6
  ): Promise<GroupQuestSession> {
    const session = await socialRepository.getGroupSession(sessionId);
    if (!session) {
      throw new Error('Group quest session not found.');
    }

    if (session.state === 'completed' || session.state === 'cancelled') {
      throw new Error('This group quest session is no longer active.');
    }

    if (await socialRepository.isBlockedBetween(session.creatorId, user.id)) {
      throw new Error('Unable to join session due to safety settings.');
    }

    const existingIndex = session.participants.findIndex(p => p.userId === user.id);
    if (existingIndex >= 0) {
      session.participants[existingIndex].status = 'active';
    } else {
      if (session.participants.filter(p => p.status === 'active' || p.status === 'accepted').length >= maxParticipants) {
        throw new Error(`Session is full (maximum ${maxParticipants} participants).`);
      }

      session.participants.push({
        id: `part_${user.id}`,
        questId: session.questId,
        userId: user.id,
        displayName: user.name,
        role: 'participant',
        status: 'active',
        joinedAt: new Date().toISOString(),
      });
    }

    await socialRepository.saveGroupSession(session);
    logger.info('User joined group quest session', { sessionId, userId: user.id });
    return session;
  }

  static async leaveGroupSession(sessionId: string, userId: string): Promise<GroupQuestSession> {
    const session = await socialRepository.getGroupSession(sessionId);
    if (!session) throw new Error('Session not found.');

    const participant = session.participants.find(p => p.userId === userId);
    if (participant) {
      participant.status = 'left';
      participant.leftAt = new Date().toISOString();
    }

    // If host leaves, transfer creator role or cancel session
    if (session.creatorId === userId) {
      const remainingActive = session.participants.find(p => p.status === 'active' && p.userId !== userId);
      if (remainingActive) {
        remainingActive.role = 'creator';
        session.creatorId = remainingActive.userId;
        logger.info('Creator role transferred', { sessionId, newCreator: remainingActive.userId });
      } else {
        session.state = 'cancelled';
        logger.info('Group session cancelled because all participants left', { sessionId });
      }
    }

    await socialRepository.saveGroupSession(session);
    return session;
  }

  static async updateSessionState(session: GroupQuestSession, newState: GroupQuestState): Promise<GroupQuestSession> {
    const updated: GroupQuestSession = {
      ...session,
      state: newState,
      startedAt: newState === 'active' && !session.startedAt ? new Date().toISOString() : session.startedAt,
    };

    await socialRepository.saveGroupSession(updated);
    return updated;
  }

  static async completeGroupSession(
    session: GroupQuestSession,
    questTitle: string
  ): Promise<SharedExperience> {
    const sharedExpId = `shared_exp_${Date.now()}`;
    const activeParticipants = session.participants.filter(p => p.status === 'active' || p.status === 'accepted');

    const sharedExp: SharedExperience = {
      id: sharedExpId,
      questId: session.questId,
      questTitle,
      creatorId: session.creatorId,
      participantIds: activeParticipants.map(p => p.userId),
      participantNames: activeParticipants.map(p => p.displayName),
      completedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    session.state = 'completed';
    session.completedAt = new Date().toISOString();
    session.sharedExperienceId = sharedExpId;

    await Promise.all([
      socialRepository.saveGroupSession(session),
      socialRepository.saveSharedExperience(sharedExp),
    ]);

    logger.info('Group quest session completed', { sessionId: session.id, sharedExpId });
    return sharedExp;
  }
}

export default GroupQuestSessionService;
