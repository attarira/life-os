import { MemoryNode, MemoryType } from './types';
import { memoryStore } from './memory-store';

// Helper: Cosine Similarity between two vectors
export function cosineSimilarity(A: number[], B: number[]): number {
  if (A.length !== B.length) throw new Error('Vector dimensions do not match.');
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < A.length; i++) {
    dotProduct += A[i] * B[i];
    normA += A[i] * A[i];
    normB += B[i] * B[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Helper: Basic BM25-lite keyword scoring
function extractKeywords(text: string): string[] {
  return text.toLowerCase().match(/\b\w+\b/g) || [];
}

function calculateBM25Score(queryKeywords: string[], docKeywords: string[]): number {
  let score = 0;
  const k1 = 1.2;
  const b = 0.75;
  const avgDocLength = 20; // assumed average for these nodes

  // Frequency map for doc
  const docFreq: Record<string, number> = {};
  for (const word of docKeywords) {
    docFreq[word] = (docFreq[word] || 0) + 1;
  }

  for (const q of queryKeywords) {
    const f = docFreq[q] || 0;
    if (f > 0) {
      // Simplified IDF: Assume IDF = 1 for simplicity in a strictly local store without global stats
      const termScore = (f * (k1 + 1)) / (f + k1 * (1 - b + b * (docKeywords.length / avgDocLength)));
      score += termScore;
    }
  }

  return score;
}

interface RankedNode extends MemoryNode {
  denseScore: number;
  sparseScore: number;
  rrfScore: number;
}

export async function searchMemory(
  queryText: string,
  queryEmbedding: number[],
  types?: MemoryType[],
  limit: number = 5
): Promise<RankedNode[]> {
  const allNodes = await memoryStore.getAll();

  // Filter by type if provided
  const candidates = types && types.length > 0
    ? allNodes.filter(n => types.includes(n.type))
    : allNodes;

  if (candidates.length === 0) return [];

  const queryKeywords = extractKeywords(queryText);

  // 1. Calculate individual scores
  const scoredNodes: RankedNode[] = candidates.map(node => {
    const denseScore = cosineSimilarity(queryEmbedding, node.embedding);
    const sparseScore = calculateBM25Score(queryKeywords, extractKeywords(node.content));

    return {
      ...node,
      denseScore,
      sparseScore,
      rrfScore: 0 // to be computed
    };
  });

  // 2. Rank by Dense
  scoredNodes.sort((a, b) => b.denseScore - a.denseScore);
  const denseRanks = new Map<string, number>();
  scoredNodes.forEach((n, idx) => denseRanks.set(n.id, idx + 1));

  // 3. Rank by Sparse
  scoredNodes.sort((a, b) => b.sparseScore - a.sparseScore);
  const sparseRanks = new Map<string, number>();
  scoredNodes.forEach((n, idx) => sparseRanks.set(n.id, idx + 1));

  // 4. Calculate RRF Score
  const k = 60;
  scoredNodes.forEach(n => {
    const r_dense = denseRanks.get(n.id) || candidates.length;
    const r_sparse = sparseRanks.get(n.id) || candidates.length;
    n.rrfScore = (1 / (k + r_dense)) + (1 / (k + r_sparse));
  });

  // 5. Sort final results and touch them to increase access threshold
  scoredNodes.sort((a, b) => b.rrfScore - a.rrfScore);

  const results = scoredNodes.slice(0, limit);

  // Asynchronously update touch stats
  results.forEach(res => {
    memoryStore.touch(res.id).catch(err => console.error('Failed to touch memory node:', err));
  });

  return results;
}
