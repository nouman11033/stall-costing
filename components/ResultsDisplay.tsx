'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Combination,
  getCostBreakdownForInput,
  getFullBreakdownForInput,
} from '@/lib/calculator';
import type { BudgetInput } from '@/lib/calculator';
import { convertUSDToINR } from '@/lib/pricing';
import { calculateQuality } from '@/lib/qualityLatency';
import { AlertTriangle, Filter, X, Download } from 'lucide-react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import * as XLSX from 'xlsx';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ResultsDisplayProps {
  results: Combination[];
  isCalculating: boolean;
  calculationInput?: BudgetInput | null;
  sliderInput?: BudgetInput | null;
}

interface Filters {
  imageProviders: string[];
  imageModels: string[];
  threeDProviders: string[];
  threeDModels: string[];
  llmModels: string[];
}

const formatProviderName = (provider: string): string => {
  const map: Record<string, string> = {
    google: 'Google Gemini',
    bfl: 'Black Forest Labs',
    ideogram: 'Ideogram',
    openai: 'OpenAI',
    tripo: 'Tripo',
    meshy: 'Meshy',
    rodin: 'Rodin',
  };
  return map[provider.toLowerCase()] || provider;
};

type DisplayCurrency = 'USD' | 'INR';

const formatUSD = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatINR = (n: number) =>
  `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function formatMoney(
  usd: number,
  currency: DisplayCurrency,
  inrRate?: number
): string {
  if (currency === 'INR') return formatINR(convertUSDToINR(usd, inrRate));
  return formatUSD(usd);
}

const PIE_COLORS = {
  Image: '#010101',
  '3D': '#3B82F6',
  LLM: '#A855F7',
  Embeddings: '#F59E0B',
  Storage: '#EC4899',
  'Fixed Infra': '#6B7280',
  Margin: '#22C55E',
};

export default function ResultsDisplay({
  results,
  isCalculating,
  calculationInput,
  sliderInput,
}: ResultsDisplayProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    imageProviders: [],
    imageModels: [],
    threeDProviders: [],
    threeDModels: [],
    llmModels: [],
  });
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'all' | 'bookmarks'>('all');
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('USD');
  const bookmarkButtonRef = useRef<any>(null);
  const fxRate = calculationInput?.usdToInr ?? sliderInput?.usdToInr;

  useEffect(() => {
    const stored = localStorage.getItem('combinationBookmarks');
    if (stored) {
      try {
        setBookmarks(new Set(JSON.parse(stored)));
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('combinationBookmarks', JSON.stringify(Array.from(bookmarks)));
  }, [bookmarks]);

  useEffect(() => {
    if (bookmarkButtonRef.current) {
      const targetFrame = viewMode === 'bookmarks' ? 98 : 0;
      bookmarkButtonRef.current.stop();
      bookmarkButtonRef.current.setFrame(targetFrame);
      bookmarkButtonRef.current.pause();
    }
  }, [viewMode]);

  const filterOptions = useMemo(() => {
    const imageProviders = Array.from(new Set(results.map((r) => r.imagePlan.provider)));
    const imageModels = Array.from(new Set(results.map((r) => r.imagePlan.id)));
    const threeDProviders = Array.from(new Set(results.map((r) => r.threeDPlan.provider)));
    const threeDModels = Array.from(new Set(results.map((r) => r.threeDPlan.id)));
    const llmModels = Array.from(
      new Set(results.map((r) => r.llmModel?.id || r.llmModelName).filter(Boolean) as string[])
    );
    return { imageProviders, imageModels, threeDProviders, threeDModels, llmModels };
  }, [results]);

  const filteredResults = useMemo(() => {
    let filtered = results.filter((combination) => {
      if (
        filters.imageProviders.length > 0 &&
        !filters.imageProviders.includes(combination.imagePlan.provider)
      )
        return false;
      if (
        filters.imageModels.length > 0 &&
        !filters.imageModels.includes(combination.imagePlan.id)
      )
        return false;
      if (
        filters.threeDProviders.length > 0 &&
        !filters.threeDProviders.includes(combination.threeDPlan.provider)
      )
        return false;
      if (
        filters.threeDModels.length > 0 &&
        !filters.threeDModels.includes(combination.threeDPlan.id)
      )
        return false;
      if (filters.llmModels.length > 0) {
        const llmKey = combination.llmModel?.id || combination.llmModelName;
        if (!filters.llmModels.includes(llmKey)) return false;
      }
      return true;
    });
    if (viewMode === 'bookmarks') {
      filtered = filtered.filter((c) => bookmarks.has(c.id));
    }
    return filtered;
  }, [results, filters, viewMode, bookmarks]);

  const toggleBookmark = (id: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    setFilters({
      imageProviders: [],
      imageModels: [],
      threeDProviders: [],
      threeDModels: [],
      llmModels: [],
    });
  };

  const handleExport = () => {
    setIsExporting(true);
    try {
      const rows = filteredResults.map((c, i) => {
        const b = sliderInput ? getFullBreakdownForInput(c, sliderInput) : c.breakdown;
        return {
          Rank: i + 1,
          Card: c.cardId || '',
          'Image Provider': formatProviderName(c.imagePlan.provider),
          'Image Tier': c.imagePlan.tier,
          '3D Provider': formatProviderName(c.threeDPlan.provider),
          '3D Workflow': c.threeDPlan.workflow,
          Storage: c.storageStack?.name || '',
          LLM: c.llmModelName || '',
          'Chat Volume': c.chatVolumePresetName || '',
          'Est. Chats': c.estimatedChats ?? '',
          Embedding: c.embeddingModelName || '',
          Infra: c.infraLabel || '',
          'Image USD': b.imageCostUSD,
          '3D USD': b.threeDCostUSD,
          'LLM USD': b.llmCostUSD,
          'Embedding USD': b.embeddingCostUSD,
          'Storage USD': b.storageCostUSD,
          'Fixed Infra USD': b.fixedInfraCostUSD,
          'Margin USD': b.marginCostUSD,
          'Margin INR': b.marginCostINR,
          'Total USD': b.totalCostUSD,
          'Total INR': b.totalCostINR,
          Caveat: c.caveat,
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Combinations');
      XLSX.writeFile(wb, 'ai-generation-cost-combinations.xlsx');
    } finally {
      setIsExporting(false);
    }
  };

  const activeFilterCount =
    filters.imageProviders.length +
    filters.imageModels.length +
    filters.threeDProviders.length +
    filters.threeDModels.length +
    filters.llmModels.length;

  if (isCalculating) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#010101] mx-auto mb-3" />
        <p className="text-[#010101]">Calculating combinations...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E5DDD1] bg-[#F9F4EE] text-sm font-medium text-[#010101] hover:border-[#010101]"
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-[#010101] text-white text-[10px]">
                {activeFilterCount}
              </span>
            )}
          </button>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs text-[#4F4F4E] hover:text-[#010101]"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'all' ? 'bookmarks' : 'all')}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E5DDD1] bg-[#F9F4EE] text-sm font-medium text-[#010101] hover:border-[#010101]"
          >
            <div className="w-6 h-6">
              <DotLottieReact
                src="https://lottie.host/embed/9f0c0e8e-0e0e-4e0e-8e0e-0e0e0e0e0e0e/bookmark.json"
                loop={false}
                autoplay={false}
                dotLottieRefCallback={(ref) => {
                  bookmarkButtonRef.current = ref;
                }}
              />
            </div>
            {viewMode === 'bookmarks' ? 'All' : 'Bookmarks'}
          </button>
          <div className="inline-flex rounded-lg border border-[#E5DDD1] overflow-hidden">
            <button
              type="button"
              onClick={() => setDisplayCurrency('USD')}
              className={`px-3 py-2 text-sm font-semibold transition-colors ${
                displayCurrency === 'USD'
                  ? 'bg-[#010101] text-white'
                  : 'bg-[#F9F4EE] text-[#010101] hover:border-[#010101]'
              }`}
            >
              $ USD
            </button>
            <button
              type="button"
              onClick={() => setDisplayCurrency('INR')}
              className={`px-3 py-2 text-sm font-semibold transition-colors border-l border-[#E5DDD1] ${
                displayCurrency === 'INR'
                  ? 'bg-[#010101] text-white'
                  : 'bg-[#F9F4EE] text-[#010101]'
              }`}
            >
              ₹ INR
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting || filteredResults.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#010101] text-white text-sm font-semibold hover:bg-[#1a1a1a] disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {isExporting ? 'Exporting...' : 'Export Excel'}
        </button>
      </div>

      {showFilters && (
        <div className="mb-6 p-4 rounded-2xl border border-[#E5DDD1] bg-[#F9F4EE]/60 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(
            [
              ['Image Provider', 'imageProviders', filterOptions.imageProviders, formatProviderName],
              [
                'Image Model',
                'imageModels',
                filterOptions.imageModels,
                (id: string) =>
                  results.find((r) => r.imagePlan.id === id)?.imagePlan.name || id,
              ],
              ['3D Provider', 'threeDProviders', filterOptions.threeDProviders, formatProviderName],
              [
                '3D Model',
                'threeDModels',
                filterOptions.threeDModels,
                (id: string) =>
                  results.find((r) => r.threeDPlan.id === id)?.threeDPlan.name || id,
              ],
              [
                'LLM Model',
                'llmModels',
                filterOptions.llmModels,
                (id: string) =>
                  results.find((r) => (r.llmModel?.id || r.llmModelName) === id)?.llmModelName ||
                  id,
              ],
            ] as const
          ).map(([label, key, opts, fmt]) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-[#010101] mb-1.5">{label}</label>
              <select
                multiple
                value={filters[key]}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                  setFilters((prev) => ({ ...prev, [key]: selected }));
                }}
                className="w-full rounded-lg border border-[#E5DDD1] bg-white px-2 py-2 text-sm"
                size={Math.min(opts.length || 1, 5)}
              >
                {opts.map((p) => (
                  <option key={p} value={p}>
                    {fmt(p)}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {filteredResults.length === 0 ? (
        <div className="text-center py-16 text-[#4F4F4E]">
          No combinations match your filters.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredResults.map((combination, index) => (
            <CombinationCard
              key={combination.id}
              combination={combination}
              rank={index + 1}
              calculationInput={calculationInput}
              sliderInput={sliderInput}
              isBookmarked={bookmarks.has(combination.id)}
              onToggleBookmark={() => toggleBookmark(combination.id)}
              displayCurrency={displayCurrency}
              fxRate={fxRate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MoneyPair({ usd, inrRate }: { usd: number; inrRate?: number }) {
  return (
    <div className="text-right">
      <div>{formatUSD(usd)}</div>
      <div className="text-gray-500 dark:text-gray-400">
        {formatINR(convertUSDToINR(usd, inrRate))}
      </div>
    </div>
  );
}

function CombinationCard({
  combination,
  rank,
  calculationInput,
  sliderInput,
  isBookmarked,
  onToggleBookmark,
  displayCurrency,
  fxRate,
}: {
  combination: Combination;
  rank: number;
  calculationInput?: BudgetInput | null;
  sliderInput?: BudgetInput | null;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  displayCurrency: DisplayCurrency;
  fxRate?: number;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const inputForDisplay = sliderInput || calculationInput;
  const fx = fxRate ?? calculationInput?.usdToInr;
  const money = (usd: number) => formatMoney(usd, displayCurrency, fx);

  const displayBreakdown = useMemo(() => {
    if (inputForDisplay) return getFullBreakdownForInput(combination, inputForDisplay);
    return combination.breakdown;
  }, [combination, inputForDisplay]);

  const costRange = useMemo(() => {
    if (!calculationInput) return null;
    const minInput: BudgetInput = {
      ...calculationInput,
      imagesPerMonth: calculationInput.minImagesPerMonth ?? calculationInput.imagesPerMonth,
      modelsPerMonth: calculationInput.minModelsPerMonth ?? calculationInput.modelsPerMonth,
    };
    const maxInput: BudgetInput = {
      ...calculationInput,
      imagesPerMonth: calculationInput.maxImagesPerMonth ?? calculationInput.imagesPerMonth,
      modelsPerMonth: calculationInput.maxModelsPerMonth ?? calculationInput.modelsPerMonth,
    };
    const minB = getCostBreakdownForInput(combination, minInput);
    const maxB = getCostBreakdownForInput(combination, maxInput);
    return {
      totalMinUSD: Math.min(minB.totalCostUSD, maxB.totalCostUSD),
      totalMaxUSD: Math.max(minB.totalCostUSD, maxB.totalCostUSD),
      imageMinUSD: Math.min(minB.imageCostUSD, maxB.imageCostUSD),
      imageMaxUSD: Math.max(minB.imageCostUSD, maxB.imageCostUSD),
      threeDMinUSD: Math.min(minB.threeDCostUSD, maxB.threeDCostUSD),
      threeDMaxUSD: Math.max(minB.threeDCostUSD, maxB.threeDCostUSD),
    };
  }, [combination, calculationInput]);

  const input = inputForDisplay;
  const images = input?.imagesPerMonth ?? 0;
  const models = input?.modelsPerMonth ?? 0;
  const imageRetry = input?.imageRetryFraction ?? 0;
  const modelRetry = input?.modelRetryFraction ?? 0;
  const effectiveImages = images * (1 + imageRetry);
  const effectiveModels = models * (1 + modelRetry);
  const unitPrice = combination.imagePlan.pricePerImageUSD;
  const threeDBase = combination.threeDPlan.baseCostUSD;
  const threeDTexture = combination.threeDPlan.textureCostUSD ?? 0;

  const assetGB = input?.r2StorageGB ?? 0;
  const r2Price = input?.r2PricePerGBUSD ?? 0.015;
  const r2Requests = input?.r2RequestsUSD ?? 0;
  // Always full R2 for 2D/3D assets
  const r2StorageLine = assetGB * r2Price + r2Requests;
  const storageName = 'R2';

  const llmInputPrice =
    combination.llmModel?.inputPer1MUSD ?? input?.llmInputPricePer1M ?? 0;
  const llmOutputPrice =
    combination.llmModel?.outputPer1MUSD ?? input?.llmOutputPricePer1M ?? 0;
  const llmInputCost = ((input?.llmInputTokens ?? 0) / 1_000_000) * llmInputPrice;
  const llmOutputCost = ((input?.llmOutputTokens ?? 0) / 1_000_000) * llmOutputPrice;
  const chatPreset = combination.chatVolumePresetName || '—';
  const estChats = combination.estimatedChats;

  const pieData = [
    { name: 'Image', value: displayBreakdown.imageCostUSD, color: PIE_COLORS.Image },
    { name: '3D', value: displayBreakdown.threeDCostUSD, color: PIE_COLORS['3D'] },
    { name: 'LLM', value: displayBreakdown.llmCostUSD, color: PIE_COLORS.LLM },
    { name: 'Embeddings', value: displayBreakdown.embeddingCostUSD, color: PIE_COLORS.Embeddings },
    { name: 'Storage', value: displayBreakdown.storageCostUSD ?? 0, color: PIE_COLORS.Storage },
    {
      name: 'Fixed Infra',
      value: displayBreakdown.fixedInfraCostUSD ?? 0,
      color: PIE_COLORS['Fixed Infra'],
    },
    {
      name: 'Margin',
      value: displayBreakdown.marginCostUSD ?? 0,
      color: PIE_COLORS.Margin,
    },
  ].filter((d) => d.value > 0);

  const llmName = combination.llmModelName || 'LLM';
  const infraName = combination.infraLabel || 'Vercel + Supabase Pro + R2';
  const quality = calculateQuality(combination);

  return (
    <div
      onClick={() => setShowDetails(!showDetails)}
      className="group relative border border-[#E5DDD1] rounded-2xl p-6 bg-white/80 dark:bg-black/80 backdrop-blur-sm hover:shadow-lg hover:border-[#010101] dark:hover:border-white transition-all duration-300 overflow-hidden cursor-pointer"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 via-indigo-50/0 to-purple-50/0 dark:from-blue-950/0 dark:via-indigo-950/0 dark:to-purple-950/0 group-hover:from-blue-50/30 group-hover:via-indigo-50/20 group-hover:to-purple-50/30 dark:group-hover:from-blue-950/20 dark:group-hover:via-indigo-950/10 dark:group-hover:to-purple-950/20 transition-all duration-500 pointer-events-none" />

      {!combination.isPriced && (
        <div className="absolute -top-1 -left-1 z-20 transform -rotate-12 origin-center pointer-events-none">
          <div className="px-4 py-1.5 rounded-md bg-amber-100 text-amber-900 shadow-xl backdrop-blur-sm border-2 border-white/50 dark:border-gray-900/50">
            <span className="flex items-center text-[0.6rem] font-bold">Unresolved USD</span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleBookmark();
        }}
        className={`absolute -top-1 right-4 z-30 px-2.5 py-1 rounded-md text-[0.6rem] font-bold border-2 shadow-xl backdrop-blur-sm transition-all ${
          isBookmarked
            ? 'bg-[#010101] text-white border-white/50 dark:border-gray-700'
            : 'bg-amber-100 text-amber-900 border-white/50 dark:border-gray-900/50'
        }`}
        title={isBookmarked ? 'Remove bookmark' : 'Bookmark this combination'}
      >
        {isBookmarked ? '★ Bookmarked' : '☆ Bookmark'}
      </button>

      <div className="relative z-10">
      {/* Compact header — match old horizontal typography */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
        <div className="flex-shrink-0">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#010101] dark:bg-white shadow-lg">
            <span className="text-lg font-extrabold text-white dark:text-black">#{rank}</span>
          </div>
        </div>

        <div className="flex-shrink-0 text-center sm:text-left min-w-[140px]">
          <div className="text-2xl font-extrabold text-[#010101] dark:text-white">
            {combination.isPriced ? money(displayBreakdown.totalCostUSD) : 'Not ranked'}
          </div>
          {combination.isPriced && costRange && (
            <div className="text-xs text-[#4F4F4E] dark:text-gray-400 mt-1.5">
              {money(costRange.totalMinUSD)} – {money(costRange.totalMaxUSD)}
            </div>
          )}
          <div className="text-xs text-[#4F4F4E] dark:text-gray-400 font-medium uppercase tracking-wider mt-0.5">
            per month · {displayCurrency}
          </div>
        </div>

        <div className="hidden sm:block flex-shrink-0 w-px h-16 bg-[#E5DDD1] dark:bg-gray-700" />

        <div className="flex-1 w-full sm:w-auto grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="space-y-1">
            <div className="font-bold text-[#010101] dark:text-white text-sm">
              {combination.imagePlan.name}
            </div>
            <div className="font-bold text-[#010101] dark:text-white text-sm">
              {unitPrice !== undefined
                ? `${money(displayBreakdown.imageCostUSD)}/mo`
                : '—'}
            </div>
            {costRange && unitPrice !== undefined && (
              <div className="text-xs text-[#4F4F4E] dark:text-gray-400 mt-1.5">
                {money(costRange.imageMinUSD)} – {money(costRange.imageMaxUSD)}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <div className="font-bold text-[#010101] dark:text-white text-sm">
              {combination.threeDPlan.providerLabel}
            </div>
            <div className="font-bold text-[#010101] dark:text-white text-sm">
              {combination.isPriced
                ? `${money(displayBreakdown.threeDCostUSD)}/mo`
                : 'Unresolved'}
            </div>
            {costRange && combination.isPriced && (
              <div className="text-xs text-[#4F4F4E] dark:text-gray-400 mt-1.5">
                {money(costRange.threeDMinUSD)} – {money(costRange.threeDMaxUSD)}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-[#4F4F4E] dark:text-gray-400">
              Storage
            </div>
            <div className="font-bold text-[#010101] dark:text-white text-sm">{storageName}</div>
            <div className="font-bold text-[#010101] dark:text-white text-sm">
              {money(displayBreakdown.storageCostUSD ?? 0)}/mo
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-[#4F4F4E] dark:text-gray-400">
              LLM
            </div>
            <div className="font-bold text-[#010101] dark:text-white text-sm" title={llmName}>
              {llmName}
            </div>
            <div className="font-bold text-[#010101] dark:text-white text-sm">
              {money(displayBreakdown.llmCostUSD + displayBreakdown.embeddingCostUSD)}
              /mo
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-[#4F4F4E] dark:text-gray-400">
              Quality
            </div>
            <div className="font-bold text-[#010101] dark:text-white text-sm">
              {quality.overallQualityScore > 0
                ? `${quality.overallQualityScore.toFixed(1)}/10`
                : 'N/A'}
            </div>
            <div className="text-xs text-[#4F4F4E] dark:text-gray-400">
              {quality.costPts != null
                ? `Cost pts ${quality.costPts.toFixed(1)}`
                : 'Public ranking'}
            </div>
          </div>
        </div>
      </div>

      {combination.warnings.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          {combination.warnings.map((w, i) => (
            <div
              key={i}
              className="inline-flex items-start gap-1.5 text-[11px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded-lg px-2 py-1"
            >
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Full breakdowns */}
      {showDetails && (
        <div
          className="mt-6 pt-6 border-t border-gray-200/50 dark:border-gray-800/50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-[0.6rem]">
            {/* IMAGE — gray like old Avatar */}
            <div className="col-span-1 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black rounded-xl p-4 border border-gray-200 dark:border-gray-800 relative">
              <div className="absolute -top-2 right-2 bg-black text-white text-[0.6rem] font-semibold px-2 py-0.5 rounded-md shadow-md z-10">
                {formatProviderName(combination.imagePlan.provider)}
              </div>
              <div className="text-[0.7rem] font-semibold text-gray-900 dark:text-white mb-3">
                Image Cost Breakdown
              </div>
              <div className="h-32 mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Base', value: unitPrice !== undefined ? images * unitPrice : 0 },
                      {
                        name: 'Retries',
                        value:
                          unitPrice !== undefined ? images * unitPrice * imageRetry : 0,
                      },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5DDD1" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#666" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#666" />
                    <Tooltip
                      formatter={(v) => formatUSD(Number(v ?? 0))}
                      contentStyle={{
                        backgroundColor: '#F9F4EE',
                        border: '1px solid #E5DDD1',
                        borderRadius: 8,
                        fontSize: 11,
                      }}
                    />
                    <Bar dataKey="value" fill="#010101" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 text-gray-700 dark:text-gray-300 text-[0.6rem]">
                <div className="pb-2 border-b border-gray-300 dark:border-gray-700 space-y-1">
                  <div className="flex justify-between">
                    <span>Image Plan:</span>
                    <span className="font-semibold">{combination.imagePlan.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Unit Price:</span>
                    <span>
                      {unitPrice !== undefined ? formatUSD(unitPrice) : 'Unresolved'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span>{combination.imagePlan.status}</span>
                  </div>
                </div>
                <div className="font-semibold text-gray-900 dark:text-white">Volume Cost:</div>
                <div className="pl-2 space-y-1">
                  <div className="flex justify-between">
                    <span>Images / month:</span>
                    <span>{images.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Retry factor:</span>
                    <span>{(imageRetry * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Effective images:</span>
                    <span>{effectiveImages.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="text-[0.55rem] text-gray-500 italic">
                    {images.toLocaleString()} × {unitPrice !== undefined ? formatUSD(unitPrice) : '—'} × (1 +{' '}
                    {imageRetry})
                  </div>
                  <div className="flex justify-between pt-1 border-t border-gray-300 dark:border-gray-700">
                    <span className="font-bold text-gray-900 dark:text-white">Total Image Cost:</span>
                    <MoneyPair usd={displayBreakdown.imageCostUSD} inrRate={fx} />
                  </div>
                </div>
              </div>
            </div>

            {/* 3D — blue/indigo like old Voice */}
            <div className="col-span-1 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl p-4 border border-blue-200 dark:border-blue-900 relative">
              <div className="absolute -top-2 right-2 bg-blue-600 text-white text-[0.6rem] font-semibold px-2 py-0.5 rounded-md shadow-md z-10">
                {combination.threeDPlan.providerLabel}
              </div>
              <div className="text-[0.7rem] font-semibold text-gray-900 dark:text-white mb-3">
                3D Cost Breakdown
              </div>
              <div className="h-32 mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Base', value: displayBreakdown.threeDBaseCostUSD },
                      { name: 'Texture', value: displayBreakdown.threeDTextureCostUSD },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5DDD1" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#666" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#666" />
                    <Tooltip
                      formatter={(v) => formatUSD(Number(v ?? 0))}
                      contentStyle={{
                        backgroundColor: '#F9F4EE',
                        border: '1px solid #E5DDD1',
                        borderRadius: 8,
                        fontSize: 11,
                      }}
                    />
                    <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 text-gray-700 dark:text-gray-300 text-[0.6rem]">
                <div className="pb-2 border-b border-gray-300 dark:border-gray-700 space-y-1">
                  <div className="flex justify-between">
                    <span>3D Plan:</span>
                    <span className="font-semibold">{combination.threeDPlan.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Workflow:</span>
                    <span>{combination.threeDPlan.workflow}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Base / model:</span>
                    <span>
                      {threeDBase !== undefined ? formatUSD(threeDBase) : 'Unresolved'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Texture / model:</span>
                    <span>{formatUSD(threeDTexture)}</span>
                  </div>
                </div>
                <div className="font-semibold text-gray-900 dark:text-white">Volume Cost:</div>
                <div className="pl-2 space-y-1">
                  <div className="flex justify-between">
                    <span>Models / month:</span>
                    <span>{models.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Retry factor:</span>
                    <span>{(modelRetry * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Effective models:</span>
                    <span>
                      {effectiveModels.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Base generation:</span>
                    <MoneyPair usd={displayBreakdown.threeDBaseCostUSD} inrRate={fx} />
                  </div>
                  <div className="flex justify-between">
                    <span>Texture / post:</span>
                    <MoneyPair usd={displayBreakdown.threeDTextureCostUSD} inrRate={fx} />
                  </div>
                  <div className="flex justify-between pt-1 border-t border-gray-300 dark:border-gray-700">
                    <span className="font-bold text-gray-900 dark:text-white">Total 3D Cost:</span>
                    <MoneyPair usd={displayBreakdown.threeDCostUSD} inrRate={fx} />
                  </div>
                </div>
              </div>
            </div>

            {/* LLM — purple/pink like old Hosting */}
            <div className="col-span-1 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl p-4 border border-purple-200 dark:border-purple-900 relative">
              <div className="absolute -top-2 right-2 bg-purple-600 text-white text-[0.6rem] font-semibold px-2 py-0.5 rounded-md shadow-md z-10">
                {llmName}
              </div>
              <div className="text-[0.7rem] font-semibold text-gray-900 dark:text-white mb-3">
                LLM & Embeddings Breakdown
              </div>
              <div className="h-32 mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Input', value: llmInputCost },
                      { name: 'Output', value: llmOutputCost },
                      { name: 'Embed', value: displayBreakdown.embeddingCostUSD },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5DDD1" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#666" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#666" />
                    <Tooltip
                      formatter={(v) => formatUSD(Number(v ?? 0))}
                      contentStyle={{
                        backgroundColor: '#F9F4EE',
                        border: '1px solid #E5DDD1',
                        borderRadius: 8,
                        fontSize: 11,
                      }}
                    />
                    <Bar dataKey="value" fill="#A855F7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 text-gray-700 dark:text-gray-300 text-[0.6rem]">
                <div className="pb-2 border-b border-gray-300 dark:border-gray-700 space-y-1">
                  <div className="flex justify-between">
                    <span>LLM Model:</span>
                    <span className="font-semibold">{llmName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Provider:</span>
                    <span>{combination.llmModel?.provider || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Chat Volume:</span>
                    <span className="font-semibold">{chatPreset}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Est. chats / mo:</span>
                    <span>{estChats != null ? estChats.toLocaleString() : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Words / chat:</span>
                    <span>
                      {combination.totalWordsPerChat != null
                        ? `~${combination.totalWordsPerChat.toLocaleString()}`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tokens / chat (in/out):</span>
                    <span>
                      {combination.inputTokensPerChat != null
                        ? `${combination.inputTokensPerChat.toLocaleString()} / ${Number(
                            combination.outputTokensPerChat
                          ).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Embedding Model:</span>
                    <span className="font-semibold">
                      {combination.embeddingModelName || '—'}
                    </span>
                  </div>
                </div>
                <div className="font-semibold text-gray-900 dark:text-white">Token Charges:</div>
                <div className="pl-2 space-y-1">
                  <div className="flex justify-between">
                    <span>Input tokens:</span>
                    <span>{(input?.llmInputTokens ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Input $/1M:</span>
                    <span>{formatUSD(llmInputPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Input cost:</span>
                    <MoneyPair usd={llmInputCost} inrRate={fx} />
                  </div>
                  <div className="flex justify-between">
                    <span>Output tokens:</span>
                    <span>{(input?.llmOutputTokens ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Output $/1M:</span>
                    <span>{formatUSD(llmOutputPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Output cost:</span>
                    <MoneyPair usd={llmOutputCost} inrRate={fx} />
                  </div>
                  <div className="flex justify-between">
                    <span>Embedding tokens:</span>
                    <span>{(input?.embeddingTokens ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Embedding cost:</span>
                    <MoneyPair usd={displayBreakdown.embeddingCostUSD} inrRate={fx} />
                  </div>
                  <div className="flex justify-between pt-1 border-t border-gray-300 dark:border-gray-700">
                    <span className="font-bold text-gray-900 dark:text-white">Total LLM + Embed:</span>
                    <MoneyPair
                      usd={displayBreakdown.llmCostUSD + displayBreakdown.embeddingCostUSD}
                      inrRate={fx}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* STORAGE — always Cloudflare R2 */}
            <div className="col-span-1 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl p-4 border border-purple-200 dark:border-purple-900 relative">
              <div className="absolute -top-2 right-2 bg-pink-600 text-white text-[0.6rem] font-semibold px-2 py-0.5 rounded-md shadow-md z-10">
                R2
              </div>
              <div className="text-[0.7rem] font-semibold text-gray-900 dark:text-white mb-3">
                Storage Cost Breakdown
              </div>
              <div className="h-32 mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Storage', value: assetGB * r2Price },
                      { name: 'Requests', value: r2Requests },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5DDD1" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#666" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#666" />
                    <Tooltip
                      formatter={(v) => formatUSD(Number(v ?? 0))}
                      contentStyle={{
                        backgroundColor: '#F9F4EE',
                        border: '1px solid #E5DDD1',
                        borderRadius: 8,
                        fontSize: 11,
                      }}
                    />
                    <Bar dataKey="value" fill="#EC4899" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 text-gray-700 dark:text-gray-300 text-[0.6rem]">
                <div className="pb-2 border-b border-gray-300 dark:border-gray-700 space-y-1">
                  <div className="flex justify-between">
                    <span>Asset store:</span>
                    <span className="font-semibold">Cloudflare R2</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Holds:</span>
                    <span>2D renders + 3D GLB/textures</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Asset storage GB:</span>
                    <span>{assetGB.toLocaleString()}</span>
                  </div>
                </div>
                <div className="pl-2 space-y-1">
                  <div className="flex justify-between">
                    <span>R2 $/GB-month:</span>
                    <span>{formatUSD(r2Price)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Storage line:</span>
                    <MoneyPair usd={assetGB * r2Price} inrRate={fx} />
                  </div>
                  <div className="flex justify-between">
                    <span>Requests:</span>
                    <MoneyPair usd={r2Requests} inrRate={fx} />
                  </div>
                </div>
                <div className="flex justify-between pt-1 border-t border-gray-300 dark:border-gray-700">
                  <span className="font-bold text-gray-900 dark:text-white">Total R2 Cost:</span>
                  <MoneyPair usd={displayBreakdown.storageCostUSD ?? 0} inrRate={fx} />
                </div>
                <p className="text-[0.55rem] text-gray-500 italic">
                  Supabase Pro is billed under Fixed Infra (app/DB) — not asset storage.
                </p>
              </div>
            </div>

            {/* FIXED INFRA — grey */}
            <div className="col-span-1 lg:col-span-2 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black rounded-xl p-4 border border-gray-200 dark:border-gray-800 relative">
              <div className="absolute -top-2 right-2 bg-gray-500 text-white text-[0.6rem] font-semibold px-2 py-0.5 rounded-md shadow-md z-10">
                Fixed Infra
              </div>
              <div className="text-[0.7rem] font-semibold text-gray-900 dark:text-white mb-3">
                Infrastructure Cost Breakdown
              </div>
              <div className="h-32 mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Vercel', value: input?.vercelMonthlyUSD ?? 0 },
                      { name: 'Supabase', value: input?.supabaseMonthlyUSD ?? 0 },
                      { name: 'Worker', value: input?.workerMonthlyUSD ?? 0 },
                      { name: 'Monitor', value: input?.monitoringMonthlyUSD ?? 0 },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5DDD1" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#666" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#666" />
                    <Tooltip
                      formatter={(v) => formatUSD(Number(v ?? 0))}
                      contentStyle={{
                        backgroundColor: '#F9F4EE',
                        border: '1px solid #E5DDD1',
                        borderRadius: 8,
                        fontSize: 11,
                      }}
                    />
                    <Bar dataKey="value" fill="#6B7280" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid sm:grid-cols-2 gap-4 text-gray-700 dark:text-gray-300 text-[0.6rem]">
                <div className="space-y-1">
                  <div className="font-semibold text-gray-900 dark:text-white mb-1">Stack label</div>
                  <div className="text-[0.7rem]">{infraName}</div>
                  <p className="text-[0.55rem] text-gray-500 italic mt-2">
                    Fixed hosting is the same on every combo. Storage stack above varies by
                    combination.
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Vercel Pro:</span>
                    <MoneyPair usd={input?.vercelMonthlyUSD ?? 0} inrRate={fx} />
                  </div>
                  <div className="flex justify-between">
                    <span>Supabase Pro:</span>
                    <MoneyPair usd={input?.supabaseMonthlyUSD ?? 0} inrRate={fx} />
                  </div>
                  <div className="flex justify-between">
                    <span>Worker / Queue:</span>
                    <MoneyPair usd={input?.workerMonthlyUSD ?? 0} inrRate={fx} />
                  </div>
                  <div className="flex justify-between">
                    <span>Monitoring / Email:</span>
                    <MoneyPair usd={input?.monitoringMonthlyUSD ?? 0} inrRate={fx} />
                  </div>
                  <div className="flex justify-between pt-1 border-t border-gray-300 dark:border-gray-700">
                    <span className="font-bold text-gray-900 dark:text-white">Total Fixed Infra:</span>
                    <MoneyPair usd={displayBreakdown.fixedInfraCostUSD ?? 0} inrRate={fx} />
                  </div>
                  <div className="flex justify-between pt-2 mt-2 border-t border-gray-300 dark:border-gray-700">
                    <span className="font-bold text-gray-900 dark:text-white">
                      Margin (default ₹5,000):
                    </span>
                    <MoneyPair usd={displayBreakdown.marginCostUSD ?? 0} inrRate={fx} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* TOTAL SUMMARY — black / white */}
          <div className="mt-4 col-span-full bg-[#010101] rounded-xl p-6 shadow-xl">
            <div className="mb-6 pb-4 border-b border-white/20">
              <div className="text-2xl font-extrabold text-white mb-1">Total Monthly Cost</div>
              <div className="text-sm text-white/70">
                Complete cost breakdown for this combination
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="mb-3">
                  <div className="text-sm font-semibold text-white mb-1">Cost Distribution</div>
                  <div className="text-xs text-white/60">Visual breakdown by component</div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-1 h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={75}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v) => formatUSD(Number(v ?? 0))}
                          contentStyle={{
                            backgroundColor: '#F9F4EE',
                            border: '1px solid #E5DDD1',
                            borderRadius: 8,
                            fontSize: 11,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-shrink-0 space-y-2.5 text-[0.7rem] text-white">
                    {[...pieData]
                      .sort((a, b) => b.value - a.value)
                      .map((entry, index) => (
                        <div key={index} className="flex items-center gap-2.5">
                          <div
                            className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-white/20"
                            style={{ backgroundColor: entry.color }}
                          />
                          <div className="flex flex-col">
                            <span className="font-semibold text-white">{entry.name}</span>
                            <span className="text-white/60 text-[0.65rem]">
                              {formatUSD(entry.value)}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-center">
                <div className="mb-4">
                  <div className="text-sm font-semibold text-white mb-1">Total Cost</div>
                  <div className="text-xs text-white/60">Monthly expenses summary</div>
                </div>
                <div className="bg-white/10 rounded-lg p-4 mb-4 border border-white/20">
                  <div className="flex justify-between items-center mb-3 pb-3 border-b border-white/20">
                    <span className="text-base font-semibold text-white/70">USD:</span>
                    <span className="text-2xl font-extrabold text-white">
                      {formatUSD(displayBreakdown.totalCostUSD)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-base font-semibold text-white/70">INR:</span>
                    <span className="text-2xl font-extrabold text-white">
                      {formatINR(displayBreakdown.totalCostINR)}
                    </span>
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="text-xs font-semibold text-white mb-3 uppercase tracking-wider">
                    Component Breakdown
                  </div>
                  <div className="space-y-2 text-[0.7rem]">
                    {[
                      ['Image', displayBreakdown.imageCostUSD],
                      ['3D', displayBreakdown.threeDCostUSD],
                      ['LLM', displayBreakdown.llmCostUSD],
                      ['Embeddings', displayBreakdown.embeddingCostUSD],
                      ['Storage', displayBreakdown.storageCostUSD ?? 0],
                      ['Fixed Infra', displayBreakdown.fixedInfraCostUSD ?? 0],
                      [
                        'Margin (₹5,000)',
                        displayBreakdown.marginCostUSD ?? 0,
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={label as string}
                        className="flex justify-between items-center py-1 border-b border-white/10 last:border-0"
                      >
                        <span className="text-white/70">{label}:</span>
                        <span className="font-semibold text-white">
                          {formatUSD(value as number)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {combination.caveat && (
            <p className="mt-4 text-xs text-gray-600 dark:text-gray-400 italic">{combination.caveat}</p>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
