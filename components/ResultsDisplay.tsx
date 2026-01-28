'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Combination } from '@/lib/calculator';
import { convertUSDToINR, convertINRToUSD } from '@/lib/pricing';
import { CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp, Filter, X, Download } from 'lucide-react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import * as XLSX from 'xlsx';
import { calculateLatency, calculateQuality } from '@/lib/qualityLatency';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ResultsDisplayProps {
  results: Combination[];
  isCalculating: boolean;
  users?: number;
  concurrentSessions?: number;
}

interface Filters {
  avatarProviders: string[];
  voiceAgents: string[];
  hostingOptions: string[];
}

// Helper function to format provider names correctly
const formatProviderName = (provider: string): string => {
  const providerMap: Record<string, string> = {
    'heygen': 'HeyGen',
    'tevus': 'Tavus',
    'anam': 'Anam',
    'inbuilt': 'Inbuilt',
    'gemini': 'Gemini',
    'hume': 'Hume',
    'gpt': 'GPT',
    'azure': 'Azure',
    'aws': 'AWS',
    'railway': 'Railway',
    'vercel': 'Vercel',
  };
  return providerMap[provider.toLowerCase()] || provider.charAt(0).toUpperCase() + provider.slice(1);
};

export default function ResultsDisplay({ results, isCalculating, users = 100, concurrentSessions = 10 }: ResultsDisplayProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    avatarProviders: [],
    voiceAgents: [],
    hostingOptions: [],
  });
  
  // Bookmark state management (simple set of bookmarked card IDs)
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'all' | 'bookmarks'>('all');
  const bookmarkButtonRef = useRef<any>(null);
  
  // Load bookmarks from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('combinationBookmarks');
    if (stored) {
      try {
        const bookmarkedIds = JSON.parse(stored);
        setBookmarks(new Set(bookmarkedIds));
      } catch (error) {
        console.error('Error loading bookmarks:', error);
      }
    }
  }, []);
  
  // Save bookmarks to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('combinationBookmarks', JSON.stringify(Array.from(bookmarks)));
  }, [bookmarks]);

  // Update bookmark button icon frame based on viewMode
  useEffect(() => {
    if (bookmarkButtonRef.current) {
      const targetFrame = viewMode === 'bookmarks' ? 98 : 0;
      bookmarkButtonRef.current.stop();
      bookmarkButtonRef.current.setFrame(targetFrame);
      bookmarkButtonRef.current.pause();
    }
  }, [viewMode]);

  // Get unique values for filter options
  const filterOptions = useMemo(() => {
    const avatarProviders = Array.from(new Set(results.map(r => r.avatarPlan.provider)));
    const voiceAgents = Array.from(new Set(results.map(r => r.voiceAgent?.id || 'inbuilt')));
    const hostingOptions = Array.from(new Set(results.map(r => r.hostingOption.id)));
    return { avatarProviders, voiceAgents, hostingOptions };
  }, [results]);

  // Filter results
  const filteredResults = useMemo(() => {
    let filtered = results.filter(combination => {
      // Avatar provider filter
      if (filters.avatarProviders.length > 0 && !filters.avatarProviders.includes(combination.avatarPlan.provider)) {
        return false;
      }
      
      // Voice agent filter
      const voiceId = combination.voiceAgent?.id || 'inbuilt';
      if (filters.voiceAgents.length > 0 && !filters.voiceAgents.includes(voiceId)) {
        return false;
      }
      
      // Hosting filter
      if (filters.hostingOptions.length > 0 && !filters.hostingOptions.includes(combination.hostingOption.id)) {
        return false;
      }
      
      return true;
    });
    
    // Bookmark filter
    if (viewMode === 'bookmarks') {
      filtered = filtered.filter(combination => bookmarks.has(combination.id));
    }
    
    return filtered;
  }, [results, filters, viewMode, bookmarks]);
  
  // Bookmark toggle function
  const toggleBookmark = (cardId: string) => {
    setBookmarks(prev => {
      const newBookmarks = new Set(prev);
      if (newBookmarks.has(cardId)) {
        newBookmarks.delete(cardId);
      } else {
        newBookmarks.add(cardId);
      }
      return newBookmarks;
    });
  };

  const toggleFilter = (category: keyof Filters, value: string) => {
    setFilters(prev => {
      const current = prev[category];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [category]: updated };
    });
  };

  const clearFilters = () => {
    setFilters({
      avatarProviders: [],
      voiceAgents: [],
      hostingOptions: [],
    });
  };

  const handleExportToExcel = () => {
    if (filteredResults.length === 0) return;
    setIsExporting(true);
    try {
      const rows = filteredResults.map((combination, index) => ({
        // Summary columns
        Rank: index + 1,
        Score: Math.round(combination.score),
        'Total Cost (INR)': combination.breakdown.totalCostINR,
        'Total Cost (USD)': combination.breakdown.totalCostUSD,
        // Main providers/options
        'Avatar Provider': formatProviderName(combination.avatarPlan.provider),
        'Avatar Plan': combination.avatarPlan.name,
        'Avatar Accounts': combination.avatarAccounts,
        'Voice Agent': combination.voiceAgent ? combination.voiceAgent.name : 'Inbuilt (Avatar)',
        'Voice Accounts': combination.voiceAccounts,
        'Hosting Option': combination.hostingOption.name,
        // Avatar detailed breakdown
        'Avatar Tier': combination.avatarPlan.tier || '',
        'Avatar Minutes Included': combination.avatarPlan.minutes,
        'Avatar Additional Minutes': combination.breakdown.avatarAdditionalMinutes,
        'Avatar Additional $/min': combination.avatarPlan.additionalPerMin,
        'Avatar Base Cost (USD)': combination.breakdown.avatarBaseCostUSD,
        'Avatar Additional Cost (USD)': combination.breakdown.avatarAdditionalCostUSD,
        'Avatar Total Cost (INR)': combination.breakdown.avatarCostINR,
        // Voice detailed breakdown
        'Voice Pricing Model': combination.voiceAgent?.pricingModel ?? 'inbuilt',
        'Voice Total Tokens': combination.breakdown.voiceTotalTokens ?? '',
        'Voice Base/Minimum (USD)': combination.breakdown.voiceBaseCostUSD ?? '',
        'Voice Per-Minute Cost (USD)': combination.breakdown.voicePerMinuteCostUSD ?? '',
        'Voice Total Cost (INR)': combination.breakdown.voiceCostINR,
        'Voice Total Cost (USD)': combination.breakdown.voiceCostUSD,
        // Hosting detailed breakdown
        'Hosting Base (INR)': combination.breakdown.hostingBaseCostINR,
        'Hosting Users Cost (INR)': combination.breakdown.hostingUsersCostINR,
        'Hosting Calls Cost (INR)': combination.breakdown.hostingCallsCostINR,
        'Hosting Total (INR)': combination.breakdown.hostingCostINR,
        // Storage detailed breakdown
        'Storage Option': combination.storageOption.label,
        'Storage Provider': formatProviderName(combination.storageOption.provider),
        'Storage Type': combination.storageOption.storageType || '',
        'Storage Replication': combination.storageOption.replication || '',
        'Storage Cost per DB (USD)': combination.storageOption.monthlyCostUSD,
        'Storage Total Cost (USD)': combination.breakdown.storageCostUSD,
        'Storage Total Cost (INR)': combination.breakdown.storageCostINR,
        // Miscellaneous
        'Misc Expenses (INR)': combination.breakdown.miscExpensesINR,
        'Warnings': combination.warnings.join('; '),
        // Plan notes (e.g., annual commitment info)
        'Plan Note': combination.avatarPlan.note || '',
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Combinations');

      const fileName = `combinations_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } finally {
      setIsExporting(false);
    }
  };

  const activeFilterCount = filters.avatarProviders.length + filters.voiceAgents.length + 
                            filters.hostingOptions.length;
  if (isCalculating) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010101] mx-auto mb-4"></div>
          <p className="text-[#010101]">Calculating combinations...</p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[#010101]/60">
          Enter your budget and click "Save and Calculate" to see results
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="mb-4 pb-4 border-b border-[#E5DDD1] flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
    <div>
            <h2 className="text-2xl font-bold text-[#010101]" style={{ fontFamily: 'Avenir' }}>
              Best Combinations
      </h2>
            <p className="text-sm text-[#010101]/60 mt-1">
              {filteredResults.length} of {results.length} {results.length === 1 ? 'combination' : 'combinations'}
              {activeFilterCount > 0 && ` (${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active)`}
            </p>
          </div>
          <div className="flex items-center gap-3">
          {results.length > 0 && (
            <>
              <button
                onClick={() => setViewMode(viewMode === 'all' ? 'bookmarks' : 'all')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'bookmarks'
                      ? 'bg-[#010101] text-white hover:bg-[#1a1a1a]'
                      : 'bg-[#F9F4EE] text-[#010101] border border-[#E5DDD1] hover:border-[#010101]'
                }`}
              >
                <DotLottieReact
                  src="/bookmark.lottie"
                  loop={false}
                  autoplay={false}
                  dotLottieRefCallback={(dotLottie) => {
                    bookmarkButtonRef.current = dotLottie;
                    if (dotLottie) {
                      // Set initial frame based on viewMode
                      const targetFrame = viewMode === 'bookmarks' ? 98 : 0;
                      dotLottie.stop();
                      dotLottie.setFrame(targetFrame);
                      dotLottie.pause();
                    }
                  }}
                  style={{ width: 16, height: 16 }}
                />
                <span>{viewMode === 'all' ? 'Show Bookmarks' : 'Show All'}</span>
              </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                showFilters || activeFilterCount > 0
                      ? 'bg-[#010101] text-white hover:bg-[#1a1a1a]'
                      : 'bg-[#F9F4EE] text-[#010101] border border-[#E5DDD1] hover:border-[#010101]'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-[0.6rem]">
                  {activeFilterCount}
                </span>
              )}
              </button>
            </>
          )}
            {filteredResults.length > 0 && (
              <button
                onClick={handleExportToExcel}
                disabled={isExporting}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium bg-[#010101] text-white hover:bg-[#1a1a1a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                <span>{isExporting ? 'Exporting...' : 'Export Excel'}</span>
            </button>
          )}
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && results.length > 0 && (
          <div className="mt-4 p-4 bg-[#F9F4EE] rounded-xl border border-[#E5DDD1]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-[#010101]">Filter Options</h3>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-[#010101] hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Avatar Provider Filter */}
              <div>
                <label className="block text-xs font-medium text-[#010101] mb-2">
                  Avatar Provider
                </label>
                <select
                  multiple
                  value={filters.avatarProviders}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setFilters(prev => ({ ...prev, avatarProviders: selected }));
                  }}
                  className="w-full px-3 py-2 border-2 border-[#E5DDD1] rounded-lg bg-white text-[#010101] focus:ring-2 focus:ring-[#010101] focus:border-[#010101] text-xs"
                  size={Math.min(filterOptions.avatarProviders.length, 4)}
                >
                  {filterOptions.avatarProviders.map(provider => (
                    <option key={provider} value={provider}>
                      {formatProviderName(provider)}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[#4F4F4E] mt-1">
                  Hold Ctrl/Cmd to select multiple
                </p>
              </div>

              {/* Voice Agent Filter */}
              <div>
                <label className="block text-[0.7rem] font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Voice Agent
                </label>
                <select
                  multiple
                  value={filters.voiceAgents}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setFilters(prev => ({ ...prev, voiceAgents: selected }));
                  }}
                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-black text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-[0.7rem]"
                  size={Math.min(filterOptions.voiceAgents.length, 4)}
                >
                  {filterOptions.voiceAgents.map(agent => (
                    <option key={agent} value={agent}>
                      {agent === 'inbuilt' ? 'Inbuilt (Avatar)' : agent.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </option>
                  ))}
                </select>
                <p className="text-[0.6rem] text-gray-500 dark:text-gray-400 mt-1">
                  Hold Ctrl/Cmd to select multiple
                </p>
              </div>

              {/* Hosting Filter */}
              <div>
                <label className="block text-[0.7rem] font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Hosting
                </label>
                <select
                  multiple
                  value={filters.hostingOptions}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setFilters(prev => ({ ...prev, hostingOptions: selected }));
                  }}
                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-black text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-[0.7rem]"
                  size={Math.min(filterOptions.hostingOptions.length, 4)}
                >
                  {filterOptions.hostingOptions.map(hosting => (
                    <option key={hosting} value={hosting}>
                      {hosting.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </option>
                  ))}
                </select>
                <p className="text-[0.6rem] text-gray-500 dark:text-gray-400 mt-1">
                  Hold Ctrl/Cmd to select multiple
                </p>
              </div>

            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-2 min-h-0">
        {filteredResults.length > 0 ? (
          <div className="space-y-4">
            {filteredResults.map((combination, index) => (
              <CombinationCard 
                key={combination.id} 
                combination={combination} 
                rank={index + 1} 
                users={users} 
                concurrentSessions={concurrentSessions}
                isBookmarked={bookmarks.has(combination.id)}
                onToggleBookmark={() => toggleBookmark(combination.id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-2">No combinations match your filters</p>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-blue-600 dark:text-blue-400 hover:underline text-[0.7rem]"
                >
                  Clear filters to see all combinations
                </button>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

function CombinationCard({ 
  combination, 
  rank, 
  users, 
  concurrentSessions,
  isBookmarked,
  onToggleBookmark
}: { 
  combination: Combination; 
  rank: number; 
  users: number; 
  concurrentSessions: number;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [storageInput, setStorageInput] = useState<any>(null);
  const [inputData, setInputData] = useState<any>(null);
  const bookmarkRef = useRef<any>(null);
  
  const [isAnimating, setIsAnimating] = useState(false);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);
  const targetBookmarkStateRef = useRef<boolean | null>(null);
  // Use ref to track current bookmark state to avoid closure issues
  const isBookmarkedRef = useRef(isBookmarked);
  
  // Update ref when prop changes
  useEffect(() => {
    isBookmarkedRef.current = isBookmarked;
  }, [isBookmarked]);
  
  const handleBookmarkClick = () => {
    const willBeBookmarked = !isBookmarked;
    targetBookmarkStateRef.current = willBeBookmarked;
    
    // Clear any existing timeout
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }
    
    if (bookmarkRef.current) {
      setIsAnimating(true);
      isInitializedRef.current = true; // Mark as initialized to prevent callback from interfering
      
      if (!isBookmarked) {
        // Bookmarking: play the animation but stop at frame 98
        bookmarkRef.current.stop();
        bookmarkRef.current.setFrame(0);
        
        // Debug: Count frames
        const totalFrames = bookmarkRef.current.totalFrames || 'unknown';
        console.log('[Bookmark] Animation started - Total frames:', totalFrames);
        
        // Calculate time to reach frame 98 (assuming 60fps)
        // If total animation is ~3 seconds (181 frames at 60fps), frame 98 is at ~98/181 * 3000ms
        const timeToFrame98 = (98 / 181) * 3000; // ~1624ms
        
        bookmarkRef.current.play();
        // Update bookmark state immediately for UI responsiveness
        onToggleBookmark();
        
        // Stop animation at frame 98 instead of letting it complete
        animationTimeoutRef.current = setTimeout(() => {
          // Use ref to get current bookmark state (avoids closure issues)
          const currentBookmarked = isBookmarkedRef.current;
          if (bookmarkRef.current && targetBookmarkStateRef.current === true) {
            bookmarkRef.current.stop();
            bookmarkRef.current.setFrame(98);
            bookmarkRef.current.pause();
            // Debug: Check if animation stopped
            const currentFrame = bookmarkRef.current.currentFrame || bookmarkRef.current.frame || 'unknown';
            console.log('[Bookmark] Animation stopped at frame:', currentFrame);
            setIsAnimating(false);
            targetBookmarkStateRef.current = null;
            // Force multiple checks to ensure frame stays set - use ref for current state
            setTimeout(() => {
              const stillBookmarked = isBookmarkedRef.current;
              if (bookmarkRef.current && stillBookmarked) {
                bookmarkRef.current.stop();
                bookmarkRef.current.setFrame(98);
                bookmarkRef.current.pause();
              }
            }, 50);
            setTimeout(() => {
              const stillBookmarked = isBookmarkedRef.current;
              if (bookmarkRef.current && stillBookmarked) {
                bookmarkRef.current.stop();
                bookmarkRef.current.setFrame(98);
                bookmarkRef.current.pause();
              }
            }, 200);
          }
        }, timeToFrame98); // Stop at frame 98 instead of waiting for full animation
      } else {
        // Unbookmarking: play animation from frame 99 to 181 (end)
        bookmarkRef.current.stop();
        bookmarkRef.current.setFrame(99);
        
        // Calculate time to play from frame 99 to 181
        // If total animation is ~3 seconds (181 frames at 60fps), frames 99-181 is (181-99)/181 * 3000ms
        const timeFrom99To181 = ((181 - 99) / 181) * 3000; // ~1359ms
        
        bookmarkRef.current.play();
        // Update bookmark state immediately for UI responsiveness
        onToggleBookmark();
        
        // Stop animation at frame 181 (end)
        animationTimeoutRef.current = setTimeout(() => {
          const currentBookmarked = isBookmarkedRef.current;
          if (bookmarkRef.current && targetBookmarkStateRef.current === false) {
            bookmarkRef.current.stop();
            bookmarkRef.current.setFrame(181);
            bookmarkRef.current.pause();
            // Debug: Check if animation stopped
            const currentFrame = bookmarkRef.current.currentFrame || bookmarkRef.current.frame || 'unknown';
            console.log('[Bookmark] Unbookmark animation stopped at frame:', currentFrame);
            setIsAnimating(false);
            targetBookmarkStateRef.current = null;
            // Then reset to frame 0 (empty state)
            setTimeout(() => {
              if (bookmarkRef.current && !isBookmarkedRef.current) {
                bookmarkRef.current.stop();
                bookmarkRef.current.setFrame(0);
                bookmarkRef.current.pause();
              }
            }, 50);
          }
        }, timeFrom99To181);
      }
    } else {
      // If ref not ready, just toggle bookmark
      onToggleBookmark();
    }
  };
  
  // Set the correct frame based on bookmark state on mount and when state changes (only if not animating)
  useEffect(() => {
    // Only set frame if we're not currently animating and component is initialized
    // Also check that we're not in the middle of an animation transition
    if (bookmarkRef.current && !isAnimating && isInitializedRef.current && targetBookmarkStateRef.current === null) {
      // Always set to end frame (98) if bookmarked (filled/black state), start (0) if not
      if (isBookmarked) {
        bookmarkRef.current.stop();
        bookmarkRef.current.setFrame(98); // End of animation - black/filled state
        bookmarkRef.current.pause();
      } else {
        bookmarkRef.current.stop();
        bookmarkRef.current.setFrame(0); // Start of animation - empty state
        bookmarkRef.current.pause();
      }
    }
  }, [isBookmarked, isAnimating]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);
  
  useEffect(() => {
    const calculationInput = localStorage.getItem('calculationInput');
    if (calculationInput) {
      try {
        const input = JSON.parse(calculationInput);
        setStorageInput({
          totalSizeGB: input.storageTotalSizeGB,
          tierAllocation: input.storageTierAllocation,
          numberOfDatabases: input.storageNumberOfDatabases,
          additionalCosts: input.storageAdditionalCosts,
        });
        setInputData({
          users: input.users || users,
          concurrentSessions: input.concurrentSessions || concurrentSessions,
          minutes: input.minutes || 0,
        });
      } catch (error) {
        console.error('Error parsing storage input:', error);
      }
    }
  }, [users, concurrentSessions]);
  
  const qualityScore = calculateQuality(combination, users, concurrentSessions).overallQualityScore;
  const fitsStandard = qualityScore > 5;
  
  const badgeColor = fitsStandard
    ? 'bg-green-100 text-green-800'
    : 'bg-red-100 text-red-800';

  const formatINR = (amount: number) => `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const formatUSD = (amount: number) => `$${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

  return (
    <div 
      onClick={() => setShowDetails(!showDetails)}
      className="group relative border border-[#E5DDD1] rounded-2xl p-6 bg-white/80 backdrop-blur-sm hover:shadow-lg hover:border-[#010101] transition-all duration-300 overflow-hidden cursor-pointer"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 via-indigo-50/0 to-purple-50/0 dark:from-blue-950/0 dark:via-indigo-950/0 dark:to-purple-950/0 group-hover:from-blue-50/30 group-hover:via-indigo-50/20 group-hover:to-purple-50/30 dark:group-hover:from-blue-950/20 dark:group-hover:via-indigo-950/10 dark:group-hover:to-purple-950/20 transition-all duration-500 pointer-events-none"></div>
      
      {/* Sticker Badge - Top Left Corner */}
      <div className="absolute -top-1 -left-1 z-20 transform -rotate-12 origin-center pointer-events-none">
        <div className={`px-4 py-1.5 rounded-md ${badgeColor} shadow-xl backdrop-blur-sm border-2 border-white/50 dark:border-gray-900/50`}>
            {fitsStandard ? (
            <span className="flex items-center text-[0.6rem] font-bold">
              <CheckCircle className="w-2.5 h-2.5 mr-1" />
                Fits Standard
              </span>
            ) : (
            <span className="flex items-center text-[0.6rem] font-bold">
              <XCircle className="w-2.5 h-2.5 mr-1" />
                Outside Standard
              </span>
            )}
        </div>
      </div>

      {/* Bookmark Animation - Top Right Corner Sticker */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          handleBookmarkClick();
        }}
        className="absolute -top-1 right-4 z-30 cursor-pointer transform origin-center pointer-events-auto"
        title={isBookmarked ? "Remove bookmark" : "Bookmark this combination"}
      >
        <DotLottieReact
          src="/bookmark.lottie"
          loop={false}
          autoplay={false}
          dotLottieRefCallback={(dotLottie) => {
            bookmarkRef.current = dotLottie;
            
            // Set initial frame based on bookmark state - only on first mount, not on re-renders
            if (dotLottie && !isInitializedRef.current) {
              // Always set to end frame (98) if bookmarked (filled/black state), start (0) if not
              const targetFrame = isBookmarked ? 98 : 0;
              // Debug: Count frames
              const totalFrames = dotLottie.totalFrames || 'unknown';
              console.log('[Bookmark] Animation initialized - Total frames:', totalFrames);
              dotLottie.stop();
              dotLottie.setFrame(targetFrame);
              dotLottie.pause();
              isInitializedRef.current = true;
              
              // Add event listener for when animation completes
              // Note: We don't want to use this for bookmarking since we stop at frame 98
              // This is just a fallback in case the timeout doesn't fire
              dotLottie.addEventListener('complete', () => {
                const currentBookmarked = isBookmarkedRef.current;
                // Only set frame if still bookmarked (shouldn't reach here if timeout worked)
                if (bookmarkRef.current && currentBookmarked) {
                  bookmarkRef.current.stop();
                  bookmarkRef.current.setFrame(98);
                  bookmarkRef.current.pause();
                  // Debug: Check if animation stopped
                  const currentFrame = bookmarkRef.current.currentFrame || bookmarkRef.current.frame || 'unknown';
                  console.log('[Bookmark] Animation stopped (complete event) at frame:', currentFrame);
                  setIsAnimating(false);
                  targetBookmarkStateRef.current = null;
                }
              });
            }
          }}
          style={{ width: 24, height: 24 }}
        />
      </div>

      <div className="relative z-10">
      {/* Horizontal Layout */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
        {/* Rank Badge */}
        <div className="flex-shrink-0">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#010101] shadow-lg">
            <span className="text-lg font-extrabold text-white">#{rank}</span>
          </div>
        </div>

        {/* Total Cost */}
        <div className="flex-shrink-0 text-center sm:text-left min-w-[140px]">
          <div className="text-2xl font-extrabold text-[#010101]">
            {formatUSD(combination.breakdown.totalCostUSD)}
          </div>
          <div className="text-sm font-semibold text-[#010101]/60 mt-1">
            {formatINR(combination.totalCostINR)}
          </div>
          <div className="text-xs text-[#4F4F4E] font-medium uppercase tracking-wider mt-0.5">per month</div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block flex-shrink-0 w-px h-16 bg-[#E5DDD1]"></div>

        {/* Service Details - Horizontal Grid */}
        <div className="flex-1 w-full sm:w-auto grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-[#4F4F4E]">Avatar</div>
            <div className="font-bold text-[#010101] text-sm">
              {combination.avatarPlan.name}
            </div>
            {combination.avatarPlan.isAnnualOnly && (
              <div className="text-xs text-[#010101] font-medium">
                Annual
              </div>
            )}
            <div className="text-xs text-[#4F4F4E]">
              {formatUSD(combination.breakdown.avatarCostUSD)}/mo
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-[#4F4F4E]">Voice</div>
            <div className="font-bold text-[#010101] text-sm">
              {combination.voiceAgent
                ? `${combination.voiceAgent.name}${combination.voiceAgent.concurrency ? ` (${combination.voiceAgent.concurrency})` : ''}`
                : 'Inbuilt'}
            </div>
            <div className="text-xs text-[#4F4F4E]">
              {combination.voiceAgent ? formatUSD(combination.breakdown.voiceCostUSD) + '/mo' : 'N/A'}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-[#4F4F4E]">Hosting</div>
            <div className="font-bold text-[#010101] text-sm">
              {combination.hostingOption.name}
            </div>
            <div className="text-xs text-[#4F4F4E]">
              {formatUSD(convertINRToUSD(combination.breakdown.hostingCostINR))}/mo
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-[#4F4F4E]">Storage</div>
            <div className="font-bold text-[#010101] text-sm">
              {combination.storageOption.label}
            </div>
            <div className="text-xs text-[#4F4F4E]">
              {formatUSD(combination.breakdown.storageCostUSD)}/mo
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-[#4F4F4E]">Quality</div>
            <div className="font-bold text-[#010101] text-sm">
              {calculateQuality(combination, users, concurrentSessions).overallQualityScore.toFixed(1)}/10
        </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-[#4F4F4E]">Latency</div>
            <div className="font-bold text-[#010101] text-sm">
              {calculateLatency(combination, users, concurrentSessions).p95Latency}ms
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Details Section */}
      {showDetails && (
        <div className="mt-6 pt-6 border-t border-gray-200/50 dark:border-gray-800/50">
          <div className="grid grid-cols-3 gap-4 text-[0.6rem]">
            {/* Row 1: Avatar, Voice (if exists), Hosting */}
            {/* Avatar Cost Breakdown */}
            <div className="col-span-1 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black rounded-xl p-4 border border-gray-200 dark:border-gray-800 relative">
              <div className="absolute -top-2 right-2 bg-black text-white text-[0.6rem] font-semibold px-2 py-0.5 rounded-md shadow-md z-10">
                {formatProviderName(combination.avatarPlan.provider)}
              </div>
              <div className="text-[0.7rem] font-semibold text-gray-900 dark:text-white mb-3">Avatar Cost Breakdown</div>
              
              {/* Avatar Bar Chart */}
              <div className="h-32 mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Base Plan', value: combination.breakdown.avatarBaseCostUSD },
                    ...(combination.breakdown.avatarAdditionalCostUSD > 0 ? [{ name: 'Additional', value: combination.breakdown.avatarAdditionalCostUSD }] : [])
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5DDD1" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#666" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#666" />
                    <Tooltip 
                      formatter={(value: number | undefined) => formatUSD(value || 0)}
                      contentStyle={{ backgroundColor: '#F9F4EE', border: '1px solid #E5DDD1', borderRadius: '8px', fontSize: '11px' }}
                    />
                    <Bar dataKey="value" fill="#010101" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3 text-gray-700 dark:text-gray-300 text-[0.6rem]">
                {/* Avatar Plan Info */}
                <div className="pb-2 border-b border-gray-300 dark:border-gray-700">
                  <div className="flex justify-between mb-1">
                    <span>Avatar Plan:</span>
                    <span className="font-semibold">{combination.avatarPlan.name}</span>
                  </div>
                <div className="flex justify-between">
                    <span>Monthly Base Cost:</span>
                    <span>{formatUSD(combination.avatarPlan.monthlyPrice)}</span>
                  </div>
                </div>

                {/* Base Plan Cost */}
                <div className="space-y-2">
                  <div className="font-semibold text-gray-900 dark:text-white">Base Plan Cost:</div>
                  <div className="pl-2">
                    <div className="flex justify-between">
                      <span>Monthly Plan Cost:</span>
                  <div className="text-right">
                    <div>{formatUSD(combination.breakdown.avatarBaseCostUSD)}</div>
                    <div className="text-gray-500">{formatINR(convertUSDToINR(combination.breakdown.avatarBaseCostUSD))}</div>
                  </div>
                </div>
                  </div>
                </div>

                {/* Additional Minutes Cost */}
                {combination.breakdown.avatarAdditionalMinutes > 0 && (
                  <div className="space-y-2 pt-2 border-t border-gray-300 dark:border-gray-700">
                    <div className="font-semibold text-gray-900 dark:text-white">Additional Minutes Cost:</div>
                    <div className="pl-2 space-y-1">
                    <div className="flex justify-between">
                      <span>Included Minutes:</span>
                      <span>{combination.avatarPlan.minutes.toLocaleString()}</span>
                    </div>
          <div className="flex justify-between">
                      <span>Additional Minutes:</span>
                      <span>{combination.breakdown.avatarAdditionalMinutes.toLocaleString()}</span>
          </div>
            <div className="flex justify-between">
                        <span>Additional Cost:</span>
                      <div className="text-right">
                        <div>{formatUSD(combination.breakdown.avatarAdditionalCostUSD)}</div>
                        <div className="text-gray-500">{formatINR(convertUSDToINR(combination.breakdown.avatarAdditionalCostUSD))}</div>
                      </div>
                    </div>
                      <div className="text-[0.55rem] text-gray-500 italic pl-2">
                        {combination.breakdown.avatarAdditionalMinutes.toLocaleString()} × {formatUSD(combination.avatarPlan.additionalPerMin)}/min
                      </div>
                      <div className="flex justify-between pl-2 pt-1 border-t border-gray-200 dark:border-gray-700 mt-1">
                        <span className="font-medium">Additional Minutes Total:</span>
                        <div className="text-right">
                          <span className="font-medium">{formatUSD(combination.breakdown.avatarAdditionalCostUSD)}</span>
                          <div className="text-gray-500 text-[0.55rem]">{formatINR(convertUSDToINR(combination.breakdown.avatarAdditionalCostUSD))}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Totals */}
                <div className="pt-2 border-t-2 border-gray-400 dark:border-gray-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Base Plan Cost:</span>
                    <div className="text-right">
                      <span className="font-semibold">{formatUSD(combination.breakdown.avatarBaseCostUSD)}</span>
                      <div className="text-gray-500 text-[0.55rem]">{formatINR(convertUSDToINR(combination.breakdown.avatarBaseCostUSD))}</div>
                    </div>
                  </div>
                  {combination.breakdown.avatarAdditionalCostUSD > 0 && (
                    <div className="flex justify-between">
                      <span>Additional Minutes Cost:</span>
                      <div className="text-right">
                        <span className="font-semibold">{formatUSD(combination.breakdown.avatarAdditionalCostUSD)}</span>
                        <div className="text-gray-500 text-[0.55rem]">{formatINR(convertUSDToINR(combination.breakdown.avatarAdditionalCostUSD))}</div>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 border-t border-gray-300 dark:border-gray-700">
                  <span>Total Avatar Cost:</span>
                  <div className="text-right">
                      <div className="font-bold text-lg">{formatUSD(combination.breakdown.avatarCostUSD)}</div>
                    <div className="text-gray-500">{formatINR(combination.breakdown.avatarCostINR)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Voice Cost Breakdown */}
            {combination.breakdown.voiceCostINR > 0 && (
              <div className="col-span-1 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl p-4 border border-blue-200 dark:border-blue-900 relative">
                <div className="absolute -top-2 right-2 bg-blue-600 text-white text-[0.6rem] font-semibold px-2 py-0.5 rounded-md shadow-md z-10">
                  {combination.voiceAgent?.name || 'Inbuilt'}
                </div>
                <div className="text-[0.7rem] font-semibold text-gray-900 dark:text-white mb-3">Voice Agent Cost Breakdown</div>
                
                {/* Voice Bar Chart */}
                <div className="h-32 mb-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      ...(combination.breakdown.voiceBaseCostUSD && combination.breakdown.voiceBaseCostUSD > 0 ? [{ name: 'Base', value: combination.breakdown.voiceBaseCostUSD }] : []),
                      ...(combination.breakdown.voicePerMinuteCostUSD && combination.breakdown.voicePerMinuteCostUSD > 0 ? [{ name: 'Per Min', value: combination.breakdown.voicePerMinuteCostUSD }] : []),
                      ...(combination.breakdown.voiceCostUSD > 0 && (!combination.breakdown.voiceBaseCostUSD || combination.breakdown.voiceBaseCostUSD === 0) && (!combination.breakdown.voicePerMinuteCostUSD || combination.breakdown.voicePerMinuteCostUSD === 0) ? [{ name: 'Total', value: combination.breakdown.voiceCostUSD }] : [])
                    ].filter(item => item.value > 0)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5DDD1" opacity={0.3} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#666" />
                      <YAxis tick={{ fontSize: 10 }} stroke="#666" />
                      <Tooltip 
                        formatter={(value: number | undefined) => formatUSD(value || 0)}
                        contentStyle={{ backgroundColor: '#F9F4EE', border: '1px solid #E5DDD1', borderRadius: '8px', fontSize: '11px' }}
                      />
                      <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3 text-gray-700 dark:text-gray-300 text-[0.6rem]">
                  {/* Voice Agent Info */}
                  <div className="pb-2 border-b border-gray-300 dark:border-gray-700">
                    <div className="flex justify-between mb-1">
                      <span>Voice Agent:</span>
                      <span className="font-semibold">{combination.voiceAgent?.name || 'Inbuilt'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pricing Model:</span>
                      <span>{combination.voiceAgent?.pricingModel || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Token-based Pricing */}
                  {combination.voiceAgent?.pricingModel === 'tokens' && combination.breakdown.voiceTotalTokens && (
                    <div className="space-y-2">
                      <div className="font-semibold text-gray-900 dark:text-white">Token-based Cost:</div>
                      <div className="pl-2 space-y-1">
                      <div className="flex justify-between">
                        <span>Tokens per Minute:</span>
                        <span>
                          {combination.voiceAgent.tokensPerMinuteMin && combination.voiceAgent.tokensPerMinuteMax
                            ? `${combination.voiceAgent.tokensPerMinuteMin.toLocaleString()}-${combination.voiceAgent.tokensPerMinuteMax.toLocaleString()} (avg: ${combination.voiceAgent.tokensPerMinute?.toLocaleString()})`
                            : `${combination.voiceAgent.tokensPerMinute?.toLocaleString() || 'N/A'}`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Tokens:</span>
                        <span>{combination.breakdown.voiceTotalTokens.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tokens (Millions):</span>
                        <span>{(combination.breakdown.voiceTotalTokens / 1_000_000).toFixed(2)}M</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Price per 1M Tokens:</span>
                        <span>{formatUSD(combination.voiceAgent.pricePer1MTokens || 0)}</span>
                      </div>
                        <div className="text-[0.55rem] text-gray-500 italic pl-2">
                          {(combination.breakdown.voiceTotalTokens / 1_000_000).toFixed(2)}M × {formatUSD(combination.voiceAgent.pricePer1MTokens || 0)}/1M
                        </div>
                        <div className="flex justify-between pl-2 pt-1 border-t border-gray-200 dark:border-gray-700 mt-1">
                          <span className="font-medium">Token Cost Total:</span>
                          <div className="text-right">
                            <div className="font-medium">{formatUSD(combination.breakdown.voiceCostUSD)}</div>
                            <div className="text-gray-500 text-[0.55rem]">{formatINR(combination.breakdown.voiceCostINR)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Per-minute Pricing */}
                  {combination.voiceAgent?.pricingModel === 'per-minute' && (
                    <div className="space-y-2">
                      <div className="font-semibold text-gray-900 dark:text-white">Per-minute Cost:</div>
                      <div className="pl-2 space-y-1">
                      {combination.breakdown.voiceBaseCostUSD !== undefined && combination.breakdown.voiceBaseCostUSD > 0 && (
                        <div className="flex justify-between">
                          <span>Minimum Monthly Cost:</span>
                          <div className="text-right">
                            <div>{formatUSD(combination.breakdown.voiceBaseCostUSD)}</div>
                            <div className="text-gray-500">{formatINR(convertUSDToINR(combination.breakdown.voiceBaseCostUSD))}</div>
                          </div>
                        </div>
                      )}
                      {combination.breakdown.voicePerMinuteCostUSD !== undefined && (
                          <>
                        <div className="flex justify-between">
                              <span>Per-Minute Cost:</span>
                          <div className="text-right">
                            <div>{formatUSD(combination.breakdown.voicePerMinuteCostUSD)}</div>
                            <div className="text-gray-500">{formatINR(convertUSDToINR(combination.breakdown.voicePerMinuteCostUSD))}</div>
                          </div>
                        </div>
                            <div className="text-[0.55rem] text-gray-500 italic pl-2">
                              Minutes × {formatUSD(combination.voiceAgent?.pricePerMinute || 0)}/min
                            </div>
                          </>
                      )}
                      {combination.breakdown.voiceBaseCostUSD !== undefined && combination.breakdown.voiceBaseCostUSD > 0 && (
                          <div className="text-[0.55rem] text-gray-500 italic pl-2">
                        * Cost is the higher of minimum or per-minute cost
                      </div>
                      )}
                      </div>
                    </div>
                  )}

                  {/* Per-minute-per-concurrency Pricing */}
                  {combination.voiceAgent?.pricingModel === 'per-minute-per-concurrency' && (
                    <div className="space-y-2">
                      <div className="font-semibold text-gray-900 dark:text-white">Per-minute-per-concurrency Cost:</div>
                      <div className="pl-2 space-y-1">
                      <div className="flex justify-between">
                        <span>Price per Minute per Concurrency:</span>
                        <span>{formatUSD(combination.voiceAgent?.pricePerMinute || 0)}</span>
                      </div>
                      {combination.breakdown.voicePerMinuteCostUSD !== undefined && (
                          <>
                        <div className="flex justify-between">
                              <span>Total Cost:</span>
                          <div className="text-right">
                            <div>{formatUSD(combination.breakdown.voicePerMinuteCostUSD)}</div>
                            <div className="text-gray-500">{formatINR(convertUSDToINR(combination.breakdown.voicePerMinuteCostUSD))}</div>
                          </div>
                        </div>
                            <div className="text-[0.55rem] text-gray-500 italic pl-2">
                              Price × minutes × concurrency
                            </div>
                    </>
                  )}
                      </div>
                    </div>
                  )}

                  {/* Totals */}
                  <div className="pt-2 border-t-2 border-gray-400 dark:border-gray-600 space-y-1">
                    <div className="flex justify-between pt-1 border-t border-gray-300 dark:border-gray-700">
                    <span>Total Voice Cost:</span>
                    <div className="text-right">
                        <div className="font-bold text-lg">{formatUSD(combination.breakdown.voiceCostUSD)}</div>
                      <div className="text-gray-500">{formatINR(combination.breakdown.voiceCostINR)}</div>
                      </div>
                    </div>
                  </div>
                </div>
            </div>
          )}

            {/* Hosting Cost Breakdown */}
            <div className="col-span-1 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl p-4 border border-purple-200 dark:border-purple-900 relative">
              <div className="absolute -top-2 right-2 bg-purple-600 text-white text-[0.6rem] font-semibold px-2 py-0.5 rounded-md shadow-md z-10">
                {combination.hostingOption.name}
              </div>
              <div className="text-[0.7rem] font-semibold text-gray-900 dark:text-white mb-3">Hosting Cost Breakdown</div>
              
              {/* Hosting Bar Chart */}
              <div className="h-32 mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Base', value: convertINRToUSD(combination.breakdown.hostingBaseCostINR) },
                    { name: 'Users', value: convertINRToUSD(combination.breakdown.hostingUsersCostINR) },
                    { name: 'Calls', value: convertINRToUSD(combination.breakdown.hostingCallsCostINR) }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5DDD1" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#666" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#666" />
                    <Tooltip 
                      formatter={(value: number | undefined) => formatUSD(value || 0)}
                      contentStyle={{ backgroundColor: '#F9F4EE', border: '1px solid #E5DDD1', borderRadius: '8px', fontSize: '11px' }}
                    />
                    <Bar dataKey="value" fill="#A855F7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3 text-gray-700 dark:text-gray-300 text-[0.6rem]">
                {/* Hosting Option Info */}
                <div className="pb-2 border-b border-gray-300 dark:border-gray-700">
                  <div className="flex justify-between mb-1">
                    <span>Hosting Option:</span>
                    <span className="font-semibold">{combination.hostingOption.name}</span>
                  </div>
                </div>

                {/* Base Cost */}
                <div className="space-y-2">
                  <div className="font-semibold text-gray-900 dark:text-white">Base Monthly Cost:</div>
                  <div className="pl-2">
                <div className="flex justify-between">
                      <span>Base Cost:</span>
                      <div className="text-right">
                        <div>{formatUSD(convertINRToUSD(combination.breakdown.hostingBaseCostINR))}</div>
                        <div className="text-gray-500">{formatINR(combination.breakdown.hostingBaseCostINR)}</div>
                      </div>
                </div>
                  </div>
                </div>

                {/* Users Cost */}
                <div className="space-y-2 pt-2 border-t border-gray-300 dark:border-gray-700">
                  <div className="font-semibold text-gray-900 dark:text-white">Users Cost:</div>
                  <div className="pl-2 space-y-1">
                <div className="flex justify-between">
                      <span>Number of Users:</span>
                      <span>{inputData?.users || users}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Users Cost:</span>
                      <div className="text-right">
                        <div>{formatUSD(convertINRToUSD(combination.breakdown.hostingUsersCostINR))}</div>
                        <div className="text-gray-500">{formatINR(combination.breakdown.hostingUsersCostINR)}</div>
                      </div>
                </div>
                    <div className="text-[0.55rem] text-gray-500 italic pl-2">
                      {inputData?.users || users} × ₹{combination.hostingOption.costPerUserPerMonthINR}/user
                    </div>
                    <div className="flex justify-between pl-2 pt-1 border-t border-gray-200 dark:border-gray-700 mt-1">
                      <span className="font-medium">Users Cost Total:</span>
                      <div className="text-right">
                        <div className="font-medium">{formatUSD(convertINRToUSD(combination.breakdown.hostingUsersCostINR))}</div>
                        <div className="text-gray-500 text-[0.55rem]">{formatINR(combination.breakdown.hostingUsersCostINR)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Calls Cost */}
                <div className="space-y-2 pt-2 border-t border-gray-300 dark:border-gray-700">
                  <div className="font-semibold text-gray-900 dark:text-white">Calls Cost:</div>
                  <div className="pl-2 space-y-1">
          <div className="flex justify-between">
                      <span>Minutes per Month:</span>
                      <span>{inputData?.minutes ? inputData.minutes.toLocaleString() : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Number of Calls (minutes ÷ 10):</span>
                      <span>{inputData?.minutes ? Math.floor(inputData.minutes / 10).toLocaleString() : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Calls Cost:</span>
                      <div className="text-right">
                        <div>{formatUSD(convertINRToUSD(combination.breakdown.hostingCallsCostINR))}</div>
                        <div className="text-gray-500">{formatINR(combination.breakdown.hostingCallsCostINR)}</div>
                      </div>
                </div>
                    <div className="text-[0.55rem] text-gray-500 italic pl-2">
                      {inputData?.minutes ? Math.floor(inputData.minutes / 10).toLocaleString() : 'N/A'} × ₹{combination.hostingOption.costPerCallINR}/call
                    </div>
                    <div className="flex justify-between pl-2 pt-1 border-t border-gray-200 dark:border-gray-700 mt-1">
                      <span className="font-medium">Calls Cost Total:</span>
                      <div className="text-right">
                        <div className="font-medium">{formatUSD(convertINRToUSD(combination.breakdown.hostingCallsCostINR))}</div>
                        <div className="text-gray-500 text-[0.55rem]">{formatINR(combination.breakdown.hostingCallsCostINR)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Totals */}
                <div className="pt-2 border-t-2 border-gray-400 dark:border-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Base Monthly Cost:</span>
                    <div className="text-right">
                      <div className="font-semibold">{formatUSD(convertINRToUSD(combination.breakdown.hostingBaseCostINR))}</div>
                      <div className="text-gray-500 text-[0.55rem]">{formatINR(combination.breakdown.hostingBaseCostINR)}</div>
                    </div>
                </div>
                <div className="flex justify-between">
                    <span>Users Cost:</span>
                    <div className="text-right">
                      <div className="font-semibold">{formatUSD(convertINRToUSD(combination.breakdown.hostingUsersCostINR))}</div>
                      <div className="text-gray-500 text-[0.55rem]">{formatINR(combination.breakdown.hostingUsersCostINR)}</div>
                    </div>
                </div>
          <div className="flex justify-between">
                    <span>Calls Cost:</span>
                    <div className="text-right">
                      <div className="font-semibold">{formatUSD(convertINRToUSD(combination.breakdown.hostingCallsCostINR))}</div>
                      <div className="text-gray-500 text-[0.55rem]">{formatINR(combination.breakdown.hostingCallsCostINR)}</div>
                </div>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-gray-300 dark:border-gray-700">
                  <span>Total Hosting Cost:</span>
                    <div className="text-right">
                      <div className="font-bold text-lg">{formatUSD(convertINRToUSD(combination.breakdown.hostingCostINR))}</div>
                      <div className="text-gray-500">{formatINR(combination.breakdown.hostingCostINR)}</div>
                    </div>
                  </div>
          </div>
        </div>
            </div>

            {/* Misc Expenses */}
            <div className={`col-span-1 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/30 dark:to-orange-900/30 rounded-xl p-4 border border-yellow-200 dark:border-yellow-900 relative ${combination.breakdown.voiceCostINR > 0 ? '' : ''}`}>
              <div className="absolute -top-2 right-2 bg-yellow-600 text-white text-[0.6rem] font-semibold px-2 py-0.5 rounded-md shadow-md z-10">
                Blacksteeed
              </div>
              <div className="text-[0.7rem] font-semibold text-gray-900 dark:text-white mb-3">Miscellaneous Expenses</div>
              
              <div className="space-y-3 text-gray-700 dark:text-gray-300 text-[0.6rem]">
                {/* Architecture Components Info */}
                <div className="pb-2 border-b border-gray-300 dark:border-gray-700">
                  <div className="text-[0.6rem] text-gray-600 dark:text-gray-400 mb-2 italic">
                    This is the cost of architecture components:
                  </div>
                </div>

                {/* Architecture Components List */}
                <div className="space-y-1">
                  <div>- Avatar Vendor Services (Audio + Video I/O)</div>
                  <div>- External Voice Vendor Services</div>
                  <div>- Vendor Live Transcription Services</div>
                  <div>- Response Router</div>
                  <div>- Runtime API Session State (Azure Cache for Redis)</div>
                  <div>- Azure Application Gateway WAF Routing</div>
                  <div>- MCP Runtime Engine</div>
                  <div>- LLM Embedding Services (Azure OpenAI)</div>
                  <div>- MCP Prompt Builder</div>
                  <div>- Tool Runners Azure Container Apps</div>
                  <div>- Internal Load Balancer (for Tool Execution)</div>
                  <div>- Tool Queue (Azure Service Bus or Storage Queue)</div>
                  <div>- Azure Service Bus Fan-out Control</div>
                  <div>- Context Aggregator</div>
                  <div>- Azure Blob Storage (Docs Memory Chunks, Vector Zone, Raw Zone)</div>
                  <div>- RAG Runners Azure Container Apps</div>
                  <div>- Azure Cognitive Search</div>
                  <div>- Internal Load Balancer (for RAG Context)</div>
                  <div>- RAG Queue (Azure Service Bus or Storage Queue)</div>
                  <div>- Azure Functions (for Chunk Clean)</div>
                  <div>- Azure Event Grid</div>
                  <div>- Client Knowledge Sources</div>
                </div>

                {/* Totals */}
                <div className="pt-2 border-t-2 border-gray-400 dark:border-gray-600 space-y-1">
                  <div className="flex justify-between pt-1 border-t border-gray-300 dark:border-gray-700">
                    <span>Architectural Cost:</span>
                    <div className="text-right">
                      <div className="font-bold text-lg">{formatUSD(convertINRToUSD(combination.breakdown.miscExpensesINR))}</div>
                      <div className="text-gray-500">{formatINR(combination.breakdown.miscExpensesINR)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Miscellaneous (if Voice exists), Storage */}
            {/* Storage Cost Breakdown - Comprehensive */}
            <div className={combination.breakdown.voiceCostINR > 0 ? 'col-span-2' : 'col-span-3'}>
              <StorageCostBreakdown 
                combination={combination} 
                storageInput={storageInput}
                formatUSD={formatUSD}
                formatINR={formatINR}
                convertUSDToINR={convertUSDToINR}
              />
            </div>

            {/* Total Summary - Full Width */}
            <div className="col-span-3 bg-gradient-to-r from-purple-700 via-purple-600 to-pink-600 rounded-xl p-6 border-2 border-purple-400 dark:border-purple-300 shadow-2xl">
              <div className="mb-6 pb-4 border-b border-purple-400/50 dark:border-purple-300/50">
                <div className="text-2xl font-extrabold text-white mb-1">Total Monthly Cost</div>
                <div className="text-sm text-purple-100">Complete cost breakdown for this combination</div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Donut Chart */}
                <div>
                  <div className="mb-3">
                    <div className="text-sm font-semibold text-white mb-1">Cost Distribution</div>
                    <div className="text-xs text-purple-100">Visual breakdown by component</div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="flex-1 h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={(() => {
                              const data = [
                                { name: 'Avatar', value: combination.breakdown.avatarCostUSD, color: '#010101' },
                                { name: 'Voice', value: combination.breakdown.voiceCostUSD, color: '#3B82F6' },
                                { name: 'Hosting', value: convertINRToUSD(combination.breakdown.hostingCostINR), color: '#A855F7' },
                                { name: 'Storage', value: combination.breakdown.storageCostUSD, color: '#EC4899' },
                                { name: 'Architectural', value: convertINRToUSD(combination.breakdown.miscExpensesINR), color: '#F59E0B' }
                              ].filter(item => item.value > 0);
                              const maxValue = Math.max(...data.map(d => d.value));
                              return data.map(item => ({
                                ...item,
                                isPrimary: item.value === maxValue
                              }));
                            })()}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={75}
                            paddingAngle={2}
                            dataKey="value"
                            label={(entry: any) => {
                              const allData = [
                                { name: 'Avatar', value: combination.breakdown.avatarCostUSD },
                                { name: 'Voice', value: combination.breakdown.voiceCostUSD },
                                { name: 'Hosting', value: convertINRToUSD(combination.breakdown.hostingCostINR) },
                                { name: 'Storage', value: combination.breakdown.storageCostUSD },
                                { name: 'Architectural', value: convertINRToUSD(combination.breakdown.miscExpensesINR) }
                              ].filter(item => item.value > 0);
                              
                              // Find the primary (max value) entry
                              const maxValue = Math.max(...allData.map(d => d.value));
                              const primaryEntry = allData.find(d => Math.abs(d.value - maxValue) < 0.001);
                              
                              console.log('=== PRIMARY DEBUG ===');
                              console.log('All Data:', allData);
                              console.log('Max Value:', maxValue);
                              console.log('Primary Entry:', primaryEntry);
                              console.log('Entry from Recharts:', {
                                payload: entry.payload,
                                name: entry.name,
                                value: entry.value,
                                percent: entry.percent,
                                startAngle: entry.startAngle,
                                endAngle: entry.endAngle
                              });
                              
                              if (!primaryEntry) {
                                console.log('No primary entry found');
                                return null;
                              }
                              
                              // Get the entry name and value from Recharts
                              const entryName = entry.payload?.name ?? entry.name;
                              const entryValue = entry.payload?.value ?? entry.value;
                              
                              console.log('Entry Name:', entryName, 'Primary Name:', primaryEntry.name);
                              console.log('Entry Value:', entryValue, 'Primary Value:', primaryEntry.value);
                              console.log('Name Match:', entryName === primaryEntry.name);
                              console.log('Value Match:', entryValue !== undefined && Math.abs(entryValue - maxValue) < 0.001);
                              
                              // Check if this is the primary entry by comparing both name and value
                              const isPrimary = (entryName === primaryEntry.name) || 
                                             (entryValue !== undefined && Math.abs(entryValue - maxValue) < 0.001);
                              
                              console.log('Is Primary:', isPrimary);
                              console.log('Percent:', entry.percent);
                              console.log('Start Angle:', entry.startAngle, 'End Angle:', entry.endAngle);
                              console.log('========================');
                              
                              if (!isPrimary || !entry.percent || entry.percent < 0.15) {
                                console.log('Skipping - not primary or percent too small');
                                return null;
                              }
                              
                              console.log('RENDERING PRIMARY LABEL FOR:', entryName);
                              
                              const RADIAN = Math.PI / 180;
                              const radius = (entry.innerRadius + entry.outerRadius) / 2;
                              const cx = entry.cx;
                              const cy = entry.cy;
                              const startAngle = entry.startAngle;
                              const endAngle = entry.endAngle;
                              
                              // Calculate the midpoint angle (center of the arc)
                              let midAngle = (startAngle + endAngle) / 2;
                              // Handle wrap-around case
                              if (Math.abs(endAngle - startAngle) > 180) {
                                midAngle = (midAngle +300) % 360;
                              }
                              
                              console.log('Arc calculation:', { cx, cy, radius, startAngle, endAngle, midAngle });
                              
                              // Convert midpoint to SVG coordinate system - INVERTED
                              // Recharts: 0° is at top, positive is clockwise
                              // SVG: 0° is at right (3 o'clock), positive is counter-clockwise
                              // Inverting the calculation to flip to opposite side
                              const midAngleRad = ((-90 - midAngle) % 360) * RADIAN;
                              
                              // Calculate arc path using midpoint - create a small arc centered at midpoint
                              const arcSpan = Math.abs(endAngle - startAngle);
                              const smallArcSpan = Math.min(arcSpan, 60); // Limit to 60 degrees for text path
                              const halfSpan = smallArcSpan / 2;
                              
                              const startAngleRad = ((-90 - (midAngle - halfSpan)) % 360) * RADIAN;
                              const endAngleRad = ((-90 - (midAngle + halfSpan)) % 360) * RADIAN;
                              
                              const x1 = cx + radius * Math.cos(startAngleRad);
                              const y1 = cy + radius * Math.sin(startAngleRad); // Inverted sign
                              const x2 = cx + radius * Math.cos(endAngleRad);
                              const y2 = cy + radius * Math.sin(endAngleRad); // Inverted sign
                              
                              console.log('Arc path points:', { x1, y1, x2, y2 });
                              
                              const largeArcFlag = smallArcSpan > 180 ? 1 : 0;
                              const pathId = `arc-primary-${entryName}-${Date.now()}`;
                              
                              console.log('Path ID:', pathId, 'Large Arc Flag:', largeArcFlag);
                              
                              return (
                                <g key={pathId}>
                                  <defs>
                                    <path
                                      id={pathId}
                                      d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${x2} ${y2}`}
                                    />
                                  </defs>
                                  <text
                                    fill="white"
                                    fontSize="11"
                                    fontWeight="bold"
                                    fontFamily="Poppins, sans-serif"
                                    style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.8))', pointerEvents: 'none' }}
                                  >
                                    <textPath
                                      href={`#${pathId}`}
                                      startOffset="50%"
                                      textAnchor="middle"
                                      letterSpacing="2"
                                    >
                                      P R I M E
                                    </textPath>
                                  </text>
                                </g>
                              );
                            }}
                          >
                            {[
                              { name: 'Avatar', value: combination.breakdown.avatarCostUSD, color: '#010101' },
                              { name: 'Voice', value: combination.breakdown.voiceCostUSD, color: '#3B82F6' },
                              { name: 'Hosting', value: convertINRToUSD(combination.breakdown.hostingCostINR), color: '#A855F7' },
                              { name: 'Storage', value: combination.breakdown.storageCostUSD, color: '#EC4899' },
                              { name: 'Architectural', value: convertINRToUSD(combination.breakdown.miscExpensesINR), color: '#F59E0B' }
                            ].filter(item => item.value > 0).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number | undefined) => formatUSD(value || 0)}
                            contentStyle={{ backgroundColor: '#F9F4EE', border: '1px solid #E5DDD1', borderRadius: '8px', fontSize: '11px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-shrink-0">
                      <div className="space-y-2.5 text-[0.7rem] text-white">
                        {[
                          { name: 'Avatar', value: combination.breakdown.avatarCostUSD, color: '#010101' },
                          { name: 'Voice', value: combination.breakdown.voiceCostUSD, color: '#3B82F6' },
                          { name: 'Hosting', value: convertINRToUSD(combination.breakdown.hostingCostINR), color: '#A855F7' },
                          { name: 'Storage', value: combination.breakdown.storageCostUSD, color: '#EC4899' },
                          { name: 'Architectural', value: convertINRToUSD(combination.breakdown.miscExpensesINR), color: '#F59E0B' }
                        ].filter(item => item.value > 0)
                        .sort((a, b) => b.value - a.value)
                        .map((entry, index) => (
                          <div key={`legend-${index}`} className="flex items-center gap-2.5">
                            <div 
                              className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-white/20" 
                              style={{ backgroundColor: entry.color }}
                            />
                            <div className="flex flex-col">
                              <span className="font-semibold text-white">{entry.name}</span>
                              <span className="text-purple-100 text-[0.65rem]">{formatUSD(entry.value)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cost Summary */}
                <div className="flex flex-col justify-center">
                  <div className="mb-4">
                    <div className="text-sm font-semibold text-white mb-1">Total Cost</div>
                    <div className="text-xs text-purple-100">Monthly expenses summary</div>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-4 border border-white/20">
                    <div className="flex justify-between items-center mb-3 pb-3 border-b border-white/20">
                      <span className="text-base font-semibold text-purple-100">USD:</span>
                      <span className="text-2xl font-extrabold text-white">{formatUSD(combination.breakdown.totalCostUSD)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-base font-semibold text-purple-100">INR:</span>
                      <span className="text-2xl font-extrabold text-white">{formatINR(combination.breakdown.totalCostINR)}</span>
                    </div>
                  </div>
                  
                  <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                    <div className="text-xs font-semibold text-white mb-3 uppercase tracking-wider">Component Breakdown</div>
                    <div className="space-y-2 text-[0.7rem]">
                      <div className="flex justify-between items-center py-1 border-b border-white/10">
                        <span className="text-purple-100">Avatar:</span>
                        <span className="font-semibold text-white">{formatUSD(combination.breakdown.avatarCostUSD)}</span>
                      </div>
                      {combination.breakdown.voiceCostUSD > 0 && (
                        <div className="flex justify-between items-center py-1 border-b border-white/10">
                          <span className="text-purple-100">Voice:</span>
                          <span className="font-semibold text-white">{formatUSD(combination.breakdown.voiceCostUSD)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center py-1 border-b border-white/10">
                        <span className="text-purple-100">Hosting:</span>
                        <span className="font-semibold text-white">{formatUSD(convertINRToUSD(combination.breakdown.hostingCostINR))}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-white/10">
                        <span className="text-purple-100">Storage:</span>
                        <span className="font-semibold text-white">{formatUSD(combination.breakdown.storageCostUSD)}</span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-purple-100">Architectural:</span>
                        <span className="font-semibold text-white">{formatUSD(convertINRToUSD(combination.breakdown.miscExpensesINR))}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warnings, Score, Quality, Latency, and View Details Button - Same Line */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 flex items-start gap-4">
        {/* Left side: Bookmark note and warnings stacked vertically */}
        <div className="flex flex-col space-y-2 flex-1 min-w-0">
          {/* Bookmark note - always shown first */}
          <div className="flex items-center space-x-1.5 text-[0.6rem] text-gray-600 dark:text-gray-400">
            <DotLottieReact
              src="/bookmark.lottie"
              loop={false}
              autoplay={false}
              dotLottieRefCallback={(dotLottie) => {
                if (dotLottie) {
                  // Always show frame 0 (empty bookmark) in the note
                  dotLottie.stop();
                  dotLottie.setFrame(0);
                  dotLottie.pause();
                }
              }}
              style={{ width: 12, height: 12 }}
            />
            <span>Click the bookmark icon to save this combination for later</span>
          </div>
          
          {/* Warnings - filtered to exclude budget-related warnings, shown below bookmark */}
          {(() => {
            const filteredWarnings = combination.warnings.filter(
              warning => !warning.toLowerCase().includes('exceeds allocated budget') &&
                         !warning.toLowerCase().includes('hosting cost') && 
                         !warning.toLowerCase().includes('budget')
            );
            return filteredWarnings.length > 0 && (
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="text-[0.6rem] text-yellow-800 dark:text-yellow-200 space-y-1">
                  {filteredWarnings.map((warning, idx) => (
                    <div key={idx}>• {warning}</div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
        
        {/* Right side: Score and View Details Button - always on the right */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-[0.6rem] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
            SCORE: <span className="text-gray-700 dark:text-gray-300">{combination.score.toFixed(0)}</span> (HIGHER IS BETTER)
          </div>

          {/* View Details Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDetails(!showDetails);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#010101] bg-[#F9F4EE] border border-[#E5DDD1] rounded-xl transition-all duration-200 hover:border-[#010101] flex-shrink-0"
          >
            <span className="uppercase tracking-wider text-xs">
              {showDetails ? 'Hide' : 'View'} Details
            </span>
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

// Comprehensive Storage Cost Breakdown Component
function StorageCostBreakdown({ 
  combination, 
  storageInput, 
  formatUSD, 
  formatINR, 
  convertUSDToINR 
}: { 
  combination: Combination; 
  storageInput: any; 
  formatUSD: (amount: number) => string;
  formatINR: (amount: number) => string;
  convertUSDToINR: (amount: number) => number;
}) {
  if (!storageInput) {
    return (
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl p-4 border border-purple-200 dark:border-purple-900">
              <div className="text-[0.7rem] font-semibold text-gray-900 dark:text-white mb-2">Storage Cost Breakdown</div>
              <div className="space-y-1 text-gray-700 dark:text-gray-300">
                <div className="flex justify-between">
                  <span>Storage Option:</span>
                  <span className="font-semibold">{combination.storageOption.label}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cost per Database:</span>
                  <div className="text-right">
                    <div>{formatUSD(combination.storageOption.monthlyCostUSD)}</div>
                    <div className="text-gray-500">{formatINR(convertUSDToINR(combination.storageOption.monthlyCostUSD))}</div>
                  </div>
                </div>
                <div className="flex justify-between pt-1 border-t border-gray-300 dark:border-gray-700 font-semibold">
                  <span>Total Storage Cost:</span>
                  <div className="text-right">
                    <div>{formatUSD(combination.breakdown.storageCostUSD)}</div>
                    <div className="text-gray-500">{formatINR(combination.breakdown.storageCostINR)}</div>
                  </div>
                </div>
              </div>
            </div>
    );
  }

  const provider = combination.storageOption.provider;
  const additionalCosts = storageInput.additionalCosts?.[provider.toLowerCase()] || {};
  const tierAllocation = storageInput.tierAllocation || { hot: 0, cold: 0, archive: 0 };
  const numberOfDatabases = storageInput.numberOfDatabases || 1;

  // Pricing constants
  const ADDITIONAL_COST_PRICING = {
    aws: {
      dataTransferOut: 0.09,
      putRequest: 0.000005,
      getRequest: 0.0000004,
      dataRetrievalCold: 0.01,
      dataRetrievalArchive: 0.01,
      dataRetrievalArchiveExpedited: 0.03,
      retrievalRequestStandard: 0.05,
      retrievalRequestExpedited: 0.03,
    },
    azure: {
      dataTransferOut: 0.087,
      readOperation: 0.0004,
      writeOperation: 0.005,
      queryDataScanned: 0.01,
      queryDataReturned: 0.01,
      iterativeReadOp: 0.0004,
      iterativeWriteOp: 0.005,
      otherOperation: 0.0004,
      dataRetrievalCold: 0.01,
      dataRetrievalArchive: 0.01,
      highPriorityRead: 0.05,
      highPriorityRetrieval: 0.02,
    },
  };

  // Calculate base storage costs by tier (simplified - using average pricing)
  const getBaseStorageCost = (tier: 'hot' | 'cold' | 'archive', sizeGB: number): number => {
    const pricing = {
      'data-lake-LRS': { hot: 0.020, cold: 0.0036, archive: 0.001 },
      'data-lake-GRS': { hot: 0.040, cold: 0.0081, archive: 0.00299 },
      'blob-LRS': { hot: 0.020, cold: 0.0036, archive: 0.00099 },
      'blob-GRS': { hot: 0.044, cold: 0.0081, archive: 0.00299 },
      'aws-s3': { hot: 0.023, cold: 0.0125, archive: 0.0036 },
    };
    const optionId = combination.storageOption.id;
    const tierPrice = pricing[optionId as keyof typeof pricing]?.[tier] || 0;
    return sizeGB * tierPrice;
  };

  const hotBaseCost = getBaseStorageCost('hot', tierAllocation.hot);
  const coldBaseCost = getBaseStorageCost('cold', tierAllocation.cold);
  const archiveBaseCost = getBaseStorageCost('archive', tierAllocation.archive);

  // Calculate additional costs by tier
  const calculateTierAdditionalCosts = (tier: 'hot' | 'cold' | 'archive') => {
    const tierCosts = additionalCosts[tier] || {};
    const pricing = ADDITIONAL_COST_PRICING[provider];
    const costs: Array<{ label: string; value: number; unit: string }> = [];

    if (provider === 'aws') {
      if (tierCosts.dataTransferOut) {
        costs.push({
          label: 'Data Transfer Out',
          value: tierCosts.dataTransferOut * pricing.dataTransferOut,
          unit: `${tierCosts.dataTransferOut} GB × $${pricing.dataTransferOut}/GB`
        });
      }
      if (tierCosts.putRequests && 'putRequest' in pricing) {
        costs.push({
          label: 'PUT/COPY/POST/LIST Requests',
          value: tierCosts.putRequests * pricing.putRequest,
          unit: `${tierCosts.putRequests.toLocaleString()} × $${pricing.putRequest}/request`
        });
      }
      if (tierCosts.getRequests && 'getRequest' in pricing) {
        costs.push({
          label: 'GET/SELECT Requests',
          value: tierCosts.getRequests * pricing.getRequest,
          unit: `${tierCosts.getRequests.toLocaleString()} × $${pricing.getRequest}/request`
        });
      }
      if ((tier === 'cold' || tier === 'archive') && tierCosts.dataRetrieved) {
        const retrievalPrice = tier === 'archive' && tierCosts.retrievalType === 'Expedited' 
          ? ('dataRetrievalArchiveExpedited' in pricing ? pricing.dataRetrievalArchiveExpedited : pricing.dataRetrievalCold)
          : pricing.dataRetrievalCold;
        costs.push({
          label: 'Data Retrieval',
          value: tierCosts.dataRetrieved * retrievalPrice,
          unit: `${tierCosts.dataRetrieved} GB × $${retrievalPrice}/GB${tier === 'archive' && tierCosts.retrievalType ? ` (${tierCosts.retrievalType})` : ''}`
        });
      }
      if (tier === 'archive' && tierCosts.retrievalRequests) {
        let requestPrice = 0;
        if (tierCosts.retrievalType === 'Expedited') {
          requestPrice = 'retrievalRequestExpedited' in pricing ? (pricing.retrievalRequestExpedited as number) : 
                        ('retrievalRequestStandard' in pricing ? (pricing.retrievalRequestStandard as number) : 0);
        } else {
          requestPrice = 'retrievalRequestStandard' in pricing ? (pricing.retrievalRequestStandard as number) : 0;
        }
        costs.push({
          label: 'Retrieval Requests',
          value: tierCosts.retrievalRequests * requestPrice,
          unit: `${tierCosts.retrievalRequests.toLocaleString()} × $${requestPrice}/request${tierCosts.retrievalType ? ` (${tierCosts.retrievalType})` : ''}`
        });
      }
    } else if (provider === 'azure') {
      if (tierCosts.dataTransferOut) {
        costs.push({
          label: 'Data Transfer Out',
          value: tierCosts.dataTransferOut * pricing.dataTransferOut,
          unit: `${tierCosts.dataTransferOut} GB × $${pricing.dataTransferOut}/GB`
        });
      }
      if (tierCosts.readOperations && 'readOperation' in pricing) {
        costs.push({
          label: 'Read Operations',
          value: (tierCosts.readOperations / 10000) * pricing.readOperation,
          unit: `${tierCosts.readOperations.toLocaleString()} ÷ 10,000 × $${pricing.readOperation}/10K`
        });
      }
      if (tierCosts.writeOperations && 'writeOperation' in pricing) {
        costs.push({
          label: 'Write Operations',
          value: (tierCosts.writeOperations / 10000) * pricing.writeOperation,
          unit: `${tierCosts.writeOperations.toLocaleString()} ÷ 10,000 × $${pricing.writeOperation}/10K`
        });
      }
      if (tierCosts.queryDataScanned && 'queryDataScanned' in pricing) {
        costs.push({
          label: 'Query Acceleration - Data Scanned',
          value: tierCosts.queryDataScanned * pricing.queryDataScanned,
          unit: `${tierCosts.queryDataScanned} GB × $${pricing.queryDataScanned}/GB`
        });
      }
      if (tierCosts.queryDataReturned && 'queryDataReturned' in pricing) {
        costs.push({
          label: 'Query Acceleration - Data Returned',
          value: tierCosts.queryDataReturned * pricing.queryDataReturned,
          unit: `${tierCosts.queryDataReturned} GB × $${pricing.queryDataReturned}/GB`
        });
      }
      if (tierCosts.iterativeReadOps && 'iterativeReadOp' in pricing) {
        costs.push({
          label: 'Iterative Read Operations',
          value: (tierCosts.iterativeReadOps / 10000) * pricing.iterativeReadOp,
          unit: `${tierCosts.iterativeReadOps.toLocaleString()} ÷ 10,000 × $${pricing.iterativeReadOp}/10K`
        });
      }
      if (tierCosts.iterativeWriteOps && 'iterativeWriteOp' in pricing) {
        costs.push({
          label: 'Iterative Write Operations',
          value: (tierCosts.iterativeWriteOps / 100) * pricing.iterativeWriteOp,
          unit: `${tierCosts.iterativeWriteOps.toLocaleString()} ÷ 100 × $${pricing.iterativeWriteOp}/100`
        });
      }
      if (tier === 'hot' && tierCosts.otherOperations && 'otherOperation' in pricing) {
        costs.push({
          label: 'Other Operations',
          value: (tierCosts.otherOperations / 10000) * pricing.otherOperation,
          unit: `${tierCosts.otherOperations.toLocaleString()} ÷ 10,000 × $${pricing.otherOperation}/10K`
        });
      }
      if ((tier === 'cold' || tier === 'archive') && tierCosts.dataRetrieved) {
        costs.push({
          label: 'Data Retrieval',
          value: tierCosts.dataRetrieved * pricing.dataRetrievalCold,
          unit: `${tierCosts.dataRetrieved} GB × $${pricing.dataRetrievalCold}/GB`
        });
      }
      if (tier === 'archive') {
        if (tierCosts.highPriorityRead && 'highPriorityRead' in pricing) {
          costs.push({
            label: 'High Priority Read Operations',
            value: (tierCosts.highPriorityRead / 100) * pricing.highPriorityRead,
            unit: `${tierCosts.highPriorityRead.toLocaleString()} ÷ 100 × $${pricing.highPriorityRead}/100`
          });
        }
        if (tierCosts.highPriorityRetrieval && 'highPriorityRetrieval' in pricing) {
          costs.push({
            label: 'High Priority Retrieval',
            value: tierCosts.highPriorityRetrieval * pricing.highPriorityRetrieval,
            unit: `${tierCosts.highPriorityRetrieval} GB × $${pricing.highPriorityRetrieval}/GB`
          });
        }
      }
    }

    return costs;
  };

  const hotAdditionalCosts = calculateTierAdditionalCosts('hot');
  const coldAdditionalCosts = calculateTierAdditionalCosts('cold');
  const archiveAdditionalCosts = calculateTierAdditionalCosts('archive');

  const hotAdditionalTotal = hotAdditionalCosts.reduce((sum, c) => sum + c.value, 0);
  const coldAdditionalTotal = coldAdditionalCosts.reduce((sum, c) => sum + c.value, 0);
  const archiveAdditionalTotal = archiveAdditionalCosts.reduce((sum, c) => sum + c.value, 0);

  // Calculate weighted additional costs (based on tier allocation)
  const totalGB = tierAllocation.hot + tierAllocation.cold + tierAllocation.archive;
  const hotWeight = totalGB > 0 ? tierAllocation.hot / totalGB : 0;
  const coldWeight = totalGB > 0 ? tierAllocation.cold / totalGB : 0;
  const archiveWeight = totalGB > 0 ? tierAllocation.archive / totalGB : 0;

  const weightedAdditionalTotal = (hotAdditionalTotal * hotWeight) + (coldAdditionalTotal * coldWeight) + (archiveAdditionalTotal * archiveWeight);
  
  // Data Lake index cost (if applicable)
  const isDataLake = combination.storageOption.id.includes('data-lake');
  const indexCost = isDataLake ? (tierAllocation.hot * 0.0297) + (tierAllocation.cold * 0.0297) : 0;

  const baseStorageTotal = hotBaseCost + coldBaseCost + archiveBaseCost + indexCost;
  const totalPerDatabase = baseStorageTotal + weightedAdditionalTotal;
  const totalForAllDatabases = totalPerDatabase * numberOfDatabases;

  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl p-4 border border-purple-200 dark:border-purple-900 relative">
      <div className="absolute -top-2 right-2 bg-pink-600 text-white text-[0.6rem] font-semibold px-2 py-0.5 rounded-md shadow-md z-10">
        {formatProviderName(combination.storageOption.provider)}
      </div>
      <div className="text-[0.7rem] font-semibold text-gray-900 dark:text-white mb-3">Storage Cost Breakdown</div>
      
      {/* Charts Container - Side by Side */}
      <div className="flex gap-4 mb-3">
        {/* Storage Bar Chart - Base Costs */}
        <div className="flex-1">
          <div className="text-[0.65rem] font-semibold text-gray-900 dark:text-white mb-2">Base Costs Breakdown</div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[
              ...(hotBaseCost > 0 ? [{ name: 'Hot', value: hotBaseCost }] : []),
              ...(coldBaseCost > 0 ? [{ name: 'Cold', value: coldBaseCost }] : []),
              ...(archiveBaseCost > 0 ? [{ name: 'Archive', value: archiveBaseCost }] : []),
              ...(indexCost > 0 ? [{ name: 'Index', value: indexCost }] : []),
              ...(weightedAdditionalTotal > 0 ? [{ name: 'Additional', value: weightedAdditionalTotal }] : [])
            ].filter(item => item.value > 0)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5DDD1" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#666" />
              <YAxis tick={{ fontSize: 10 }} stroke="#666" />
              <Tooltip 
                formatter={(value: number | undefined) => formatUSD(value || 0)}
                contentStyle={{ backgroundColor: '#F9F4EE', border: '1px solid #E5DDD1', borderRadius: '8px', fontSize: '11px' }}
              />
              <Bar dataKey="value" fill="#EC4899" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
              </div>
            </div>

        {/* Additional Costs Breakdown Chart - Pie Chart */}
        {(hotAdditionalCosts.length > 0 || coldAdditionalCosts.length > 0 || archiveAdditionalCosts.length > 0) && (
          <div className="flex-1">
            <div className="text-[0.65rem] font-semibold text-gray-900 dark:text-white mb-1">Additional Costs Breakdown</div>
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart margin={{ top: -1, right: 20, bottom: 20, left: 20 }}>
                  <Pie
                    data={(() => {
                      // Aggregate all additional costs by parameter name across all tiers
                      const costMap = new Map<string, number>();
                      
                      // Combine all costs from all tiers
                      [...hotAdditionalCosts, ...coldAdditionalCosts, ...archiveAdditionalCosts].forEach(cost => {
                        const existing = costMap.get(cost.label) || 0;
                        costMap.set(cost.label, existing + cost.value);
                      });
                      
                      // Convert to array and filter out zero values
                      return Array.from(costMap.entries())
                        .map(([label, value]) => ({
                          name: label.length > 25 ? label.substring(0, 22) + '...' : label,
                          fullName: label,
                          value: value
                        }))
                        .filter(item => item.value > 0)
                        .sort((a, b) => b.value - a.value); // Sort by value descending
                    })()}
                    cx="50%"
                    cy="50%"
                    innerRadius={25}
                    outerRadius={55}
                    paddingAngle={2}
                    dataKey="value"
                    label={false}
                    labelLine={false}
                  >
                    {(() => {
                      const costMap = new Map<string, number>();
                      [...hotAdditionalCosts, ...coldAdditionalCosts, ...archiveAdditionalCosts].forEach(cost => {
                        const existing = costMap.get(cost.label) || 0;
                        costMap.set(cost.label, existing + cost.value);
                      });
                      const colors = ['#EC4899', '#F472B6', '#F9A8D4', '#FBCFE8', '#FCE7F3', '#010101', '#1a1a1a', '#333333', '#4a4a4a', '#666666'];
                      return Array.from(costMap.entries())
                        .map(([label, value]) => ({ label, value }))
                        .filter(item => item.value > 0)
                        .sort((a, b) => b.value - a.value)
                        .map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                        ));
                    })()}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number | undefined, name: string | undefined, props: any) => [
                      formatUSD(value || 0),
                      props?.payload?.fullName || name || ''
                    ]}
                    contentStyle={{ backgroundColor: '#F9F4EE', border: '1px solid #E5DDD1', borderRadius: '8px', fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              </div>
            <div className="flex-shrink-0">
              <div className="space-y-2 text-[0.65rem]">
                {(() => {
                  const costMap = new Map<string, number>();
                  [...hotAdditionalCosts, ...coldAdditionalCosts, ...archiveAdditionalCosts].forEach(cost => {
                    const existing = costMap.get(cost.label) || 0;
                    costMap.set(cost.label, existing + cost.value);
                  });
                  const colors = ['#EC4899', '#F472B6', '#F9A8D4', '#FBCFE8', '#FCE7F3', '#010101', '#1a1a1a', '#333333', '#4a4a4a', '#666666'];
                  return Array.from(costMap.entries())
                    .map(([label, value]) => ({ label, value }))
                    .filter(item => item.value > 0)
                    .sort((a, b) => b.value - a.value)
                    .map((entry, index) => (
                      <div key={`legend-${index}`} className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: colors[index % colors.length] }}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900 dark:text-white">{entry.label}</span>
                          <span className="text-gray-500 dark:text-gray-400 text-[0.6rem]">{formatUSD(entry.value)}</span>
                        </div>
                      </div>
                    ));
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      <div className="space-y-3 text-gray-700 dark:text-gray-300 text-[0.6rem]">
        {/* Storage Option Info */}
        <div className="pb-2 border-b border-gray-300 dark:border-gray-700">
          <div className="flex justify-between mb-1">
            <span>Storage Option:</span>
            <span className="font-semibold">{combination.storageOption.label}</span>
          </div>
          <div className="flex justify-between">
            <span>Number of Databases:</span>
            <span>{numberOfDatabases}</span>
              </div>
            </div>

        {/* Base Storage Costs by Tier */}
        <div className="space-y-2">
          <div className="font-semibold text-gray-900 dark:text-white">Base Storage Costs:</div>
          
          {tierAllocation.hot > 0 && (
            <div className="pl-2 border-l-2 border-blue-400">
              <div className="font-medium">Hot Tier ({tierAllocation.hot.toFixed(0)} GB):</div>
              <div className="flex justify-between pl-2">
                <span>Storage Cost:</span>
                <div className="text-right">
                  <span>{formatUSD(hotBaseCost)}</span>
                  <div className="text-gray-500 text-[0.55rem]">{formatINR(convertUSDToINR(hotBaseCost))}</div>
                </div>
              </div>
              </div>
          )}
          
          {tierAllocation.cold > 0 && (
            <div className="pl-2 border-l-2 border-yellow-400">
              <div className="font-medium">Cold Tier ({tierAllocation.cold.toFixed(0)} GB):</div>
              <div className="flex justify-between pl-2">
                <span>Storage Cost:</span>
                <div className="text-right">
                  <span>{formatUSD(coldBaseCost)}</span>
                  <div className="text-gray-500 text-[0.55rem]">{formatINR(convertUSDToINR(coldBaseCost))}</div>
                </div>
            </div>
            </div>
          )}
          
          {tierAllocation.archive > 0 && (
            <div className="pl-2 border-l-2 border-gray-400">
              <div className="font-medium">Archive Tier ({tierAllocation.archive.toFixed(0)} GB):</div>
              <div className="flex justify-between pl-2">
                <span>Storage Cost:</span>
                <div className="text-right">
                  <span>{formatUSD(archiveBaseCost)}</span>
                  <div className="text-gray-500 text-[0.55rem]">{formatINR(convertUSDToINR(archiveBaseCost))}</div>
                </div>
          </div>
        </div>
      )}

          {isDataLake && (
            <div className="pl-2">
              <div className="flex justify-between">
                <span>Index Cost (Data Lake):</span>
                <div className="text-right">
                  <span>{formatUSD(indexCost)}</span>
                  <div className="text-gray-500 text-[0.55rem]">{formatINR(convertUSDToINR(indexCost))}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Additional Costs by Tier */}
        {(hotAdditionalCosts.length > 0 || coldAdditionalCosts.length > 0 || archiveAdditionalCosts.length > 0) && (
          <div className="space-y-2 pt-2 border-t border-gray-300 dark:border-gray-700">
            <div className="font-semibold text-gray-900 dark:text-white">Additional Costs:</div>
            
            {hotAdditionalCosts.length > 0 && (
              <div className="pl-2 border-l-2 border-blue-400">
                <div className="font-medium mb-1">Hot Tier Additional Costs:</div>
                {hotAdditionalCosts.map((cost, idx) => (
                  <div key={idx} className="pl-2 space-y-0.5">
                    <div className="flex justify-between">
                      <span>{cost.label}:</span>
                      <div className="text-right">
                        <span>{formatUSD(cost.value)}</span>
                        <div className="text-gray-500 text-[0.55rem]">{formatINR(convertUSDToINR(cost.value))}</div>
                      </div>
                    </div>
                    <div className="text-[0.55rem] text-gray-500 italic pl-2">
                      {cost.unit}
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pl-2 pt-1 border-t border-gray-200 dark:border-gray-700 mt-1">
                  <span className="font-medium">Hot Tier Additional Total:</span>
                  <div className="text-right">
                    <span className="font-medium">{formatUSD(hotAdditionalTotal)}</span>
                    <div className="text-gray-500 text-[0.55rem]">{formatINR(convertUSDToINR(hotAdditionalTotal))}</div>
            </div>
          </div>
        </div>
      )}

            {coldAdditionalCosts.length > 0 && (
              <div className="pl-2 border-l-2 border-yellow-400">
                <div className="font-medium mb-1">Cold Tier Additional Costs:</div>
                {coldAdditionalCosts.map((cost, idx) => (
                  <div key={idx} className="pl-2 space-y-0.5">
                    <div className="flex justify-between">
                      <span>{cost.label}:</span>
                      <div className="text-right">
                        <span>{formatUSD(cost.value)}</span>
                        <div className="text-gray-500 text-[0.55rem]">{formatINR(convertUSDToINR(cost.value))}</div>
                      </div>
                    </div>
                    <div className="text-[0.55rem] text-gray-500 italic pl-2">
                      {cost.unit}
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pl-2 pt-1 border-t border-gray-200 dark:border-gray-700 mt-1">
                  <span className="font-medium">Cold Tier Additional Total:</span>
                  <div className="text-right">
                    <span className="font-medium">{formatUSD(coldAdditionalTotal)}</span>
                    <div className="text-gray-500 text-[0.55rem]">{formatINR(convertUSDToINR(coldAdditionalTotal))}</div>
                  </div>
          </div>
        </div>
      )}

            {archiveAdditionalCosts.length > 0 && (
              <div className="pl-2 border-l-2 border-gray-400">
                <div className="font-medium mb-1">Archive Tier Additional Costs:</div>
                {archiveAdditionalCosts.map((cost, idx) => (
                  <div key={idx} className="pl-2 space-y-0.5">
                    <div className="flex justify-between">
                      <span>{cost.label}:</span>
                      <div className="text-right">
                        <span>{formatUSD(cost.value)}</span>
                        <div className="text-gray-500 text-[0.55rem]">{formatINR(convertUSDToINR(cost.value))}</div>
                      </div>
                    </div>
                    <div className="text-[0.55rem] text-gray-500 italic pl-2">
                      {cost.unit}
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pl-2 pt-1 border-t border-gray-200 dark:border-gray-700 mt-1">
                  <span className="font-medium">Archive Tier Additional Total:</span>
                  <div className="text-right">
                    <span className="font-medium">{formatUSD(archiveAdditionalTotal)}</span>
                    <div className="text-gray-500 text-[0.55rem]">{formatINR(convertUSDToINR(archiveAdditionalTotal))}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="pl-2 pt-1 border-t border-gray-300 dark:border-gray-700">
              <div className="flex justify-between">
                <span>Weighted Additional Cost (by tier allocation):</span>
                <div className="text-right">
                  <span className="font-medium">{formatUSD(weightedAdditionalTotal)}</span>
                  <div className="text-gray-500 text-[0.55rem]">{formatINR(convertUSDToINR(weightedAdditionalTotal))}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Totals */}
        <div className="pt-2 border-t-2 border-gray-400 dark:border-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>Base Storage Total (per DB):</span>
            <div className="text-right">
              <span className="font-semibold">{formatUSD(baseStorageTotal)}</span>
              <div className="text-gray-500 text-[0.55rem]">{formatINR(convertUSDToINR(baseStorageTotal))}</div>
            </div>
          </div>
          <div className="flex justify-between">
            <span>Additional Costs (per DB):</span>
            <div className="text-right">
              <span className="font-semibold">{formatUSD(weightedAdditionalTotal)}</span>
              <div className="text-gray-500 text-[0.55rem]">{formatINR(convertUSDToINR(weightedAdditionalTotal))}</div>
            </div>
          </div>
          <div className="flex justify-between pt-1 border-t border-gray-300 dark:border-gray-700">
            <span>Total per Database:</span>
            <div className="text-right">
              <span className="font-semibold">{formatUSD(totalPerDatabase)}</span>
              <div className="text-gray-500 text-[0.55rem]">{formatINR(convertUSDToINR(totalPerDatabase))}</div>
            </div>
          </div>
          <div className="flex justify-between pt-1 border-t-2 border-gray-400 dark:border-gray-600">
            <span>Total for {numberOfDatabases} Database{numberOfDatabases > 1 ? 's' : ''}:</span>
            <div className="text-right">
              <div className="font-bold text-lg">{formatUSD(totalForAllDatabases)}</div>
              <div className="text-gray-500">{formatINR(convertUSDToINR(totalForAllDatabases))}</div>
            </div>
          </div>
      </div>
      </div>
    </div>
  );
}
