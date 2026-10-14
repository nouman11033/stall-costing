import type { Combination } from './calculator';

/**
 * Quality & cost points from AI_Gen_Public_Quality_and_Cost_Points_Ranking.xlsx.
 * Quality = public-opinion proxy (not lab benchmarks). Cost pts = relative value in-category.
 * Card Quality Pts = mean(Image Q, 3D Q, LLM Q). Latency is not a factor.
 */

export interface QualityResult {
  overallQualityScore: number;
  imageQualityIndex: number | null;
  threeDQualityIndex: number | null;
  llmQualityIndex: number | null;
  costPts: number | null;
  note: string;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function calculateQuality(combination: Combination): QualityResult {
  const image =
    combination.imageQualityIndex ?? combination.imagePlan.qualityPts ?? null;
  const threeD =
    combination.threeDQualityIndex ?? combination.threeDPlan.qualityPts ?? null;
  const llm = combination.llmModel?.qualityPts ?? null;

  const qParts = [image, threeD, llm].filter((v): v is number => v != null);
  const overall = mean(qParts) ?? 0;

  const cParts = [
    combination.imagePlan.costPts,
    combination.threeDPlan.costPts,
    combination.llmModel?.costPts,
  ].filter((v): v is number => v != null);
  const costPts = mean(cParts);

  return {
    overallQualityScore: overall,
    imageQualityIndex: image,
    threeDQualityIndex: threeD,
    llmQualityIndex: llm,
    costPts,
    note:
      qParts.length === 0
        ? 'Quality indices require public ranking points — not inventoried for this combo.'
        : 'Card Quality Pts = mean(Image, 3D, LLM) public-opinion proxies from ranking workbook.',
  };
}
