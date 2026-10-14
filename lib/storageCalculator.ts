/**
 * Legacy storage calculator stub — AI Gen calculator uses R2 infra fields on BudgetInput.
 * Kept so any residual imports resolve; prefer infra fields in calculator.ts.
 */

export interface TierAllocation {
  hot: number;
  cold: number;
  archive: number;
}

export interface StorageOption {
  id: string;
  name: string;
  provider: string;
  monthlyCostUSD: number;
}

export function calculateStorageCosts(
  _totalSizeGB: number,
  _tierAllocation: TierAllocation,
  _numberOfDatabases: number,
  _additionalCosts?: unknown
): StorageOption[] {
  return [
    {
      id: 'r2-standard',
      name: 'Cloudflare R2 Standard',
      provider: 'Cloudflare',
      monthlyCostUSD: 0,
    },
  ];
}
