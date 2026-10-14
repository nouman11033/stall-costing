'use client';

import { useEffect } from 'react';
import { ImageIcon } from 'lucide-react';
import { BudgetInput, defaultBudgetInput } from '@/lib/calculator';
import type { StorageStackId } from '@/lib/pricing';
import {
  IMAGE_PROVIDER_OPTIONS,
  THREED_PROVIDER_OPTIONS,
  DEFAULT_STORAGE_STACK_ID,
} from '@/lib/pricing';

export interface WorkloadState {
  imagesPerMonth: number;
  modelsPerMonth: number;
  imageRetryFraction: number;
  modelRetryFraction: number;
  usdToInr: number;
  selectedImageProviders: string[];
  selectedThreeDProviders: string[];
  /** Always R2 — kept for submit payload compatibility */
  selectedStorageStacks: StorageStackId[];
}

interface BudgetFormProps {
  onSubmit: (input: BudgetInput) => void;
  isCalculating: boolean;
  infraInput?: Partial<BudgetInput>;
  workload: WorkloadState;
  onWorkloadChange: (workload: WorkloadState) => void;
}

export default function BudgetForm({
  onSubmit,
  isCalculating,
  infraInput,
  workload,
  onWorkloadChange,
}: BudgetFormProps) {
  const {
    imagesPerMonth,
    modelsPerMonth,
    imageRetryFraction,
    modelRetryFraction,
    usdToInr,
    selectedImageProviders: imageProviders,
    selectedThreeDProviders: threeDProviders,
  } = workload;

  const imageRetryPercent = Math.round(imageRetryFraction * 100);
  const modelRetryPercent = Math.round(modelRetryFraction * 100);

  const patch = (partial: Partial<WorkloadState>) => {
    onWorkloadChange({ ...workload, ...partial });
  };

  const toggleProvider = (
    provider: string,
    providers: string[],
    key: 'selectedImageProviders' | 'selectedThreeDProviders'
  ) => {
    if (providers.includes(provider)) {
      if (providers.length === 1) return;
      patch({ [key]: providers.filter((p) => p !== provider) });
    } else {
      patch({ [key]: [...providers, provider] });
    }
  };

  const isAllSelected = (options: { id: string }[], providers: string[]) =>
    options.every((option) => providers.includes(option.id));

  const toggleSelectAll = (
    options: { id: string }[],
    providers: string[],
    key: 'selectedImageProviders' | 'selectedThreeDProviders'
  ) => {
    if (isAllSelected(options, providers)) {
      patch({ [key]: [options[0].id] });
    } else {
      patch({ [key]: options.map((o) => o.id) });
    }
  };

  // silence unused
  useEffect(() => {}, [isCalculating]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (imageProviders.length === 0 || threeDProviders.length === 0) {
      return;
    }

    const base = defaultBudgetInput();
    onSubmit({
      ...base,
      ...infraInput,
      imagesPerMonth,
      modelsPerMonth,
      imageRetryFraction,
      modelRetryFraction,
      usdToInr,
      selectedImageProviders: imageProviders,
      selectedThreeDProviders: threeDProviders,
      selectedStorageStacks: [DEFAULT_STORAGE_STACK_ID],
      minImagesPerMonth: Math.max(100, Math.round(imagesPerMonth * 0.25)),
      maxImagesPerMonth: Math.max(imagesPerMonth, Math.round(imagesPerMonth * 3)),
      minModelsPerMonth: Math.max(20, Math.round(modelsPerMonth * 0.25)),
      maxModelsPerMonth: Math.max(modelsPerMonth, Math.round(modelsPerMonth * 3)),
    });
  };

  return (
    <form id="budget-form" onSubmit={handleSubmit} className="h-full">
      <div className="flex h-[740px] flex-col overflow-hidden rounded-2xl border border-[#E5DDD1] bg-white/80 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-[#010101] hover:shadow-md">
        <div className="bg-white border-b border-[#E5DDD1] p-6 flex-shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-[#010101] rounded-xl flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-white" />
            </div>
            <h2
              className="text-2xl font-bold text-[#010101]"
              style={{
                fontFamily:
                  'Avenir, var(--font-app), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              }}
            >
              Generation Workload
            </h2>
          </div>
        </div>

        <div className="p-6 flex-1 flex flex-col overflow-hidden">
          <div className="space-y-4 flex-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#010101] mb-1.5">
                  Images per Month
                </label>
                <input
                  type="number"
                  value={imagesPerMonth}
                  onChange={(e) => patch({ imagesPerMonth: Number(e.target.value) })}
                  className="show-spinner w-full px-3 py-2 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-sm text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                  min="1"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#010101] mb-1.5">
                  3D Models per Month
                </label>
                <input
                  type="number"
                  value={modelsPerMonth}
                  onChange={(e) => patch({ modelsPerMonth: Number(e.target.value) })}
                  className="show-spinner w-full px-3 py-2 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-sm text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                  min="1"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#010101] mb-1.5">
                  Image Retries (%)
                </label>
                <input
                  type="number"
                  value={imageRetryPercent}
                  onChange={(e) =>
                    patch({ imageRetryFraction: Number(e.target.value) / 100 })
                  }
                  className="show-spinner w-full px-3 py-2 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-sm text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                  min="0"
                  max="100"
                  step="1"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#010101] mb-1.5">
                  3D Retries (%)
                </label>
                <input
                  type="number"
                  value={modelRetryPercent}
                  onChange={(e) =>
                    patch({ modelRetryFraction: Number(e.target.value) / 100 })
                  }
                  className="show-spinner w-full px-3 py-2 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-sm text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                  min="0"
                  max="100"
                  step="1"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#010101] mb-1.5">
                USD → INR Rate
              </label>
              <input
                type="number"
                value={usdToInr}
                onChange={(e) => patch({ usdToInr: Number(e.target.value) })}
                className="show-spinner w-full px-3 py-2 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-sm text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                min="1"
                step="0.1"
              />
              <p className="text-[10px] text-[#4F4F4E] mt-1">
                Editable planning assumption, not live FX.
              </p>
            </div>

            {/* Image Provider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-[#010101]">Image Provider</label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAllSelected(IMAGE_PROVIDER_OPTIONS, imageProviders)}
                    onChange={() =>
                      toggleSelectAll(
                        IMAGE_PROVIDER_OPTIONS,
                        imageProviders,
                        'selectedImageProviders'
                      )
                    }
                    className="w-3.5 h-3.5 rounded border-[#E5DDD1] text-[#010101] focus:ring-[#010101] cursor-pointer"
                  />
                  <span className="text-[10px] font-medium text-[#4F4F4E]">Select All</span>
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {IMAGE_PROVIDER_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() =>
                      toggleProvider(option.id, imageProviders, 'selectedImageProviders')
                    }
                    disabled={imageProviders.length === 1 && imageProviders.includes(option.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      imageProviders.includes(option.id)
                        ? 'bg-[#010101] text-white border-[#010101]'
                        : 'bg-[#F9F4EE] text-[#010101] border-[#E5DDD1] hover:border-[#010101]'
                    } ${imageProviders.length === 1 && imageProviders.includes(option.id) ? 'opacity-75 cursor-not-allowed' : ''}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3D Provider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-[#010101]">3D Provider</label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAllSelected(THREED_PROVIDER_OPTIONS, threeDProviders)}
                    onChange={() =>
                      toggleSelectAll(
                        THREED_PROVIDER_OPTIONS,
                        threeDProviders,
                        'selectedThreeDProviders'
                      )
                    }
                    className="w-3.5 h-3.5 rounded border-[#E5DDD1] text-[#010101] focus:ring-[#010101] cursor-pointer"
                  />
                  <span className="text-[10px] font-medium text-[#4F4F4E]">Select All</span>
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {THREED_PROVIDER_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() =>
                      toggleProvider(option.id, threeDProviders, 'selectedThreeDProviders')
                    }
                    disabled={threeDProviders.length === 1 && threeDProviders.includes(option.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      threeDProviders.includes(option.id)
                        ? 'bg-[#010101] text-white border-[#010101]'
                        : 'bg-[#F9F4EE] text-[#010101] border-[#E5DDD1] hover:border-[#010101]'
                    } ${threeDProviders.length === 1 && threeDProviders.includes(option.id) ? 'opacity-75 cursor-not-allowed' : ''}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Storage — always R2 */}
            <div className="rounded-lg border border-[#E5DDD1] bg-[#F9F4EE] px-3 py-2.5">
              <label className="block text-xs font-semibold text-[#010101] mb-1">
                Asset Storage
              </label>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#010101] text-white">
                  Cloudflare R2
                </span>
                <span className="text-[10px] text-[#4F4F4E]">
                  Always on every card · 2D + 3D assets
                </span>
              </div>
              <p className="text-[10px] text-[#4F4F4E] mt-1.5">
                Supabase Pro is fixed app/DB infra — not a substitute for R2 media storage.
              </p>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

export function defaultWorkloadState(): WorkloadState {
  const d = defaultBudgetInput();
  return {
    imagesPerMonth: d.imagesPerMonth,
    modelsPerMonth: d.modelsPerMonth,
    imageRetryFraction: d.imageRetryFraction,
    modelRetryFraction: d.modelRetryFraction,
    usdToInr: d.usdToInr,
    selectedImageProviders: d.selectedImageProviders || ['google', 'bfl', 'ideogram', 'openai'],
    selectedThreeDProviders: d.selectedThreeDProviders || ['tripo', 'meshy', 'rodin'],
    selectedStorageStacks: [DEFAULT_STORAGE_STACK_ID],
  };
}
