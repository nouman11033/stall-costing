/**
 * Simplified Storage Cost Calculator
 * Calculates storage costs for 5 storage options: Azure Data Lake LRS/GRS, Azure Blob LRS/GRS, AWS S3
 */

export interface TierAllocation {
  hot: number; // in GB
  cold: number; // in GB
  archive: number; // in GB
}

export interface StorageOption {
  id: string;
  provider: 'azure' | 'aws';
  storageType?: 'data-lake' | 'blob';
  replication?: 'LRS' | 'GRS';
  label: string;
  monthlyCostUSD: number; // Per database
}

// Simplified pricing (per GB per month in USD)
const PRICING = {
  'data-lake-LRS': {
    hot: [
      { range: { min: 0, max: 51200 }, pricePerGB: 0.021 },
      { range: { min: 51200, max: 512000 }, pricePerGB: 0.020 },
      { range: { min: 512000, max: null }, pricePerGB: 0.020 },
    ],
    cold: [{ range: { min: 0, max: null }, pricePerGB: 0.0036 }],
    archive: [{ range: { min: 0, max: null }, pricePerGB: 0.001 }],
    index: { hot: 0.0297, cold: 0.0297 }, // per GB for data lake
  },
  'data-lake-GRS': {
    hot: [
      { range: { min: 0, max: 51200 }, pricePerGB: 0.042 },
      { range: { min: 51200, max: 512000 }, pricePerGB: 0.040 },
      { range: { min: 512000, max: null }, pricePerGB: 0.040 },
    ],
    cold: [{ range: { min: 0, max: null }, pricePerGB: 0.0081 }],
    archive: [{ range: { min: 0, max: null }, pricePerGB: 0.00299 }],
    index: { hot: 0.0297, cold: 0.0297 },
  },
  'blob-LRS': {
    hot: [
      { range: { min: 0, max: 51200 }, pricePerGB: 0.021 },
      { range: { min: 51200, max: 512000 }, pricePerGB: 0.020 },
      { range: { min: 512000, max: null }, pricePerGB: 0.020 },
    ],
    cold: [{ range: { min: 0, max: null }, pricePerGB: 0.0036 }],
    archive: [{ range: { min: 0, max: null }, pricePerGB: 0.00099 }],
  },
  'blob-GRS': {
    hot: [
      { range: { min: 0, max: 51200 }, pricePerGB: 0.046 },
      { range: { min: 51200, max: 512000 }, pricePerGB: 0.044 },
      { range: { min: 512000, max: null }, pricePerGB: 0.0421 },
    ],
    cold: [{ range: { min: 0, max: null }, pricePerGB: 0.0081 }],
    archive: [{ range: { min: 0, max: null }, pricePerGB: 0.00299 }],
  },
  'aws-s3': {
    hot: [{ range: { min: 0, max: null }, pricePerGB: 0.023 }],
    cold: [{ range: { min: 0, max: null }, pricePerGB: 0.0125 }],
    archive: [{ range: { min: 0, max: null }, pricePerGB: 0.0036 }],
  },
};

function calculateStorageCost(
  sizeGB: number,
  pricingSlabs: Array<{ range: { min: number; max: number | null }; pricePerGB: number }>
): number {
  if (sizeGB <= 0) return 0;

  let remainingGB = sizeGB;
  let totalCost = 0;

  for (const slab of pricingSlabs) {
    if (remainingGB <= 0) break;

    const slabMin = slab.range.min;
    const slabMax = slab.range.max;
    const slabSize = slabMax === null 
      ? remainingGB 
      : Math.min(remainingGB, slabMax - slabMin);

    if (slabSize > 0) {
      totalCost += slabSize * slab.pricePerGB;
      remainingGB -= slabSize;
    }
  }

  return totalCost;
}

export function calculateStorageCosts(
  totalSizeGB: number,
  tierAllocation: TierAllocation,
  numberOfDatabases: number
): StorageOption[] {
  const options: StorageOption[] = [];

  // Azure Data Lake Storage - LRS
  const dataLakeLRS = PRICING['data-lake-LRS'];
  const dataLakeLRSCost = 
    calculateStorageCost(tierAllocation.hot, dataLakeLRS.hot) +
    calculateStorageCost(tierAllocation.cold, dataLakeLRS.cold) +
    calculateStorageCost(tierAllocation.archive, dataLakeLRS.archive) +
    (tierAllocation.hot * dataLakeLRS.index.hot) +
    (tierAllocation.cold * dataLakeLRS.index.cold);
  options.push({
    id: 'data-lake-LRS',
    provider: 'azure',
    storageType: 'data-lake',
    replication: 'LRS',
    label: 'Azure Data Lake Storage (LRS)',
    monthlyCostUSD: dataLakeLRSCost,
  });

  // Azure Data Lake Storage - GRS
  const dataLakeGRS = PRICING['data-lake-GRS'];
  const dataLakeGRSCost = 
    calculateStorageCost(tierAllocation.hot, dataLakeGRS.hot) +
    calculateStorageCost(tierAllocation.cold, dataLakeGRS.cold) +
    calculateStorageCost(tierAllocation.archive, dataLakeGRS.archive) +
    (tierAllocation.hot * dataLakeGRS.index.hot) +
    (tierAllocation.cold * dataLakeGRS.index.cold);
  options.push({
    id: 'data-lake-GRS',
    provider: 'azure',
    storageType: 'data-lake',
    replication: 'GRS',
    label: 'Azure Data Lake Storage (GRS)',
    monthlyCostUSD: dataLakeGRSCost,
  });

  // Azure Blob Storage - LRS
  const blobLRS = PRICING['blob-LRS'];
  const blobLRSCost = 
    calculateStorageCost(tierAllocation.hot, blobLRS.hot) +
    calculateStorageCost(tierAllocation.cold, blobLRS.cold) +
    calculateStorageCost(tierAllocation.archive, blobLRS.archive);
  options.push({
    id: 'blob-LRS',
    provider: 'azure',
    storageType: 'blob',
    replication: 'LRS',
    label: 'Azure Blob Storage (LRS)',
    monthlyCostUSD: blobLRSCost,
  });

  // Azure Blob Storage - GRS
  const blobGRS = PRICING['blob-GRS'];
  const blobGRSCost = 
    calculateStorageCost(tierAllocation.hot, blobGRS.hot) +
    calculateStorageCost(tierAllocation.cold, blobGRS.cold) +
    calculateStorageCost(tierAllocation.archive, blobGRS.archive);
  options.push({
    id: 'blob-GRS',
    provider: 'azure',
    storageType: 'blob',
    replication: 'GRS',
    label: 'Azure Blob Storage (GRS)',
    monthlyCostUSD: blobGRSCost,
  });

  // AWS S3
  const awsS3 = PRICING['aws-s3'];
  const awsS3Cost = 
    calculateStorageCost(tierAllocation.hot, awsS3.hot) +
    calculateStorageCost(tierAllocation.cold, awsS3.cold) +
    calculateStorageCost(tierAllocation.archive, awsS3.archive);
  options.push({
    id: 'aws-s3',
    provider: 'aws',
    label: 'AWS S3',
    monthlyCostUSD: awsS3Cost,
  });

  return options;
}
