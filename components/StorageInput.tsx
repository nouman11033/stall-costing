'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Server, SlidersHorizontal, X } from 'lucide-react';
import type { BudgetInput } from '@/lib/calculator';
import { defaultBudgetInput, deriveWorkloadDerived } from '@/lib/calculator';
import type { WorkloadState } from '@/components/BudgetForm';
import {
  CHAT_VOLUME_PRESETS,
  LLM_MODELS,
  EMBEDDING_MODELS,
  CHAT_TOKEN_BUDGET,
  DEFAULT_CHAT_VOLUME_PRESET_ID,
  tokensFromChatVolumePreset,
  getChatVolumePresetById,
  getEmbeddingModelById,
  type ChatVolumePresetId,
} from '@/lib/pricing';

export type InfraInput = Pick<
  BudgetInput,
  | 'llmInputTokens'
  | 'llmInputPricePer1M'
  | 'llmOutputTokens'
  | 'llmOutputPricePer1M'
  | 'embeddingTokens'
  | 'embeddingPricePer1M'
  | 'vercelMonthlyUSD'
  | 'supabaseMonthlyUSD'
  | 'r2StorageGB'
  | 'r2PricePerGBUSD'
  | 'r2RequestsUSD'
  | 'workerMonthlyUSD'
  | 'monitoringMonthlyUSD'
  | 'embeddingModelId'
  | 'selectedLlmModelIds'
  | 'chatVolumePresetId'
  | 'llmTokensManualEdit'
>;

type AutoField = 'r2StorageGB' | 'r2RequestsUSD';

export function defaultInfraInput(): InfraInput {
  const d = defaultBudgetInput();
  return {
    llmInputTokens: d.llmInputTokens,
    llmInputPricePer1M: d.llmInputPricePer1M,
    llmOutputTokens: d.llmOutputTokens,
    llmOutputPricePer1M: d.llmOutputPricePer1M,
    embeddingTokens: d.embeddingTokens,
    embeddingPricePer1M: d.embeddingPricePer1M,
    vercelMonthlyUSD: d.vercelMonthlyUSD,
    supabaseMonthlyUSD: d.supabaseMonthlyUSD,
    r2StorageGB: d.r2StorageGB,
    r2PricePerGBUSD: d.r2PricePerGBUSD,
    r2RequestsUSD: d.r2RequestsUSD,
    workerMonthlyUSD: d.workerMonthlyUSD,
    monitoringMonthlyUSD: d.monitoringMonthlyUSD,
    embeddingModelId: d.embeddingModelId,
    selectedLlmModelIds: d.selectedLlmModelIds,
    chatVolumePresetId: d.chatVolumePresetId,
    llmTokensManualEdit: d.llmTokensManualEdit,
  };
}

interface StorageInputProps {
  infraInput: InfraInput;
  onChange: (input: InfraInput) => void;
  workload: WorkloadState;
}

function Field({
  label,
  value,
  onChange,
  step = 1,
  hint,
  disabled,
  isAuto,
  onReset,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  hint?: string;
  disabled?: boolean;
  isAuto?: boolean;
  onReset?: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <label className="block text-xs font-semibold text-[#010101]">{label}</label>
        {isAuto !== undefined && (
          <button
            type="button"
            onClick={onReset}
            disabled={isAuto}
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border transition-all ${
              isAuto
                ? 'bg-[#010101] text-white border-[#010101] cursor-default'
                : 'bg-[#F9F4EE] text-[#010101] border-[#E5DDD1] hover:border-[#010101]'
            }`}
            title={isAuto ? 'Auto from workload' : 'Reset to auto'}
          >
            {isAuto ? 'Auto' : 'Reset'}
          </button>
        )}
      </div>
      <input
        type="number"
        value={value}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`show-spinner w-full px-3 py-2 border rounded-lg text-sm text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101] ${
          disabled
            ? 'bg-[#E5DDD1]/60 border-[#D4CCC0] cursor-not-allowed opacity-80'
            : 'bg-[#F9F4EE] border-[#E5DDD1]'
        }`}
        min="0"
      />
      {hint && <p className="text-[10px] text-[#4F4F4E] mt-0.5">{hint}</p>}
    </div>
  );
}

export default function StorageInput({ infraInput, onChange, workload }: StorageInputProps) {
  const [overrides, setOverrides] = useState<Set<AutoField>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const lastDerivedKey = useRef('');

  const presetId = infraInput.chatVolumePresetId || DEFAULT_CHAT_VOLUME_PRESET_ID;
  const preset = getChatVolumePresetById(presetId);
  const manualEdit = !!infraInput.llmTokensManualEdit;
  const selectedLlms = infraInput.selectedLlmModelIds || LLM_MODELS.map((m) => m.id);

  const derived = useMemo(
    () =>
      deriveWorkloadDerived({
        imagesPerMonth: workload.imagesPerMonth,
        modelsPerMonth: workload.modelsPerMonth,
        imageRetryFraction: workload.imageRetryFraction,
        modelRetryFraction: workload.modelRetryFraction,
      }),
    [
      workload.imagesPerMonth,
      workload.modelsPerMonth,
      workload.imageRetryFraction,
      workload.modelRetryFraction,
    ]
  );

  useEffect(() => {
    const key = `${derived.assetStorageGB}|${derived.r2RequestsUSD}`;
    if (key === lastDerivedKey.current) return;
    lastDerivedKey.current = key;

    const next = { ...infraInput };
    if (!overrides.has('r2StorageGB')) next.r2StorageGB = derived.assetStorageGB;
    if (!overrides.has('r2RequestsUSD')) next.r2RequestsUSD = derived.r2RequestsUSD;
    onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derived, overrides]);

  const setManual = <K extends keyof InfraInput>(key: K, value: InfraInput[K]) => {
    if (key === 'r2StorageGB' || key === 'r2RequestsUSD') {
      setOverrides((prev) => new Set(prev).add(key as AutoField));
    }
    onChange({ ...infraInput, [key]: value });
  };

  const resetField = (field: AutoField) => {
    setOverrides((prev) => {
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
    const map: Record<AutoField, number> = {
      r2StorageGB: derived.assetStorageGB,
      r2RequestsUSD: derived.r2RequestsUSD,
    };
    onChange({ ...infraInput, [field]: map[field] });
  };

  const isAuto = (field: AutoField) => !overrides.has(field);

  const applyChatVolume = (id: ChatVolumePresetId) => {
    const tokens = tokensFromChatVolumePreset(id);
    onChange({
      ...infraInput,
      chatVolumePresetId: id,
      llmTokensManualEdit: false,
      llmInputTokens: tokens.llmInputTokens,
      llmOutputTokens: tokens.llmOutputTokens,
      embeddingTokens: tokens.embeddingTokens,
    });
  };

  const toggleManualEdit = () => {
    if (manualEdit) {
      const tokens = tokensFromChatVolumePreset(presetId);
      onChange({
        ...infraInput,
        llmTokensManualEdit: false,
        llmInputTokens: tokens.llmInputTokens,
        llmOutputTokens: tokens.llmOutputTokens,
        embeddingTokens: tokens.embeddingTokens,
      });
    } else {
      onChange({ ...infraInput, llmTokensManualEdit: true });
      setDrawerOpen(true);
    }
  };

  const toggleLlm = (id: string) => {
    if (selectedLlms.includes(id)) {
      if (selectedLlms.length === 1) return;
      setManual(
        'selectedLlmModelIds',
        selectedLlms.filter((x) => x !== id)
      );
    } else {
      setManual('selectedLlmModelIds', [...selectedLlms, id]);
    }
  };

  const toggleAllLlms = () => {
    if (selectedLlms.length === LLM_MODELS.length) {
      setManual('selectedLlmModelIds', [LLM_MODELS[0].id]);
    } else {
      setManual(
        'selectedLlmModelIds',
        LLM_MODELS.map((m) => m.id)
      );
    }
  };

  const setEmbedding = (id: string) => {
    const emb = getEmbeddingModelById(id);
    onChange({
      ...infraInput,
      embeddingModelId: emb.id,
      embeddingPricePer1M: emb.pricePer1MUSD,
    });
  };

  const tokenBudgetLabel = `${(CHAT_TOKEN_BUDGET.totalTokens / 1_000_000).toFixed(1)}M tokens`;
  const fixedInfraTotal =
    infraInput.vercelMonthlyUSD +
    infraInput.supabaseMonthlyUSD +
    infraInput.workerMonthlyUSD +
    infraInput.monitoringMonthlyUSD;

  return (
    <div className="h-full relative">
      <div className="relative flex h-[740px] flex-col overflow-hidden rounded-2xl border border-[#E5DDD1] bg-white/80 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-[#010101] hover:shadow-md">
        {/* Left drawer — Token Budget + Fixed Infra */}
        <div
          className={`absolute inset-y-0 left-0 z-30 flex w-[min(100%,320px)] flex-col border-r border-[#E5DDD1] bg-white shadow-xl transition-transform duration-300 ease-out ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          aria-hidden={!drawerOpen}
        >
          <div className="flex items-center justify-between border-b border-[#E5DDD1] px-4 py-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#010101]" />
              <span className="text-sm font-bold text-[#010101]">Budget & Infra</span>
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="p-1.5 rounded-lg border border-[#E5DDD1] hover:border-[#010101] transition-colors"
              aria-label="Close drawer"
            >
              <X className="w-4 h-4 text-[#010101]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#4F4F4E] mb-2">
                Token Budget {manualEdit ? '(editable)' : '(from chat volume)'}
              </p>
              <p className="text-[10px] text-[#4F4F4E] mb-3">
                Updates when you pick Short / Normal / Detailed / Very long
                {manualEdit ? ' — unlocked for override' : ''}.
              </p>
              <div className="grid grid-cols-1 gap-3">
                <Field
                  label="LLM Input Tokens / mo"
                  value={infraInput.llmInputTokens}
                  onChange={(n) => setManual('llmInputTokens', n)}
                  disabled={!manualEdit}
                  hint={manualEdit ? 'Manual override' : 'Auto from chat volume'}
                />
                <Field
                  label="LLM Output Tokens / mo"
                  value={infraInput.llmOutputTokens}
                  onChange={(n) => setManual('llmOutputTokens', n)}
                  disabled={!manualEdit}
                />
                <Field
                  label="Embedding Tokens / mo"
                  value={infraInput.embeddingTokens}
                  onChange={(n) => setManual('embeddingTokens', n)}
                  disabled={!manualEdit}
                />
                <Field
                  label="Embedding $/1M"
                  value={infraInput.embeddingPricePer1M}
                  onChange={(n) => setManual('embeddingPricePer1M', n)}
                  step={0.01}
                  hint="Set by embedding model"
                />
              </div>
            </div>

            <div className="border-t border-[#E5DDD1] pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#4F4F4E] mb-2">
                Fixed infra (USD / mo)
              </p>
              <p className="text-[10px] text-[#4F4F4E] mb-3">Same on every combo · R2 holds 2D/3D</p>
              <div className="grid grid-cols-1 gap-3">
                <Field
                  label="Vercel"
                  value={infraInput.vercelMonthlyUSD}
                  onChange={(n) => setManual('vercelMonthlyUSD', n)}
                />
                <Field
                  label="Supabase Pro"
                  value={infraInput.supabaseMonthlyUSD}
                  onChange={(n) => setManual('supabaseMonthlyUSD', n)}
                />
                <Field
                  label="Asset Storage (GB)"
                  value={infraInput.r2StorageGB}
                  onChange={(n) => setManual('r2StorageGB', n)}
                  isAuto={isAuto('r2StorageGB')}
                  onReset={() => resetField('r2StorageGB')}
                  hint="All asset GB billed on Cloudflare R2"
                />
                <Field
                  label="R2 $/GB-month"
                  value={infraInput.r2PricePerGBUSD}
                  onChange={(n) => setManual('r2PricePerGBUSD', n)}
                  step={0.001}
                />
                <Field
                  label="R2 Requests $"
                  value={infraInput.r2RequestsUSD}
                  onChange={(n) => setManual('r2RequestsUSD', n)}
                  isAuto={isAuto('r2RequestsUSD')}
                  onReset={() => resetField('r2RequestsUSD')}
                />
                <Field
                  label="Worker / Queue $"
                  value={infraInput.workerMonthlyUSD}
                  onChange={(n) => setManual('workerMonthlyUSD', n)}
                />
                <Field
                  label="Monitoring / Email $"
                  value={infraInput.monitoringMonthlyUSD}
                  onChange={(n) => setManual('monitoringMonthlyUSD', n)}
                />
              </div>
            </div>
          </div>
        </div>

        {drawerOpen && (
          <button
            type="button"
            className="absolute inset-0 z-20 bg-black/10"
            aria-label="Close drawer overlay"
            onClick={() => setDrawerOpen(false)}
          />
        )}

        <div className="bg-white border-b border-[#E5DDD1] p-6 flex-shrink-0 relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-[#010101] rounded-xl flex items-center justify-center">
              <Server className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2
                className="text-2xl font-bold text-[#010101]"
                style={{
                  fontFamily:
                    'Avenir, var(--font-app), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}
              >
                Infra + LLM
              </h2>
              <p className="text-[10px] text-[#4F4F4E] mt-0.5">
                Chat volume presets · LLM is a combination axis
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 pb-20 flex-1 overflow-hidden relative z-10">
          <div className="space-y-4">
            {/* Chat volume */}
            <div>
              <div className="flex items-center justify-between mb-2 gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#4F4F4E]">
                  Chat Volume
                </p>
                <button
                  type="button"
                  onClick={toggleManualEdit}
                  className={`text-[10px] font-semibold px-2 py-1 rounded-md border transition-all ${
                    manualEdit
                      ? 'bg-[#010101] text-white border-[#010101]'
                      : 'bg-[#F9F4EE] text-[#010101] border-[#E5DDD1] hover:border-[#010101]'
                  }`}
                >
                  {manualEdit ? 'Using Manual Edit' : 'Manual Edit'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {CHAT_VOLUME_PRESETS.map((p) => {
                  const active = presetId === p.id && !manualEdit;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyChatVolume(p.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        active
                          ? 'bg-[#010101] text-white border-[#010101]'
                          : 'bg-[#F9F4EE] text-[#010101] border-[#E5DDD1] hover:border-[#010101]'
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
              <div className="rounded-lg border border-[#E5DDD1] bg-[#F9F4EE] px-3 py-2 text-[10px] text-[#4F4F4E] space-y-0.5">
                <div className="flex justify-between">
                  <span>Preset</span>
                  <span className="font-semibold text-[#010101]">
                    {manualEdit ? 'Manual' : preset.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Est. chats / mo</span>
                  <span className="font-semibold text-[#010101]">
                    {preset.estimatedChats.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Words / chat</span>
                  <span className="font-semibold text-[#010101]">
                    ~{preset.totalWordsPerChat.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-[#E5DDD1] mt-1">
                  <span>Token budget</span>
                  <span className="font-semibold text-[#010101]">{tokenBudgetLabel}</span>
                </div>
              </div>
            </div>

            {/* LLM combination axis */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#4F4F4E]">
                  LLM Models (combination)
                </p>
                <button
                  type="button"
                  onClick={toggleAllLlms}
                  className="text-[10px] font-semibold text-[#010101] underline"
                >
                  {selectedLlms.length === LLM_MODELS.length ? 'Clear to one' : 'Select all'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {LLM_MODELS.map((m) => {
                  const active = selectedLlms.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleLlm(m.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                        active
                          ? 'bg-[#010101] text-white border-[#010101]'
                          : 'bg-[#F9F4EE] text-[#010101] border-[#E5DDD1] hover:border-[#010101]'
                      }`}
                      title={`${m.provider} · $${m.inputPer1MUSD}/$${m.outputPer1MUSD} per 1M`}
                    >
                      {m.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-[#4F4F4E] mt-1.5">
                Each selected model becomes its own combo with Image × 3D × R2
              </p>
            </div>

            {/* Embedding */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#4F4F4E] mb-2">
                Embedding Model
              </p>
              <div className="flex flex-wrap gap-2">
                {EMBEDDING_MODELS.map((m) => {
                  const active = (infraInput.embeddingModelId || EMBEDDING_MODELS[0].id) === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setEmbedding(m.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                        active
                          ? 'bg-[#010101] text-white border-[#010101]'
                          : 'bg-[#F9F4EE] text-[#010101] border-[#E5DDD1] hover:border-[#010101]'
                      }`}
                    >
                      {m.name} · ${m.pricePer1MUSD}/1M
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        {/* Bottom-left Budget button — opens drawer from the left */}
        <div className="absolute bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-3 border-t border-[#E5DDD1] bg-white/95 px-4 py-3 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setDrawerOpen((o) => !o)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-md transition-all ${
              drawerOpen
                ? 'bg-[#1a1a1a] text-white border border-[#010101]'
                : 'bg-[#010101] text-white hover:bg-[#1a1a1a]'
            }`}
            title={drawerOpen ? 'Close budget drawer' : 'Open budget drawer from the left'}
          >
            {drawerOpen ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <SlidersHorizontal className="w-4 h-4" />
            )}
            Budget
            {!drawerOpen && <ChevronRight className="w-3.5 h-3.5 opacity-80" />}
          </button>
          <p className="text-[10px] text-[#4F4F4E] text-right leading-snug max-w-[55%]">
            {tokenBudgetLabel} · fixed ~${fixedInfraTotal.toFixed(0)}/mo + R2
            <span className="block text-[#4F4F4E]/80">Opens from the left</span>
          </p>
        </div>
      </div>
    </div>
  );
}
