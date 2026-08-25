/**
 * EXTROVELA — Phase 11: Experience Graph Service
 *
 * A per-user relationship graph stored as ordinary Firestore DOCUMENTS in two
 * subcollections — experienceGraphNodes and experienceGraphEdges. There is
 * deliberately NO graph database (no Neo4j): the traversals this product needs
 * are one- and two-hop lookups over a few hundred nodes per user, which are
 * cheaper and simpler as denormalized documents.
 *
 * Node keys are deterministic (`type:key`) so repeated events converge on the
 * same document instead of creating duplicates.
 *
 * NOTE: an unrelated `server/services/experienceGraph.js` already computes
 * aggregate *quality metrics* for admin dashboards. It is untouched; this
 * service is the per-user relationship graph and does not replace it.
 */

import logger from '../../utils/logger';
import { intelligenceFirestore } from './intelligenceFirestore';
import { isSafeDerivedValue } from './sensitiveAttributeGuard';
import type {
  ExperienceEvent,
  ExperienceEdgeType,
  ExperienceGraphEdge,
  ExperienceGraphNode,
  ExperienceNodeType,
} from '../../types/experienceIntelligence';

const MAX_LINEAGE_IDS = 25;

export function nodeId(type: ExperienceNodeType, key: string): string {
  const safe = key.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 48);
  return `${type}__${safe}`;
}

export function edgeId(type: ExperienceEdgeType, fromId: string, toId: string): string {
  return `${type}__${fromId}__${toId}`;
}

interface NodeSpec {
  type: ExperienceNodeType;
  key: string;
  label: string;
}

/** Extracts the graph nodes an event touches. */
export function nodesFromEvent(event: ExperienceEvent): NodeSpec[] {
  const specs: NodeSpec[] = [];
  const add = (type: ExperienceNodeType, key?: string, label?: string) => {
    if (!key) return;
    if (!isSafeDerivedValue(key)) return;
    specs.push({ type, key, label: label || key });
  };

  add('category', event.category);
  add('experienceType', event.experienceType);
  add('place', event.placeId);
  add('timeOfDay', event.timeOfDay);
  add('socialMode', event.socialMode);
  add('setting', event.locationArea);
  // Only moods the user explicitly selected are graphed — never inferred ones.
  add('mood', event.moodAfter);

  return specs;
}

/** Which edge type an event implies, and how strongly. */
export function edgeSpecFromEvent(
  event: ExperienceEvent
): { type: ExperienceEdgeType; weight: number } | null {
  switch (event.type) {
    case 'questCompleted':
    case 'friendQuestCompleted':
      return { type: 'enjoyed', weight: 1 };
    case 'questRated':
      if (typeof event.rating !== 'number') return null;
      return event.rating >= 4
        ? { type: 'enjoyed', weight: event.rating - 3 }
        : event.rating <= 2
          ? { type: 'avoided', weight: 3 - event.rating }
          : null;
    case 'memoryCreated':
      return { type: 'enjoyed', weight: 0.8 };
    case 'placeDiscovered':
      return { type: 'discovered', weight: 1 };
    case 'questRejected':
      return { type: 'avoided', weight: 1 };
    case 'questSkipped':
      return { type: 'avoided', weight: 0.5 };
    case 'discoverySelected':
      return { type: 'discovered', weight: 0.5 };
    default:
      return null;
  }
}

export class ExperienceGraphService {
  /** Folds one raw event into the user's graph. Idempotent per event id. */
  async applyEvent(event: ExperienceEvent): Promise<{ nodes: number; edges: number }> {
    const specs = nodesFromEvent(event);
    if (specs.length === 0) return { nodes: 0, edges: 0 };

    const now = new Date().toISOString();
    const existingNodes = await intelligenceFirestore.getGraphNodes(event.userId);
    const nodeMap = new Map(existingNodes.map(n => [n.id, n]));

    // The user node anchors every relationship.
    const userNode = await this.ensureNode(
      nodeMap,
      event.userId,
      { type: 'user', key: 'self', label: 'You' },
      event.createdAt,
      now
    );

    const touched: ExperienceGraphNode[] = [];
    for (const spec of specs) {
      touched.push(await this.ensureNode(nodeMap, event.userId, spec, event.createdAt, now));
    }

    const edgeSpec = edgeSpecFromEvent(event);
    let edgeCount = 0;

    if (edgeSpec) {
      const existingEdges = await intelligenceFirestore.getGraphEdges(event.userId);
      const edgeMap = new Map(existingEdges.map(e => [e.id, e]));

      // user → each touched node
      for (const node of touched) {
        const applied = await this.upsertEdge(
          edgeMap,
          event,
          edgeSpec.type,
          userNode.id,
          node.id,
          edgeSpec.weight,
          now
        );
        if (applied) edgeCount += 1;
      }

      // Co-occurrence edges between the touched nodes (e.g. nature ↔ evening).
      for (let i = 0; i < touched.length; i += 1) {
        for (let j = i + 1; j < touched.length; j += 1) {
          const applied = await this.upsertEdge(
            edgeMap,
            event,
            'pairedWith',
            touched[i].id,
            touched[j].id,
            0.5,
            now
          );
          if (applied) edgeCount += 1;
        }
      }
    }

    return { nodes: touched.length, edges: edgeCount };
  }

  private async ensureNode(
    nodeMap: Map<string, ExperienceGraphNode>,
    userId: string,
    spec: NodeSpec,
    seenAt: string,
    now: string
  ): Promise<ExperienceGraphNode> {
    const id = nodeId(spec.type, spec.key);
    const existing = nodeMap.get(id);

    const next: ExperienceGraphNode = existing
      ? {
          ...existing,
          weight: existing.weight + 1,
          lastSeenAt: seenAt > existing.lastSeenAt ? seenAt : existing.lastSeenAt,
          updatedAt: now,
        }
      : {
          id,
          userId,
          type: spec.type,
          key: spec.key.toLowerCase(),
          label: spec.label,
          weight: 1,
          firstSeenAt: seenAt,
          lastSeenAt: seenAt,
          updatedAt: now,
        };

    nodeMap.set(id, next);
    await intelligenceFirestore.saveGraphNode(next);
    return next;
  }

  private async upsertEdge(
    edgeMap: Map<string, ExperienceGraphEdge>,
    event: ExperienceEvent,
    type: ExperienceEdgeType,
    fromNodeId: string,
    toNodeId: string,
    weight: number,
    now: string
  ): Promise<boolean> {
    const id = edgeId(type, fromNodeId, toNodeId);
    const existing = edgeMap.get(id);

    // Idempotency: this raw event already contributed to this edge.
    if (existing && existing.sourceEventIds.includes(event.id)) return false;

    const observationCount = (existing?.observationCount || 0) + 1;
    const next: ExperienceGraphEdge = {
      id,
      userId: event.userId,
      type,
      fromNodeId,
      toNodeId,
      weight: Number(((existing?.weight || 0) + weight).toFixed(3)),
      // Saturating confidence: 1 observation ≈ 0.30, 5 ≈ 0.71, 10 ≈ 0.87
      confidence: Number((1 - Math.exp(-observationCount / 3)).toFixed(4)),
      observationCount,
      lastObservedAt: event.createdAt,
      updatedAt: now,
      sourceEventIds: Array.from(
        new Set([...(existing?.sourceEventIds || []), event.id])
      ).slice(-MAX_LINEAGE_IDS),
    };

    edgeMap.set(id, next);
    await intelligenceFirestore.saveGraphEdge(next);
    return true;
  }

  // ─── Queries (one- and two-hop) ────────────────────────────

  /** Nodes the user has an `enjoyed` edge to, strongest first. */
  async getEnjoyedNodes(userId: string, max = 20): Promise<ExperienceGraphNode[]> {
    const [nodes, edges] = await Promise.all([
      intelligenceFirestore.getGraphNodes(userId),
      intelligenceFirestore.getGraphEdges(userId),
    ]);
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const selfId = nodeId('user', 'self');

    return edges
      .filter(e => e.type === 'enjoyed' && e.fromNodeId === selfId)
      .sort((a, b) => b.weight - a.weight)
      .map(e => nodeById.get(e.toNodeId))
      .filter((n): n is ExperienceGraphNode => Boolean(n))
      .slice(0, max);
  }

  /** Nodes the user has an `avoided` edge to, strongest first. */
  async getAvoidedNodes(userId: string, max = 20): Promise<ExperienceGraphNode[]> {
    const [nodes, edges] = await Promise.all([
      intelligenceFirestore.getGraphNodes(userId),
      intelligenceFirestore.getGraphEdges(userId),
    ]);
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const selfId = nodeId('user', 'self');

    return edges
      .filter(e => e.type === 'avoided' && e.fromNodeId === selfId)
      .sort((a, b) => b.weight - a.weight)
      .map(e => nodeById.get(e.toNodeId))
      .filter((n): n is ExperienceGraphNode => Boolean(n))
      .slice(0, max);
  }

  /**
   * Two-hop traversal: things paired with what the user enjoys but that they
   * have not themselves engaged with. This is the graph's contribution to
   * novelty — "adjacent, not random".
   */
  async getAdjacentUnexplored(userId: string, max = 10): Promise<ExperienceGraphNode[]> {
    const [nodes, edges] = await Promise.all([
      intelligenceFirestore.getGraphNodes(userId),
      intelligenceFirestore.getGraphEdges(userId),
    ]);
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const selfId = nodeId('user', 'self');

    const directlyTouched = new Set(
      edges.filter(e => e.fromNodeId === selfId).map(e => e.toNodeId)
    );
    const enjoyed = edges
      .filter(e => e.type === 'enjoyed' && e.fromNodeId === selfId)
      .map(e => e.toNodeId);

    const scores = new Map<string, number>();
    for (const enjoyedId of enjoyed) {
      for (const edge of edges) {
        if (edge.type !== 'pairedWith') continue;
        const other =
          edge.fromNodeId === enjoyedId
            ? edge.toNodeId
            : edge.toNodeId === enjoyedId
              ? edge.fromNodeId
              : null;
        if (!other || directlyTouched.has(other) || other === selfId) continue;
        scores.set(other, (scores.get(other) || 0) + edge.weight * edge.confidence);
      }
    }

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => nodeById.get(id))
      .filter((n): n is ExperienceGraphNode => Boolean(n))
      .slice(0, max);
  }

  /** Repetition detection: node keys engaged with unusually often and recently. */
  async detectRepetition(
    userId: string,
    windowDays = 21
  ): Promise<Array<{ node: ExperienceGraphNode; recentWeight: number }>> {
    const nodes = await intelligenceFirestore.getGraphNodes(userId);
    const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;

    return nodes
      .filter(n => n.type === 'category' || n.type === 'experienceType')
      .filter(n => new Date(n.lastSeenAt).getTime() >= cutoff && n.weight >= 3)
      .sort((a, b) => b.weight - a.weight)
      .map(node => ({ node, recentWeight: node.weight }));
  }

  async getStats(userId: string): Promise<{ nodeCount: number; edgeCount: number }> {
    const [nodes, edges] = await Promise.all([
      intelligenceFirestore.getGraphNodes(userId),
      intelligenceFirestore.getGraphEdges(userId),
    ]);
    logger.debug('Experience graph size', { nodeCount: nodes.length, edgeCount: edges.length });
    return { nodeCount: nodes.length, edgeCount: edges.length };
  }
}

export const experienceGraphService = new ExperienceGraphService();
export default experienceGraphService;
