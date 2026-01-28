'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Combination } from '@/lib/calculator';
import ResultsDisplay from '@/components/ResultsDisplay';
import { ArrowLeft } from 'lucide-react';
import { calculateLatency, calculateQuality } from '@/lib/qualityLatency';
import { convertINRToUSD } from '@/lib/pricing';

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
          if (avatarProvider === 'tevus') {
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
            } else if (voiceId.includes('gemini')) {
              score += 70;
            } else if (voiceId.includes('gpt')) {
              score += 10;
            } else if (voiceId.includes('grok')) {
              score += 5;
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
  const concurrentSessions = input?.concurrentSessions || 10;

  // Calculate metrics
  const metrics = useMemo(() => {
    if (results.length === 0) {
      return {
        totalMin: 0,
        totalMax: 0,
        averageCost: 0,
        averageLatency: 0,
        qualityMin: 0,
        qualityMax: 0,
      };
    }
    const totalCosts = results.map(r => r.breakdown.totalCostINR);
    const totalMin = totalCosts.length > 0 ? Math.min(...totalCosts) : 0;
    const totalMax = totalCosts.length > 0 ? Math.max(...totalCosts) : 0;
    const averageCost = totalCosts.length > 0 ? totalCosts.reduce((a, b) => a + b, 0) / totalCosts.length : 0;
    
    // Calculate average latency and quality range
    const latencies = results.map(r => {
      const latency = calculateLatency(r, users, concurrentSessions);
      return latency.p95Latency;
    });
    const averageLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    
    const qualities = results.map(r => {
      const quality = calculateQuality(r, users, concurrentSessions);
      return quality.overallQualityScore;
    });
    const qualityMin = qualities.length > 0 ? Math.min(...qualities) : 0;
    const qualityMax = qualities.length > 0 ? Math.max(...qualities) : 0;
    
    return {
      totalMin,
      totalMax,
      averageCost,
      averageLatency,
      qualityMin,
      qualityMax,
    };
  }, [results, users, concurrentSessions]);

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

              {/* Average Cost */}
              <div className="flex-1 px-6">
                <h3 className="text-sm font-bold text-[#010101]/60 tracking-wide mb-2" style={{ fontFamily: 'Avenir' }}>
                  AVERAGE COST
                </h3>
                <div className="text-lg font-bold text-[#010101]">
                  {formatUSD(convertINRToUSD(metrics.averageCost))}
                </div>
                <div className="text-sm text-[#010101]/60">
                  {formatINR(metrics.averageCost)}
                </div>
              </div>

              {/* Average Latency */}
              <div className="flex-1 px-6">
                <h3 className="text-sm font-bold text-[#010101]/60 tracking-wide mb-2" style={{ fontFamily: 'Avenir' }}>
                  AVERAGE LATENCY
                </h3>
                <div className="text-lg font-bold text-[#010101]">
                  {Math.round(metrics.averageLatency)}ms
                </div>
              </div>

              {/* Quality Range */}
              <div className="flex-1 px-6">
                <h3 className="text-sm font-bold text-[#010101]/60 tracking-wide mb-2" style={{ fontFamily: 'Avenir' }}>
                  QUALITY RANGE
                </h3>
                <div className="text-lg font-bold text-[#010101]">
                  {metrics.qualityMin.toFixed(1)} - {metrics.qualityMax.toFixed(1)}
                </div>
              </div>

              {/* Total Cost Range */}
              <div className="flex-1 px-6 last:pr-0">
                <h3 className="text-sm font-bold text-[#010101]/60 tracking-wide mb-2" style={{ fontFamily: 'Avenir' }}>
                  TOTAL COST RANGE
                </h3>
                <div className="text-lg font-bold text-[#010101]">
                  {formatUSD(convertINRToUSD(metrics.totalMin))} - {formatUSD(convertINRToUSD(metrics.totalMax))}
                </div>
                <div className="text-sm text-[#010101]/60">
                  {formatINR(metrics.totalMin)} - {formatINR(metrics.totalMax)}
                </div>
              </div>
            </div>
          </div>

          {/* Sort Options */}
          <SortOptions results={results} setResults={setResults} users={users} concurrentSessions={concurrentSessions} />

          {/* Results Display */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-sm border border-white/50">
            <ResultsDisplay results={results} isCalculating={false} users={users} concurrentSessions={concurrentSessions} />
          </div>
        </div>
      </main>
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
