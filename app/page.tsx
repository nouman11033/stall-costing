'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BudgetInput, calculateCombinations } from '@/lib/calculator';
import BudgetForm from '@/components/BudgetForm';
import StorageInput, { StorageInput as StorageInputType } from '@/components/StorageInput';
import ThemeToggle from '@/components/ThemeToggle';

export default function Home() {
  const router = useRouter();
  const [isCalculating, setIsCalculating] = useState(false);
  const [storageInput, setStorageInput] = useState<StorageInputType>({
    totalSizeGB: 1000,
    tierAllocation: {
      hot: 600,
      cold: 300,
      archive: 100,
    },
    numberOfDatabases: 1,
  });

  const handleCalculate = (input: BudgetInput) => {
    setIsCalculating(true);
    // Simulate calculation (in case it takes time)
    setTimeout(() => {
      // Merge storage input into budget input
      const fullInput: BudgetInput = {
        ...input,
        storageTotalSizeGB: storageInput.totalSizeGB,
        storageTierAllocation: storageInput.tierAllocation,
        storageNumberOfDatabases: storageInput.numberOfDatabases,
      };
      const combinations = calculateCombinations(fullInput);
      // Store results in localStorage to pass to results page
      localStorage.setItem('calculationResults', JSON.stringify(combinations));
      localStorage.setItem('calculationInput', JSON.stringify(fullInput));
      setIsCalculating(false);
      // Navigate to results page
      router.push('/results');
    }, 100);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-black dark:via-black dark:to-black">
      <ThemeToggle />
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-2xl font-extrabold text-red-600 dark:text-red-500">
                Cost Iterations
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Two Cards Side by Side */}
      <div className="flex flex-col lg:flex-row items-start justify-center min-h-[calc(100vh-73px)] p-4 md:p-8 lg:p-12 gap-6 lg:gap-8">
        {/* Left Card - Storage Configuration */}
        <div className="w-full lg:w-full lg:max-w-lg">
          <StorageInput storageInput={storageInput} onChange={setStorageInput} />
        </div>

        {/* Right Card - Budget Configuration */}
        <div className="w-full lg:w-full lg:max-w-lg">
          <div className="bg-white/80 dark:bg-black/80 backdrop-blur-sm border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl p-8">
            <div className="mb-8 pb-6 border-b border-gray-200/50 dark:border-gray-800/50">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-1 h-8 bg-blue-600 dark:bg-blue-500 rounded-full"></div>
                <div>
                  <h2 className="text-[1.275rem] font-bold text-gray-900 dark:text-white">
                    Configuration
                  </h2>
                  <p className="text-[0.6375rem] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
                    Budget & Usage Parameters
                  </p>
                </div>
              </div>
            </div>
            <BudgetForm onSubmit={handleCalculate} isCalculating={isCalculating} />
          </div>
        </div>
      </div>
    </main>
  );
}
