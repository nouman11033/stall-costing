'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import { BudgetInput } from '@/lib/calculator';

interface BudgetFormProps {
  onSubmit: (input: BudgetInput) => void;
  isCalculating: boolean;
}

export default function BudgetForm({ onSubmit, isCalculating }: BudgetFormProps) {
  const [numUsers, setNumUsers] = useState(100);
  const [numMinutes, setNumMinutes] = useState(2400);
  const [concurrentSessions, setConcurrentSessions] = useState(10);
  const [avatarProviders, setAvatarProviders] = useState<string[]>(['heygen', 'anam', 'tevus']);
  const [voiceProviders, setVoiceProviders] = useState<string[]>([]);
  const [hostingServices, setHostingServices] = useState<string[]>([]);

  const avatarOptions = [
    { id: 'heygen', label: 'HeyGen' },
    { id: 'anam', label: 'Anam' },
    { id: 'tevus', label: 'Tavus' },
  ];
  
  const voiceOptions = [
    { id: 'inbuilt', label: 'Inbuilt' },
    { id: 'gemini', label: 'Gemini' },
    { id: 'hume', label: 'Hume' },
    { id: 'gpt', label: 'GPT' },
  ];
  
  const hostingOptions = [
    { id: 'azure', label: 'Azure' },
    { id: 'railway', label: 'Railway' },
    { id: 'vercel', label: 'Vercel' },
    { id: 'vercel-railway', label: 'Railway+Vercel' },
  ];

  const toggleProvider = (provider: string, providers: string[], setProviders: (value: string[]) => void, category: 'avatar' | 'voice' | 'hosting') => {
    if (providers.includes(provider)) {
      // Prevent deselecting if it's the last one
      if (providers.length === 1) {
        return; // Don't allow deselecting the last item
      }
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
      // When deselecting all, keep at least one (the first option)
      setProviders([options[0].id]);
    } else {
      setProviders(options.map(o => o.id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that at least one is selected in each category
    if (avatarProviders.length === 0 || voiceProviders.length === 0 || hostingServices.length === 0) {
      return; // Don't submit if validation fails
    }
    
    const input: BudgetInput = {
      users: numUsers,
      concurrentSessions: concurrentSessions,
      minutesPerMonth: numMinutes,
      selectedAvatarProviders: avatarProviders,
      selectedVoiceProviders: voiceProviders,
      selectedHostingOptions: hostingServices,
      storageTotalSizeGB: 1000, // Will be merged from storageInput in page.tsx
      storageTierAllocation: {
        hot: 600,
        cold: 300,
        archive: 100,
      },
      storageNumberOfDatabases: 1,
    };
    
    onSubmit(input);
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
            {/* Number Inputs */}
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
                <input
                  type="number"
                  value={concurrentSessions}
                  onChange={(e) => setConcurrentSessions(Number(e.target.value))}
                  className="show-spinner w-full px-3 py-2 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-sm text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                  placeholder="0"
                  min="1"
                  required
                />
              </div>
            </div>

            {/* Minutes with Slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#010101]">
                  Minutes per month: {numMinutes.toLocaleString()}
                </label>
              </div>
              <div 
                className="minutes-slider-container relative"
                style={{
                  '--slider-progress': `${(numMinutes / 100000) * 100}%`
                } as React.CSSProperties}
              >
                <input
                  type="range"
                  min="0"
                  max="100000"
                  step="100"
                  value={numMinutes}
                  onChange={(e) => setNumMinutes(Number(e.target.value))}
                  className="minutes-slider w-full appearance-none cursor-pointer relative z-10"
                  style={{
                    background: 'transparent',
                    height: '6px'
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[#4F4F4E] mt-1 mb-2">
                <span>0</span>
                <span>100K</span>
              </div>
              <input
                type="number"
                value={numMinutes}
                onChange={(e) => setNumMinutes(Number(e.target.value))}
                className="show-spinner w-full px-3 py-2 bg-[#F9F4EE] border border-[#E5DDD1] rounded-lg text-sm text-[#010101] focus:outline-none focus:ring-1 focus:ring-[#010101] focus:border-[#010101]"
                placeholder="0"
                min="0"
                max={100000}
                step="100"
                required
              />
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
