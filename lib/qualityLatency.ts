import { Combination } from './calculator';

// Provider quality scores (1-10 scale)
const AVATAR_PROVIDER_QUALITY: Record<string, number> = {
  'heygen': 8.0,
  'anam': 7.5,
  'tevus': 7.8,
  'Default': 7.0,
};

const VOICE_AGENT_QUALITY: Record<string, number> = {
  'inbuilt': 7.5,
  'gemini-live': 8.0,
  'gpt-realtime': 8.5,
  'hume-pro': 8.2,
  'hume-scale': 7.8,
  'hume-business': 8.5,
  'grok': 7.5,
  'Default': 7.0,
};

const HOSTING_QUALITY: Record<string, number> = {
  'railway': 8.0,
  'vercel': 8.5,
  'azure': 8.0,
  'vercel-railway': 8.3,
  'Default': 7.5,
};

// Quality weights
const QUALITY_WEIGHTS = {
  avatar: 0.5,
  voice: 0.3,
  hosting: 0.2,
};

// Base latency constants (in milliseconds)
const BASE_AVATAR_LATENCY = 200;
const EXTERNAL_VOICE_LATENCY_PENALTY = 150;

// Hosting latency base values (ms) - simplified for our hosting options
const HOSTING_LATENCY_BASE: Record<string, number> = {
  'railway': 50,
  'vercel': 45,
  'azure': 60,
  'vercel-railway': 47,
  'Default': 55,
};

export interface QualityMetrics {
  overallQualityScore: number;
  avatarQualityScore: number;
  voiceQualityScore: number;
  hostingQualityScore: number;
}

export interface LatencyMetrics {
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
}

export function calculateQuality(combination: Combination, users: number, concurrentSessions: number): QualityMetrics {
  // Get provider quality scores
  const avatarProvider = combination.avatarPlan.provider.toLowerCase();
  const avatarQuality = AVATAR_PROVIDER_QUALITY[avatarProvider] || AVATAR_PROVIDER_QUALITY.Default;
  
  const voiceId = combination.voiceAgent?.id || 'inbuilt';
  const voiceQuality = VOICE_AGENT_QUALITY[voiceId] || VOICE_AGENT_QUALITY.Default;
  
  const hostingId = combination.hostingOption.id.toLowerCase();
  const hostingQuality = HOSTING_QUALITY[hostingId] || HOSTING_QUALITY.Default;
  
  // Calculate overall quality score
  let overallQualityScore = 
    QUALITY_WEIGHTS.avatar * avatarQuality +
    QUALITY_WEIGHTS.voice * voiceQuality +
    QUALITY_WEIGHTS.hosting * hostingQuality;
  
  // Add storage quality contribution (simplified - based on tier allocation)
  // Hot tier contributes more to quality
  const storageQualityContribution = 0.5; // Simplified contribution
  overallQualityScore += storageQualityContribution;
  overallQualityScore = Math.min(10, overallQualityScore); // Cap at 10
  
  return {
    overallQualityScore: Math.round(overallQualityScore * 10) / 10,
    avatarQualityScore: Math.round(avatarQuality * 10) / 10,
    voiceQualityScore: Math.round(voiceQuality * 10) / 10,
    hostingQualityScore: Math.round(hostingQuality * 10) / 10,
  };
}

export function calculateLatency(combination: Combination, users: number, concurrentSessions: number): LatencyMetrics {
  // Base latency from avatar processing
  let baseLatency = BASE_AVATAR_LATENCY;
  
  // Add external voice penalty if applicable
  if (combination.voiceAgent && combination.voiceAgent.id !== 'inbuilt') {
    baseLatency += EXTERNAL_VOICE_LATENCY_PENALTY;
  }
  
  // Add hosting overhead
  const hostingId = combination.hostingOption.id.toLowerCase();
  const hostingLatency = HOSTING_LATENCY_BASE[hostingId] || HOSTING_LATENCY_BASE.Default;
  baseLatency += hostingLatency;
  
  // Load-based penalty
  const loadFactor = Math.min(
    1 + (users / 1000) * 0.1 + (concurrentSessions / 100) * 0.15,
    1.5 // Cap at 50% increase
  );
  baseLatency *= loadFactor;
  
  // Calculate percentiles
  const p50Latency = Math.round(baseLatency);
  const p95Latency = Math.round(baseLatency * 1.5); // Conservative estimate
  const p99Latency = Math.round(baseLatency * 2.0); // Worst case
  
  // Add storage latency impact (simplified - cold/archive retrieval scenarios)
  const storageLatencyImpact = 50; // Simplified impact
  const p95LatencyWithStorage = p95Latency + storageLatencyImpact;
  const p99LatencyWithStorage = p99Latency + storageLatencyImpact;
  
  return {
    p50Latency,
    p95Latency: p95LatencyWithStorage,
    p99Latency: p99LatencyWithStorage,
  };
}
