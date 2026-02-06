'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Combination, getCostBreakdownForInput } from '@/lib/calculator';
import type { BudgetInput } from '@/lib/calculator';
import ResultsDisplay from '@/components/ResultsDisplay';
import { ArrowLeft } from 'lucide-react';
import { calculateLatency, calculateQuality } from '@/lib/qualityLatency';
import { convertINRToUSD, convertUSDToINR } from '@/lib/pricing';

export default function ResultsPage() {
  const router = useRouter();
  const [results, setResults] = useState<Combination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [input, setInput] = useState<any>(null);

  useEffect(() => {
    // Read results from localStorage
    const storedResults = localStorage.getItem('calculationResults');
    const calculationInput = localStorage.getItem('calculationInput');
    
    if (storedResults && calculationInput) {
      try {
        const parsedResults: Combination[] = JSON.parse(storedResults);
        const input = JSON.parse(calculationInput);
        
        // Recalculate scores for all results (in case they were calculated with old formula)
        const resultsWithRecalculatedScores = parsedResults.map(combo => {
          // Recalculate score using current formula
          let score = 0;
          
          // Avatar provider bonuses
          const avatarProvider = combo.avatarPlan.provider.toLowerCase();
          if (avatarProvider === 'tavus') {
            score += 100;
          } else if (avatarProvider === 'anam') {
            score += 90;
          } else if (avatarProvider === 'heygen') {
            score += 78;
          }
          
          // Voice agent bonuses
          if (combo.voiceAgent) {
            const voiceId = combo.voiceAgent.id.toLowerCase();
            if (voiceId.includes('hume')) {
              score += 100;
            } else if (voiceId.includes('elevenlabs')) {
              score += 70;
            }
          }
          
          // Avatar concurrency check
          const isAvatarCombo = combo.avatarPlan.tier === 'Combo' || combo.avatarPlan.id.includes('+');
          const avatarConcurrencyLimit = combo.avatarPlan.concurrency !== undefined
            ? combo.avatarPlan.concurrency * (isAvatarCombo ? 1 : combo.avatarAccounts)
            : undefined;
          if (avatarConcurrencyLimit === undefined || input.concurrentSessions <= avatarConcurrencyLimit) {
            score += 100;
          }
          
          // Voice agent concurrency check
          const isVoiceCombo = combo.voiceAgent ? combo.voiceAgent.id.includes('+') || combo.voiceAgent.name?.includes('combo') : false;
          if (combo.voiceAgent && combo.voiceAgent.concurrency) {
            const voiceConcurrencyLimit = combo.voiceAgent.concurrency * (isVoiceCombo ? 1 : combo.voiceAccounts);
            if (input.concurrentSessions <= voiceConcurrencyLimit) {
              score += 100;
            }
          }
          
          // Account penalties
          if (combo.avatarAccounts > 1) score -= 25 * (combo.avatarAccounts - 1);
          if (combo.voiceAccounts > 1) score -= 25 * (combo.voiceAccounts - 1);
          
          // Quality score
          const quality = calculateQuality(combo, input.users || 100, input.concurrentSessions || 10);
          score += quality.overallQualityScore * 100;
          
          return { ...combo, score };
        });
        
        setResults(resultsWithRecalculatedScores);
      } catch (error) {
        console.error('Error parsing results:', error);
      }
    } else if (storedResults) {
      try {
        const parsedResults = JSON.parse(storedResults);
        setResults(parsedResults);
      } catch (error) {
        console.error('Error parsing results:', error);
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Get input data for quality/latency calculations
    const calculationInput = localStorage.getItem('calculationInput');
    if (calculationInput) {
      try {
        setInput(JSON.parse(calculationInput));
      } catch (error) {
        console.error('Error parsing calculation input:', error);
      }
    }
  }, []);

  const users = input?.users || 100;

  // Slider state (minutes per user, concurrency) — drives dynamic calculations; initialized to average when input loads
  const [sliderMinutesPerUser, setSliderMinutesPerUser] = useState(30);
  const [sliderConcurrency, setSliderConcurrency] = useState(5);
  const initialSliderSet = useRef(false);
  useEffect(() => {
    if (input && !initialSliderSet.current) {
      initialSliderSet.current = true;
      const minM = input.minMinutesPerUser ?? 10;
      const maxM = input.maxMinutesPerUser ?? 50;
      const c5 = input.concurrentSessions5Percent ?? 0;
      const c10 = input.concurrentSessions10Percent ?? 10;
      setSliderMinutesPerUser(Math.round((minM + maxM) / 2));
      setSliderConcurrency(Math.round((c5 + c10) / 2));
    }
  }, [input]);

  // Slider input: BudgetInput built from calculation input + current slider values (for dynamic cost/latency)
  const sliderInput = useMemo((): BudgetInput | null => {
    if (!input || !results.length) return null;
    const u = input.users ?? 100;
    const minutesPerMonth = Math.round(u * 0.5 * 24 * sliderMinutesPerUser);
    return {
      ...input,
      users: u,
      minutesPerMonth,
      concurrentSessions: sliderConcurrency,
      storageNumberOfDatabases: input.storageNumberOfDatabases ?? 1,
      storageTotalSizeGB: input.storageTotalSizeGB ?? 1000,
      storageTierAllocation: input.storageTierAllocation ?? { hot: 600, cold: 300, archive: 100 },
    } as BudgetInput;
  }, [input, sliderMinutesPerUser, sliderConcurrency, results.length]);

  // Fixed metrics (range) — from original results at average; do NOT change with slider
  const fixedMetrics = useMemo(() => {
    if (results.length === 0) {
      return { totalMin: 0, totalMax: 0, qualityMin: 0, qualityMax: 0 };
    }
    const totalCosts = results.map(r => r.breakdown.totalCostINR);
    const totalMin = Math.min(...totalCosts);
    const totalMax = Math.max(...totalCosts);
    const qualities = results.map(r => {
      const quality = calculateQuality(r, users, input?.concurrentSessions ?? 10);
      return quality.overallQualityScore;
    });
    return {
      totalMin,
      totalMax,
      qualityMin: Math.min(...qualities),
      qualityMax: Math.max(...qualities),
    };
  }, [results, users, input?.concurrentSessions]);

  // Dynamic metrics (average cost, average latency) — recompute when slider changes
  const dynamicMetrics = useMemo(() => {
    if (results.length === 0 || !sliderInput) {
      return { averageCost: 0, averageLatency: 0 };
    }
    const costsINR = results.map(r => {
      const b = getCostBreakdownForInput(r, sliderInput);
      return convertUSDToINR(b.totalCostUSD);
    });
    const averageCost = costsINR.reduce((a, b) => a + b, 0) / costsINR.length;
    const latencies = results.map(r => calculateLatency(r, users, sliderConcurrency).p95Latency);
    const averageLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    return { averageCost, averageLatency };
  }, [results, sliderInput, users, sliderConcurrency]);

  const handleBack = () => {
    router.push('/');
  };

  const formatINR = (amount: number) => `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const formatUSD = (amount: number) => `$${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

  if (isLoading) {
    return (
      <div className="min-h-screen relative bg-[#E5DDD1] overflow-hidden">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010101] mx-auto mb-4"></div>
            <p className="text-[#010101]">Loading results...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative bg-[#E5DDD1] overflow-hidden">
      {/* Pixel Grid Background */}
      <div 
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage: `
            linear-gradient(to right, #F9F4EE 1px, transparent 1px),
            linear-gradient(to bottom, #F9F4EE 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px'
        }}
      />
      
      {/* Random pixel accents */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute w-8 h-8 bg-[#D4CCC0]" style={{ top: '8%', left: '5%' }} />
        <div className="absolute w-8 h-8 bg-[#D4CCC0]" style={{ top: '12%', right: '8%' }} />
        <div className="absolute w-8 h-8 bg-[#D4CCC0]" style={{ top: '85%', left: '15%' }} />
        <div className="absolute w-8 h-8 bg-[#D4CCC0]" style={{ top: '88%', right: '12%' }} />
        <div className="absolute w-8 h-8 bg-[#D4CCC0]" style={{ top: '45%', left: '3%' }} />
        <div className="absolute w-8 h-8 bg-[#D4CCC0]" style={{ top: '50%', right: '4%' }} />
      </div>

      {/* Main Content */}
      <main className="relative z-10 min-h-screen px-8 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Back Button and Heading */}
          <div className="mb-8 flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 rounded-lg hover:bg-white/50 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-6 h-6 text-[#010101]" />
            </button>
            <motion.h1 
              className="text-7xl lg:text-6xl font-black text-[#010101] tracking-tight"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              RESULTS
            </motion.h1>
          </div>

          {/* Top Full-Width Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 mb-6 shadow-sm border border-white/50">
            <div className="flex items-center justify-between divide-x divide-[#D4CCC0]/30">
              {/* Total Architectures */}
              <div className="flex-1 px-6 first:pl-0">
                <h3 className="text-sm font-bold text-[#010101]/60 tracking-wide mb-2" style={{ fontFamily: 'Avenir' }}>
                  TOTAL ARCHITECTURES
                </h3>
                <div className="text-lg font-bold text-[#010101]">
                  {results.length}
                </div>
              </div>

              {/* Average Cost (dynamic: updates with slider) */}
              <div className="flex-1 px-6">
                <h3 className="text-sm font-bold text-[#010101]/60 tracking-wide mb-2" style={{ fontFamily: 'Avenir' }}>
                  AVERAGE COST
                </h3>
                <div className="text-lg font-bold text-[#010101]">
                  {formatUSD(convertINRToUSD(dynamicMetrics.averageCost))}
                </div>
                <div className="text-sm text-[#010101]/60">
                  {formatINR(dynamicMetrics.averageCost)}
                </div>
              </div>

              {/* Average Latency (dynamic: updates with slider) */}
              <div className="flex-1 px-6">
                <h3 className="text-sm font-bold text-[#010101]/60 tracking-wide mb-2" style={{ fontFamily: 'Avenir' }}>
                  AVERAGE LATENCY
                </h3>
                <div className="text-lg font-bold text-[#010101]">
                  {Math.round(dynamicMetrics.averageLatency)}ms
                </div>
              </div>

              {/* Quality Range (fixed: does not change with slider) */}
              <div className="flex-1 px-6">
                <h3 className="text-sm font-bold text-[#010101]/60 tracking-wide mb-2" style={{ fontFamily: 'Avenir' }}>
                  QUALITY RANGE
                </h3>
                <div className="text-lg font-bold text-[#010101]">
                  {fixedMetrics.qualityMin.toFixed(1)} - {fixedMetrics.qualityMax.toFixed(1)}
                </div>
              </div>

              {/* Total Cost Range (fixed: does not change with slider) */}
              <div className="flex-1 px-6 last:pr-0">
                <h3 className="text-sm font-bold text-[#010101]/60 tracking-wide mb-2" style={{ fontFamily: 'Avenir' }}>
                  TOTAL COST RANGE
                </h3>
                <div className="text-lg font-bold text-[#010101]">
                  {formatUSD(convertINRToUSD(fixedMetrics.totalMin))} - {formatUSD(convertINRToUSD(fixedMetrics.totalMax))}
                </div>
                <div className="text-sm text-[#010101]/60">
                  {formatINR(fixedMetrics.totalMin)} - {formatINR(fixedMetrics.totalMax)}
                </div>
              </div>
            </div>
          </div>

          {/* Sliders Card - Minutes per user & Concurrency (drives dynamic cost/latency) */}
          <SlidersCard
            input={input}
            minutesPerUser={sliderMinutesPerUser}
            concurrency={sliderConcurrency}
            onMinutesPerUserChange={setSliderMinutesPerUser}
            onConcurrencyChange={setSliderConcurrency}
          />

          {/* Sort Options */}
          <SortOptions results={results} setResults={setResults} users={users} concurrentSessions={sliderConcurrency} />

          {/* Results Display (amounts and charts use slider input when set) */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-sm border border-white/50">
            <ResultsDisplay
              results={results}
              isCalculating={false}
              users={users}
              concurrentSessions={sliderConcurrency}
              calculationInput={input}
              sliderInput={sliderInput}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

// Sliders Card - Minutes per user & Concurrency (above Sort); controlled by parent for dynamic results
function SlidersCard({
  input,
  minutesPerUser,
  concurrency,
  onMinutesPerUserChange,
  onConcurrencyChange,
}: {
  input: any;
  minutesPerUser: number;
  concurrency: number;
  onMinutesPerUserChange: (v: number) => void;
  onConcurrencyChange: (v: number) => void;
}) {
  const minMinutesPerUser = input?.minMinutesPerUser ?? 10;
  const maxMinutesPerUser = input?.maxMinutesPerUser ?? 50;
  const concurrency5 = input?.concurrentSessions5Percent ?? 0;
  const concurrency10 = input?.concurrentSessions10Percent ?? 10;

  const avgMinutesPerUser = Math.round((minMinutesPerUser + maxMinutesPerUser) / 2);
  const avgConcurrency = Math.round((concurrency5 + concurrency10) / 2);

  const minutesRange = Math.max(maxMinutesPerUser - minMinutesPerUser, 1);
  const concurrencyRange = Math.max(concurrency10 - concurrency5, 1);
  const minutesPercent = ((minutesPerUser - minMinutesPerUser) / minutesRange) * 100;
  const concurrencyPercent = ((concurrency - concurrency5) / concurrencyRange) * 100;
  const avgMinutesPercent = ((avgMinutesPerUser - minMinutesPerUser) / minutesRange) * 100;
  const avgConcurrencyPercent = ((avgConcurrency - concurrency5) / concurrencyRange) * 100;

  // Fill from average: segment between thumb and avg (so fill starts at avg, not at left)
  const minutesFillStart = minutesPerUser >= avgMinutesPerUser ? avgMinutesPercent : minutesPercent;
  const minutesFillWidth = Math.abs(minutesPercent - avgMinutesPercent);
  const concurrencyFillStart = concurrency >= avgConcurrency ? avgConcurrencyPercent : concurrencyPercent;
  const concurrencyFillWidth = Math.abs(concurrencyPercent - avgConcurrencyPercent);

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 mb-6 shadow-sm border border-white/50">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-6">
        {/* Column 1: Minutes per user */}
        <div className="mb-2">
          <h3 className="text-base font-bold text-[#010101] mb-4" style={{ fontFamily: 'Avenir' }}>
            Minutes per user
          </h3>
          <div className="relative">
            {/* MIN / AVG / MAX above slider */}
            <div className="relative flex justify-between mb-1.5 text-xs font-semibold uppercase tracking-wider text-[#4F4F4E]">
              <span>MIN</span>
              <span className="absolute" style={{ left: `${avgMinutesPercent}%`, transform: 'translateX(-50%)' }}>AVG</span>
              <span>MAX</span>
            </div>
            <div
              className="tier-slider-container slider-fill-from-avg relative"
              style={
                {
                  '--slider-fill-start': `${minutesFillStart}%`,
                  '--slider-fill-width': `${minutesFillWidth}%`,
                } as React.CSSProperties
              }
            >
              <div
                className="absolute w-px bg-[#010101]/50 z-[2] pointer-events-none"
                style={{
                  left: `${avgMinutesPercent}%`,
                  transform: 'translateX(-50%)',
                  top: '-6px',
                  height: '18px',
                }}
                aria-hidden
              />
              <input
                type="range"
                min={minMinutesPerUser}
                max={maxMinutesPerUser}
                value={minutesPerUser}
                onChange={(e) => onMinutesPerUserChange(Number(e.target.value))}
                className="tier-slider w-full appearance-none cursor-pointer relative z-10"
                style={{ background: 'transparent', height: '6px' }}
              />
            </div>
            <div className="relative flex justify-between mt-1 text-xs text-[#4F4F4E]">
              <span>{minMinutesPerUser}</span>
              <span className="absolute text-base font-bold text-[#010101]" style={{ left: `${minutesPercent}%`, transform: 'translateX(-50%)' }}>
                {minutesPerUser}
              </span>
              <span>{maxMinutesPerUser}</span>
            </div>
          </div>
        </div>

        {/* Column 2: Concurrency */}
        <div className="mb-2">
          <h3 className="text-base font-bold text-[#010101] mb-4" style={{ fontFamily: 'Avenir' }}>
            Concurrency
          </h3>
          <div className="relative">
            <div className="relative flex justify-between mb-1.5 text-xs font-semibold uppercase tracking-wider text-[#4F4F4E]">
              <span>5%</span>
              <span className="absolute" style={{ left: `${avgConcurrencyPercent}%`, transform: 'translateX(-50%)' }}>AVG</span>
              <span>10%</span>
            </div>
            <div
              className="tier-slider-container slider-fill-from-avg relative"
              style={
                {
                  '--slider-fill-start': `${concurrencyFillStart}%`,
                  '--slider-fill-width': `${concurrencyFillWidth}%`,
                } as React.CSSProperties
              }
            >
              <div
                className="absolute w-px bg-[#010101]/50 z-[2] pointer-events-none"
                style={{
                  left: `${avgConcurrencyPercent}%`,
                  transform: 'translateX(-50%)',
                  top: '-6px',
                  height: '18px',
                }}
                aria-hidden
              />
              <input
                type="range"
                min={concurrency5}
                max={concurrency10}
                value={concurrency}
                onChange={(e) => onConcurrencyChange(Number(e.target.value))}
                className="tier-slider w-full appearance-none cursor-pointer relative z-10"
                style={{ background: 'transparent', height: '6px' }}
              />
            </div>
            <div className="relative flex justify-between mt-1 text-xs text-[#4F4F4E]">
              <span>{concurrency5}</span>
              <span className="absolute text-base font-bold text-[#010101]" style={{ left: `${concurrencyPercent}%`, transform: 'translateX(-50%)' }}>
                {concurrency}
              </span>
              <span>{concurrency10}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sort Options Component
function SortOptions({ results, setResults, users, concurrentSessions }: { results: Combination[]; setResults: (results: Combination[]) => void; users: number; concurrentSessions: number }) {
  const [sortBy, setSortBy] = useState<'cost' | 'recommendations'>('cost');
  
  const applySort = (type: 'cost' | 'recommendations', data: Combination[]) => {
    let sorted = [...data];
    
    if (type === 'cost') {
      // Sort by cost (ascending - lowest first)
      sorted.sort((a, b) => a.breakdown.totalCostINR - b.breakdown.totalCostINR);
      console.log('Cost sort - First 3 costs:', sorted.slice(0, 3).map(r => r.breakdown.totalCostINR));
    } else if (type === 'recommendations') {
      // Sort by recommendations (purely based on score - highest score first)
      console.log('Before sort - First 3 scores:', sorted.slice(0, 3).map(r => ({ id: r.id.substring(0, 30), score: r.score, provider: r.avatarPlan.provider })));
      sorted.sort((a, b) => {
        const diff = b.score - a.score;
        if (diff === 0) {
          // If scores are equal, sort by cost as tiebreaker
          return a.breakdown.totalCostINR - b.breakdown.totalCostINR;
        }
        return diff;
      });
      console.log('After sort - First 3 scores:', sorted.slice(0, 3).map(r => ({ id: r.id.substring(0, 30), score: r.score, provider: r.avatarPlan.provider })));
    }
    
    return sorted;
  };
  
  const handleSort = (type: 'cost' | 'recommendations') => {
    console.log('handleSort called with type:', type);
    console.log('Current results length:', results.length);
    setSortBy(type);
    const sorted = applySort(type, results);
    console.log('Setting sorted results, length:', sorted.length);
    // Force a new array reference to ensure React detects the change
    setResults([...sorted]);
  };
  

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 mb-6 shadow-sm border border-white/50">
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold text-[#010101]" style={{ fontFamily: 'Avenir' }}>
          Sort by:
        </span>
        <button
          onClick={() => handleSort('cost')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            sortBy === 'cost'
              ? 'bg-[#010101] text-white'
              : 'bg-[#F9F4EE] text-[#010101] border border-[#E5DDD1] hover:border-[#010101]'
          }`}
        >
          Cost Rank
        </button>
        <button
          onClick={() => handleSort('recommendations')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            sortBy === 'recommendations'
              ? 'bg-[#010101] text-white'
              : 'bg-[#F9F4EE] text-[#010101] border border-[#E5DDD1] hover:border-[#010101]'
          }`}
        >
          Recommendations
        </button>
      </div>
    </div>
  );
}
