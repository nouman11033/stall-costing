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

export interface BudgetInput {
  monthlyBudgetINR: number;
  apiAllocationPercent: number; // Percentage for APIs (avatar + voice)
  hostingAllocationPercent: number; // Percentage for hosting
  users: number;
  concurrentSessions: number;
  minutesPerMonth: number;
  useVoiceAgent: boolean; // true = avatar + voice agent, false = avatar with inbuilt voice
  // Storage parameters
  storageTotalSizeGB: number;
  storageTierAllocation: TierAllocation;
  storageNumberOfDatabases: number;
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
  const apiBudgetINR = (input.monthlyBudgetINR * input.apiAllocationPercent) / 100;
  const hostingBudgetINR = (input.monthlyBudgetINR * input.hostingAllocationPercent) / 100;

  const avatarPlanCombos = buildAvatarPlanCombos(input);
  const voiceAgentCombos = buildVoiceAgentCombos(input);
  
  // Calculate storage costs for all 5 storage options
  const storageOptions = calculateStorageCosts(
    input.storageTotalSizeGB,
    input.storageTierAllocation,
    input.storageNumberOfDatabases
  );

  for (const avatarCombo of avatarPlanCombos) {
    for (const hostingOption of HOSTING_OPTIONS) {
      if (input.useVoiceAgent) {
        for (const voiceCombo of voiceAgentCombos) {
          // Multiply by 5 storage options
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
      } else {
        // Multiply by 5 storage options
        for (const storageOption of storageOptions) {
          const combination = calculateCombination(
            avatarCombo.plan,
            avatarCombo.accounts,
            undefined,
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
    }
  }

  // Filter out invalid combinations and rank
  return combinations
    .filter((c) => isValidCombination(c, input))
    .sort((a, b) => b.score - a.score);
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
      // Per-minute per concurrency pricing (Grok)
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

  // Check if fits budget
  // Must fit within total monthly budget AND individual allocations
  const apiCostINR = avatarCostINR + voiceCostINR;
  const fitsBudget = totalCostINR <= input.monthlyBudgetINR && 
                     apiCostINR <= apiBudgetINR && 
                     hostingCostINR <= hostingBudgetINR;

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

  // Calculate score (higher is better)
  // Factors: fits budget, cost efficiency, feature match
  let score = 0;
  if (fitsBudget) score += 1000;
  score -= totalCostINR / 100; // Lower cost = higher score
  if (avatarConcurrencyLimit === undefined || input.concurrentSessions <= avatarConcurrencyLimit) {
    score += 100;
  }
  if (voiceAgent && voiceAgent.concurrency && input.concurrentSessions <= voiceAgent.concurrency * (isVoiceCombo ? 1 : voiceAccounts)) {
    score += 100;
  }
  if (voiceAgent || avatarPlan.hasInbuiltVoice) score += 50;
  // Slight penalty for managing multiple accounts to avoid over-favoring splits
  if (avatarAccounts > 1) score -= 25 * (avatarAccounts - 1);
  if (voiceAccounts > 1) score -= 25 * (voiceAccounts - 1);

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

  // Check if plan has inbuilt voice when not using voice agent
  if (!input.useVoiceAgent && !combination.avatarPlan.hasInbuiltVoice) {
    return false;
  }

  return true;
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
  const eligible = AVATAR_PLANS.filter((p) => p.monthlyPrice > 0);

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

    // If we have valid single plans, include all within 2% of cheapest
    if (validSingles.length > 0) {
      const cheapestCost = validSingles[0].cost;
      const threshold = cheapestCost * 1.02; // 2% tolerance for avatar providers
      
      // Include all plans within 2% of cheapest cost
      for (const single of validSingles) {
        if (single.cost <= threshold) {
          combos.push({ plan: single.plan, accounts: 1 });
        }
      }

      // Only create combos if a combo might be cheaper than the cheapest single
      // We'll check each combo and only add it if it's actually cheaper
      // Enterprise plans cannot be used in combos
      for (let i = 0; i < plans.length; i++) {
        for (let j = i; j < plans.length; j++) {
          const a = plans[i];
          const b = plans[j];
          
          // Skip if either plan is an Enterprise plan (annual only)
          if (a.isAnnualOnly || b.isAnnualOnly || a.tier === 'Enterprise' || b.tier === 'Enterprise') {
            continue;
          }
          
          const sortedPlans = [a, b].sort((p1, p2) => p1.id.localeCompare(p2.id));
          const aggregated = aggregateAvatarPlans(sortedPlans);
          
          // Only include combo if it meets concurrency
          if (meetsConcurrencyRequirement(aggregated, 2, input.concurrentSessions)) {
            const comboCost = estimateAvatarCost(aggregated, 2, input.minutesPerMonth);
            
            // Only add if combo is more than 5% cheaper than cheapest single
            if (comboCost < cheapestCost * 0.95) {
              combos.push({ plan: aggregated, accounts: 2 });
            }
          }
        }
      }
    } else {
      // No single plan meets concurrency - we need combos
      // Enterprise plans cannot be used in combos
      for (let i = 0; i < plans.length; i++) {
        for (let j = i; j < plans.length; j++) {
          const a = plans[i];
          const b = plans[j];
          
          // Skip if either plan is an Enterprise plan (annual only)
          if (a.isAnnualOnly || b.isAnnualOnly || a.tier === 'Enterprise' || b.tier === 'Enterprise') {
            continue;
          }
          
          const sortedPlans = [a, b].sort((p1, p2) => p1.id.localeCompare(p2.id));
          const aggregated = aggregateAvatarPlans(sortedPlans);
          
          if (meetsConcurrencyRequirement(aggregated, 2, input.concurrentSessions)) {
            combos.push({ plan: aggregated, accounts: 2 });
          }
        }
      }
    }
  }

  return combos;
}

function aggregateAvatarPlans(plans: AvatarPlan[]): AvatarPlan {
  const provider = plans[0].provider;
  const id = plans.map((p) => p.id).join('+');
  const name = `${provider.toUpperCase()} combo: ${plans.map((p) => p.name).join(' + ')}`;
  const monthlyPrice = plans.reduce((sum, p) => sum + p.monthlyPrice, 0);
  const minutes = plans.reduce((sum, p) => sum + p.minutes, 0);
  const additionalPerMin = Math.min(...plans.map((p) => p.additionalPerMin));

  // Concurrency: if any is unlimited (undefined), keep undefined; else sum
  const hasUnlimited = plans.some((p) => p.concurrency === undefined);
  const concurrency = hasUnlimited
    ? undefined
    : plans.reduce((sum, p) => sum + (p.concurrency || 0), 0);

  const maxLength = plans.some((p) => p.maxLength === undefined)
    ? undefined
    : Math.max(...plans.map((p) => p.maxLength || 0));

  const hasInbuiltVoice = plans.every((p) => p.hasInbuiltVoice);

  // For combos, if any plan is annual-only, the combo is also annual-only
  const hasAnnualOnly = plans.some((p) => p.isAnnualOnly);
  const totalAnnualMinutes = hasAnnualOnly
    ? plans.reduce((sum, p) => sum + (p.totalAnnualMinutes || 0), 0)
    : undefined;
  const annualCommitmentUSD = hasAnnualOnly
    ? plans.reduce((sum, p) => sum + (p.annualCommitmentUSD || 0), 0)
    : undefined;
  const note = hasAnnualOnly
    ? plans.map((p) => p.note).filter(Boolean).join('; ')
    : undefined;

  return {
    id,
    name,
    provider,
    tier: 'Combo',
    monthlyPrice,
    minutes,
    maxLength,
    concurrency,
    additionalPerMin,
    hasInbuiltVoice,
    isAnnualOnly: hasAnnualOnly || undefined,
    annualCommitmentUSD,
    totalAnnualMinutes,
    note,
  };
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

function buildVoiceAgentCombos(input: BudgetInput): { agent: VoiceAgent; accounts: number }[] {
  const combos: { agent: VoiceAgent; accounts: number; cost: number }[] = [];
  
  // Only process voice agents if useVoiceAgent is true
  if (!input.useVoiceAgent) {
    return [];
  }

  const humeAgents = VOICE_AGENTS.filter((v) => v.id.startsWith('hume-'));
  
  // Process non-Hume agents first (they don't have tiers, so include all that meet concurrency)
  for (const agent of VOICE_AGENTS) {
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

  // For Hume combos, only create if:
  // 1. No single agent meets concurrency, OR
  // 2. Combo is cheaper than the cheapest single
  const needsCombo = lowestTierSingle === null;

  if (needsCombo || cheapestSingleCost !== Infinity) {
    for (let i = 0; i < sortedHumeAgents.length; i++) {
      for (let j = i; j < sortedHumeAgents.length; j++) {
        const a = sortedHumeAgents[i];
        const b = sortedHumeAgents[j];
        const sortedAgents = [a, b].sort((a1, a2) => a1.id.localeCompare(a2.id));
        const aggregated = aggregateHumeAgents(sortedAgents);
        
        const comboMeetsConcurrency = meetsVoiceConcurrencyRequirement(aggregated, 2, input.concurrentSessions);
        
        if (comboMeetsConcurrency) {
          const comboCost = estimateVoiceAgentCost(aggregated, 2, input.minutesPerMonth, input.concurrentSessions);
          
          // Only add combo if:
          // - No single agent meets concurrency, OR
          // - Combo is more than 5% cheaper than cheapest single
          if (needsCombo || comboCost < cheapestSingleCost * 0.95) {
            combos.push({ agent: aggregated, accounts: 2, cost: comboCost });
          }
        }
      }
    }
  }

  // Remove cost property before returning (it was just for comparison)
  return combos.map(({ cost, ...rest }) => rest);
}

function aggregateHumeAgents(agents: VoiceAgent[]): VoiceAgent {
  // All Hume plans are per-minute
  const id = agents.map((a) => a.id).join('+');
  const name = `Hume combo: ${agents.map((a) => a.name).join(' + ')}`;

  // Pricing: per-minute uses the minimum rate; minimum base cost sums
  const pricePerMinute = Math.min(...agents.map((a) => a.pricePerMinute || 0));
  const monthlyMinimumCost = agents
    .map((a) => a.monthlyMinimumCost || a.monthlyBaseCost || 0)
    .reduce((sum, v) => sum + v, 0);

  // Concurrency: if any unlimited, undefined else sum
  const hasUnlimited = agents.some((a) => a.concurrency === undefined);
  const concurrency = hasUnlimited
    ? undefined
    : agents.reduce((sum, a) => sum + (a.concurrency || 0), 0);

  return {
    id,
    name,
    pricingModel: 'per-minute',
    pricePerMinute,
    monthlyBaseCost: monthlyMinimumCost,
    monthlyMinimumCost,
    concurrency,
  };
}

