/**
 * Pricing data from AI Generation API Costing Research Workbook (Oct 2026 Updated)
 */

export type ImageProviderId = 'google' | 'bfl' | 'ideogram' | 'openai';
export type ThreeDProviderId = 'tripo' | 'meshy' | 'rodin';
export type StorageStackId = 'r2';

export interface StorageStack {
  id: StorageStackId;
  name: string;
  shortName: string;
  /** Fraction of derived asset GB billed on R2 (0–1) */
  r2Share: number;
  /** Fraction of derived asset GB billed on Supabase Storage overage (0–1) */
  supabaseShare: number;
  note?: string;
}

export interface ImagePlan {
  id: string;
  name: string;
  provider: ImageProviderId;
  providerLabel: string;
  tier: string;
  /** USD per image; undefined = cannot price (token-based / needs confirmation) */
  pricePerImageUSD?: number;
  billingUnit: string;
  status: 'Published' | 'Estimated' | 'Needs confirmation';
  note?: string;
  /** Public-opinion quality proxy 0–10 (AI_Gen_Public_Quality_and_Cost_Points_Ranking.xlsx) */
  qualityPts?: number;
  /** Relative cost value 0–10 within image category (higher = cheaper / better value) */
  costPts?: number;
}

export interface ThreeDPlan {
  id: string;
  name: string;
  provider: ThreeDProviderId;
  providerLabel: string;
  workflow: string;
  /** USD base per model; undefined = credit conversion unresolved */
  baseCostUSD?: number;
  /** USD texture/post-process per model */
  textureCostUSD?: number;
  status: 'Published' | 'Estimated' | 'Needs confirmation';
  note?: string;
  /** Public-opinion quality proxy 0–10 */
  qualityPts?: number;
  /** Relative cost value 0–10 within 3D category */
  costPts?: number;
}

export type ChatVolumePresetId = 'short' | 'normal' | 'detailed' | 'very-long';

export interface ChatVolumePreset {
  id: ChatVolumePresetId;
  name: string;
  /** Approx input words per chat (sheet) */
  inputWordsPerChat: number;
  /** Approx output words per chat (sheet) */
  outputWordsPerChat: number;
  inputTokensPerChat: number;
  outputTokensPerChat: number;
  totalWordsPerChat: number;
  /** Chats that fit the fixed monthly token budget */
  estimatedChats: number;
}

export interface LLMModel {
  id: string;
  name: string;
  provider: string;
  inputPer1MUSD: number;
  outputPer1MUSD: number;
  cachedInputPer1MUSD?: number;
  /** Public-opinion quality proxy 0–10 */
  qualityPts?: number;
  /** Relative cost value 0–10 within LLM category */
  costPts?: number;
}

export interface EmbeddingModel {
  id: string;
  name: string;
  provider: string;
  pricePer1MUSD: number;
}

/** Fixed monthly token budget from Chat Volume sheet */
export const CHAT_TOKEN_BUDGET = {
  totalTokens: 22_500_000,
  inputTokens: 10_000_000,
  outputTokens: 2_500_000,
  embeddingTokens: 10_000_000,
  wordsPerToken: 0.75,
} as const;

export interface InfraDefaults {
  vercelMonthlyUSD: number;
  supabaseMonthlyUSD: number;
  r2PricePerGBUSD: number;
  r2RequestsUSD: number;
  workerMonthlyUSD: number;
  monitoringMonthlyUSD: number;
  defaultR2StorageGB: number;
}

/** Image API options used in combination cards + expandable catalog */
export const IMAGE_PLANS: ImagePlan[] = [
  {
    id: 'gemini-nano-banana-2-1k',
    name: 'Nano Banana 2 / 1K',
    provider: 'google',
    providerLabel: 'Google Gemini',
    tier: 'Nano Banana 2 / 1K',
    pricePerImageUSD: 0.067,
    billingUnit: 'USD/image',
    status: 'Published',
    note: 'High-volume image generation.',
    qualityPts: 8.0,
    costPts: 3.2,
  },
  {
    id: 'gemini-nano-banana-pro-2k',
    name: 'Nano Banana Pro / 2K',
    provider: 'google',
    providerLabel: 'Google Gemini',
    tier: 'Nano Banana Pro / 2K',
    pricePerImageUSD: 0.134,
    billingUnit: 'USD/image',
    status: 'Published',
    note: 'Premium concept image; illustrative.',
    qualityPts: 8.5,
    costPts: 1.0,
  },
  {
    id: 'gemini-nano-banana-2-0-5k',
    name: 'Nano Banana 2 / 0.5K',
    provider: 'google',
    providerLabel: 'Google Gemini',
    tier: 'Nano Banana 2 / 0.5K',
    pricePerImageUSD: 0.045,
    billingUnit: 'USD/image',
    status: 'Published',
    qualityPts: 7.6,
    costPts: 5.5,
  },
  {
    id: 'gemini-flash-lite-image-1k',
    name: 'Flash-Lite Image / 1K',
    provider: 'google',
    providerLabel: 'Google Gemini',
    tier: 'Flash-Lite / 1K',
    pricePerImageUSD: 0.0336,
    billingUnit: 'USD/image',
    status: 'Published',
    note: 'Lower-cost option; benchmark quality.',
    qualityPts: 7.0,
    costPts: 6.8,
  },
  {
    id: 'flux-2-klein-9b',
    name: 'FLUX.2 klein 9B / 1MP',
    provider: 'bfl',
    providerLabel: 'Black Forest Labs',
    tier: 'FLUX.2 klein 9B / 1MP',
    pricePerImageUSD: 0.015,
    billingUnit: 'USD/image',
    status: 'Published',
    note: 'Low-cost concept image; benchmark output quality.',
    qualityPts: 7.8,
    costPts: 9.4,
  },
  {
    id: 'flux-2-pro',
    name: 'FLUX.2 Pro / 1MP',
    provider: 'bfl',
    providerLabel: 'Black Forest Labs',
    tier: 'FLUX.2 Pro / 1MP',
    pricePerImageUSD: 0.03,
    billingUnit: 'USD/image',
    status: 'Published',
    qualityPts: 8.8,
    costPts: 7.2,
  },
  {
    id: 'flux-2-klein-4b',
    name: 'FLUX.2 klein 4B / 1MP',
    provider: 'bfl',
    providerLabel: 'Black Forest Labs',
    tier: 'FLUX.2 klein 4B / 1MP',
    pricePerImageUSD: 0.014,
    billingUnit: 'USD/image',
    status: 'Published',
    qualityPts: 7.4,
    costPts: 9.6,
  },
  {
    id: 'flux-2-max',
    name: 'FLUX.2 Max / 1MP',
    provider: 'bfl',
    providerLabel: 'Black Forest Labs',
    tier: 'FLUX.2 Max / 1MP',
    pricePerImageUSD: 0.07,
    billingUnit: 'USD/image',
    status: 'Published',
    qualityPts: 9.2,
    costPts: 3.0,
  },
  {
    id: 'flux-3-image-768sq',
    name: 'FLUX 3 Image / 768sq',
    provider: 'bfl',
    providerLabel: 'Black Forest Labs',
    tier: 'FLUX 3 Image / 768sq',
    pricePerImageUSD: 0.041,
    billingUnit: 'USD/image',
    status: 'Published',
    note: 'BFL FLUX 3 Image API; resolution=768sq (docs.bfl.ml).',
    qualityPts: 9.0,
    costPts: 5.8,
  },
  {
    id: 'flux-3-image-1k',
    name: 'FLUX 3 Image / 1K',
    provider: 'bfl',
    providerLabel: 'Black Forest Labs',
    tier: 'FLUX 3 Image / 1K',
    pricePerImageUSD: 0.048,
    billingUnit: 'USD/image',
    status: 'Published',
    note: 'BFL FLUX 3 Image API default resolution=1k (docs.bfl.ml).',
    qualityPts: 9.3,
    costPts: 5.2,
  },
  {
    id: 'flux-3-image-2k',
    name: 'FLUX 3 Image / 2K',
    provider: 'bfl',
    providerLabel: 'Black Forest Labs',
    tier: 'FLUX 3 Image / 2K',
    pricePerImageUSD: 0.1,
    billingUnit: 'USD/image',
    status: 'Published',
    note: 'BFL FLUX 3 Image API; resolution=2k (docs.bfl.ml).',
    qualityPts: 9.4,
    costPts: 1.5,
  },
  {
    id: 'flux-3-image-4k',
    name: 'FLUX 3 Image / 4K',
    provider: 'bfl',
    providerLabel: 'Black Forest Labs',
    tier: 'FLUX 3 Image / 4K',
    pricePerImageUSD: 0.607,
    billingUnit: 'USD/image',
    status: 'Published',
    note: 'BFL FLUX 3 Image API; resolution=4k ~16MP (docs.bfl.ml).',
    qualityPts: 9.5,
    costPts: 0.5,
  },
  {
    id: 'ideogram-4-5-medium',
    name: 'Ideogram 4.5 Medium / 1K',
    provider: 'ideogram',
    providerLabel: 'Ideogram',
    tier: '4.5 Medium / 1K',
    pricePerImageUSD: 0.06,
    billingUnit: 'USD/image',
    status: 'Published',
    note: 'Test signage/typography accuracy.',
    qualityPts: 8.3,
    costPts: 4.0,
  },
  {
    id: 'ideogram-4-5-low',
    name: 'Ideogram 4.5 Low / 1K',
    provider: 'ideogram',
    providerLabel: 'Ideogram',
    tier: '4.5 Low / 1K',
    pricePerImageUSD: 0.03,
    billingUnit: 'USD/image',
    status: 'Published',
    qualityPts: 7.5,
    costPts: 7.2,
  },
  {
    id: 'ideogram-4-5-high',
    name: 'Ideogram 4.5 High / 1K',
    provider: 'ideogram',
    providerLabel: 'Ideogram',
    tier: '4.5 High / 1K',
    pricePerImageUSD: 0.1,
    billingUnit: 'USD/image',
    status: 'Published',
    qualityPts: 8.9,
    costPts: 1.5,
  },
  {
    id: 'openai-gpt-image-2-medium',
    name: 'GPT Image 2 / 1024 medium',
    provider: 'openai',
    providerLabel: 'OpenAI',
    tier: 'GPT Image 2 / 1024 medium',
    pricePerImageUSD: 0.0224,
    billingUnit: 'USD/image estimate',
    status: 'Estimated',
    note: 'Third-party estimator; actual OpenAI bill is token-priced.',
    qualityPts: 8.1,
    costPts: 8.2,
  },
  {
    id: 'openai-gpt-image-2-low',
    name: 'GPT Image 2 / 1024 low',
    provider: 'openai',
    providerLabel: 'OpenAI',
    tier: 'GPT Image 2 / 1024 low',
    pricePerImageUSD: 0.0151,
    billingUnit: 'USD/image estimate',
    status: 'Estimated',
    qualityPts: 7.3,
    costPts: 9.3,
  },
  {
    id: 'openai-gpt-image-2-high',
    name: 'GPT Image 2 / 1024 high',
    provider: 'openai',
    providerLabel: 'OpenAI',
    tier: 'GPT Image 2 / 1024 high',
    pricePerImageUSD: 0.0619,
    billingUnit: 'USD/image estimate',
    status: 'Estimated',
    qualityPts: 8.6,
    costPts: 3.5,
  },
];

/** 3D API options — Tripo, Meshy, Rodin priced from public docs */
export const THREED_PLANS: ThreeDPlan[] = [
  {
    id: 'tripo-image-to-3d-texture',
    name: 'Tripo Image-to-3D + texture',
    provider: 'tripo',
    providerLabel: 'Tripo',
    workflow: 'Image-to-3D + texture',
    baseCostUSD: 0.2,
    textureCostUSD: 0.1,
    status: 'Published',
    note: 'Example Tripo image-to-3D lower-end rate + texture add-on.',
    qualityPts: 7.8,
    costPts: 8.5,
  },
  {
    id: 'tripo-image-to-3d-only',
    name: 'Tripo Image-to-3D',
    provider: 'tripo',
    providerLabel: 'Tripo',
    workflow: 'Image-to-3D',
    baseCostUSD: 0.2,
    textureCostUSD: 0,
    status: 'Published',
    qualityPts: 7.4,
    costPts: 10.0,
  },
  {
    id: 'meshy-image-to-3d-textured',
    name: 'Meshy Image-to-3D textured',
    provider: 'meshy',
    providerLabel: 'Meshy',
    workflow: 'Image-to-3D textured (7.1 / 2K–4K)',
    // docs.meshy.ai: Image-to-3D meshy-7.1 mesh=20 + 2K/4K texture=10 → 30 credits.
    // meshy.ai/pricing Pro (API eligible): $20 / 1,000 credits → $0.02/credit.
    baseCostUSD: 0.4,
    textureCostUSD: 0.2,
    status: 'Published',
    note:
      'Meshy 7.1 Image-to-3D textured = 30 credits (docs.meshy.ai). USD via Pro plan rate $20/1,000 credits ($0.02/cr). Prepaid top-ups may differ; Enterprise is custom.',
    qualityPts: 8.2,
    costPts: 5.0,
  },
  {
    id: 'rodin-gen-2-5-standard',
    name: 'Rodin Gen-2.5 standard',
    provider: 'rodin',
    providerLabel: 'Rodin / Hyper3D',
    workflow: 'Gen-2.5 standard',
    // Docs: base Gen-2.5 = 0.5 credits. Pricing page: direct credits = $1.50/credit.
    // 0.5 × $1.50 = $0.75. Business API ($120/mo, ~416 models) is cheaper via subscription credits.
    baseCostUSD: 0.75,
    textureCostUSD: 0,
    status: 'Published',
    note:
      'Hyper3D Gen-2.5 base = 0.5 credits × $1.50/direct credit (hyper3d.ai/pricing). Business API $120/mo ≈ 416 models if using plan credits; Extreme-High / extreme texture add credits.',
    qualityPts: 8.6,
    costPts: 3.5,
  },
];

/** Seeded combination cards A–F from workbook */
export const SEED_COMBINATION_IDS: { id: string; imagePlanId: string; threeDPlanId: string; caveat: string }[] = [
  {
    id: 'A',
    imagePlanId: 'gemini-nano-banana-2-1k',
    threeDPlanId: 'tripo-image-to-3d-texture',
    caveat: 'Balanced illustration; actual selected endpoint and texture cost must be confirmed.',
  },
  {
    id: 'B',
    imagePlanId: 'gemini-nano-banana-pro-2k',
    threeDPlanId: 'tripo-image-to-3d-texture',
    caveat: 'Premium concept image; illustrative.',
  },
  {
    id: 'C',
    imagePlanId: 'flux-2-klein-9b',
    threeDPlanId: 'tripo-image-to-3d-texture',
    caveat: 'Low-cost concept image; benchmark output quality.',
  },
  {
    id: 'D',
    imagePlanId: 'flux-2-pro',
    threeDPlanId: 'meshy-image-to-3d-textured',
    caveat:
      'Meshy at Pro credit rate ($0.60/model textured 7.1). Higher tiers or prepaid packs change effective $/credit.',
  },
  {
    id: 'E',
    imagePlanId: 'ideogram-4-5-medium',
    threeDPlanId: 'tripo-image-to-3d-texture',
    caveat: 'Test signage/typography accuracy.',
  },
  {
    id: 'F',
    imagePlanId: 'openai-gpt-image-2-medium',
    threeDPlanId: 'rodin-gen-2-5-standard',
    caveat:
      'GPT image price is an estimate. Rodin at direct-credit rate ($0.75/model); Business subscription credits are cheaper.',
  },
];

/** Chat length presets — same token budget; different chats & words/chat */
export const CHAT_VOLUME_PRESETS: ChatVolumePreset[] = [
  {
    id: 'short',
    name: 'Short',
    inputWordsPerChat: 750,
    outputWordsPerChat: 188,
    inputTokensPerChat: 1000,
    outputTokensPerChat: 250.67,
    totalWordsPerChat: 938,
    estimatedChats: 9973,
  },
  {
    id: 'normal',
    name: 'Normal',
    inputWordsPerChat: 3750,
    outputWordsPerChat: 938,
    inputTokensPerChat: 5000,
    outputTokensPerChat: 1250.67,
    totalWordsPerChat: 4688,
    estimatedChats: 2000,
  },
  {
    id: 'detailed',
    name: 'Detailed',
    inputWordsPerChat: 7500,
    outputWordsPerChat: 1875,
    inputTokensPerChat: 10000,
    outputTokensPerChat: 2500,
    totalWordsPerChat: 9375,
    estimatedChats: 1000,
  },
  {
    id: 'very-long',
    name: 'Very long',
    inputWordsPerChat: 37500,
    outputWordsPerChat: 9375,
    inputTokensPerChat: 50000,
    outputTokensPerChat: 12500,
    totalWordsPerChat: 46875,
    estimatedChats: 200,
  },
];

/** LLM models from Chat Volume / LLM Cost sheet — combination axis */
export const LLM_MODELS: LLMModel[] = [
  {
    id: 'gpt-4o-luna',
    name: 'gpt-4o-luna',
    provider: 'OpenAI',
    inputPer1MUSD: 0.05,
    outputPer1MUSD: 0.25,
    qualityPts: 6.5,
    costPts: 10.0,
  },
  {
    id: 'gpt-4o-sol',
    name: 'gpt-4o-sol',
    provider: 'OpenAI',
    inputPer1MUSD: 1.0,
    outputPer1MUSD: 5.0,
    qualityPts: 8.4,
    costPts: 5.0,
  },
  {
    id: 'gpt-4o-astra',
    name: 'gpt-4o-astra',
    provider: 'OpenAI',
    inputPer1MUSD: 5.0,
    outputPer1MUSD: 25.0,
    qualityPts: 9.1,
    costPts: 1.0,
  },
  {
    id: 'gemini-3-1-flash-lite',
    name: 'gemini-3.1-flash-lite',
    provider: 'Google',
    inputPer1MUSD: 0.25,
    outputPer1MUSD: 1.5,
    qualityPts: 7.4,
    costPts: 8.5,
  },
  {
    id: 'gemini-3-1-pro-preview',
    name: 'gemini-3.1-pro-preview',
    provider: 'Google',
    inputPer1MUSD: 2.0,
    outputPer1MUSD: 12.0,
    qualityPts: 8.8,
    costPts: 2.5,
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'gemini-3-flash-preview',
    provider: 'Google',
    inputPer1MUSD: 0.5,
    outputPer1MUSD: 3.0,
    qualityPts: 7.8,
    costPts: 7.0,
  },
];

export const EMBEDDING_MODELS: EmbeddingModel[] = [
  {
    id: 'text-embedding-3-large',
    name: 'text-embedding-3-large',
    provider: 'OpenAI',
    pricePer1MUSD: 0.13,
  },
  {
    id: 'text-embedding-3-small',
    name: 'text-embedding-3-small',
    provider: 'OpenAI',
    pricePer1MUSD: 0.02,
  },
];

export const INFRA_DEFAULTS: InfraDefaults = {
  vercelMonthlyUSD: 20,
  supabaseMonthlyUSD: 25,
  r2PricePerGBUSD: 0.015,
  r2RequestsUSD: 2,
  workerMonthlyUSD: 20,
  monitoringMonthlyUSD: 15,
  defaultR2StorageGB: 100,
};

/** Workbook Supabase Storage overage ~$0.0213/GB-month */
export const SUPABASE_STORAGE_PRICE_PER_GB_USD = 0.0213;

/** Defaults from Chat Volume sheet */
export const DEFAULT_LLM_MODEL_ID = 'gemini-3-1-flash-lite';
export const DEFAULT_EMBEDDING_MODEL_ID = 'text-embedding-3-large';
export const DEFAULT_CHAT_VOLUME_PRESET_ID: ChatVolumePresetId = 'normal';

export const LLM_MODEL_OPTIONS: { id: string; label: string; provider: string }[] =
  LLM_MODELS.map((m) => ({ id: m.id, label: m.name, provider: m.provider }));

export const CHAT_VOLUME_OPTIONS: { id: ChatVolumePresetId; label: string }[] =
  CHAT_VOLUME_PRESETS.map((p) => ({ id: p.id, label: p.name }));

/**
 * Asset storage is always Cloudflare R2 (2D renders + 3D GLB/GLTF/textures).
 * Supabase Pro is fixed app/DB infra — not an alternate place for unstructured media.
 */
export const STORAGE_STACKS: StorageStack[] = [
  {
    id: 'r2',
    name: 'Cloudflare R2 Standard',
    shortName: 'R2',
    r2Share: 1,
    supabaseShare: 0,
    note: 'All unstructured 2D/3D assets on R2. Supabase Pro covers app/DB only.',
  },
];

/** @deprecated Storage is no longer a combo axis — always R2 */
export const STORAGE_STACK_OPTIONS: { id: StorageStackId; label: string }[] = [
  { id: 'r2', label: 'R2 (always — 2D/3D assets)' },
];

export const DEFAULT_STORAGE_STACK_ID: StorageStackId = 'r2';

/** Default FX from Updated workbook Monthly Calculator */
export const DEFAULT_USD_TO_INR = 85;

/** Default margin added to every combination card (INR / month) */
export const DEFAULT_MARGIN_COST_INR = 5000;

let activeUsdToInr = DEFAULT_USD_TO_INR;

export function setUsdToInrRate(rate: number) {
  activeUsdToInr = rate > 0 ? rate : DEFAULT_USD_TO_INR;
}

export function getUsdToInrRate(): number {
  return activeUsdToInr;
}

export function convertUSDToINR(usd: number, rate?: number): number {
  return usd * (rate ?? activeUsdToInr);
}

export function convertINRToUSD(inr: number, rate?: number): number {
  return inr / (rate ?? activeUsdToInr);
}

export const IMAGE_PROVIDER_OPTIONS: { id: ImageProviderId; label: string }[] = [
  { id: 'google', label: 'Google Gemini' },
  { id: 'bfl', label: 'Black Forest Labs' },
  { id: 'ideogram', label: 'Ideogram' },
  { id: 'openai', label: 'OpenAI' },
];

export const THREED_PROVIDER_OPTIONS: { id: ThreeDProviderId; label: string }[] = [
  { id: 'tripo', label: 'Tripo' },
  { id: 'meshy', label: 'Meshy' },
  { id: 'rodin', label: 'Rodin' },
];

export function getLLMModelById(id?: string): LLMModel {
  return LLM_MODELS.find((m) => m.id === id) || LLM_MODELS[0];
}

export function getEmbeddingModelById(id?: string): EmbeddingModel {
  return EMBEDDING_MODELS.find((m) => m.id === id) || EMBEDDING_MODELS[0];
}

export function getStorageStackById(id?: string): StorageStack {
  return STORAGE_STACKS.find((s) => s.id === id) || STORAGE_STACKS[0];
}

export function getChatVolumePresetById(id?: string): ChatVolumePreset {
  return CHAT_VOLUME_PRESETS.find((p) => p.id === id) || CHAT_VOLUME_PRESETS[1];
}

/** Apply chat-volume preset → monthly token fields */
export function tokensFromChatVolumePreset(presetId?: ChatVolumePresetId) {
  const preset = getChatVolumePresetById(presetId);
  return {
    chatVolumePresetId: preset.id,
    llmInputTokens: CHAT_TOKEN_BUDGET.inputTokens,
    llmOutputTokens: CHAT_TOKEN_BUDGET.outputTokens,
    embeddingTokens: CHAT_TOKEN_BUDGET.embeddingTokens,
    estimatedChats: preset.estimatedChats,
    inputTokensPerChat: preset.inputTokensPerChat,
    outputTokensPerChat: preset.outputTokensPerChat,
    totalWordsPerChat: preset.totalWordsPerChat,
  };
}
