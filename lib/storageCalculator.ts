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
  monthlyCostUSD: number; // Per database (includes base storage + additional costs)
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

// Additional cost pricing (simplified estimates - these would need actual pricing data)
const ADDITIONAL_COST_PRICING = {
  aws: {
    dataTransferOut: 0.09, // per GB
    putRequest: 0.000005, // per request
    getRequest: 0.0000004, // per request
    dataRetrievalCold: 0.01, // per GB
    dataRetrievalArchive: 0.01, // per GB (Standard)
    dataRetrievalArchiveExpedited: 0.03, // per GB (Expedited)
    retrievalRequestStandard: 0.05, // per request
    retrievalRequestExpedited: 0.03, // per request
  },
  azure: {
    dataTransferOut: 0.087, // per GB
    readOperation: 0.0004, // per 10,000 operations
    writeOperation: 0.005, // per 10,000 operations
    queryDataScanned: 0.01, // per GB
    queryDataReturned: 0.01, // per GB
    iterativeReadOp: 0.0004, // per 10,000 operations
    iterativeWriteOp: 0.005, // per 100 operations
    otherOperation: 0.0004, // per 10,000 operations
    dataRetrievalCold: 0.01, // per GB
    dataRetrievalArchive: 0.01, // per GB
    highPriorityRead: 0.05, // per 100 operations
    highPriorityRetrieval: 0.02, // per GB
  },
};

function calculateAdditionalCosts(
  provider: 'aws' | 'azure',
  tier: 'hot' | 'cold' | 'archive',
  additionalCosts?: any
): number {
  if (!additionalCosts || !additionalCosts[provider] || !additionalCosts[provider][tier]) {
    return 0;
  }

  const tierCosts = additionalCosts[provider][tier];
  const pricing = ADDITIONAL_COST_PRICING[provider];
  let total = 0;

  if (provider === 'aws') {
    // Data Transfer Out
    if (tierCosts.dataTransferOut) {
      total += tierCosts.dataTransferOut * pricing.dataTransferOut;
    }
    // PUT Requests
    if (tierCosts.putRequests) {
      total += tierCosts.putRequests * pricing.putRequest;
    }
    // GET Requests
    if (tierCosts.getRequests) {
      total += tierCosts.getRequests * pricing.getRequest;
    }
    // Data Retrieval (Cold/Archive)
    if ((tier === 'cold' || tier === 'archive') && tierCosts.dataRetrieved) {
      total += tierCosts.dataRetrieved * (tier === 'archive' && tierCosts.retrievalType === 'Expedited' 
        ? pricing.dataRetrievalArchiveExpedited 
        : pricing.dataRetrievalCold);
    }
    // Archive Retrieval Requests
    if (tier === 'archive' && tierCosts.retrievalRequests) {
      const requestPrice = tierCosts.retrievalType === 'Expedited' 
        ? pricing.retrievalRequestExpedited 
        : pricing.retrievalRequestStandard;
      total += tierCosts.retrievalRequests * requestPrice;
    }
  } else if (provider === 'azure') {
    // Data Transfer Out
    if (tierCosts.dataTransferOut) {
      total += tierCosts.dataTransferOut * pricing.dataTransferOut;
    }
    // Read Operations
    if (tierCosts.readOperations) {
      total += (tierCosts.readOperations / 10000) * pricing.readOperation;
    }
    // Write Operations
    if (tierCosts.writeOperations) {
      total += (tierCosts.writeOperations / 10000) * pricing.writeOperation;
    }
    // Query Acceleration
    if (tierCosts.queryDataScanned) {
      total += tierCosts.queryDataScanned * pricing.queryDataScanned;
    }
    if (tierCosts.queryDataReturned) {
      total += tierCosts.queryDataReturned * pricing.queryDataReturned;
    }
    // Iterative Operations
    if (tierCosts.iterativeReadOps) {
      total += (tierCosts.iterativeReadOps / 10000) * pricing.iterativeReadOp;
    }
    if (tierCosts.iterativeWriteOps) {
      total += (tierCosts.iterativeWriteOps / 100) * pricing.iterativeWriteOp;
    }
    // Other Operations (Hot only)
    if (tier === 'hot' && tierCosts.otherOperations) {
      total += (tierCosts.otherOperations / 10000) * pricing.otherOperation;
    }
    // Data Retrieval (Cold/Archive)
    if ((tier === 'cold' || tier === 'archive') && tierCosts.dataRetrieved) {
      total += tierCosts.dataRetrieved * pricing.dataRetrievalCold;
    }
    // High Priority Operations (Archive only)
    if (tier === 'archive') {
      if (tierCosts.highPriorityRead) {
        total += (tierCosts.highPriorityRead / 100) * pricing.highPriorityRead;
      }
      if (tierCosts.highPriorityRetrieval) {
        total += tierCosts.highPriorityRetrieval * pricing.highPriorityRetrieval;
      }
    }
  }

  return total;
}

export function calculateStorageCosts(
  totalSizeGB: number,
  tierAllocation: TierAllocation,
  numberOfDatabases: number,
  additionalCosts?: any
): StorageOption[] {
  const options: StorageOption[] = [];
  
  // Calculate additional costs per tier
  const awsHotAdditional = calculateAdditionalCosts('aws', 'hot', additionalCosts);
  const awsColdAdditional = calculateAdditionalCosts('aws', 'cold', additionalCosts);
  const awsArchiveAdditional = calculateAdditionalCosts('aws', 'archive', additionalCosts);
  const azureHotAdditional = calculateAdditionalCosts('azure', 'hot', additionalCosts);
  const azureColdAdditional = calculateAdditionalCosts('azure', 'cold', additionalCosts);
  const azureArchiveAdditional = calculateAdditionalCosts('azure', 'archive', additionalCosts);
  
  // Calculate tier-based additional costs (weighted by allocation)
  const totalGB = tierAllocation.hot + tierAllocation.cold + tierAllocation.archive;
  const hotWeight = totalGB > 0 ? tierAllocation.hot / totalGB : 0;
  const coldWeight = totalGB > 0 ? tierAllocation.cold / totalGB : 0;
  const archiveWeight = totalGB > 0 ? tierAllocation.archive / totalGB : 0;
  
  const awsAdditionalTotal = (awsHotAdditional * hotWeight) + (awsColdAdditional * coldWeight) + (awsArchiveAdditional * archiveWeight);
  const azureAdditionalTotal = (azureHotAdditional * hotWeight) + (azureColdAdditional * coldWeight) + (azureArchiveAdditional * archiveWeight);

  // Azure Data Lake Storage - LRS
  const dataLakeLRS = PRICING['data-lake-LRS'];
  const dataLakeLRSCost = 
    calculateStorageCost(tierAllocation.hot, dataLakeLRS.hot) +
    calculateStorageCost(tierAllocation.cold, dataLakeLRS.cold) +
    calculateStorageCost(tierAllocation.archive, dataLakeLRS.archive) +
    (tierAllocation.hot * dataLakeLRS.index.hot) +
    (tierAllocation.cold * dataLakeLRS.index.cold) +
    azureAdditionalTotal;
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
    (tierAllocation.cold * dataLakeGRS.index.cold) +
    azureAdditionalTotal;
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
    calculateStorageCost(tierAllocation.archive, blobLRS.archive) +
    azureAdditionalTotal;
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
    calculateStorageCost(tierAllocation.archive, blobGRS.archive) +
    azureAdditionalTotal;
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
    calculateStorageCost(tierAllocation.archive, awsS3.archive) +
    awsAdditionalTotal;
  options.push({
    id: 'aws-s3',
    provider: 'aws',
    label: 'AWS S3',
    monthlyCostUSD: awsS3Cost,
  });

  return options;
}
