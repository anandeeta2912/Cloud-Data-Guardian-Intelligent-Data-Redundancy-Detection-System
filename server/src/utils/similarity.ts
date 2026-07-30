export interface SimilarityResult {
  score: number;
  algorithm: string;
  field: string;
}

export interface CompositeSimilarityResult {
  overallScore: number;
  weightedScore: number;
  fieldResults: SimilarityResult[];
  matchedFields: number;
  totalFields: number;
}

export const jaroWinkler = (s1: string, s2: string): number => {
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const matchDistance = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const m = matches;
  const jaro = (m / s1.length + m / s2.length + (m - transpositions / 2) / m) / 3;
  const prefix = Math.min(4, (() => {
    let i = 0;
    while (i < Math.min(s1.length, s2.length) && s1[i] === s2[i]) i++;
    return i;
  })());
  return jaro + prefix * 0.1 * (1 - jaro);
};

export const levenshteinNormalized = (s1: string, s2: string): number => {
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const matrix: number[][] = Array(s2.length + 1)
    .fill(null)
    .map(() => Array(s1.length + 1).fill(0));

  for (let i = 0; i <= s1.length; i++) matrix[0]![i] = i;
  for (let j = 0; j <= s2.length; j++) matrix[j]![0] = j;

  for (let j = 1; j <= s2.length; j++) {
    for (let i = 1; i <= s1.length; i++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[j]![i] = Math.min(matrix[j]![i - 1]! + 1, matrix[j - 1]![i]! + 1, matrix[j - 1]![i - 1]! + cost);
    }
  }

  const distance = matrix[s2.length]![s1.length]!;
  const maxLen = Math.max(s1.length, s2.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
};

export const cosineSimilarity = (s1: string, s2: string): number => {
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const tokens1 = s1.toLowerCase().split(/\s+/);
  const tokens2 = s2.toLowerCase().split(/\s+/);
  const allTokens = new Set([...tokens1, ...tokens2]);

  const freq1: Record<string, number> = {};
  const freq2: Record<string, number> = {};
  for (const t of allTokens) {
    freq1[t] = (tokens1.filter((x) => x === t).length);
    freq2[t] = (tokens2.filter((x) => x === t).length);
  }

  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;
  for (const t of allTokens) {
    dotProduct += (freq1[t] ?? 0) * (freq2[t] ?? 0);
    mag1 += (freq1[t] ?? 0) ** 2;
    mag2 += (freq2[t] ?? 0) ** 2;
  }

  const denom = Math.sqrt(mag1) * Math.sqrt(mag2);
  return denom === 0 ? 0 : dotProduct / denom;
};

export const normalizedDiceSorensen = (s1: string, s2: string): number => {
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const tokens1 = new Set(s1.toLowerCase().split(/\s+/));
  const tokens2 = new Set(s2.toLowerCase().split(/\s+/));
  const intersection = [...tokens1].filter((t) => tokens2.has(t)).length;
  return (2 * intersection) / (tokens1.size + tokens2.size);
};

export const jaccardIndex = (s1: string, s2: string): number => {
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const set1 = new Set(s1.toLowerCase().split(/\s+/));
  const set2 = new Set(s2.toLowerCase().split(/\s+/));
  const intersection = [...set1].filter((t) => set2.has(t)).length;
  const union = new Set([...set1, ...set2]).size;
  return union === 0 ? 0 : intersection / union;
};

export const getCompositeScore = (s1: string, s2: string): number => {
  const jaro = jaroWinkler(s1, s2);
  const lev = levenshteinNormalized(s1, s2);
  const dice = normalizedDiceSorensen(s1, s2);
  const jaccard = jaccardIndex(s1, s2);
  const characterScore = (jaro + lev) / 2;
  const tokenScore = (dice + jaccard) / 2;
  return characterScore * 0.6 + tokenScore * 0.4;
};

export const computeSimilarityScore = (s1: string, s2: string, algorithm: string): number => {
  switch (algorithm) {
    case 'jaroWinkler':
      return jaroWinkler(s1, s2);
    case 'levenshtein':
      return levenshteinNormalized(s1, s2);
    case 'cosine':
      return cosineSimilarity(s1, s2);
    case 'composite':
      return getCompositeScore(s1, s2);
    case 'diceSorensen':
      return normalizedDiceSorensen(s1, s2);
    case 'jaccard':
      return jaccardIndex(s1, s2);
    default:
      return jaroWinkler(s1, s2);
  }
};

export const computeFieldSimilarity = (s1: string, s2: string, algorithm: string): SimilarityResult => {
  const score = computeSimilarityScore(s1, s2, algorithm);
  return { score, algorithm, field: '' };
};

export const computeCompositeSimilarity = (
  comparisons: Array<{ source: string; target: string; algorithm: string; weight: number; threshold: number }>
): CompositeSimilarityResult => {
  if (comparisons.length === 0) {
    return { overallScore: 0, weightedScore: 0, fieldResults: [], matchedFields: 0, totalFields: 0 };
  }

  const fieldResults: SimilarityResult[] = [];
  let totalWeightedScore = 0;
  let totalWeight = 0;
  let matchedFields = 0;

  for (const comp of comparisons) {
    const score = computeSimilarityScore(comp.source, comp.target, comp.algorithm);
    fieldResults.push({ score, algorithm: comp.algorithm, field: '' });
    totalWeightedScore += score * comp.weight;
    totalWeight += comp.weight;
    if (score >= comp.threshold) {
      matchedFields++;
    }
  }

  const weightedScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
  const overallScore = weightedScore;

  return { overallScore, weightedScore, fieldResults, matchedFields, totalFields: comparisons.length };
};