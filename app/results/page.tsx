'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Combination,
  getCostBreakdownForInput,
  getPricedCombinations,
} from '@/lib/calculator';
import type { BudgetInput } from '@/lib/calculator';
import ResultsDisplay from '@/components/ResultsDisplay';
import { ArrowLeft } from 'lucide-react';
import { convertUSDToINR } from '@/lib/pricing';
import { lookRecommendationScore } from '@/lib/qualityLatency';

export default function ResultsPage() {
  const router = useRouter();
  const [results, setResults] = useState<Combination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [input, setInput] = useState<BudgetInput | null>(null);

  useEffect(() => {
    const storedResults = localStorage.getItem('calculationResults');
    const calculationInput = localStorage.getItem('calculationInput');

    if (storedResults) {
      try {
        const parsedResults: Combination[] = JSON.parse(storedResults);
        setResults(parsedResults);
      } catch (error) {
        console.error('Error parsing results:', error);
      }
    }
    if (calculationInput) {
      try {
        setInput(JSON.parse(calculationInput));
      } catch (error) {
        console.error('Error parsing calculation input:', error);
      }
    }
    setIsLoading(false);
  }, []);

  const [sliderImages, setSliderImages] = useState(1000);
  const [sliderModels, setSliderModels] = useState(200);
  const initialSliderSet = useRef(false);

  useEffect(() => {
    if (input && !initialSliderSet.current) {
      initialSliderSet.current = true;
      setSliderImages(input.imagesPerMonth);
      setSliderModels(input.modelsPerMonth);
    }
  }, [input]);

  const sliderInput = useMemo((): BudgetInput | null => {
    if (!input || !results.length) return null;
    return {
      ...input,
      imagesPerMonth: sliderImages,
      modelsPerMonth: sliderModels,
    };
  }, [input, sliderImages, sliderModels, results.length]);

  const priced = useMemo(() => getPricedCombinations(results), [results]);

  const fixedMetrics = useMemo(() => {
    if (priced.length === 0) {
      return { totalMin: 0, totalMax: 0, cheapest: 0 };
    }
    const totals = priced.map((r) => r.breakdown.totalCostUSD);
    return {
      totalMin: Math.min(...totals),
      totalMax: Math.max(...totals),
      cheapest: Math.min(...totals),
    };
  }, [priced]);

  const dynamicMetrics = useMemo(() => {
    if (priced.length === 0 || !sliderInput) {
      return {
        averageCostUSD: 0,
        aiPerImage: 0,
        aiPerModel: 0,
        infraShare: 0,
      };
    }
    const costs = priced.map((r) => getCostBreakdownForInput(r, sliderInput).totalCostUSD);
    const averageCostUSD = costs.reduce((a, b) => a + b, 0) / costs.length;

    const sample = getCostBreakdownForInput(priced[0], sliderInput);
    const effectiveImages = sliderInput.imagesPerMonth * (1 + sliderInput.imageRetryFraction);
    const effectiveModels = sliderInput.modelsPerMonth * (1 + sliderInput.modelRetryFraction);
    const aiPerImage = effectiveImages > 0 ? sample.imageCostUSD / effectiveImages : 0;
    const aiPerModel = effectiveModels > 0 ? sample.threeDCostUSD / effectiveModels : 0;
    const infraShare =
      sample.totalCostUSD > 0 ? (sample.llmPlusInfraCostUSD / sample.totalCostUSD) * 100 : 0;

    return { averageCostUSD, aiPerImage, aiPerModel, infraShare };
  }, [priced, sliderInput]);

  const handleBack = () => {
    router.push('/');
  };

  const formatINR = (amount: number) =>
    `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const formatUSD = (amount: number) =>
    `$${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

  const fx = input?.usdToInr ?? 85;

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
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage: `
            linear-gradient(to right, #F9F4EE 1px, transparent 1px),
            linear-gradient(to bottom, #F9F4EE 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
        }}
      />

      <div className="absolute inset-0 opacity-30">
        <div className="absolute w-8 h-8 bg-[#D4CCC0]" style={{ top: '8%', left: '5%' }} />
        <div className="absolute w-8 h-8 bg-[#D4CCC0]" style={{ top: '12%', right: '8%' }} />
        <div className="absolute w-8 h-8 bg-[#D4CCC0]" style={{ top: '85%', left: '15%' }} />
        <div className="absolute w-8 h-8 bg-[#D4CCC0]" style={{ top: '88%', right: '12%' }} />
        <div className="absolute w-8 h-8 bg-[#D4CCC0]" style={{ top: '45%', left: '3%' }} />
        <div className="absolute w-8 h-8 bg-[#D4CCC0]" style={{ top: '50%', right: '4%' }} />
      </div>

      <main className="relative z-10 min-h-screen px-8 py-8">
        <div className="max-w-7xl mx-auto">
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

          {/* Summary bar */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 mb-6 shadow-sm border border-white/50">
            <div className="flex items-center justify-between divide-x divide-[#D4CCC0]/30">
              <div className="flex-1 px-6 first:pl-0">
                <h3
                  className="text-sm font-bold text-[#010101]/60 tracking-wide mb-2"
                  style={{
                    fontFamily:
                      'Avenir, var(--font-app), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  }}
                >
                  COMBINATIONS
                </h3>
                <div className="text-lg font-bold text-[#010101]">{results.length}</div>
                <div className="text-sm text-[#010101]/60">{priced.length} priced</div>
              </div>

              <div className="flex-1 px-6">
                <h3
                  className="text-sm font-bold text-[#010101]/60 tracking-wide mb-2"
                  style={{
                    fontFamily:
                      'Avenir, var(--font-app), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  }}
                >
                  AVERAGE COST
                </h3>
                <div className="text-lg font-bold text-[#010101]">
                  {formatUSD(dynamicMetrics.averageCostUSD)}
                </div>
                <div className="text-sm text-[#010101]/60">
                  {formatINR(convertUSDToINR(dynamicMetrics.averageCostUSD, fx))}
                </div>
              </div>

              <div className="flex-1 px-6">
                <h3
                  className="text-sm font-bold text-[#010101]/60 tracking-wide mb-2"
                  style={{
                    fontFamily:
                      'Avenir, var(--font-app), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  }}
                >
                  AI $/IMAGE
                </h3>
                <div className="text-lg font-bold text-[#010101]">
                  {formatUSD(dynamicMetrics.aiPerImage)}
                </div>
              </div>

              <div className="flex-1 px-6">
                <h3
                  className="text-sm font-bold text-[#010101]/60 tracking-wide mb-2"
                  style={{
                    fontFamily:
                      'Avenir, var(--font-app), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  }}
                >
                  AI $/3D MODEL
                </h3>
                <div className="text-lg font-bold text-[#010101]">
                  {formatUSD(dynamicMetrics.aiPerModel)}
                </div>
              </div>

              <div className="flex-1 px-6 last:pr-0">
                <h3
                  className="text-sm font-bold text-[#010101]/60 tracking-wide mb-2"
                  style={{
                    fontFamily:
                      'Avenir, var(--font-app), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  }}
                >
                  COST RANGE
                </h3>
                <div className="text-lg font-bold text-[#010101]">
                  {priced.length > 0
                    ? `${formatUSD(fixedMetrics.totalMin)} – ${formatUSD(fixedMetrics.totalMax)}`
                    : '—'}
                </div>
                <div className="text-sm text-[#010101]/60">
                  Infra+LLM share ~{dynamicMetrics.infraShare.toFixed(0)}%
                </div>
              </div>
            </div>
          </div>

          <SlidersCard
            input={input}
            images={sliderImages}
            models={sliderModels}
            onImagesChange={setSliderImages}
            onModelsChange={setSliderModels}
          />

          <SortOptions results={results} setResults={setResults} />

          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-sm border border-white/50">
            <ResultsDisplay
              results={results}
              isCalculating={false}
              calculationInput={input}
              sliderInput={sliderInput}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function sliderProgress(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

function VolumeSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const progress = sliderProgress(value, min, max);
  const step = Math.max(1, Math.round((max - min) / 200));

  return (
    <div className="rounded-2xl border border-[#E5DDD1] bg-[#F9F4EE]/70 px-5 py-4">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#4F4F4E] mb-1">
            {label}
          </p>
          <p className="text-2xl font-extrabold tabular-nums text-[#010101] leading-none">
            {value.toLocaleString()}
          </p>
        </div>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isNaN(n)) return;
            onChange(Math.min(max, Math.max(min, Math.round(n))));
          }}
          className="show-spinner w-28 px-2.5 py-1.5 rounded-lg border border-[#E5DDD1] bg-white text-sm font-semibold tabular-nums text-[#010101] text-right focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
          aria-label={`${label} exact value`}
        />
      </div>

      <div
        className="tier-slider-container results-volume-slider"
        style={{ ['--slider-progress' as string]: `${progress}%` }}
      >
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="tier-slider w-full"
          aria-label={label}
        />
      </div>

      <div className="mt-2.5 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-[#4F4F4E]">
        <span>{min.toLocaleString()}</span>
        <span className="text-[#010101]/50">{Math.round(progress)}%</span>
        <span>{max.toLocaleString()}</span>
      </div>
    </div>
  );
}

function SlidersCard({
  input,
  images,
  models,
  onImagesChange,
  onModelsChange,
}: {
  input: BudgetInput | null;
  images: number;
  models: number;
  onImagesChange: (v: number) => void;
  onModelsChange: (v: number) => void;
}) {
  const minImages = input?.minImagesPerMonth ?? 100;
  const maxImages = input?.maxImagesPerMonth ?? 5000;
  const minModels = input?.minModelsPerMonth ?? 50;
  const maxModels = input?.maxModelsPerMonth ?? 1000;

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-5 sm:p-6 mb-6 shadow-sm border border-white/50">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#4F4F4E] mb-3">
        Adjust volume · costs update live
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        <VolumeSlider
          label="Images per Month"
          value={images}
          min={minImages}
          max={maxImages}
          onChange={onImagesChange}
        />
        <VolumeSlider
          label="3D Models per Month"
          value={models}
          min={minModels}
          max={maxModels}
          onChange={onModelsChange}
        />
      </div>
    </div>
  );
}

function SortOptions({
  results,
  setResults,
}: {
  results: Combination[];
  setResults: (r: Combination[]) => void;
}) {
  const [sortMode, setSortMode] = useState<'cost' | 'recommendations'>('cost');

  useEffect(() => {
    if (sortMode === 'cost') {
      setResults(
        [...results].sort((a, b) => {
          if (a.isPriced !== b.isPriced) return a.isPriced ? -1 : 1;
          return a.totalCostUSD - b.totalCostUSD;
        })
      );
    } else {
      // Best look first: Image 50% + 3D 40% + LLM 10%; cost only breaks ties
      setResults(
        [...results].sort(
          (a, b) => lookRecommendationScore(b) - lookRecommendationScore(a)
        )
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortMode]);

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      <button
        type="button"
        onClick={() => setSortMode('cost')}
        className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
          sortMode === 'cost'
            ? 'bg-[#010101] text-white border-[#010101]'
            : 'bg-white/80 text-[#010101] border-[#E5DDD1] hover:border-[#010101]'
        }`}
      >
        Cost Rank
      </button>
      <button
        type="button"
        onClick={() => setSortMode('recommendations')}
        title="Ranks by visual look (image + 3D quality) over cost"
        className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
          sortMode === 'recommendations'
            ? 'bg-[#010101] text-white border-[#010101]'
            : 'bg-white/80 text-[#010101] border-[#E5DDD1] hover:border-[#010101]'
        }`}
      >
        Recommendations
      </button>
      {sortMode === 'recommendations' && (
        <span className="text-[11px] text-[#4F4F4E]">
          Best look · Image + 3D quality over cost
        </span>
      )}
    </div>
  );
}
