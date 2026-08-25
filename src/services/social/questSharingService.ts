import { Quest } from '../../types/quest';
import { QuestInvite } from '../../types/social';
import { socialRepository } from '../../repositories/SocialRepository';
import { generateSecureToken } from '../security/tokenGenerator';
import { rateLimiter } from './rateLimiter';
import logger from '../../utils/logger';

export class QuestSharingService {
  /**
   * Generates an unguessable invite token. The token is a capability — anyone who
   * holds it can view/join the invite — so it MUST come from a CSPRNG, never
   * Math.random. `generateSecureToken(24)` yields 24 base62 chars (~143 bits);
   * with the `inv_` prefix the total is 28 chars, above the 22-char rule floor.
   * base62 contains no `_`, so the deep-link regex still round-trips the prefix.
   */
  private static generateToken(): string {
    return 'inv_' + generateSecureToken(24);
  }

  static async createInvite(
    quest: Quest,
    creatorId: string,
    creatorName: string,
    type: 'friend' | 'link' = 'link',
    maxParticipants = 4
  ): Promise<QuestInvite> {
    const check = rateLimiter.isAllowed('invite_create', creatorId);
    if (!check.allowed) {
      throw new Error(`Rate limit exceeded for quest invites. Please wait ${Math.ceil((check.retryAfterMs || 0) / 1000)} seconds.`);
    }

    // The token IS the canonical id: in Firestore the invite lives at
    // questInvites/{token}, so a lookup is a direct getDoc (no query, no index) and
    // the id cannot be enumerated. In-memory mode keys by the same value.
    const token = this.generateToken();
    const inviteId = token;

    // 24 hour default expiration
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const invite: QuestInvite = {
      id: inviteId,
      questId: quest.id,
      creatorId,
      creatorName,
      questTitle: quest.title,
      estimatedDuration: quest.time || '30-45 mins',
      approximateArea: quest.cityContext?.[0] || 'Local Area',
      type,
      inviteToken: token,
      status: 'active',
      maxParticipants,
      expiresAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await socialRepository.saveQuestInvite(invite);
    logger.info('Quest invite token generated', { inviteId, token });
    return invite;
  }

  /**
   * Validates invite token, expiration, status, and block rules
   */
  static async validateInviteToken(token: string, currentUserId: string): Promise<{
    valid: boolean;
    invite?: QuestInvite;
    reason?: string;
  }> {
    const invite = await socialRepository.getInviteByToken(token);
    if (!invite) {
      return { valid: false, reason: 'Invalid or unknown invite token.' };
    }

    if (invite.status === 'cancelled') {
      return { valid: false, reason: 'This quest invite has been cancelled by the host.' };
    }

    if (invite.status === 'completed') {
      return { valid: false, reason: 'This shared quest has already been completed.' };
    }

    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      return { valid: false, reason: 'This invite link has expired.' };
    }

    if (await socialRepository.isBlockedBetween(invite.creatorId, currentUserId)) {
      return { valid: false, reason: 'This invite is unavailable due to safety settings.' };
    }

    return { valid: true, invite };
  }

  static async cancelInvite(inviteId: string, creatorId: string): Promise<void> {
    const invite = await socialRepository.getQuestInvite(inviteId);
    if (invite && invite.creatorId === creatorId) {
      await socialRepository.cancelInvite(inviteId);
    }
  }

  static getShareUrl(invite: QuestInvite): string {
    return `https://extrovela.app/quest/invite/${invite.inviteToken}`;
  }

  static parseInviteFromUrl(url: string): string | null {
    try {
      const match = url.match(/\/quest\/invite\/([a-zA-Z0-9_-]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
}

export default QuestSharingService;
