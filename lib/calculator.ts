import {
  AVATAR_PLANS,
  VOICE_AGENTS,
  HOSTING_OPTIONS,
  AvatarPlan,
  VoiceAgent,
  HostingOption,
  convertUSDToINR,
  convertINRToUSD,
  MISC_EXPENSES_MONTHLY_INR,
} from './pricing';
import { StorageOption, calculateStorageCosts, TierAllocation } from './storageCalculator';
import { calculateQuality, calculateLatency } from './qualityLatency';

export interface BudgetInput {
  monthlyBudgetINR?: number; // Optional - can be calculated dynamically
  apiAllocationPercent?: number; // Optional - can be calculated dynamically
  hostingAllocationPercent?: number; // Optional - can be calculated dynamically
  users: number;
  concurrentSessions: number;
  minutesPerMonth: number;
  // Provider selections
  selectedAvatarProviders?: string[]; // ['heygen', 'anam', 'tavus']
  selectedVoiceProviders?: string[]; // ['inbuilt', 'hume-pro', 'hume-scale', 'hume-business', 'elevenlabs']
  selectedHostingOptions?: string[]; // ['azure', 'railway', 'vercel', 'vercel-railway']
  // Storage parameters
  storageTotalSizeGB: number;
  storageTierAllocation: TierAllocation;
  storageNumberOfDatabases: number;
  storageProviders?: ('AWS' | 'Azure')[];
  storageAdditionalCosts?: {
    aws?: {
      hot?: { dataTransferOut?: number; putRequests?: number; getRequests?: number; };
      cold?: { dataTransferOut?: number; putRequests?: number; getRequests?: number; dataRetrieved?: number; };
      archive?: { dataTransferOut?: number; putRequests?: number; getRequests?: number; dataRetrieved?: number; retrievalType?: 'Standard' | 'Expedited'; retrievalRequests?: number; };
    };
    azure?: {
      hot?: { dataTransferOut?: number; readOperations?: number; writeOperations?: number; queryDataScanned?: number; queryDataReturned?: number; iterativeReadOps?: number; iterativeWriteOps?: number; otherOperations?: number; };
      cold?: { dataTransferOut?: number; readOperations?: number; writeOperations?: number; queryDataScanned?: number; queryDataReturned?: number; iterativeWriteOps?: number; dataRetrieved?: number; };
      archive?: { dataTransferOut?: number; readOperations?: number; writeOperations?: number; highPriorityRead?: number; highPriorityRetrieval?: number; iterativeWriteOps?: number; dataRetrieved?: number; };
    };
  };
}

export interface Combination {
  id: string;
  avatarPlan: AvatarPlan;
  avatarAccounts: number;
  voiceAgent?: VoiceAgent;
  voiceAccounts: number;
  hostingOption: HostingOption;
  storageOption: StorageOption; // One of the 5 storage options
  totalCostINR: number;
  breakdown: {
    avatarCostINR: number;
    avatarCostUSD: number;
    avatarBaseCostUSD: number;
    avatarAdditionalMinutes: number;
    avatarAdditionalCostUSD: number;
    voiceCostINR: number;
    voiceCostUSD: number;
    voiceBaseCostUSD?: number;
    voicePerMinuteCostUSD?: number;
    voiceTotalTokens?: number;
    hostingCostINR: number;
    hostingBaseCostINR: number;
    hostingUsersCostINR: number;
    hostingCallsCostINR: number;
    storageCostINR: number;
    storageCostUSD: number;
    miscExpensesINR: number;
    totalCostINR: number;
    totalCostUSD: number;
  };
  fitsBudget: boolean;
  score: number; // Higher is better
  warnings: string[];
}

export function calculateCombinations(input: BudgetInput): Combination[] {
  const combinations: Combination[] = [];
  
  // Use provided budget or calculate dynamically (if not provided, set to a high value to not filter)
  const monthlyBudgetINR = input.monthlyBudgetINR || 999999999;
  const apiAllocationPercent = input.apiAllocationPercent || 100;
  const hostingAllocationPercent = input.hostingAllocationPercent || 0;
  const apiBudgetINR = (monthlyBudgetINR * apiAllocationPercent) / 100;
  const hostingBudgetINR = (monthlyBudgetINR * hostingAllocationPercent) / 100;

  // Filter avatar plans by selected providers
  const avatarPlanCombos = buildAvatarPlanCombos(input);
  
  // Filter voice agents based on selection
  // If 'inbuilt' is selected, include combinations with inbuilt voice
  // If voice agents are selected, include those
  // If nothing is selected, default to inbuilt
  const hasVoiceSelection =
    Array.isArray(input.selectedVoiceProviders) &&
    input.selectedVoiceProviders.length > 0;
  const useInbuilt =
    !hasVoiceSelection ||
    (Array.isArray(input.selectedVoiceProviders) &&
      input.selectedVoiceProviders.includes('inbuilt')) ||
    false;
  const selectedVoiceAgentIds = hasVoiceSelection
    ? (input.selectedVoiceProviders ?? []).filter(v => v !== 'inbuilt')
    : [];
  const voiceAgentCombos = buildVoiceAgentCombos(input, selectedVoiceAgentIds);
  
  // Filter hosting options by selection
  const hostingOptions = input.selectedHostingOptions && input.selectedHostingOptions.length > 0
    ? HOSTING_OPTIONS.filter(h => input.selectedHostingOptions!.includes(h.id))
    : HOSTING_OPTIONS;
  
  // Calculate storage costs for all 5 storage options
  const storageOptions = calculateStorageCosts(
    input.storageTotalSizeGB,
    input.storageTierAllocation,
    input.storageNumberOfDatabases,
    input.storageAdditionalCosts
  );

  for (const avatarCombo of avatarPlanCombos) {
    for (const hostingOption of hostingOptions) {
      // If inbuilt is selected, include combinations with inbuilt voice
      if (useInbuilt) {
        for (const storageOption of storageOptions) {
          const combination = calculateCombination(
            avatarCombo.plan,
            avatarCombo.accounts,
            undefined, // inbuilt voice
            1,
            hostingOption,
            storageOption,
            input,
            apiBudgetINR,
            hostingBudgetINR
          );
          combinations.push(combination);
        }
      }
      
      // If voice agents are selected, include combinations with those agents
      if (selectedVoiceAgentIds.length > 0) {
        for (const voiceCombo of voiceAgentCombos) {
          for (const storageOption of storageOptions) {
            const combination = calculateCombination(
              avatarCombo.plan,
              avatarCombo.accounts,
              voiceCombo.agent,
              voiceCombo.accounts,
              hostingOption,
              storageOption,
              input,
              apiBudgetINR,
              hostingBudgetINR
            );
            combinations.push(combination);
          }
        }
      }
    }
  }

  // Filter out invalid combinations and rank by lowest cost (rank 1 = lowest cost)
  return combinations
    .filter((c) => isValidCombination(c, input))
    .sort((a, b) => a.totalCostINR - b.totalCostINR); // Sort ascending (lowest cost first)
}

function calculateCombination(
  avatarPlan: AvatarPlan,
  avatarAccounts: number,
  voiceAgent: VoiceAgent | undefined,
  voiceAccounts: number,
  hostingOption: HostingOption,
  storageOption: StorageOption,
  input: BudgetInput,
  apiBudgetINR: number,
  hostingBudgetINR: number
): Combination {
  const isAvatarCombo = avatarPlan.tier === 'Combo' || avatarPlan.id.includes('+');
  const avatarFactor = isAvatarCombo ? 1 : avatarAccounts;

  // Calculate avatar cost
  const avatarBaseCostUSD = avatarPlan.monthlyPrice * avatarFactor;
  const includedMinutes = avatarPlan.minutes * avatarFactor;
  const additionalMinutes = Math.max(0, input.minutesPerMonth - includedMinutes);
  const avatarAdditionalCostUSD = additionalMinutes * avatarPlan.additionalPerMin;
  const totalAvatarCostUSD = avatarBaseCostUSD + avatarAdditionalCostUSD;
  const avatarCostINR = convertUSDToINR(totalAvatarCostUSD);

  // Calculate voice cost (if using voice agent)
  let voiceCostINR = 0;
  let voiceCostUSD = 0;
  let voiceBaseCostUSD: number | undefined = undefined;
  let voicePerMinuteCostUSD: number | undefined = undefined;
  let voiceTotalTokens: number | undefined = undefined;
  const isVoiceCombo = voiceAgent ? voiceAgent.id.includes('+') || voiceAgent.name?.includes('combo') : false;
  const voiceFactor = isVoiceCombo ? 1 : voiceAccounts;
  
  if (voiceAgent) {
    if (voiceAgent.pricingModel === 'tokens') {
      // Token-based pricing
      voiceTotalTokens = input.minutesPerMonth * (voiceAgent.tokensPerMinute || 1000); // Default to 1000 if not specified
      const tokensInMillions = voiceTotalTokens / 1_000_000;
      voiceCostUSD = tokensInMillions * (voiceAgent.pricePer1MTokens || 0);
      voiceCostINR = convertUSDToINR(voiceCostUSD);
    } else if (voiceAgent.pricingModel === 'per-minute') {
      // Per-minute pricing (Hume) - allow up to 2 accounts
      const minimumCostPerAccountUSD = voiceAgent.monthlyMinimumCost || voiceAgent.monthlyBaseCost || 0;
      if (isVoiceCombo) {
        const variableCostUSD = (voiceAgent.pricePerMinute || 0) * input.minutesPerMonth;
        voicePerMinuteCostUSD = variableCostUSD;
        voiceBaseCostUSD = minimumCostPerAccountUSD; // already aggregated for combo
        voiceCostUSD = Math.max(minimumCostPerAccountUSD, variableCostUSD);
      } else {
        const perAccountMinutes = input.minutesPerMonth / voiceFactor;
        const variableCostPerAccountUSD = (voiceAgent.pricePerMinute || 0) * perAccountMinutes;
        const perAccountCostUSD = Math.max(minimumCostPerAccountUSD, variableCostPerAccountUSD);
        voicePerMinuteCostUSD = (voiceAgent.pricePerMinute || 0) * input.minutesPerMonth;
        voiceBaseCostUSD = minimumCostPerAccountUSD * voiceFactor;
        voiceCostUSD = perAccountCostUSD * voiceFactor;
      }
      voiceCostINR = convertUSDToINR(voiceCostUSD);
    } else if (voiceAgent.pricingModel === 'per-minute-per-concurrency') {
      // Per-minute per concurrency pricing
      // Cost = price per minute × minutes × concurrent sessions
      voicePerMinuteCostUSD = (voiceAgent.pricePerMinute || 0) * input.minutesPerMonth * input.concurrentSessions;
      voiceCostUSD = voicePerMinuteCostUSD;
      voiceCostINR = convertUSDToINR(voiceCostUSD);
    }
  }

  // Calculate hosting cost breakdown
  const hostingBaseCostINR = hostingOption.baseMonthlyCostINR;
  const hostingUsersCostINR = input.users * hostingOption.costPerUserPerMonthINR;
  const calls = input.minutesPerMonth / 10; // Assuming ~10 min per call
  const hostingCallsCostINR = calls * hostingOption.costPerCallINR;
  const hostingCostINR = hostingBaseCostINR + hostingUsersCostINR + hostingCallsCostINR;

  // Calculate storage cost
  // Storage cost is per database, multiply by number of databases
  const storageCostUSD = storageOption.monthlyCostUSD * input.storageNumberOfDatabases;
  const storageCostINR = convertUSDToINR(storageCostUSD);

  // Total cost (including miscellaneous expenses)
  const totalCostINR = avatarCostINR + voiceCostINR + hostingCostINR + storageCostINR + MISC_EXPENSES_MONTHLY_INR;
  const totalCostUSD = convertINRToUSD(totalCostINR);

  // Check if fits budget (only if budget is provided)
  const apiCostINR = avatarCostINR + voiceCostINR;
  const fitsBudget = input.monthlyBudgetINR 
    ? (totalCostINR <= input.monthlyBudgetINR && 
       apiCostINR <= apiBudgetINR && 
       hostingCostINR <= hostingBudgetINR)
    : true; // If no budget specified, all combinations fit

  // Generate warnings
  const warnings: string[] = [];
  const avatarConcurrencyLimit =
    avatarPlan.concurrency !== undefined
      ? avatarPlan.concurrency * (isAvatarCombo ? 1 : avatarAccounts)
      : undefined;
  if (avatarConcurrencyLimit !== undefined && input.concurrentSessions > avatarConcurrencyLimit) {
    warnings.push(
      `Concurrent sessions (${input.concurrentSessions}) exceed avatar plan limit with ${avatarAccounts} account(s) (${avatarConcurrencyLimit})`
    );
  }
  if (voiceAgent && voiceAgent.concurrency) {
    const voiceConcurrencyLimit = voiceAgent.concurrency * (isVoiceCombo ? 1 : voiceAccounts);
    if (input.concurrentSessions > voiceConcurrencyLimit) {
      warnings.push(
        `Concurrent sessions (${input.concurrentSessions}) exceed voice agent limit with ${voiceAccounts} account(s) (${voiceConcurrencyLimit})`
      );
    }
  }
  if (avatarPlan.maxLength && input.minutesPerMonth / input.users > avatarPlan.maxLength) {
    warnings.push(
      `Average session length may exceed plan limit (${avatarPlan.maxLength} min)`
    );
  }
  if (apiCostINR > apiBudgetINR) {
    warnings.push(`API cost (₹${apiCostINR.toFixed(2)}) exceeds allocated budget (₹${apiBudgetINR.toFixed(2)})`);
  }
  if (hostingCostINR > hostingBudgetINR) {
    warnings.push(
      `Hosting cost (₹${hostingCostINR.toFixed(2)}) exceeds allocated budget (₹${hostingBudgetINR.toFixed(2)})`
    );
  }

  // Calculate score - combines quality, concurrency, cost, latency, and account management
  let score = 0;
  
  // Avatar provider bonuses
  const avatarProvider = avatarPlan.provider.toLowerCase();
  if (avatarProvider === 'tavus') {
    score += 100;
  } else if (avatarProvider === 'anam') {
    score += 90;
  } else if (avatarProvider === 'heygen') {
    score += 78;
  }
  
  // Voice agent bonuses
  if (voiceAgent) {
    const voiceId = voiceAgent.id.toLowerCase();
    if (voiceId.includes('hume')) {
      score += 100;
    } else if (voiceId.includes('elevenlabs')) {
      score += 70;
    }
  }
  
  // Avatar concurrency within limit: +100 points
  if (avatarConcurrencyLimit === undefined || input.concurrentSessions <= avatarConcurrencyLimit) {
    score += 100;
  }
  
  // Voice agent concurrency within limit: +100 points
  if (voiceAgent && voiceAgent.concurrency && input.concurrentSessions <= voiceAgent.concurrency * (isVoiceCombo ? 1 : voiceAccounts)) {
    score += 100;
  }
  
  // Account management penalties (to avoid over-favoring splits)
  if (avatarAccounts > 1) score -= 25 * (avatarAccounts - 1);
  if (voiceAccounts > 1) score -= 25 * (voiceAccounts - 1);
  
  // Add quality score: +0 to +1000 points (overallQualityScore × 100)
  // Create a temporary combination object to calculate quality
  const tempCombination: Combination = {
    id: '',
    avatarPlan,
    avatarAccounts,
    voiceAgent,
    voiceAccounts,
    hostingOption,
    storageOption,
    totalCostINR,
    breakdown: {
      avatarCostINR,
      avatarCostUSD: totalAvatarCostUSD,
      avatarBaseCostUSD,
      avatarAdditionalMinutes: additionalMinutes,
      avatarAdditionalCostUSD,
      voiceCostINR,
      voiceCostUSD,
      voiceBaseCostUSD,
      voicePerMinuteCostUSD,
      voiceTotalTokens,
      hostingCostINR,
      hostingBaseCostINR,
      hostingUsersCostINR,
      hostingCallsCostINR,
      storageCostINR,
      storageCostUSD,
      miscExpensesINR: MISC_EXPENSES_MONTHLY_INR,
      totalCostINR,
      totalCostUSD,
    },
    fitsBudget,
    warnings,
    score: 0, // Will be set below
  };
  const quality = calculateQuality(tempCombination, input.users, input.concurrentSessions);
  score += quality.overallQualityScore * 100; // +0 to +1000 points

  const id = `${avatarPlan.id}x${avatarAccounts}-${voiceAgent?.id || 'inbuilt'}x${voiceAccounts}-${hostingOption.id}-${storageOption.id}`;

  return {
    id,
    avatarPlan,
    avatarAccounts,
    voiceAgent,
    voiceAccounts,
    hostingOption,
    storageOption,
    totalCostINR,
    breakdown: {
      avatarCostINR,
      avatarCostUSD: totalAvatarCostUSD,
      avatarBaseCostUSD,
      avatarAdditionalMinutes: additionalMinutes,
      avatarAdditionalCostUSD,
      voiceCostINR,
      voiceCostUSD,
      voiceBaseCostUSD,
      voicePerMinuteCostUSD,
      voiceTotalTokens,
      hostingCostINR,
      hostingBaseCostINR,
      hostingUsersCostINR,
      hostingCallsCostINR,
      storageCostINR,
      storageCostUSD,
      miscExpensesINR: MISC_EXPENSES_MONTHLY_INR,
      totalCostINR,
      totalCostUSD,
    },
    fitsBudget,
    score,
    warnings,
  };
}

function isValidCombination(combination: Combination, input: BudgetInput): boolean {
  const isAvatarCombo = combination.avatarPlan.tier === 'Combo' || combination.avatarPlan.id.includes('+');
  const isVoiceCombo = combination.voiceAgent ? combination.voiceAgent.id.includes('+') || combination.voiceAgent.name?.includes('combo') : false;

  // Check avatar concurrency (skip if undefined, as it means custom/unlimited)
  if (combination.avatarPlan.concurrency !== undefined) {
    const capacity = combination.avatarPlan.concurrency * (isAvatarCombo ? 1 : combination.avatarAccounts);
    if (input.concurrentSessions > capacity) {
      return false; // Can't handle required concurrency
    }
  }

  // Check voice agent concurrency (if using voice agent with concurrency limit)
  if (combination.voiceAgent && combination.voiceAgent.concurrency) {
    const capacity = combination.voiceAgent.concurrency * (isVoiceCombo ? 1 : combination.voiceAccounts);
    if (input.concurrentSessions > capacity) {
      return false; // Voice agent can't handle required concurrency
    }
  }

  // Check if plan has inbuilt voice when using inbuilt voice (no voice agent)
  if (!combination.voiceAgent && !combination.avatarPlan.hasInbuiltVoice) {
    return false;
  }

  return true;
}

/** Returns cost breakdown for a combination at given input (minutesPerMonth, concurrentSessions). Used for min/max range display. */
export function getCostBreakdownForInput(combination: Combination, input: BudgetInput): {
  avatarCostUSD: number;
  voiceCostUSD: number;
  hostingCostINR: number;
  storageCostINR: number;
  totalCostUSD: number;
} {
  const { avatarPlan, avatarAccounts, voiceAgent, voiceAccounts, hostingOption, storageOption } = combination;
  const isAvatarCombo = avatarPlan.tier === 'Combo' || avatarPlan.id.includes('+');
  const avatarFactor = isAvatarCombo ? 1 : avatarAccounts;

  const avatarBaseCostUSD = avatarPlan.monthlyPrice * avatarFactor;
  const includedMinutes = avatarPlan.minutes * avatarFactor;
  const additionalMinutes = Math.max(0, input.minutesPerMonth - includedMinutes);
  const avatarAdditionalCostUSD = additionalMinutes * avatarPlan.additionalPerMin;
  const avatarCostUSD = avatarBaseCostUSD + avatarAdditionalCostUSD;

  let voiceCostUSD = 0;
  const isVoiceCombo = voiceAgent ? voiceAgent.id.includes('+') || voiceAgent.name?.includes('combo') : false;
  const voiceFactor = isVoiceCombo ? 1 : voiceAccounts;

  if (voiceAgent) {
    if (voiceAgent.pricingModel === 'tokens') {
      const voiceTotalTokens = input.minutesPerMonth * (voiceAgent.tokensPerMinute || 1000);
      voiceCostUSD = (voiceTotalTokens / 1_000_000) * (voiceAgent.pricePer1MTokens || 0);
    } else if (voiceAgent.pricingModel === 'per-minute') {
      const minimumCostPerAccountUSD = voiceAgent.monthlyMinimumCost || voiceAgent.monthlyBaseCost || 0;
      if (isVoiceCombo) {
        const variableCostUSD = (voiceAgent.pricePerMinute || 0) * input.minutesPerMonth;
        voiceCostUSD = Math.max(minimumCostPerAccountUSD, variableCostUSD);
      } else {
        const perAccountMinutes = input.minutesPerMonth / voiceFactor;
        const variableCostPerAccountUSD = (voiceAgent.pricePerMinute || 0) * perAccountMinutes;
        const perAccountCostUSD = Math.max(minimumCostPerAccountUSD, variableCostPerAccountUSD);
        voiceCostUSD = perAccountCostUSD * voiceFactor;
      }
    } else if (voiceAgent.pricingModel === 'per-minute-per-concurrency') {
      voiceCostUSD = (voiceAgent.pricePerMinute || 0) * input.minutesPerMonth * input.concurrentSessions;
    }
  }

  const hostingBaseCostINR = hostingOption.baseMonthlyCostINR;
  const hostingUsersCostINR = input.users * hostingOption.costPerUserPerMonthINR;
  const calls = input.minutesPerMonth / 10;
  const hostingCallsCostINR = calls * hostingOption.costPerCallINR;
  const hostingCostINR = hostingBaseCostINR + hostingUsersCostINR + hostingCallsCostINR;

  const storageCostUSD = storageOption.monthlyCostUSD * input.storageNumberOfDatabases;
  const storageCostINR = convertUSDToINR(storageCostUSD);

  const totalCostINR = convertUSDToINR(avatarCostUSD) + convertUSDToINR(voiceCostUSD) + hostingCostINR + storageCostINR + MISC_EXPENSES_MONTHLY_INR;
  const totalCostUSD = convertINRToUSD(totalCostINR);

  return { avatarCostUSD, voiceCostUSD, hostingCostINR, storageCostINR, totalCostUSD };
}

/** Returns full breakdown for a combination at given input. Used for dynamic results page (slider-driven amounts and charts). */
export function getFullBreakdownForInput(combination: Combination, input: BudgetInput): Combination['breakdown'] {
  const { avatarPlan, avatarAccounts, voiceAgent, voiceAccounts, hostingOption, storageOption } = combination;
  const isAvatarCombo = avatarPlan.tier === 'Combo' || avatarPlan.id.includes('+');
  const avatarFactor = isAvatarCombo ? 1 : avatarAccounts;

  const avatarBaseCostUSD = avatarPlan.monthlyPrice * avatarFactor;
  const includedMinutes = avatarPlan.minutes * avatarFactor;
  const additionalMinutes = Math.max(0, input.minutesPerMonth - includedMinutes);
  const avatarAdditionalCostUSD = additionalMinutes * avatarPlan.additionalPerMin;
  const avatarCostUSD = avatarBaseCostUSD + avatarAdditionalCostUSD;
  const avatarCostINR = convertUSDToINR(avatarCostUSD);

  let voiceCostUSD = 0;
  let voiceBaseCostUSD: number | undefined = undefined;
  let voicePerMinuteCostUSD: number | undefined = undefined;
  let voiceTotalTokens: number | undefined = undefined;
  const isVoiceCombo = voiceAgent ? voiceAgent.id.includes('+') || voiceAgent.name?.includes('combo') : false;
  const voiceFactor = isVoiceCombo ? 1 : voiceAccounts;

  if (voiceAgent) {
    if (voiceAgent.pricingModel === 'tokens') {
      voiceTotalTokens = input.minutesPerMonth * (voiceAgent.tokensPerMinute || 1000);
      voiceCostUSD = (voiceTotalTokens / 1_000_000) * (voiceAgent.pricePer1MTokens || 0);
    } else if (voiceAgent.pricingModel === 'per-minute') {
      const minimumCostPerAccountUSD = voiceAgent.monthlyMinimumCost || voiceAgent.monthlyBaseCost || 0;
      if (isVoiceCombo) {
        const variableCostUSD = (voiceAgent.pricePerMinute || 0) * input.minutesPerMonth;
        voicePerMinuteCostUSD = variableCostUSD;
        voiceBaseCostUSD = minimumCostPerAccountUSD;
        voiceCostUSD = Math.max(minimumCostPerAccountUSD, variableCostUSD);
      } else {
        const perAccountMinutes = input.minutesPerMonth / voiceFactor;
        const variableCostPerAccountUSD = (voiceAgent.pricePerMinute || 0) * perAccountMinutes;
        const perAccountCostUSD = Math.max(minimumCostPerAccountUSD, variableCostPerAccountUSD);
        voicePerMinuteCostUSD = (voiceAgent.pricePerMinute || 0) * input.minutesPerMonth;
        voiceBaseCostUSD = minimumCostPerAccountUSD * voiceFactor;
        voiceCostUSD = perAccountCostUSD * voiceFactor;
      }
    } else if (voiceAgent.pricingModel === 'per-minute-per-concurrency') {
      voicePerMinuteCostUSD = (voiceAgent.pricePerMinute || 0) * input.minutesPerMonth * input.concurrentSessions;
      voiceCostUSD = voicePerMinuteCostUSD;
    }
  }
  const voiceCostINR = convertUSDToINR(voiceCostUSD);

  const hostingBaseCostINR = hostingOption.baseMonthlyCostINR;
  const hostingUsersCostINR = input.users * hostingOption.costPerUserPerMonthINR;
  const calls = input.minutesPerMonth / 10;
  const hostingCallsCostINR = calls * hostingOption.costPerCallINR;
  const hostingCostINR = hostingBaseCostINR + hostingUsersCostINR + hostingCallsCostINR;

  const storageCostUSD = storageOption.monthlyCostUSD * input.storageNumberOfDatabases;
  const storageCostINR = convertUSDToINR(storageCostUSD);

  const totalCostINR = avatarCostINR + voiceCostINR + hostingCostINR + storageCostINR + MISC_EXPENSES_MONTHLY_INR;
  const totalCostUSD = convertINRToUSD(totalCostINR);

  return {
    avatarCostINR,
    avatarCostUSD,
    avatarBaseCostUSD,
    avatarAdditionalMinutes: additionalMinutes,
    avatarAdditionalCostUSD,
    voiceCostINR,
    voiceCostUSD,
    voiceBaseCostUSD,
    voicePerMinuteCostUSD,
    voiceTotalTokens,
    hostingCostINR,
    hostingBaseCostINR,
    hostingUsersCostINR,
    hostingCallsCostINR,
    storageCostINR,
    storageCostUSD,
    miscExpensesINR: MISC_EXPENSES_MONTHLY_INR,
    totalCostINR,
    totalCostUSD,
  };
}

// Helper function to estimate avatar cost for a plan/combo
function estimateAvatarCost(plan: AvatarPlan, accounts: number, minutesPerMonth: number): number {
  const isCombo = plan.tier === 'Combo' || plan.id.includes('+');
  const factor = isCombo ? 1 : accounts;
  const baseCostUSD = plan.monthlyPrice * factor;
  const includedMinutes = plan.minutes * factor;
  const additionalMinutes = Math.max(0, minutesPerMonth - includedMinutes);
  const additionalCostUSD = additionalMinutes * plan.additionalPerMin;
  const totalCostUSD = baseCostUSD + additionalCostUSD;
  return convertUSDToINR(totalCostUSD);
}

// Helper function to check if avatar plan/combo meets concurrency requirement
function meetsConcurrencyRequirement(plan: AvatarPlan, accounts: number, requiredConcurrency: number): boolean {
  if (plan.concurrency === undefined) return true; // Unlimited
  const isCombo = plan.tier === 'Combo' || plan.id.includes('+');
  const capacity = plan.concurrency * (isCombo ? 1 : accounts);
  return capacity >= requiredConcurrency;
}

function buildAvatarPlanCombos(input: BudgetInput): { plan: AvatarPlan; accounts: number }[] {
  const combos: { plan: AvatarPlan; accounts: number }[] = [];
  // Filter plans: only exclude plans with no monthly price
  // Enterprise plans will compete with regular plans based on cost-effectiveness
  let eligible = AVATAR_PLANS.filter((p) => p.monthlyPrice > 0);
  
  // Filter by selected avatar providers if specified
  if (input.selectedAvatarProviders && input.selectedAvatarProviders.length > 0) {
    eligible = eligible.filter((p) => input.selectedAvatarProviders!.includes(p.provider));
  }

  // Group plans by provider
  const plansByProvider = new Map<string, AvatarPlan[]>();
  for (const plan of eligible) {
    if (!plansByProvider.has(plan.provider)) {
      plansByProvider.set(plan.provider, []);
    }
    plansByProvider.get(plan.provider)!.push(plan);
  }

  // For each provider, find optimal plans
  for (const [provider, plans] of plansByProvider.entries()) {
    // Find single plans that meet concurrency requirement
    const validSingles = plans
      .filter((p) => meetsConcurrencyRequirement(p, 1, input.concurrentSessions))
      .map((p) => ({
        plan: p,
        accounts: 1,
        cost: estimateAvatarCost(p, 1, input.minutesPerMonth),
        tier: getAvatarTierOrder(p.tier),
      }))
      .sort((a, b) => {
        // Sort by cost first, then by tier (prefer lower tier if costs are similar)
        if (Math.abs(a.cost - b.cost) < 0.01) { // Costs are essentially equal (within 1 paisa)
          return a.tier - b.tier; // Prefer lower tier
        }
        return a.cost - b.cost; // Prefer cheaper
      });

    // Include all valid single plans (no combos for avatars)
    if (validSingles.length > 0) {
      const cheapestCost = validSingles[0].cost;
      const threshold = cheapestCost * 1.02; // 2% tolerance for avatar providers
      
      // Include all plans within 2% of cheapest cost
      for (const single of validSingles) {
        if (single.cost <= threshold) {
          combos.push({ plan: single.plan, accounts: 1 });
        }
      }
    }
    // Note: Combo creation removed - only single plans are used for avatars
  }

  return combos;
}

// Helper function to estimate voice agent cost
function estimateVoiceAgentCost(
  agent: VoiceAgent,
  accounts: number,
  minutesPerMonth: number,
  concurrentSessions: number
): number {
  const isCombo = agent.id.includes('+') || agent.name?.includes('combo');
  const factor = isCombo ? 1 : accounts;

  if (agent.pricingModel === 'tokens') {
    const tokensPerMinute = agent.tokensPerMinute || 1000;
    const totalTokens = minutesPerMonth * tokensPerMinute;
    const tokensInMillions = totalTokens / 1_000_000;
    const costUSD = tokensInMillions * (agent.pricePer1MTokens || 0);
    return convertUSDToINR(costUSD);
  } else if (agent.pricingModel === 'per-minute') {
    const minimumCostPerAccountUSD = agent.monthlyMinimumCost || agent.monthlyBaseCost || 0;
    if (isCombo) {
      const variableCostUSD = (agent.pricePerMinute || 0) * minutesPerMonth;
      const costUSD = Math.max(minimumCostPerAccountUSD, variableCostUSD);
      return convertUSDToINR(costUSD);
    } else {
      const perAccountMinutes = minutesPerMonth / factor;
      const variableCostPerAccountUSD = (agent.pricePerMinute || 0) * perAccountMinutes;
      const perAccountCostUSD = Math.max(minimumCostPerAccountUSD, variableCostPerAccountUSD);
      const costUSD = perAccountCostUSD * factor;
      return convertUSDToINR(costUSD);
    }
  } else if (agent.pricingModel === 'per-minute-per-concurrency') {
    const costUSD = (agent.pricePerMinute || 0) * minutesPerMonth * concurrentSessions;
    return convertUSDToINR(costUSD);
  }
  return 0;
}

// Helper function to check if voice agent meets concurrency requirement
function meetsVoiceConcurrencyRequirement(
  agent: VoiceAgent,
  accounts: number,
  requiredConcurrency: number
): boolean {
  if (agent.concurrency === undefined) return true; // Unlimited
  const isCombo = agent.id.includes('+') || agent.name?.includes('combo');
  const capacity = agent.concurrency * (isCombo ? 1 : accounts);
  return capacity >= requiredConcurrency;
}

// Helper to get tier order for Hume agents (lower tier = lower number)
function getHumeTierOrder(agentId: string): number {
  if (agentId.includes('hume-pro')) return 1;
  if (agentId.includes('hume-scale')) return 2;
  if (agentId.includes('hume-business')) return 3;
  return 999; // Other agents
}

// Helper to get tier order for avatar plans (lower tier = lower number)
function getAvatarTierOrder(tier: string): number {
  const tierOrder: { [key: string]: number } = {
    'Starter': 1,
    'Essential': 1,
    'Explorer': 2,
    'Growth': 3,
    'Pro': 4,
    'Business': 4,
    'Enterprise': 5,
    'Combo': 999, // Combos are handled separately
  };
  return tierOrder[tier] ?? 999;
}

function buildVoiceAgentCombos(input: BudgetInput, selectedVoiceAgentIds: string[] = []): { agent: VoiceAgent; accounts: number }[] {
  const combos: { agent: VoiceAgent; accounts: number; cost: number }[] = [];
  
  // Filter voice agents by selection
  let eligibleAgents = VOICE_AGENTS;
  if (selectedVoiceAgentIds.length > 0) {
    eligibleAgents = VOICE_AGENTS.filter((v) => {
      // If 'hume' is selected, include all hume agents (pro, scale, business, enterprise)
      if (selectedVoiceAgentIds.includes('hume') || selectedVoiceAgentIds.some(id => id.startsWith('hume-'))) {
        if (v.id.startsWith('hume-')) return true;
      }
      // If 'elevenlabs' is selected, include elevenlabs
      if (selectedVoiceAgentIds.includes('elevenlabs')) {
        if (v.id === 'elevenlabs') return true;
      }
      // Direct ID match (for backward compatibility)
      return selectedVoiceAgentIds.includes(v.id);
    });
  }

  const humeAgents = eligibleAgents.filter((v) => v.id.startsWith('hume-'));
  
  // Process non-Hume agents first (they don't have tiers, so include all that meet concurrency)
  for (const agent of eligibleAgents) {
    if (!agent.id.startsWith('hume-')) {
      const singleMeetsConcurrency = meetsVoiceConcurrencyRequirement(agent, 1, input.concurrentSessions);
      if (singleMeetsConcurrency) {
        const singleCost = estimateVoiceAgentCost(agent, 1, input.minutesPerMonth, input.concurrentSessions);
        combos.push({ agent, accounts: 1, cost: singleCost });
      }
    }
  }

  // Process Hume agents with tier-based filtering
  // Sort Hume agents by tier (Pro < Scale < Business)
  const sortedHumeAgents = [...humeAgents].sort((a, b) => getHumeTierOrder(a.id) - getHumeTierOrder(b.id));
  
  // Find all single agents that meet concurrency and calculate their costs
  const validSingles: { agent: VoiceAgent; cost: number; tier: number }[] = [];
  
  for (const agent of sortedHumeAgents) {
    const singleMeetsConcurrency = meetsVoiceConcurrencyRequirement(agent, 1, input.concurrentSessions);
    if (singleMeetsConcurrency) {
      const singleCost = estimateVoiceAgentCost(agent, 1, input.minutesPerMonth, input.concurrentSessions);
      const tier = getHumeTierOrder(agent.id);
      validSingles.push({ agent, cost: singleCost, tier });
    }
  }

  // Find the cheapest cost
  let cheapestSingleCost = Infinity;
  let lowestTierSingle: { agent: VoiceAgent; cost: number; tier: number } | null = null;
  
  if (validSingles.length > 0) {
    // Sort by cost, then by tier (prefer lower tier if costs are similar)
    validSingles.sort((a, b) => {
      if (Math.abs(a.cost - b.cost) < 0.01) { // Costs are essentially equal (within 1 paisa)
        return a.tier - b.tier; // Prefer lower tier
      }
      return a.cost - b.cost; // Prefer cheaper
    });
    
    cheapestSingleCost = validSingles[0].cost;
    lowestTierSingle = validSingles[0];
    
    // Include all agents that are:
    // 1. The cheapest option, OR
    // 2. Within 1% of cheapest (include both if costs are very similar)
    const threshold = cheapestSingleCost * 1.01; // 1% tolerance
    
    for (const single of validSingles) {
      // Include if it's within 1% of the cheapest cost
      if (single.cost <= threshold) {
        combos.push({ agent: single.agent, accounts: 1, cost: single.cost });
      }
    }
  }

  // Note: Combo creation removed for Hume - only single agents are used

  // Remove cost property before returning (it was just for comparison)
  return combos.map(({ cost, ...rest }) => rest);
}

