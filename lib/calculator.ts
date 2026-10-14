import {
  IMAGE_PLANS,
  THREED_PLANS,
  SEED_COMBINATION_IDS,
  LLM_MODELS,
  INFRA_DEFAULTS,
  SUPABASE_STORAGE_PRICE_PER_GB_USD,
  DEFAULT_LLM_MODEL_ID,
  DEFAULT_EMBEDDING_MODEL_ID,
  DEFAULT_CHAT_VOLUME_PRESET_ID,
  DEFAULT_STORAGE_STACK_ID,
  DEFAULT_MARGIN_COST_INR,
  CHAT_TOKEN_BUDGET,
  ImagePlan,
  ThreeDPlan,
  StorageStack,
  StorageStackId,
  LLMModel,
  ChatVolumePresetId,
  convertUSDToINR,
  convertINRToUSD,
  setUsdToInrRate,
  DEFAULT_USD_TO_INR,
  getLLMModelById,
  getEmbeddingModelById,
  getStorageStackById,
  getChatVolumePresetById,
  tokensFromChatVolumePreset,
} from './pricing';

export interface WorkloadParams {
  imagesPerMonth: number;
  modelsPerMonth: number;
  imageRetryFraction: number;
  modelRetryFraction: number;
}

/** Auto-derived volumes from Generation Workload (editable on Infra card) */
export interface WorkloadDerived {
  effectiveImages: number;
  effectiveModels: number;
  /** Legacy workload-based tokens — chat volume presets override these for LLM */
  llmInputTokens: number;
  llmOutputTokens: number;
  embeddingTokens: number;
  assetStorageGB: number;
  r2RequestsUSD: number;
}

export interface BudgetInput {
  imagesPerMonth: number;
  modelsPerMonth: number;
  imageRetryFraction: number;
  modelRetryFraction: number;
  usdToInr: number;

  selectedImageProviders?: string[];
  selectedThreeDProviders?: string[];
  selectedStorageStacks?: StorageStackId[];
  /** LLM models included as combination axis */
  selectedLlmModelIds?: string[];

  /** Chat volume preset (Short / Normal / Detailed / Very long) */
  chatVolumePresetId?: ChatVolumePresetId;
  /** When false, token fields are locked to the chat-volume preset */
  llmTokensManualEdit?: boolean;

  embeddingModelId?: string;

  llmInputTokens: number;
  llmOutputTokens: number;
  embeddingTokens: number;
  /** Fallback prices when a combo has no LLM model (should not happen) */
  llmInputPricePer1M: number;
  llmOutputPricePer1M: number;
  embeddingPricePer1M: number;

  vercelMonthlyUSD: number;
  supabaseMonthlyUSD: number;
  r2StorageGB: number;
  r2PricePerGBUSD: number;
  r2RequestsUSD: number;
  workerMonthlyUSD: number;
  monitoringMonthlyUSD: number;
  supabaseStoragePricePerGBUSD?: number;

  minImagesPerMonth?: number;
  maxImagesPerMonth?: number;
  minModelsPerMonth?: number;
  maxModelsPerMonth?: number;
}

export interface CombinationBreakdown {
  imageCostUSD: number;
  threeDBaseCostUSD: number;
  threeDTextureCostUSD: number;
  threeDCostUSD: number;
  aiVariableCostUSD: number;
  llmCostUSD: number;
  llmInputCostUSD: number;
  llmOutputCostUSD: number;
  embeddingCostUSD: number;
  storageCostUSD: number;
  fixedInfraCostUSD: number;
  /** Default margin (₹5,000 / mo) converted at active FX */
  marginCostUSD: number;
  marginCostINR: number;
  infraCostUSD: number;
  llmPlusInfraCostUSD: number;
  totalCostUSD: number;
  totalCostINR: number;
  aiCostPerImageUSD: number;
  aiCostPerModelUSD: number;
}

export interface Combination {
  id: string;
  cardId?: string;
  imagePlan: ImagePlan;
  threeDPlan: ThreeDPlan;
  storageStack: StorageStack;
  llmModel: LLMModel;
  llmModelName: string;
  embeddingModelName: string;
  chatVolumePresetId: ChatVolumePresetId;
  chatVolumePresetName: string;
  estimatedChats: number;
  inputTokensPerChat: number;
  outputTokensPerChat: number;
  totalWordsPerChat: number;
  infraLabel: string;
  caveat: string;
  isPriced: boolean;
  totalCostUSD: number;
  totalCostINR: number;
  breakdown: CombinationBreakdown;
  fitsBudget: boolean;
  score: number;
  warnings: string[];
  imageQualityIndex?: number | null;
  threeDQualityIndex?: number | null;
}

export function deriveWorkloadDerived(w: WorkloadParams): WorkloadDerived {
  const effectiveImages = w.imagesPerMonth * (1 + w.imageRetryFraction);
  const effectiveModels = w.modelsPerMonth * (1 + w.modelRetryFraction);

  return {
    effectiveImages,
    effectiveModels,
    llmInputTokens: CHAT_TOKEN_BUDGET.inputTokens,
    llmOutputTokens: CHAT_TOKEN_BUDGET.outputTokens,
    embeddingTokens: CHAT_TOKEN_BUDGET.embeddingTokens,
    assetStorageGB: Math.max(10, Math.round(5 + effectiveImages * 0.05 + effectiveModels * 0.25)),
    r2RequestsUSD: Math.round((1 + (effectiveImages + effectiveModels) * 0.001) * 100) / 100,
  };
}

export function defaultBudgetInput(): BudgetInput {
  const workload: WorkloadParams = {
    imagesPerMonth: 1000,
    modelsPerMonth: 200,
    imageRetryFraction: 0.2,
    modelRetryFraction: 0.15,
  };
  const derived = deriveWorkloadDerived(workload);
  const llm = getLLMModelById(DEFAULT_LLM_MODEL_ID);
  const emb = getEmbeddingModelById(DEFAULT_EMBEDDING_MODEL_ID);
  const tokens = tokensFromChatVolumePreset(DEFAULT_CHAT_VOLUME_PRESET_ID);

  return {
    ...workload,
    usdToInr: DEFAULT_USD_TO_INR,
    selectedImageProviders: ['google', 'bfl', 'ideogram', 'openai'],
    selectedThreeDProviders: ['tripo', 'meshy', 'rodin'],
    selectedStorageStacks: [DEFAULT_STORAGE_STACK_ID],
    selectedLlmModelIds: LLM_MODELS.map((m) => m.id),
    chatVolumePresetId: tokens.chatVolumePresetId,
    llmTokensManualEdit: false,
    embeddingModelId: emb.id,
    llmInputTokens: tokens.llmInputTokens,
    llmInputPricePer1M: llm.inputPer1MUSD,
    llmOutputTokens: tokens.llmOutputTokens,
    llmOutputPricePer1M: llm.outputPer1MUSD,
    embeddingTokens: tokens.embeddingTokens,
    embeddingPricePer1M: emb.pricePer1MUSD,
    vercelMonthlyUSD: INFRA_DEFAULTS.vercelMonthlyUSD,
    supabaseMonthlyUSD: INFRA_DEFAULTS.supabaseMonthlyUSD,
    r2StorageGB: derived.assetStorageGB,
    r2PricePerGBUSD: INFRA_DEFAULTS.r2PricePerGBUSD,
    r2RequestsUSD: derived.r2RequestsUSD,
    workerMonthlyUSD: INFRA_DEFAULTS.workerMonthlyUSD,
    monitoringMonthlyUSD: INFRA_DEFAULTS.monitoringMonthlyUSD,
    supabaseStoragePricePerGBUSD: SUPABASE_STORAGE_PRICE_PER_GB_USD,
    minImagesPerMonth: 100,
    maxImagesPerMonth: 5000,
    minModelsPerMonth: 50,
    maxModelsPerMonth: 1000,
  };
}

/** Always R2 for unstructured 2D/3D assets (full GB + requests). */
function computeStorageCostUSD(_stack: StorageStack, input: BudgetInput): number {
  const gb = input.r2StorageGB;
  return gb * input.r2PricePerGBUSD + input.r2RequestsUSD;
}

function computeFixedInfraUSD(input: BudgetInput): number {
  return (
    input.vercelMonthlyUSD +
    input.supabaseMonthlyUSD +
    input.workerMonthlyUSD +
    input.monitoringMonthlyUSD
  );
}

function buildBreakdown(
  imagePlan: ImagePlan,
  threeDPlan: ThreeDPlan,
  storageStack: StorageStack,
  llmModel: LLMModel,
  input: BudgetInput
): { breakdown: CombinationBreakdown; isPriced: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const emb = getEmbeddingModelById(input.embeddingModelId);

  const llmInputCostUSD =
    (input.llmInputTokens / 1_000_000) * llmModel.inputPer1MUSD;
  const llmOutputCostUSD =
    (input.llmOutputTokens / 1_000_000) * llmModel.outputPer1MUSD;
  const llmCostUSD = llmInputCostUSD + llmOutputCostUSD;
  const embeddingCostUSD =
    (input.embeddingTokens / 1_000_000) * emb.pricePer1MUSD;
  const storageCostUSD = computeStorageCostUSD(storageStack, input);
  const fixedInfraCostUSD = computeFixedInfraUSD(input);
  const marginCostINR = DEFAULT_MARGIN_COST_INR;
  const marginCostUSD = convertINRToUSD(marginCostINR, input.usdToInr);
  const infraCostUSD = fixedInfraCostUSD + storageCostUSD;
  const llmPlusInfraCostUSD =
    llmCostUSD + embeddingCostUSD + infraCostUSD + marginCostUSD;

  const imagePrice = imagePlan.pricePerImageUSD;
  const threeDBase = threeDPlan.baseCostUSD;
  const threeDTexture = threeDPlan.textureCostUSD ?? 0;

  let isPriced = true;

  if (imagePrice === undefined || imagePrice === null) {
    isPriced = false;
    warnings.push(`${imagePlan.name}: image unit price needs confirmation.`);
  }
  if (imagePlan.status === 'Estimated') {
    warnings.push(`${imagePlan.name}: price is an estimate, not a fixed published rate.`);
  }
  if (threeDBase === undefined || threeDBase === null) {
    isPriced = false;
    warnings.push(
      threeDPlan.note ||
        `${threeDPlan.providerLabel}: USD credit conversion unresolved; no cost ranking until verified.`
    );
  }

  const imageCostUSD =
    isPriced && imagePrice !== undefined
      ? input.imagesPerMonth * imagePrice * (1 + input.imageRetryFraction)
      : 0;
  const threeDBaseCostUSD =
    isPriced && threeDBase !== undefined
      ? input.modelsPerMonth * threeDBase * (1 + input.modelRetryFraction)
      : 0;
  const threeDTextureCostUSD =
    isPriced && threeDBase !== undefined
      ? input.modelsPerMonth * threeDTexture * (1 + input.modelRetryFraction)
      : 0;
  const threeDCostUSD = threeDBaseCostUSD + threeDTextureCostUSD;
  const aiVariableCostUSD = imageCostUSD + threeDCostUSD;
  const totalCostUSD = isPriced
    ? aiVariableCostUSD + llmPlusInfraCostUSD
    : llmPlusInfraCostUSD;
  const totalCostINR = convertUSDToINR(totalCostUSD, input.usdToInr);

  const effectiveImages = input.imagesPerMonth * (1 + input.imageRetryFraction);
  const effectiveModels = input.modelsPerMonth * (1 + input.modelRetryFraction);

  return {
    isPriced,
    warnings,
    breakdown: {
      imageCostUSD,
      threeDBaseCostUSD,
      threeDTextureCostUSD,
      threeDCostUSD,
      aiVariableCostUSD,
      llmCostUSD,
      llmInputCostUSD,
      llmOutputCostUSD,
      embeddingCostUSD,
      storageCostUSD,
      fixedInfraCostUSD,
      marginCostUSD,
      marginCostINR,
      infraCostUSD,
      llmPlusInfraCostUSD,
      totalCostUSD,
      totalCostINR,
      aiCostPerImageUSD: effectiveImages > 0 && isPriced ? imageCostUSD / effectiveImages : 0,
      aiCostPerModelUSD: effectiveModels > 0 && isPriced ? threeDCostUSD / effectiveModels : 0,
    },
  };
}

/** Stored recommendation score — visual look (image+3D) over cost. */
function scoreCombination(
  isPriced: boolean,
  totalCostUSD: number,
  imagePlan: ImagePlan,
  threeDPlan: ThreeDPlan,
  llmModel: LLMModel
): number {
  const image = imagePlan.qualityPts ?? 0;
  const threeD = threeDPlan.qualityPts ?? 0;
  const llm = llmModel.qualityPts ?? 0;
  const look = 0.5 * image + 0.4 * threeD + 0.1 * llm;
  const costTiebreak = isPriced ? totalCostUSD * 0.001 : 100;
  return look * 1000 - costTiebreak;
}

function infraLabelFor(_stack: StorageStack): string {
  return 'Vercel + Supabase Pro + R2';
}

function buildQuad(
  imagePlan: ImagePlan,
  threeDPlan: ThreeDPlan,
  storageStack: StorageStack,
  llmModel: LLMModel,
  input: BudgetInput,
  cardId?: string,
  caveat?: string
): Combination {
  const { breakdown, isPriced, warnings } = buildBreakdown(
    imagePlan,
    threeDPlan,
    storageStack,
    llmModel,
    input
  );
  const emb = getEmbeddingModelById(input.embeddingModelId);
  const preset = getChatVolumePresetById(input.chatVolumePresetId);
  const stack = getStorageStackById(DEFAULT_STORAGE_STACK_ID);
  const id = cardId
    ? `card-${cardId}-${imagePlan.id}-${threeDPlan.id}-r2-${llmModel.id}`
    : `${imagePlan.id}__${threeDPlan.id}__r2__${llmModel.id}`;

  return {
    id,
    cardId,
    imagePlan,
    threeDPlan,
    storageStack: stack,
    llmModel,
    llmModelName: llmModel.name,
    embeddingModelName: emb.name,
    chatVolumePresetId: preset.id,
    chatVolumePresetName: preset.name,
    estimatedChats: preset.estimatedChats,
    inputTokensPerChat: preset.inputTokensPerChat,
    outputTokensPerChat: preset.outputTokensPerChat,
    totalWordsPerChat: preset.totalWordsPerChat,
    infraLabel: infraLabelFor(stack),
    caveat:
      caveat ||
      imagePlan.note ||
      threeDPlan.note ||
      `${imagePlan.providerLabel} + ${threeDPlan.providerLabel} + R2 + ${llmModel.name}`,
    isPriced,
    totalCostUSD: breakdown.totalCostUSD,
    totalCostINR: breakdown.totalCostINR,
    breakdown,
    fitsBudget: true,
    score: scoreCombination(
      isPriced,
      breakdown.totalCostUSD,
      imagePlan,
      threeDPlan,
      llmModel
    ),
    warnings,
    imageQualityIndex: imagePlan.qualityPts ?? null,
    threeDQualityIndex: threeDPlan.qualityPts ?? null,
  };
}

export function calculateCombinations(input: BudgetInput): Combination[] {
  setUsdToInrRate(input.usdToInr || DEFAULT_USD_TO_INR);

  const selectedImage =
    input.selectedImageProviders && input.selectedImageProviders.length > 0
      ? input.selectedImageProviders
      : ['google', 'bfl', 'ideogram', 'openai'];
  const selected3D =
    input.selectedThreeDProviders && input.selectedThreeDProviders.length > 0
      ? input.selectedThreeDProviders
      : ['tripo', 'meshy', 'rodin'];
  // Asset storage is always R2 — not a combination axis
  const r2Stack = getStorageStackById(DEFAULT_STORAGE_STACK_ID);

  const selectedLlmIds =
    input.selectedLlmModelIds && input.selectedLlmModelIds.length > 0
      ? input.selectedLlmModelIds
      : LLM_MODELS.map((m) => m.id);
  const llmModels = LLM_MODELS.filter((m) => selectedLlmIds.includes(m.id));

  const combinations: Combination[] = [];
  const seen = new Set<string>();

  // Seeded A–F × LLM (R2 on every card)
  for (const seed of SEED_COMBINATION_IDS) {
    const imagePlan = IMAGE_PLANS.find((p) => p.id === seed.imagePlanId);
    const threeDPlan = THREED_PLANS.find((p) => p.id === seed.threeDPlanId);
    if (!imagePlan || !threeDPlan) continue;
    if (!selectedImage.includes(imagePlan.provider)) continue;
    if (!selected3D.includes(threeDPlan.provider)) continue;
    for (const llm of llmModels) {
      const key = `${imagePlan.id}__${threeDPlan.id}__r2__${llm.id}`;
      combinations.push(
        buildQuad(imagePlan, threeDPlan, r2Stack, llm, input, seed.id, seed.caveat)
      );
      seen.add(key);
    }
  }

  const imagePlans = IMAGE_PLANS.filter(
    (p) =>
      selectedImage.includes(p.provider) &&
      p.pricePerImageUSD !== undefined &&
      (p.status === 'Published' || p.status === 'Estimated')
  );
  const threeDPlans = THREED_PLANS.filter((p) => selected3D.includes(p.provider));

  for (const imagePlan of imagePlans) {
    for (const threeDPlan of threeDPlans) {
      const isUnpriced3D = threeDPlan.baseCostUSD === undefined;
      if (isUnpriced3D) continue;

      for (const llm of llmModels) {
        const key = `${imagePlan.id}__${threeDPlan.id}__r2__${llm.id}`;
        if (seen.has(key)) continue;
        combinations.push(buildQuad(imagePlan, threeDPlan, r2Stack, llm, input));
        seen.add(key);
      }
    }
  }

  return combinations.sort((a, b) => {
    if (a.isPriced !== b.isPriced) return a.isPriced ? -1 : 1;
    if (!a.isPriced) return (a.cardId || '').localeCompare(b.cardId || '');
    return a.totalCostUSD - b.totalCostUSD;
  });
}

export function getCostBreakdownForInput(
  combination: Combination,
  input: BudgetInput
): {
  imageCostUSD: number;
  threeDCostUSD: number;
  aiVariableCostUSD: number;
  llmPlusInfraCostUSD: number;
  storageCostUSD: number;
  totalCostUSD: number;
} {
  const stack = combination.storageStack || getStorageStackById('r2');
  const llm = combination.llmModel || getLLMModelById(DEFAULT_LLM_MODEL_ID);
  const { breakdown, isPriced } = buildBreakdown(
    combination.imagePlan,
    combination.threeDPlan,
    stack,
    llm,
    input
  );
  return {
    imageCostUSD: breakdown.imageCostUSD,
    threeDCostUSD: breakdown.threeDCostUSD,
    aiVariableCostUSD: breakdown.aiVariableCostUSD,
    llmPlusInfraCostUSD: breakdown.llmPlusInfraCostUSD,
    storageCostUSD: breakdown.storageCostUSD,
    totalCostUSD: isPriced ? breakdown.totalCostUSD : breakdown.llmPlusInfraCostUSD,
  };
}

export function getFullBreakdownForInput(
  combination: Combination,
  input: BudgetInput
): CombinationBreakdown {
  const stack = combination.storageStack || getStorageStackById('r2');
  const llm = combination.llmModel || getLLMModelById(DEFAULT_LLM_MODEL_ID);
  return buildBreakdown(combination.imagePlan, combination.threeDPlan, stack, llm, input)
    .breakdown;
}

export function recalculateCombination(
  combination: Combination,
  input: BudgetInput
): Combination {
  return buildQuad(
    combination.imagePlan,
    combination.threeDPlan,
    combination.storageStack || getStorageStackById('r2'),
    combination.llmModel || getLLMModelById(DEFAULT_LLM_MODEL_ID),
    input,
    combination.cardId,
    combination.caveat
  );
}

export function getPricedCombinations(results: Combination[]): Combination[] {
  return results.filter((r) => r.isPriced);
}

export { convertUSDToINR, convertINRToUSD };
