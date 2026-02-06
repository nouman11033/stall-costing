// Pricing data from the PDF

export interface AvatarPlan {
  id: string;
  name: string;
  provider: 'heygen' | 'anam' | 'tavus';
  tier: string;
  monthlyPrice: number; // Monthly price in USD
  minutes: number;
  maxLength?: number; // in minutes (undefined = unlimited)
  concurrency?: number; // Max concurrent sessions (undefined = unlimited/custom)
  additionalPerMin: number;
  hasInbuiltVoice: boolean;
  // Annual commitment fields (for Enterprise plans)
  isAnnualOnly?: boolean; // true if this plan requires annual commitment
  annualCommitmentUSD?: number; // Annual commitment amount in USD
  totalAnnualMinutes?: number; // Total minutes included in the annual plan
  note?: string; // Note about the plan (e.g., "Annual commitment required")
}

export interface VoiceAgent {
  id: string;
  name: string;
  pricingModel: 'tokens' | 'per-minute' | 'per-minute-per-concurrency';
  // For token-based pricing
  pricePer1MTokens?: number;
  tokensPerMinute?: number; // Average tokens per minute
  tokensPerMinuteMin?: number; // Minimum tokens per minute (for range display)
  tokensPerMinuteMax?: number; // Maximum tokens per minute (for range display)
  // For per-minute pricing
  pricePerMinute?: number;
  monthlyBaseCost?: number; // Monthly minimum cost (for Hume) or base cost
  monthlyMinimumCost?: number; // Minimum expenditure required (for Hume)
  concurrency?: number; // Max concurrent sessions
}

export interface HostingOption {
  id: string;
  name: string;
  baseMonthlyCostINR: number;
  costPerUserPerMonthINR: number;
  costPerCallINR: number;
  storageGB: number;
}

// Avatar Plans (Monthly prices)
export const AVATAR_PLANS: AvatarPlan[] = [
  // HeyGen
  {
    id: 'heygen-essential',
    name: 'HeyGen Essential',
    provider: 'heygen',
    tier: 'Essential',
    monthlyPrice: 99, // $99/month
    minutes: 1000,
    maxLength: 20,
    concurrency: 20,
    additionalPerMin: 0.10,
    hasInbuiltVoice: true,
  },
  // HeyGen Enterprise Plan (Annual commitment only)
  {
    id: 'heygen-enterprise',
    name: 'HeyGen Enterprise',
    provider: 'heygen',
    tier: 'Enterprise',
    monthlyPrice: 2000, // $24,000 / 12
    minutes: 20000, // Minutes per month
    maxLength: undefined,
    concurrency: 100,
    additionalPerMin: 0.10,
    hasInbuiltVoice: true,
    isAnnualOnly: true,
    annualCommitmentUSD: 24000,
    totalAnnualMinutes: 240000, // 20,000 * 12
    note: 'Annual commitment required. 1080p custom avatars.',
  },
  // Anam
  {
    id: 'anam-starter',
    name: 'Anam Starter',
    provider: 'anam',
    tier: 'Starter',
    monthlyPrice: 12,
    minutes: 45,
    maxLength: 5,
    concurrency: 1,
    additionalPerMin: 0.18,
    hasInbuiltVoice: true,
  },
  {
    id: 'anam-explorer',
    name: 'Anam Explorer',
    provider: 'anam',
    tier: 'Explorer',
    monthlyPrice: 49,
    minutes: 90,
    maxLength: 10,
    concurrency: 3,
    additionalPerMin: 0.18,
    hasInbuiltVoice: true,
  },
  {
    id: 'anam-growth',
    name: 'Anam Growth',
    provider: 'anam',
    tier: 'Growth',
    monthlyPrice: 299,
    minutes: 300,
    maxLength: 30,
    concurrency: 5,
    additionalPerMin: 0.18,
    hasInbuiltVoice: true,
  },
  {
    id: 'anam-pro',
    name: 'Anam Pro',
    provider: 'anam',
    tier: 'Pro',
    monthlyPrice: 799,
    minutes: 1000,
    maxLength: undefined, // unlimited (--)
    concurrency: 10,
    additionalPerMin: 0.18,
    hasInbuiltVoice: true,
  },
  // Anam Enterprise Plans (Annual commitment only)
  {
    id: 'anam-enterprise-tier1',
    name: 'Anam Enterprise Tier 1',
    provider: 'anam',
    tier: 'Enterprise',
    monthlyPrice: 3900, // $1,400 (annual commitment/12) + $2,500 (annual payment/12)
    minutes: 10000, // Minutes per month
    maxLength: undefined,
    concurrency: 30,
    additionalPerMin: 0.14,
    hasInbuiltVoice: true,
    isAnnualOnly: true,
    annualCommitmentUSD: 16800,
    totalAnnualMinutes: 120000, // 10,000 * 12
    note: 'Annual commitment required. Includes $30,000 annual payment.',
  },
  {
    id: 'anam-enterprise-tier2',
    name: 'Anam Enterprise Tier 2',
    provider: 'anam',
    tier: 'Enterprise',
    monthlyPrice: 8500, // $6,000 (annual commitment/12) + $2,500 (annual payment/12)
    minutes: 50000, // Minutes per month
    maxLength: undefined,
    concurrency: 50,
    additionalPerMin: 0.12, // Estimated based on tier structure
    hasInbuiltVoice: true,
    isAnnualOnly: true,
    annualCommitmentUSD: 72000,
    totalAnnualMinutes: 600000, // 50,000 * 12
    note: 'Annual commitment required. Includes $30,000 annual payment.',
  },
  {
    id: 'anam-enterprise-tier3',
    name: 'Anam Enterprise Tier 3',
    provider: 'anam',
    tier: 'Enterprise',
    monthlyPrice: 12500, // $10,000 (annual commitment/12) + $2,500 (annual payment/12)
    minutes: 100000, // Minutes per month
    maxLength: undefined,
    concurrency: 100,
    additionalPerMin: 0.12,
    hasInbuiltVoice: true,
    isAnnualOnly: true,
    annualCommitmentUSD: 120000,
    totalAnnualMinutes: 1200000, // 100,000 * 12
    note: 'Annual commitment required. Includes $30,000 annual payment.',
  },
  // Tavus
  {
    id: 'tavus-starter',
    name: 'Tavus Starter',
    provider: 'tavus',
    tier: 'Starter',
    monthlyPrice: 59,
    minutes: 100,
    maxLength: undefined, // Not specified
    concurrency: 3,
    additionalPerMin: 0.37,
    hasInbuiltVoice: true,
  },
  {
    id: 'tavus-growth',
    name: 'Tavus Growth',
    provider: 'tavus',
    tier: 'Growth',
    monthlyPrice: 397,
    minutes: 1250,
    maxLength: undefined, // Not specified
    concurrency: 15,
    additionalPerMin: 0.32,
    hasInbuiltVoice: true,
  },
  // Tavus Enterprise Plans (Annual commitment only)
  {
    id: 'tavus-enterprise-tier1',
    name: 'Tavus Enterprise Tier 1',
    provider: 'tavus',
    tier: 'Enterprise',
    monthlyPrice: 1667, // $20,000 / 12
    minutes: 6667, // Minutes per month
    maxLength: undefined,
    concurrency: 30,
    additionalPerMin: 0.25,
    hasInbuiltVoice: true,
    isAnnualOnly: true,
    annualCommitmentUSD: 20000,
    totalAnnualMinutes: 80000, // 6,667 * 12
    note: 'Annual commitment required. Avatar cost: $40 per avatar.',
  },
  {
    id: 'tavus-enterprise-tier2',
    name: 'Tavus Enterprise Tier 2',
    provider: 'tavus',
    tier: 'Enterprise',
    monthlyPrice: 4917, // $59,000 / 12
    minutes: 24583, // Minutes per month (24,583)
    maxLength: undefined,
    concurrency: 100,
    additionalPerMin: 0.20,
    hasInbuiltVoice: true,
    isAnnualOnly: true,
    annualCommitmentUSD: 59000,
    totalAnnualMinutes: 295000, // 24,583 * 12
    note: 'Annual commitment required. Avatar cost: $40 per avatar.',
  },
  {
    id: 'tavus-enterprise-tier3',
    name: 'Tavus Enterprise Tier 3',
    provider: 'tavus',
    tier: 'Enterprise',
    monthlyPrice: 8329, // $99,950 / 12
    minutes: 59583, // Minutes per month (59,583)
    maxLength: undefined,
    concurrency: 200,
    additionalPerMin: 0.14,
    hasInbuiltVoice: true,
    isAnnualOnly: true,
    annualCommitmentUSD: 99950,
    totalAnnualMinutes: 715000, // 59,583 * 12
    note: 'Annual commitment required. Avatar cost: $40 per avatar.',
  },
  {
    id: 'tavus-enterprise-tier4',
    name: 'Tavus Enterprise Tier 4',
    provider: 'tavus',
    tier: 'Enterprise',
    monthlyPrice: 18200, // $218,400 / 12
    minutes: 200000, // Minutes per month
    maxLength: undefined,
    concurrency: 300,
    additionalPerMin: 0.09,
    hasInbuiltVoice: true,
    isAnnualOnly: true,
    annualCommitmentUSD: 218400,
    totalAnnualMinutes: 2400000, // 200,000 * 12
    note: 'Annual commitment required. Avatar cost: $40 per avatar.',
  },
];

// Voice Agents
export const VOICE_AGENTS: VoiceAgent[] = [
  // Per-minute pricing
  {
    id: 'hume-pro',
    name: 'Hume Pro',
    pricingModel: 'per-minute',
    pricePerMinute: 0.06,
    monthlyBaseCost: 70, // Minimum expenditure required
    monthlyMinimumCost: 70, // Minimum expenditure required
    concurrency: 10,
  },
  {
    id: 'hume-scale',
    name: 'Hume Scale',
    pricingModel: 'per-minute',
    pricePerMinute: 0.05,
    monthlyBaseCost: 200, // Minimum expenditure required
    monthlyMinimumCost: 200, // Minimum expenditure required
    concurrency: 20,
  },
  {
    id: 'hume-business',
    name: 'Hume Business',
    pricingModel: 'per-minute',
    pricePerMinute: 0.04,
    monthlyBaseCost: 500, // Minimum expenditure required
    monthlyMinimumCost: 500, // Minimum expenditure required
    concurrency: 30,
  },
  {
    id: 'hume-enterprise',
    name: 'Hume Enterprise',
    pricingModel: 'per-minute',
    pricePerMinute: 0.03,
    monthlyBaseCost: 1250, // $15,000 annual minimum / 12 months
    monthlyMinimumCost: 1250, // $15,000 annual minimum / 12 months
    concurrency: undefined, // Unlimited
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    pricingModel: 'per-minute',
    pricePerMinute: 0.18,
    monthlyBaseCost: 0,
    concurrency: undefined,
  },
];

// Hosting Options
export const HOSTING_OPTIONS: HostingOption[] = [
  {
    id: 'azure',
    name: 'Azure',
    baseMonthlyCostINR: 50000,
    costPerUserPerMonthINR: 220,
    costPerCallINR: 3.10,
    storageGB: 50,
  },
  {
    id: 'vercel',
    name: 'Vercel',
    baseMonthlyCostINR: 40000,
    costPerUserPerMonthINR: 240,
    costPerCallINR: 3.40,
    storageGB: 10,
  },
  {
    id: 'railway',
    name: 'Railway',
    baseMonthlyCostINR: 30000,
    costPerUserPerMonthINR: 210,
    costPerCallINR: 3.00,
    storageGB: 10,
  },
  {
    id: 'vercel-railway',
    name: 'Vercel + Railway',
    baseMonthlyCostINR: 35000, // Average
    costPerUserPerMonthINR: 230, // Average
    costPerCallINR: 3.20, // Average
    storageGB: 15,
  },
];

// Exchange rate: 1 USD = 90 INR
const USD_TO_INR = 90;

export function convertUSDToINR(usd: number): number {
  return usd * USD_TO_INR;
}

export function convertINRToUSD(inr: number): number {
  return inr / USD_TO_INR;
}

// Fixed miscellaneous expenses (irrespective of other costs)
export const MISC_EXPENSES_MONTHLY_INR = 30000;

