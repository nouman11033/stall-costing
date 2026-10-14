'use client';

import { useState, useCallback } from 'react';
import { Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AvatarDerived } from '@/components/BudgetForm';

export interface StorageInput {
  totalSizeGB: number;
  tierAllocation: {
    hot: number; // in GB
    cold: number; // in GB
    archive: number; // in GB
  };
  numberOfDatabases: number;
  // Storage provider selection
  storageProviders: ('AWS' | 'Azure')[];
  // AWS Additional Cost Parameters
  aws?: {
    hot?: {
      dataTransferOut?: number; // GB
      putRequests?: number;
      getRequests?: number;
    };
    cold?: {
      dataTransferOut?: number; // GB
      putRequests?: number;
      getRequests?: number;
      dataRetrieved?: number; // GB
    };
    archive?: {
      dataTransferOut?: number; // GB
      putRequests?: number;
      getRequests?: number;
      dataRetrieved?: number; // GB
      retrievalType?: 'Standard' | 'Expedited';
      retrievalRequests?: number;
    };
  };
  // Azure Additional Cost Parameters
  azure?: {
    hot?: {
      dataTransferOut?: number; // GB
      readOperations?: number; // per 10,000
      writeOperations?: number; // per 10,000
      queryDataScanned?: number; // GB
      queryDataReturned?: number; // GB
      iterativeReadOps?: number; // per 10,000
      iterativeWriteOps?: number; // per 100
      otherOperations?: number; // per 10,000
    };
    cold?: {
      dataTransferOut?: number; // GB
      readOperations?: number; // per 10,000
      writeOperations?: number; // per 10,000
      queryDataScanned?: number; // GB
      queryDataReturned?: number; // GB
      iterativeWriteOps?: number; // per 100
      dataRetrieved?: number; // GB
    };
    archive?: {
      dataTransferOut?: number; // GB
      readOperations?: number;
      writeOperations?: number;
      highPriorityRead?: number; // per 100
      highPriorityRetrieval?: number; // GB
      iterativeWriteOps?: number; // per 100
      dataRetrieved?: number; // GB
    };
  };
}

interface StorageInputProps {
  storageInput: StorageInput;
  onChange: (input: StorageInput) => void;
  avatarDerived?: AvatarDerived | null;
}

// Format number to short form for display (e.g. 1000 -> 1K, 1000000 -> 1M)
function formatMinutes(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toString();
}

// Compute AWS/Azure param values from total monthly minutes (placeholder formulas)
function paramsFromTotalMinutes(totalMinutes: number): Partial<StorageInput> {
  const m = totalMinutes;
  return {
    aws: {
      hot: {
        putRequests: Math.round(m * 0.1),
        getRequests: Math.round(m * 0.2),
      },
      cold: {
        putRequests: Math.round(m * 0.05),
        getRequests: Math.round(m * 0.1),
        dataRetrieved: Math.round(m * 0.01),
      },
      archive: {
        putRequests: Math.round(m * 0.02),
        getRequests: Math.round(m * 0.02),
        dataRetrieved: Math.round(m * 0.005),
        retrievalType: 'Standard',
        retrievalRequests: Math.round(m * 0.001),
      },
    },
    azure: {
      hot: {
        readOperations: Math.round(m * 0.2 / 10000) * 10000,
        writeOperations: Math.round(m * 0.1 / 10000) * 10000,
        queryDataScanned: Math.round(m * 0.01),
        queryDataReturned: Math.round(m * 0.005),
        iterativeReadOps: Math.round(m * 0.05 / 10000) * 10000,
        iterativeWriteOps: Math.round(m * 0.02 / 100) * 100,
        otherOperations: Math.round(m * 0.03 / 10000) * 10000,
      },
      cold: {
        readOperations: Math.round(m * 0.1 / 10000) * 10000,
        writeOperations: Math.round(m * 0.05 / 10000) * 10000,
        queryDataScanned: Math.round(m * 0.005),
        queryDataReturned: Math.round(m * 0.002),
        iterativeWriteOps: Math.round(m * 0.01 / 100) * 100,
        dataRetrieved: Math.round(m * 0.01),
      },
      archive: {
        readOperations: Math.round(m * 0.02),
        writeOperations: Math.round(m * 0.01),
        highPriorityRead: Math.round(m * 0.001 / 100) * 100,
        highPriorityRetrieval: Math.round(m * 0.002),
        iterativeWriteOps: Math.round(m * 0.005 / 100) * 100,
        dataRetrieved: Math.round(m * 0.005),
      },
    },
  };
}

export default function StorageInput({ storageInput, onChange, avatarDerived }: StorageInputProps) {
  const maxSizeGB = 500 * 1024; // 500 TB in GB
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [activeProvider, setActiveProvider] = useState<'AWS' | 'Azure'>('AWS');
  const [activeTierTab, setActiveTierTab] = useState<'Hot' | 'Cold' | 'Archive'>('Hot');
  const minMinutes = avatarDerived?.minMinutesPerMonth ?? 0;
  const maxMinutes = avatarDerived?.maxMinutesPerMonth ?? 100000;
  const defaultSliderMinutes = minMinutes > 0 || maxMinutes > 0 ? Math.round((minMinutes + maxMinutes) / 2) : 50000;
  const [sliderTotalMinutes, setSliderTotalMinutes] = useState(defaultSliderMinutes);

  const selectedProviders = storageInput.storageProviders || ['AWS', 'Azure'];
  const hasBothProviders = selectedProviders.length === 2;
  const hasOneProvider = selectedProviders.length === 1;

  const totalAllocated = storageInput.tierAllocation.hot + storageInput.tierAllocation.cold + storageInput.tierAllocation.archive;
  const percentages = {
    hot: storageInput.totalSizeGB > 0 ? (storageInput.tierAllocation.hot / storageInput.totalSizeGB) * 100 : 0,
    cold: storageInput.totalSizeGB > 0 ? (storageInput.tierAllocation.cold / storageInput.totalSizeGB) * 100 : 0,
    archive: storageInput.totalSizeGB > 0 ? (storageInput.tierAllocation.archive / storageInput.totalSizeGB) * 100 : 0,
  };
  const totalPercentage = percentages.hot + percentages.cold + percentages.archive;

  const handlePercentageChange = (tier: keyof typeof storageInput.tierAllocation, percentage: number) => {
    const newPercentage = Math.max(0, Math.min(100, percentage));
    const currentPercentages = { ...percentages };
    const diff = newPercentage - currentPercentages[tier];
    const currentTotal = currentPercentages.hot + currentPercentages.cold + currentPercentages.archive;
    
    if (currentTotal + diff > 100) {
      const excess = currentTotal + diff - 100;
      const otherTiers: (keyof typeof storageInput.tierAllocation)[] = ['hot', 'cold', 'archive'].filter(
        t => t !== tier
      ) as (keyof typeof storageInput.tierAllocation)[];
      const otherTotal = otherTiers.reduce((sum, t) => sum + currentPercentages[t], 0);
      
      otherTiers.forEach(t => {
        if (otherTotal > 0) {
          currentPercentages[t] = Math.max(0, currentPercentages[t] - (excess * currentPercentages[t] / otherTotal));
        }
      });
    }
    
    currentPercentages[tier] = newPercentage;
    const newAllocation = {
      hot: (currentPercentages.hot / 100) * storageInput.totalSizeGB,
      cold: (currentPercentages.cold / 100) * storageInput.totalSizeGB,
      archive: (currentPercentages.archive / 100) * storageInput.totalSizeGB,
    };
    
    onChange({
      ...storageInput,
      tierAllocation: newAllocation,
    });
  };

  const toggleProvider = (provider: 'AWS' | 'Azure') => {
    const providers = storageInput.storageProviders || [];
    const newProviders = providers.includes(provider)
      ? providers.filter(p => p !== provider)
      : [...providers, provider];
    onChange({ ...storageInput, storageProviders: newProviders.length > 0 ? newProviders : [provider] });
  };

  const updateAdditionalCost = (provider: 'AWS' | 'Azure', tier: 'hot' | 'cold' | 'archive', field: string, value: number | string) => {
    const updated = { ...storageInput };
    if (!updated[provider.toLowerCase() as 'aws' | 'azure']) {
      updated[provider.toLowerCase() as 'aws' | 'azure'] = {};
    }
    const providerData = updated[provider.toLowerCase() as 'aws' | 'azure'] as any;
    if (!providerData[tier]) {
      providerData[tier] = {};
    }
    providerData[tier][field] = value;
    onChange(updated);
  };

  const getAdditionalCostValue = (provider: 'AWS' | 'Azure', tier: 'hot' | 'cold' | 'archive', field: string): number | string => {
    const providerData = storageInput[provider.toLowerCase() as 'aws' | 'azure'];
    if (!providerData || !providerData[tier]) return 0;
    return (providerData[tier] as any)[field] ?? 0;
  };

  const handleSliderMinutesChange = useCallback((totalMinutes: number) => {
    setSliderTotalMinutes(totalMinutes);
    const derived = paramsFromTotalMinutes(totalMinutes);
    onChange({
      ...storageInput,
      ...derived,
    });
  }, [storageInput, onChange]);

  const handleNext = () => {
    if (selectedProviders.length > 0) {
      if (hasOneProvider) {
        setActiveProvider(selectedProviders[0] as 'AWS' | 'Azure');
      }
      const min = avatarDerived?.minMinutesPerMonth ?? 0;
      const max = avatarDerived?.maxMinutesPerMonth ?? 100000;
      const mid = (min > 0 || max > 0) ? Math.round((min + max) / 2) : 50000;
      setSliderTotalMinutes(mid);
      onChange({ ...storageInput, ...paramsFromTotalMinutes(mid) });
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    setCurrentStep(1);
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-[#E5DDD1] overflow-hidden hover:shadow-md transition-all duration-300 hover:border-[#010101] flex flex-col h-[600px]">
      {/* Header */}
      <div className="bg-white border-b border-[#E5DDD1] p-6 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-[#010101] rounded-xl flex items-center justify-center">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <h2 
            className="text-2xl font-bold text-[#010101]"
            style={{ fontFamily: 'Avenir, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
          >
            Data Storage
          </h2>
        </div>
      </div>

      {/* Content - Step 1: Basic Info + Provider Selection */}
      {currentStep === 1 && (
        <div className="p-6 flex-1 flex flex-col">
          <div className="space-y-4 flex-1">
            {/* Number Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#010101] mb-1.5">
                  Number of Databases
          </label>
          <input
            type="number"
            min="1"
            max="75"
            value={storageInput.numberOfDatabases}
            onChange={(e) => {
              const value = parseInt(e.target.value) || 1;
              onChange({
                ...storageInput,
                numberOfDatabases: Math.max(1, Math.min(75, value)),
              });
            }}
            className="show-spinner w-full px-3 py-2 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-sm text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
            placeholder="0"
            required
          />
        </div>

              <div>
                <label className="block text-xs font-semibold text-[#010101] mb-1.5">
                  Storage Size per Database (GB)
          </label>
          <input
            type="number"
            min="0"
            max={maxSizeGB}
            step="1"
            value={storageInput.totalSizeGB}
            onChange={(e) => {
              const newSize = parseFloat(e.target.value) || 0;
              if (newSize <= maxSizeGB) {
                const scale = storageInput.totalSizeGB > 0 ? newSize / storageInput.totalSizeGB : 1;
                onChange({
                  ...storageInput,
                  totalSizeGB: newSize,
                  tierAllocation: {
                    hot: storageInput.tierAllocation.hot * scale,
                    cold: storageInput.tierAllocation.cold * scale,
                    archive: storageInput.tierAllocation.archive * scale,
                  },
                });
              }
            }}
            className="show-spinner w-full px-3 py-2 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-sm text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
            placeholder="0"
            required
          />
              </div>
            </div>

            {/* Storage Provider Selection */}
            <div>
              <label className="block text-xs font-semibold text-[#010101] mb-2">
                Storage Provider
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => toggleProvider('AWS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selectedProviders.includes('AWS')
                      ? 'bg-[#010101] text-white border-[#010101]'
                      : 'bg-[#F9F4EE] text-[#010101] border-[#E5DDD1] hover:border-[#010101]'
                  }`}
                >
                  AWS
                </button>
                <button
                  type="button"
                  onClick={() => toggleProvider('Azure')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selectedProviders.includes('Azure')
                      ? 'bg-[#010101] text-white border-[#010101]'
                      : 'bg-[#F9F4EE] text-[#010101] border-[#E5DDD1] hover:border-[#010101]'
                  }`}
                >
                  Azure
                </button>
              </div>
        </div>

        {/* Tier Allocation */}
            <div className="pt-1">
              <h3 className="text-xs font-semibold text-[#010101] mb-2">Tier Allocation</h3>
              
              {/* Hot / S3 Standard */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-[#010101]">
                    Hot / S3 Standard
          </label>
                  <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                      value={Math.round(percentages.hot)}
                      onChange={(e) => handlePercentageChange('hot', parseFloat(e.target.value))}
                      className="w-14 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                      min="0"
                      max="100"
                    />
                    <span className="text-xs font-medium text-[#010101]">%</span>
                  </div>
                </div>
                <div 
                  className="tier-slider-container relative"
                  style={{
                    '--slider-progress': `${percentages.hot}%`
                  } as React.CSSProperties}
                >
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={percentages.hot}
                    onChange={(e) => handlePercentageChange('hot', parseFloat(e.target.value))}
                    className="tier-slider w-full appearance-none cursor-pointer relative z-10"
                    style={{
                      background: 'transparent',
                      height: '6px'
                    }}
                  />
                </div>
              </div>

              {/* Cold / S3 Standard - IA */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-[#010101]">
                    Cold / S3 Standard - IA
                  </label>
                  <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                      value={Math.round(percentages.cold)}
                      onChange={(e) => handlePercentageChange('cold', parseFloat(e.target.value))}
                      className="w-14 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                    min="0"
                      max="100"
                    />
                    <span className="text-xs font-medium text-[#010101]">%</span>
                  </div>
                </div>
                <div 
                  className="tier-slider-container relative"
                  style={{
                    '--slider-progress': `${percentages.cold}%`
                  } as React.CSSProperties}
                >
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={percentages.cold}
                    onChange={(e) => handlePercentageChange('cold', parseFloat(e.target.value))}
                    className="tier-slider w-full appearance-none cursor-pointer relative z-10"
                    style={{
                      background: 'transparent',
                      height: '6px'
                    }}
                  />
                </div>
              </div>

              {/* Archive / S3 Glacier Flexible Retrieval */}
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-[#010101]">
                    Archive / S3 Glacier Flexible Retrieval
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={Math.round(percentages.archive)}
                      onChange={(e) => handlePercentageChange('archive', parseFloat(e.target.value))}
                      className="w-14 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                      min="0"
                      max="100"
                    />
                    <span className="text-xs font-medium text-[#010101]">%</span>
                </div>
              </div>
              <div 
                className="tier-slider-container relative"
                style={{
                  '--slider-progress': `${percentages.archive}%`
                } as React.CSSProperties}
              >
              <input
                type="range"
                min="0"
                max="100"
                  step="1"
                  value={percentages.archive}
                  onChange={(e) => handlePercentageChange('archive', parseFloat(e.target.value))}
                  className="tier-slider w-full appearance-none cursor-pointer relative z-10"
                style={{
                    background: 'transparent',
                    height: '6px'
                  }}
                />
              </div>
              </div>

              {/* Total Percentage Indicator */}
              <div className="flex justify-end mt-1">
                <span className={`text-xs font-semibold ${
                  Math.abs(totalPercentage - 100) < 0.1 ? 'text-green-600' : 'text-orange-600'
                }`}>
                  Total: {totalPercentage.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Next Button */}
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleNext}
              disabled={selectedProviders.length === 0}
              className="px-6 py-2 bg-[#010101] text-white rounded-lg text-xs font-semibold hover:bg-[#1a1a1a] transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Content - Step 2: Additional Costs */}
      {currentStep === 2 && (
        <div className="p-6 flex-1 flex flex-col">
          <div className="space-y-4 flex-1">
            {/* Total number of minutes slider – drives param numbers */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#010101]">
                  Total number of minutes
                </label>
                <span className="text-xs font-semibold text-[#010101]">
                  {formatMinutes(sliderTotalMinutes)}
                </span>
              </div>
              <div
                className="tier-slider-container relative"
                style={{ '--slider-progress': `${maxMinutes > minMinutes ? ((sliderTotalMinutes - minMinutes) / (maxMinutes - minMinutes)) * 100 : 0}%` } as React.CSSProperties}
              >
                <input
                  type="range"
                  min={minMinutes}
                  max={Math.max(maxMinutes, minMinutes + 1)}
                  step={Math.max(1, Math.floor((maxMinutes - minMinutes) / 500))}
                  value={sliderTotalMinutes}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setSliderTotalMinutes(v);
                    handleSliderMinutesChange(v);
                  }}
                  className="tier-slider w-full appearance-none cursor-pointer relative z-10"
                  style={{ background: 'transparent', height: '6px' }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[#4F4F4E] mt-1">
                <span>{formatMinutes(minMinutes)}</span>
                <span>{formatMinutes(maxMinutes)}</span>
              </div>
            </div>

            {/* Provider Toggle (only if both selected) */}
            {hasBothProviders && (
              <div className="relative mb-4">
                {/* Line Separator */}
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#E5DDD1]"></div>
                </div>
                {/* Toggle Buttons */}
                <div className="relative flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setActiveProvider('AWS')}
                    className={`px-6 py-2 bg-white text-xs font-semibold transition-all border-t-2 ${
                      activeProvider === 'AWS'
                        ? 'text-[#010101] border-[#010101]'
                        : 'text-[#4F4F4E] border-transparent hover:text-[#010101]'
                    }`}
                  >
                    AWS
                  </button>
                  <div className="w-px h-6 bg-[#E5DDD1]"></div>
                  <button
                    type="button"
                    onClick={() => setActiveProvider('Azure')}
                    className={`px-6 py-2 bg-white text-xs font-semibold transition-all border-t-2 ${
                      activeProvider === 'Azure'
                        ? 'text-[#010101] border-[#010101]'
                        : 'text-[#4F4F4E] border-transparent hover:text-[#010101]'
                    }`}
                  >
                    Azure
                  </button>
                </div>
              </div>
            )}

            {/* Tier Allocation Reference */}
            <div className="bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg p-3 mb-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#010101]">Tier Allocation Reference:</span>
                <div className="flex items-center gap-4 text-[#4F4F4E]">
                  <span>Hot: <span className="font-semibold text-[#010101]">{Math.round(percentages.hot)}%</span></span>
                  <span>Cold: <span className="font-semibold text-[#010101]">{Math.round(percentages.cold)}%</span></span>
                  <span>Archive: <span className="font-semibold text-[#010101]">{Math.round(percentages.archive)}%</span></span>
                </div>
              </div>
            </div>

            {/* Tier Tabs */}
            <div className="flex gap-2 mb-3">
              {activeProvider === 'AWS' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTierTab('Hot')}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTierTab === 'Hot'
                        ? 'bg-[#010101] text-white'
                        : 'bg-[#F9F4EE] text-[#4F4F4E] hover:bg-[#E5DDD1]'
                    }`}
                  >
                    S3 Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTierTab('Cold')}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTierTab === 'Cold'
                        ? 'bg-[#010101] text-white'
                        : 'bg-[#F9F4EE] text-[#4F4F4E] hover:bg-[#E5DDD1]'
                    }`}
                  >
                    S3 Standard-IA
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTierTab('Archive')}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTierTab === 'Archive'
                        ? 'bg-[#010101] text-white'
                        : 'bg-[#F9F4EE] text-[#4F4F4E] hover:bg-[#E5DDD1]'
                    }`}
                  >
                    S3 Glacier Flexible Retrieval
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTierTab('Hot')}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTierTab === 'Hot'
                        ? 'bg-[#010101] text-white'
                        : 'bg-[#F9F4EE] text-[#4F4F4E] hover:bg-[#E5DDD1]'
                    }`}
                  >
                    Hot
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTierTab('Cold')}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTierTab === 'Cold'
                        ? 'bg-[#010101] text-white'
                        : 'bg-[#F9F4EE] text-[#4F4F4E] hover:bg-[#E5DDD1]'
                    }`}
                  >
                    Cold
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTierTab('Archive')}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTierTab === 'Archive'
                        ? 'bg-[#010101] text-white'
                        : 'bg-[#F9F4EE] text-[#4F4F4E] hover:bg-[#E5DDD1]'
                    }`}
                  >
                    Archive
                  </button>
                </>
              )}
            </div>

            {/* Input Parameters based on Provider and Tier */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activeProvider === 'AWS' && (
                <>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-[#010101]">
                      PUT/COPY/POST/LIST Requests
                    </label>
                    <input
                      type="number"
                      value={Number(getAdditionalCostValue('AWS', activeTierTab.toLowerCase() as 'hot' | 'cold' | 'archive', 'putRequests')) || 0}
                      onChange={(e) => updateAdditionalCost('AWS', activeTierTab.toLowerCase() as 'hot' | 'cold' | 'archive', 'putRequests', Number(e.target.value))}
                      className="w-32 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                      placeholder="0"
                      min="0"
                      step="1"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-[#010101]">
                      GET/SELECT Requests
                    </label>
                    <input
                      type="number"
                      value={Number(getAdditionalCostValue('AWS', activeTierTab.toLowerCase() as 'hot' | 'cold' | 'archive', 'getRequests')) || 0}
                      onChange={(e) => updateAdditionalCost('AWS', activeTierTab.toLowerCase() as 'hot' | 'cold' | 'archive', 'getRequests', Number(e.target.value))}
                      className="w-32 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                      placeholder="0"
                      min="0"
                      step="1"
                    />
                  </div>
                  {(activeTierTab === 'Cold' || activeTierTab === 'Archive') && (
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium text-[#010101]">
                        Data Retrieval (GB)
                      </label>
                      <input
                        type="number"
                        value={Number(getAdditionalCostValue('AWS', activeTierTab.toLowerCase() as 'hot' | 'cold' | 'archive', 'dataRetrieved')) || 0}
                        onChange={(e) => updateAdditionalCost('AWS', activeTierTab.toLowerCase() as 'hot' | 'cold' | 'archive', 'dataRetrieved', Number(e.target.value))}
                        className="w-32 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                        placeholder="0"
                        min="0"
                        step="1"
                      />
                    </div>
                  )}
                  {activeTierTab === 'Archive' && (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <label className="block text-xs font-medium text-[#010101]">
                          Data Retrieval Requests
                        </label>
                        <div className="flex items-center gap-2">
                          <select
                            value={String(getAdditionalCostValue('AWS', 'archive', 'retrievalType') || 'Standard')}
                            onChange={(e) => updateAdditionalCost('AWS', 'archive', 'retrievalType', e.target.value)}
                            className="w-24 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                          >
                            <option value="Standard">Standard</option>
                            <option value="Expedited">Expedited</option>
                          </select>
                          <input
                            type="number"
                            value={Number(getAdditionalCostValue('AWS', 'archive', 'retrievalRequests')) || 0}
                            onChange={(e) => updateAdditionalCost('AWS', 'archive', 'retrievalRequests', Number(e.target.value))}
                            className="w-32 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                            placeholder="0"
                            min="0"
                            step="1"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {activeProvider === 'Azure' && (
                <>
                  {activeTierTab === 'Hot' && (
                    <>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-[#010101]">
                          Read Operations (per 10,000)
                        </label>
                        <input
                          type="number"
                          value={Number(getAdditionalCostValue('Azure', 'hot', 'readOperations')) || 0}
                          onChange={(e) => updateAdditionalCost('Azure', 'hot', 'readOperations', Number(e.target.value))}
                          className="w-32 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                          placeholder="0"
                          min="0"
                          step="1"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-[#010101]">
                          Write Operations (per 10,000)
                        </label>
                        <input
                          type="number"
                          value={Number(getAdditionalCostValue('Azure', 'hot', 'writeOperations')) || 0}
                          onChange={(e) => updateAdditionalCost('Azure', 'hot', 'writeOperations', Number(e.target.value))}
                          className="w-32 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                          placeholder="0"
                          min="0"
                          step="1"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-[#010101]">
                          Query Acceleration - Data Scanned (GB)
                        </label>
                        <input
                          type="number"
                          value={Number(getAdditionalCostValue('Azure', 'hot', 'queryDataScanned')) || 0}
                          onChange={(e) => updateAdditionalCost('Azure', 'hot', 'queryDataScanned', Number(e.target.value))}
                          className="w-32 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                          placeholder="0"
                          min="0"
                          step="1"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-[#010101]">
                          Query Acceleration - Data Returned (GB)
                        </label>
                        <input
                          type="number"
                          value={Number(getAdditionalCostValue('Azure', 'hot', 'queryDataReturned')) || 0}
                          onChange={(e) => updateAdditionalCost('Azure', 'hot', 'queryDataReturned', Number(e.target.value))}
                          className="w-32 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                          placeholder="0"
                          min="0"
                          step="1"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-[#010101]">
                          Iterative Read Operations (per 10,000)
                        </label>
                        <input
                          type="number"
                          value={Number(getAdditionalCostValue('Azure', 'hot', 'iterativeReadOps')) || 0}
                          onChange={(e) => updateAdditionalCost('Azure', 'hot', 'iterativeReadOps', Number(e.target.value))}
                          className="w-32 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                          placeholder="0"
                          min="0"
                          step="1"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-[#010101]">
                          Iterative Write Operations (per 100)
                        </label>
                        <input
                          type="number"
                          value={Number(getAdditionalCostValue('Azure', 'hot', 'iterativeWriteOps')) || 0}
                          onChange={(e) => updateAdditionalCost('Azure', 'hot', 'iterativeWriteOps', Number(e.target.value))}
                          className="w-32 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                          placeholder="0"
                          min="0"
                          step="1"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-[#010101]">
                          Other Operations (per 10,000)
                        </label>
                        <input
                          type="number"
                          value={Number(getAdditionalCostValue('Azure', 'hot', 'otherOperations')) || 0}
                          onChange={(e) => updateAdditionalCost('Azure', 'hot', 'otherOperations', Number(e.target.value))}
                          className="w-32 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                          placeholder="0"
                          min="0"
                          step="1"
                        />
                      </div>
                    </>
                  )}
                  {activeTierTab === 'Cold' && (
                    <>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-[#010101]">
                          Read Operations (per 10,000)
                        </label>
                        <input
                          type="number"
                          value={Number(getAdditionalCostValue('Azure', 'cold', 'readOperations')) || 0}
                          onChange={(e) => updateAdditionalCost('Azure', 'cold', 'readOperations', Number(e.target.value))}
                          className="w-32 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                          placeholder="0"
                          min="0"
                          step="1"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-[#010101]">
                          Write Operations (per 10,000)
                        </label>
                        <input
                          type="number"
                          value={Number(getAdditionalCostValue('Azure', 'cold', 'writeOperations')) || 0}
                          onChange={(e) => updateAdditionalCost('Azure', 'cold', 'writeOperations', Number(e.target.value))}
                          className="w-32 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                          placeholder="0"
                          min="0"
                          step="1"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-[#010101]">
                          Query Acceleration - Data Scanned (GB)
                        </label>
                        <input
                          type="number"
                          value={Number(getAdditionalCostValue('Azure', 'cold', 'queryDataScanned')) || 0}
                          onChange={(e) => updateAdditionalCost('Azure', 'cold', 'queryDataScanned', Number(e.target.value))}
                          className="w-32 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                          placeholder="0"
                          min="0"
                          step="1"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-[#010101]">
                          Query Acceleration - Data Returned (GB)
                        </label>
                        <input
                          type="number"
                          value={Number(getAdditionalCostValue('Azure', 'cold', 'queryDataReturned')) || 0}
                          onChange={(e) => updateAdditionalCost('Azure', 'cold', 'queryDataReturned', Number(e.target.value))}
                          className="w-32 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                          placeholder="0"
                          min="0"
                          step="1"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-[#010101]">
                          Iterative Write Operations (per 100)
                        </label>
                        <input
                          type="number"
                          value={Number(getAdditionalCostValue('Azure', 'cold', 'iterativeWriteOps')) || 0}
                          onChange={(e) => updateAdditionalCost('Azure', 'cold', 'iterativeWriteOps', Number(e.target.value))}
                          className="w-32 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                          placeholder="0"
                          min="0"
                          step="1"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-[#010101]">
                          Data Retrieval (GB)
                        </label>
                        <input
                          type="number"
                          value={Number(getAdditionalCostValue('Azure', 'cold', 'dataRetrieved')) || 0}
                          onChange={(e) => updateAdditionalCost('Azure', 'cold', 'dataRetrieved', Number(e.target.value))}
                          className="w-32 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                          placeholder="0"
                          min="0"
                          step="1"
                        />
                      </div>
                    </>
                  )}
                  {activeTierTab === 'Archive' && (
                    <>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-[#010101]">
                          Data Transfer Out (GB)
                        </label>
                        <input
                          type="number"
                          value={Number(getAdditionalCostValue('Azure', 'archive', 'dataTransferOut')) || 0}
                          onChange={(e) => updateAdditionalCost('Azure', 'archive', 'dataTransferOut', Number(e.target.value))}
                          className="w-32 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                          placeholder="0"
                          min="0"
                          step="1"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-[#010101]">
                          Write Operations
                        </label>
                        <input
                          type="number"
                          value={Number(getAdditionalCostValue('Azure', 'archive', 'writeOperations')) || 0}
                          onChange={(e) => updateAdditionalCost('Azure', 'archive', 'writeOperations', Number(e.target.value))}
                          className="w-32 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                          placeholder="0"
                          min="0"
                          step="1"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-[#010101]">
                          Read Operations
                        </label>
                        <input
                          type="number"
                          value={Number(getAdditionalCostValue('Azure', 'archive', 'readOperations')) || 0}
                          onChange={(e) => updateAdditionalCost('Azure', 'archive', 'readOperations', Number(e.target.value))}
                          className="w-32 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                          placeholder="0"
                          min="0"
                          step="1"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-[#010101]">
                          High Priority Read Operations (per 100)
                        </label>
                        <input
                          type="number"
                          value={Number(getAdditionalCostValue('Azure', 'archive', 'highPriorityRead')) || 0}
                          onChange={(e) => updateAdditionalCost('Azure', 'archive', 'highPriorityRead', Number(e.target.value))}
                          className="w-32 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                          placeholder="0"
                          min="0"
                          step="1"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-[#010101]">
                          High Priority Retrieval (GB)
                        </label>
                        <input
                          type="number"
                          value={Number(getAdditionalCostValue('Azure', 'archive', 'highPriorityRetrieval')) || 0}
                          onChange={(e) => updateAdditionalCost('Azure', 'archive', 'highPriorityRetrieval', Number(e.target.value))}
                          className="w-32 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                          placeholder="0"
                          min="0"
                          step="1"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-[#010101]">
                          Iterative Write Operations (per 100)
                        </label>
                        <input
                          type="number"
                          value={Number(getAdditionalCostValue('Azure', 'archive', 'iterativeWriteOps')) || 0}
                          onChange={(e) => updateAdditionalCost('Azure', 'archive', 'iterativeWriteOps', Number(e.target.value))}
                          className="w-32 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                          placeholder="0"
                          min="0"
                          step="1"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-[#010101]">
                          Data Retrieved (GB)
                        </label>
                        <input
                          type="number"
                          value={Number(getAdditionalCostValue('Azure', 'archive', 'dataRetrieved')) || 0}
                          onChange={(e) => updateAdditionalCost('Azure', 'archive', 'dataRetrieved', Number(e.target.value))}
                          className="w-32 px-2 py-1 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-xs text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                          placeholder="0"
                          min="0"
                          step="1"
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
        </div>

          {/* Back Button */}
          <div className="mt-6 flex justify-start">
            <button
              type="button"
              onClick={handleBack}
              className="px-6 py-2 bg-[#F9F4EE] text-[#010101] border border-[#E5DDD1] rounded-lg text-xs font-semibold hover:bg-[#E5DDD1] transition-colors flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
