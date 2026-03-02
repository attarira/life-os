import { memoryStore } from './memory-store';
import { MemoryNode } from './types';
import { cosineSimilarity } from './memory-retrieval';

// Configuration for Memory decay
const DECAY_THRESHOLD = 0.15;
const MAX_BASE_DECAY_DAYS = 30;
const MILLISECONDS_IN_DAY = 1000 * 60 * 60 * 24;

/**
 * Calculates the composite retrieval score for a memory node
 * factoring in intrinsic importance, access frequency logic, and linear time decay.
 */
export function calculateDecayWeight(node: MemoryNode): number {
  const now = Date.now();
  const lastAccess = new Date(node.lastAccessedAt).getTime();

  const daysSinceAccess = Math.max(0, (now - lastAccess) / MILLISECONDS_IN_DAY);

  // Linear penalty based on days since last touch, maxing out at 30 days
  const timeDecay = Math.min(daysSinceAccess / MAX_BASE_DECAY_DAYS, 1.0);

  // Logarithmic boost for frequently accessed items
  const accessBoost = Math.log10(Math.max(1, node.accessCount)) * 0.1;

  // Base formulation: Weight_decay = Importance + log(AccessCount) - TimeDecay
  const weight = node.importance + accessBoost - (timeDecay * 0.5); // Decay penalty maxes at 0.5

  return Math.max(0, weight);
}

/**
 * Scans the database and removes nodes that fall below the decay threshold.
 * Should be run periodically (e.g., on application boot).
 */
export async function pruneMemories(): Promise<number> {
  const allNodes = await memoryStore.getAll();
  let prunedCount = 0;

  for (const node of allNodes) {
    const weight = calculateDecayWeight(node);

    // Only prune if weak AND older than 30 days
    const daysOld = (Date.now() - new Date(node.lastAccessedAt).getTime()) / MILLISECONDS_IN_DAY;

    if (weight < DECAY_THRESHOLD && daysOld > MAX_BASE_DECAY_DAYS) {
      await memoryStore.remove(node.id);
      prunedCount++;
    }
  }

  return prunedCount;
}

/**
 * Detects conflicts when attempting to insert new memory.
 * Evaluates semantic collision (>0.95 cosine similarity).
 * Note: In a real system, the LLM determines contradiction from the collision queue.
 */
export async function detectMemoryCollisions(newEmbedding: number[], type: MemoryNode['type']): Promise<MemoryNode[]> {
  const candidates = await memoryStore.getByType(type);

  const collisions = candidates.filter(node => {
    const similarity = cosineSimilarity(newEmbedding, node.embedding);
    return similarity >= 0.95;
  });

  return collisions;
}

/**
 * A sample interface the LLM orchestration might call.
 * If a contradiction is detected by the LLM, the old memory's content and embedding are overwritten.
 */
export async function resolveMemoryConflict(
  existingNodeId: string,
  newContent: string,
  newEmbedding: number[],
  importance: number
): Promise<MemoryNode> {
  return memoryStore.update(existingNodeId, {
    content: newContent,
    embedding: newEmbedding,
    importance,
    lastAccessedAt: new Date().toISOString()
  });
}
