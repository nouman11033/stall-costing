'use client';

import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { BudgetInput } from '@/lib/calculator';

export interface AvatarDerived {
  minMinutesPerMonth: number;
  maxMinutesPerMonth: number;
  numUsers: number;
}

interface BudgetFormProps {
  onSubmit: (input: BudgetInput) => void;
  isCalculating: boolean;
  onAvatarDerivedChange?: (data: AvatarDerived) => void;
}

// Format number to short form (e.g., 1000 -> 1K, 1000000 -> 1M)
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
};

// Parse formatted string back to number (e.g., "1K" -> 1000, "1.5M" -> 1500000)
const parseFormattedNumber = (str: string): number => {
  if (!str || str.trim() === '') return 0;
  const cleaned = str.trim().toUpperCase();
  const match = cleaned.match(/^([\d.]+)([KM])?$/);
  if (!match) return 0;

  const num = parseFloat(match[1]);
  const suffix = match[2];

  if (suffix === 'M') return Math.round(num * 1000000);
  if (suffix === 'K') return Math.round(num * 1000);
  return Math.round(num);
};

export default function BudgetForm({ onSubmit, isCalculating, onAvatarDerivedChange }: BudgetFormProps) {
  const [numUsers, setNumUsers] = useState(100);
  const [minMinutesPerUser, setMinMinutesPerUser] = useState(10);
  const [maxMinutesPerUser, setMaxMinutesPerUser] = useState(20);
  const [concurrentSessions5Percent, setConcurrentSessions5Percent] = useState(0);
  const [concurrentSessions10Percent, setConcurrentSessions10Percent] = useState(0);
  const [minMinutesPerMonth, setMinMinutesPerMonth] = useState(0);
  const [maxMinutesPerMonth, setMaxMinutesPerMonth] = useState(0);
  const [minMinutesPerMonthDisplay, setMinMinutesPerMonthDisplay] = useState('0');
  const [maxMinutesPerMonthDisplay, setMaxMinutesPerMonthDisplay] = useState('0');
  const [avatarProviders, setAvatarProviders] = useState<string[]>(['heygen', 'anam', 'tavus']);
  const [voiceProviders, setVoiceProviders] = useState<string[]>([]);
  const [hostingServices, setHostingServices] = useState<string[]>([]);

  // Auto-calculate concurrent sessions based on number of users
  useEffect(() => {
    const usersOnSameDay = numUsers * 0.5;
    const fivePercent = Math.round(usersOnSameDay * 0.05);
    const tenPercent = Math.round(usersOnSameDay * 0.10);
    setConcurrentSessions5Percent(fivePercent);
    setConcurrentSessions10Percent(tenPercent);
  }, [numUsers]);

  // Auto-calculate total monthly minutes based on number of users and minutes per user
  useEffect(() => {
    const dailyUsers = numUsers * 0.5;
    const workingDaysPerMonth = 24;
    const minTotal = Math.round(dailyUsers * minMinutesPerUser * workingDaysPerMonth);
    const maxTotal = Math.round(dailyUsers * maxMinutesPerUser * workingDaysPerMonth);
    setMinMinutesPerMonth(minTotal);
    setMaxMinutesPerMonth(maxTotal);
    setMinMinutesPerMonthDisplay(formatNumber(minTotal));
    setMaxMinutesPerMonthDisplay(formatNumber(maxTotal));
  }, [numUsers, minMinutesPerUser, maxMinutesPerUser]);

  // Notify parent of avatar-derived values for storage card
  useEffect(() => {
    onAvatarDerivedChange?.({
      minMinutesPerMonth,
      maxMinutesPerMonth,
      numUsers,
    });
  }, [minMinutesPerMonth, maxMinutesPerMonth, numUsers, onAvatarDerivedChange]);

  const avatarOptions = [
    { id: 'heygen', label: 'HeyGen' },
    { id: 'anam', label: 'Anam' },
    { id: 'tavus', label: 'Tavus' },
  ];

  const voiceOptions = [
    { id: 'inbuilt', label: 'Inbuilt' },
    { id: 'hume', label: 'Hume' },
    { id: 'elevenlabs', label: 'ElevenLabs' },
  ];

  const hostingOptions = [
    { id: 'azure', label: 'Azure' },
    { id: 'railway', label: 'Railway' },
    { id: 'vercel', label: 'Vercel' },
    { id: 'vercel-railway', label: 'Railway+Vercel' },
  ];

  const toggleProvider = (provider: string, providers: string[], setProviders: (value: string[]) => void, category: 'avatar' | 'voice' | 'hosting') => {
    if (providers.includes(provider)) {
      if (providers.length === 1) return;
      const newProviders = providers.filter(p => p !== provider);
      setProviders(newProviders);
    } else {
      const newProviders = [...providers, provider];
      setProviders(newProviders);
    }
  };

  const isAllSelected = (options: { id: string }[], providers: string[]) => {
    return options.every(option => providers.includes(option.id));
  };

  const toggleSelectAll = (options: { id: string }[], providers: string[], setProviders: (value: string[]) => void) => {
    if (isAllSelected(options, providers)) {
      setProviders([options[0].id]);
    } else {
      setProviders(options.map(o => o.id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (avatarProviders.length === 0 || voiceProviders.length === 0 || hostingServices.length === 0) {
      return;
    }

    // For calculation: average concurrency and average of min/max monthly minutes
    const averageConcurrency = Math.round((concurrentSessions5Percent + concurrentSessions10Percent) / 2);
    const minutesPerMonth = Math.round((minMinutesPerMonth + maxMinutesPerMonth) / 2);

    const input: BudgetInput = {
      users: numUsers,
      concurrentSessions: averageConcurrency,
      minutesPerMonth,
      selectedAvatarProviders: avatarProviders,
      selectedVoiceProviders: voiceProviders,
      selectedHostingOptions: hostingServices,
      storageTotalSizeGB: 1000,
      storageTierAllocation: {
        hot: 600,
        cold: 300,
        archive: 100,
      },
      storageNumberOfDatabases: 1,
    };

    onSubmit({
      ...input,
      minMinutesPerUser,
      maxMinutesPerUser,
      concurrentSessions5Percent,
      concurrentSessions10Percent,
    });
  };

  return (
    <form id="budget-form" onSubmit={handleSubmit} className="h-full">
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-[#E5DDD1] overflow-hidden hover:shadow-md transition-all duration-300 hover:border-[#010101] h-full flex flex-col h-[600px]">
        {/* Header */}
        <div className="bg-white border-b border-[#E5DDD1] p-6 flex-shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-[#010101] rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <h2
              className="text-2xl font-bold text-[#010101]"
              style={{ fontFamily: 'Avenir, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
            >
              Interactive Avatar
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 flex flex-col">
          <div className="space-y-4 flex-1">
            {/* Number of Users and Concurrent Sessions */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#010101] mb-1.5">
                  Number of Users
                </label>
                <input
                  type="number"
                  value={numUsers}
                  onChange={(e) => setNumUsers(Number(e.target.value))}
                  className="show-spinner w-full px-3 py-2 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-sm text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                  placeholder="0"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#010101] mb-1.5">
                  Concurrent Sessions
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <span className="text-[10px] font-medium text-[#4F4F4E]">5%</span>
                    </div>
                    <input
                      type="number"
                      value={concurrentSessions5Percent}
                      onChange={(e) => setConcurrentSessions5Percent(Number(e.target.value))}
                      className="w-full pl-10 pr-3 py-2 bg-white/80 border border-[#E5DDD1] rounded-lg text-sm text-[#4F4F4E] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <span className="text-[10px] font-medium text-[#4F4F4E]">10%</span>
                    </div>
                    <input
                      type="number"
                      value={concurrentSessions10Percent}
                      onChange={(e) => setConcurrentSessions10Percent(Number(e.target.value))}
                      className="w-full pl-10 pr-3 py-2 bg-white/80 border border-[#E5DDD1] rounded-lg text-sm text-[#4F4F4E] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Minutes per User and Total Monthly Minutes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#010101] mb-1.5">
                  Minutes per User
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <span className="text-[10px] font-medium text-[#4F4F4E]">Min.</span>
                    </div>
                    <input
                      type="number"
                      value={minMinutesPerUser}
                      onChange={(e) => setMinMinutesPerUser(Number(e.target.value))}
                      className="w-full pl-10 pr-3 py-2 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-sm text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0"
                      min="0"
                      required
                    />
                  </div>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <span className="text-[10px] font-medium text-[#4F4F4E]">Max.</span>
                    </div>
                    <input
                      type="number"
                      value={maxMinutesPerUser}
                      onChange={(e) => setMaxMinutesPerUser(Number(e.target.value))}
                      className="w-full pl-10 pr-3 py-2 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-sm text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0"
                      min="0"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#010101] mb-1.5">
                  Total Monthly Minutes
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <span className="text-[10px] font-medium text-[#4F4F4E]">Min.</span>
                    </div>
                    <input
                      type="text"
                      value={minMinutesPerMonthDisplay}
                      onChange={(e) => {
                        setMinMinutesPerMonthDisplay(e.target.value);
                        const parsed = parseFormattedNumber(e.target.value);
                        setMinMinutesPerMonth(parsed);
                      }}
                      onBlur={(e) => {
                        const parsed = parseFormattedNumber(e.target.value);
                        setMinMinutesPerMonth(parsed);
                        setMinMinutesPerMonthDisplay(formatNumber(parsed));
                      }}
                      className="w-full pl-10 pr-3 py-2 bg-white/80 border border-[#E5DDD1] rounded-lg text-sm text-[#4F4F4E] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                      placeholder="0"
                    />
                  </div>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <span className="text-[10px] font-medium text-[#4F4F4E]">Max.</span>
                    </div>
                    <input
                      type="text"
                      value={maxMinutesPerMonthDisplay}
                      onChange={(e) => {
                        setMaxMinutesPerMonthDisplay(e.target.value);
                        const parsed = parseFormattedNumber(e.target.value);
                        setMaxMinutesPerMonth(parsed);
                      }}
                      onBlur={(e) => {
                        const parsed = parseFormattedNumber(e.target.value);
                        setMaxMinutesPerMonth(parsed);
                        setMaxMinutesPerMonthDisplay(formatNumber(parsed));
                      }}
                      className="w-full pl-10 pr-3 py-2 bg-white/80 border border-[#E5DDD1] rounded-lg text-sm text-[#4F4F4E] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Avatar Provider Checkboxes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-[#010101]">
                  Avatar Provider
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAllSelected(avatarOptions, avatarProviders)}
                    onChange={() => toggleSelectAll(avatarOptions, avatarProviders, setAvatarProviders)}
                    className="w-3.5 h-3.5 rounded border-[#E5DDD1] text-[#010101] focus:ring-[#010101] cursor-pointer"
                  />
                  <span className="text-[10px] font-medium text-[#4F4F4E]">Select All</span>
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {avatarOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleProvider(option.id, avatarProviders, setAvatarProviders, 'avatar')}
                    disabled={avatarProviders.length === 1 && avatarProviders.includes(option.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      avatarProviders.includes(option.id)
                        ? 'bg-[#010101] text-white border-[#010101]'
                        : 'bg-[#F9F4EE] text-[#010101] border-[#E5DDD1] hover:border-[#010101]'
                    } ${avatarProviders.length === 1 && avatarProviders.includes(option.id) ? 'opacity-75 cursor-not-allowed' : ''}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {avatarProviders.length === 0 && (
                <p className="text-[10px] text-orange-600 mt-1">
                  ⚠️ At least one Avatar Provider must be selected
                </p>
              )}
            </div>

            {/* Voice Provider Checkboxes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-[#010101]">
                  Voice Provider
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAllSelected(voiceOptions, voiceProviders)}
                    onChange={() => toggleSelectAll(voiceOptions, voiceProviders, setVoiceProviders)}
                    className="w-3.5 h-3.5 rounded border-[#E5DDD1] text-[#010101] focus:ring-[#010101] cursor-pointer"
                  />
                  <span className="text-[10px] font-medium text-[#4F4F4E]">Select All</span>
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {voiceOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleProvider(option.id, voiceProviders, setVoiceProviders, 'voice')}
                    disabled={voiceProviders.length === 1 && voiceProviders.includes(option.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      voiceProviders.includes(option.id)
                        ? 'bg-[#010101] text-white border-[#010101]'
                        : 'bg-[#F9F4EE] text-[#010101] border-[#E5DDD1] hover:border-[#010101]'
                    } ${voiceProviders.length === 1 && voiceProviders.includes(option.id) ? 'opacity-75 cursor-not-allowed' : ''}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {voiceProviders.length === 0 && (
                <p className="text-[10px] text-orange-600 mt-1">
                  ⚠️ At least one Voice Provider must be selected
                </p>
              )}
            </div>

            {/* Hosting Service Options */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-[#010101]">
                  Hosting Service
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAllSelected(hostingOptions, hostingServices)}
                    onChange={() => toggleSelectAll(hostingOptions, hostingServices, setHostingServices)}
                    className="w-3.5 h-3.5 rounded border-[#E5DDD1] text-[#010101] focus:ring-[#010101] cursor-pointer"
                  />
                  <span className="text-[10px] font-medium text-[#4F4F4E]">Select All</span>
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {hostingOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleProvider(option.id, hostingServices, setHostingServices, 'hosting')}
                    disabled={hostingServices.length === 1 && hostingServices.includes(option.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      hostingServices.includes(option.id)
                        ? 'bg-[#010101] text-white border-[#010101]'
                        : 'bg-[#F9F4EE] text-[#010101] border-[#E5DDD1] hover:border-[#010101]'
                    } ${hostingServices.length === 1 && hostingServices.includes(option.id) ? 'opacity-75 cursor-not-allowed' : ''}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {hostingServices.length === 0 && (
                <p className="text-[10px] text-orange-600 mt-1">
                  ⚠️ At least one Hosting Service must be selected
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
