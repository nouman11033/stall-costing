'use client';

import { useState } from 'react';

export interface StorageInput {
  totalSizeGB: number;
  tierAllocation: {
    hot: number; // in GB
    cold: number; // in GB
    archive: number; // in GB
  };
  numberOfDatabases: number;
}

interface StorageInputProps {
  storageInput: StorageInput;
  onChange: (input: StorageInput) => void;
}

export default function StorageInput({ storageInput, onChange }: StorageInputProps) {
  const maxSizeGB = 500 * 1024; // 500 TB in GB

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

  const handleAbsoluteChange = (tier: keyof typeof storageInput.tierAllocation, valueGB: number) => {
    const newValue = Math.max(0, Math.min(storageInput.totalSizeGB, valueGB));
    const newAllocation = { ...storageInput.tierAllocation };
    newAllocation[tier] = newValue;
    onChange({
      ...storageInput,
      tierAllocation: newAllocation,
    });
  };

  return (
    <div className="bg-white/80 dark:bg-black/80 backdrop-blur-sm border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl p-8">
      <div className="mb-8 pb-6 border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-1 h-8 bg-purple-600 dark:bg-purple-500 rounded-full"></div>
          <div>
            <h2 className="text-[1.275rem] font-bold text-gray-900 dark:text-white">
              Storage Configuration
            </h2>
            <p className="text-[0.6375rem] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
              Azure & AWS Storage Parameters
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Number of Databases */}
        <div className="space-y-2.5">
          <label className="block text-[0.6375rem] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
            Number of Databases (1-75)
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
            className="w-full px-5 py-3.5 border border-gray-300/50 dark:border-gray-700/50 rounded-2xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 bg-white/80 dark:bg-gray-900/50 backdrop-blur-sm text-gray-900 dark:text-white font-semibold shadow-sm hover:shadow-md transition-all duration-200 text-[0.85rem]"
            required
          />
        </div>

        {/* Total Storage Size */}
        <div className="space-y-2.5">
          <label className="block text-[0.6375rem] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
            Total Storage Size per Database (GB)
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
            className="w-full px-5 py-3.5 border border-gray-300/50 dark:border-gray-700/50 rounded-2xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 bg-white/80 dark:bg-gray-900/50 backdrop-blur-sm text-gray-900 dark:text-white font-semibold shadow-sm hover:shadow-md transition-all duration-200 text-[0.85rem]"
            required
          />
          <p className="text-[0.6375rem] text-gray-500 dark:text-gray-400">
            Max: {maxSizeGB.toLocaleString('en-US')} GB ({(maxSizeGB / 1024).toLocaleString('en-US')} TB)
          </p>
        </div>

        {/* Tier Allocation */}
        <div className="space-y-4">
          <label className="block text-[0.6375rem] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
            Tier Allocation
          </label>
          {(['hot', 'cold', 'archive'] as const).map((tier) => (
            <div key={tier} className="space-y-2.5">
              <div className="flex justify-between items-center">
                <label className="block text-[0.6375rem] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 capitalize">
                  {tier} Tier
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={percentages[tier].toFixed(1)}
                    onChange={(e) => handlePercentageChange(tier, parseFloat(e.target.value))}
                    className="w-16 px-2 py-1 border border-gray-300/50 dark:border-gray-700/50 rounded-lg text-xs text-right font-semibold bg-white dark:bg-gray-900 focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-xs text-gray-500 font-semibold">%</span>
                  <input
                    type="number"
                    min="0"
                    max={storageInput.totalSizeGB}
                    step="1"
                    value={Math.round(storageInput.tierAllocation[tier])}
                    onChange={(e) => handleAbsoluteChange(tier, parseFloat(e.target.value))}
                    className="w-20 px-2 py-1 border border-gray-300/50 dark:border-gray-700/50 rounded-lg text-xs text-right font-semibold bg-white dark:bg-gray-900 focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-xs text-gray-500 font-semibold">GB</span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={percentages[tier]}
                onChange={(e) => handlePercentageChange(tier, parseFloat(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-purple-600"
                style={{
                  background: `linear-gradient(to right, rgb(147, 51, 234) 0%, rgb(147, 51, 234) ${percentages[tier]}%, rgb(229, 231, 235) ${percentages[tier]}%, rgb(229, 231, 235) 100%)`
                }}
              />
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="pt-4 border-t border-gray-200/50 dark:border-gray-800/50">
          <div className="flex justify-between items-center text-[0.6375rem]">
            <span className="font-bold text-gray-700 dark:text-gray-300">
              Total Allocated: {Math.round(totalAllocated).toLocaleString('en-US')} GB
            </span>
            <span className={`font-bold ${
              Math.abs(totalPercentage - 100) < 0.1 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {totalPercentage.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
