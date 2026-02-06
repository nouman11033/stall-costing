'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { BudgetInput, calculateCombinations } from '@/lib/calculator';
import BudgetForm, { AvatarDerived } from '@/components/BudgetForm';
import StorageInput, { StorageInput as StorageInputType } from '@/components/StorageInput';

// Animated Background Text Component
function AnimatedBackgroundText() {
  const springConfig = { stiffness: 50, damping: 20 };
  
  // Create motion values for smooth spring animations
  const y1Motion = useMotionValue(0);
  const y2Motion = useMotionValue(0);
  const y3Motion = useMotionValue(0);
  
  const y1 = useSpring(y1Motion, springConfig);
  const y2 = useSpring(y2Motion, springConfig);
  const y3 = useSpring(y3Motion, springConfig);
  
  // Opacity animations
  const opacity1Motion = useMotionValue(0.03);
  const opacity2Motion = useMotionValue(0.04);
  const opacity3Motion = useMotionValue(0.03);
  
  const opacity1 = useSpring(opacity1Motion, springConfig);
  const opacity2 = useSpring(opacity2Motion, springConfig);
  const opacity3 = useSpring(opacity3Motion, springConfig);
  
  // Animate opacity with subtle pulsing
  useEffect(() => {
    const interval = setInterval(() => {
      opacity1Motion.set(0.03 + Math.random() * 0.02);
      opacity2Motion.set(0.04 + Math.random() * 0.02);
      opacity3Motion.set(0.03 + Math.random() * 0.02);
    }, 3000);
    return () => clearInterval(interval);
  }, [opacity1Motion, opacity2Motion, opacity3Motion]);

  return (
    <>
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ y: y1, opacity: opacity1 }}
      >
        <motion.h2
          className="text-[15vw] lg:text-[20vw] font-black text-[#E5DDD1] select-none whitespace-nowrap"
          style={{
            fontFamily: 'Avenir, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            letterSpacing: '0.02em',
          }}
          animate={{
            x: [0, -100, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          FEATURED APIS
        </motion.h2>
      </motion.div>
      
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ y: y2, opacity: opacity2 }}
      >
        <motion.h2
          className="text-[12vw] lg:text-[18vw] font-black text-[#E5DDD1] select-none whitespace-nowrap"
          style={{
            fontFamily: 'Avenir, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            letterSpacing: '0.02em',
          }}
          animate={{
            x: [0, 100, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          MOTION COMPONENT
        </motion.h2>
      </motion.div>
      
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ y: y3, opacity: opacity3 }}
      >
        <motion.h2
          className="text-[14vw] lg:text-[19vw] font-black text-[#E5DDD1] select-none whitespace-nowrap"
          style={{
            fontFamily: 'Avenir, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            letterSpacing: '0.02em',
          }}
          animate={{
            x: [0, -80, 0],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          USESPRING USETRANSFORM
        </motion.h2>
      </motion.div>
    </>
  );
}

export default function Home() {
  const router = useRouter();
  const [isCalculating, setIsCalculating] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [avatarDerived, setAvatarDerived] = useState<AvatarDerived | null>(null);
  const [storageInput, setStorageInput] = useState<StorageInputType>({
    totalSizeGB: 1000,
    tierAllocation: {
      hot: 600,
      cold: 300,
      archive: 100,
    },
    numberOfDatabases: 1,
    storageProviders: ['AWS', 'Azure'],
  });

  // Generate grid cells based on viewport
  const gridCells = useMemo(() => {
    if (typeof window === 'undefined') return [];
    const cols = Math.ceil(window.innerWidth / 32) + 3;
    const rows = Math.ceil(window.innerHeight / 32) + 3;
    const cells = [];
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        cells.push({ row, col });
      }
    }
    return cells;
  }, []);

  const handleCalculate = (input: BudgetInput) => {
    setIsCalculating(true);
    setIsTransitioning(true);
    
      // Merge storage input into budget input
      const fullInput: BudgetInput = {
        ...input,
        storageTotalSizeGB: storageInput.totalSizeGB,
        storageTierAllocation: storageInput.tierAllocation,
        storageNumberOfDatabases: storageInput.numberOfDatabases,
        storageProviders: storageInput.storageProviders,
        storageAdditionalCosts: {
          aws: storageInput.aws,
          azure: storageInput.azure,
        },
      };
    
    const combinations = calculateCombinations(fullInput);
    
    // Store results in localStorage
    localStorage.setItem('calculationResults', JSON.stringify(combinations));
    localStorage.setItem('calculationInput', JSON.stringify(fullInput));
    
    // Navigate after animation completes
    setTimeout(() => {
      setIsCalculating(false);
      router.push('/results');
    }, 2800);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Results page background - revealed during transition */}
      <div className={`absolute inset-0 bg-[#E5DDD1] transition-opacity duration-300 ${isTransitioning ? 'opacity-100' : 'opacity-0'}`}>
        <div 
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: `
              linear-gradient(to right, #F9F4EE 1px, transparent 1px),
              linear-gradient(to bottom, #F9F4EE 1px, transparent 1px)
            `,
            backgroundSize: '32px 32px'
          }}
        />
      </div>

      {/* Home page background */}
      <div className={`absolute inset-0 bg-[#F9F4EE] transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
        <div 
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `
              linear-gradient(to right, #E5DDD1 1px, transparent 1px),
              linear-gradient(to bottom, #E5DDD1 1px, transparent 1px)
            `,
            backgroundSize: '32px 32px'
          }}
        />
        
        {/* Animated Background Fill Text */}
        <AnimatedBackgroundText />
      </div>
      
      {/* Random pixel accents */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute w-8 h-8 bg-[#D4CCC0]" style={{ top: '8%', left: '5%' }} />
        <div className="absolute w-8 h-8 bg-[#D4CCC0]" style={{ top: '12%', right: '8%' }} />
        <div className="absolute w-8 h-8 bg-[#D4CCC0]" style={{ top: '85%', left: '15%' }} />
        <div className="absolute w-8 h-8 bg-[#D4CCC0]" style={{ top: '88%', right: '12%' }} />
        <div className="absolute w-8 h-8 bg-[#D4CCC0]" style={{ top: '45%', left: '3%' }} />
        <div className="absolute w-8 h-8 bg-[#D4CCC0]" style={{ top: '50%', right: '4%' }} />
      </div>

      {/* Main Content - Home Page */}
      <AnimatePresence>
        {!isTransitioning && (
          <main className="relative z-50 min-h-screen flex flex-col items-center justify-center px-8 py-16">
            {/* Heading */}
            <motion.h1 
              className="text-7xl lg:text-6xl font-black text-[#010101] mb-20 tracking-tight text-center"
              exit={{ x: -150, opacity: 0 }}
              transition={{ duration: 0.8, ease: [0.65, 0, 0.35, 1] }}
            >
              COST ESTIMATION
            </motion.h1>

            {/* Cards Grid */}
            <motion.div 
              className="grid lg:grid-cols-2 gap-8 max-w-4xl w-full mb-8 items-stretch"
              exit={{ x: -150, opacity: 0 }}
              transition={{ duration: 0.8, ease: [0.65, 0, 0.35, 1], delay: 0.05 }}
            >
              <BudgetForm onSubmit={handleCalculate} isCalculating={isCalculating} onAvatarDerivedChange={setAvatarDerived} />
              <StorageInput storageInput={storageInput} onChange={setStorageInput} avatarDerived={avatarDerived} />
            </motion.div>

            {/* Generate Set Button - Below both cards */}
            <motion.div 
              className="w-full max-w-4xl flex justify-center"
              exit={{ x: -150, opacity: 0 }}
              transition={{ duration: 0.8, ease: [0.65, 0, 0.35, 1], delay: 0.1 }}
            >
              <button
                type="button"
                onClick={() => {
                  const form = document.getElementById('budget-form') as HTMLFormElement;
                  if (form) {
                    form.requestSubmit();
                  }
                }}
                disabled={isCalculating}
                className="w-full px-12 py-4 bg-[#010101] text-white rounded-xl font-semibold text-base hover:bg-[#1a1a1a] transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCalculating ? 'CALCULATING...' : 'GENERATE SET'}
              </button>
            </motion.div>
          </main>
        )}
      </AnimatePresence>

      {/* Flipping Grid Cells Transition Overlay */}
      <AnimatePresence>
        {isTransitioning && typeof window !== 'undefined' && (
          <div className="fixed z-40 pointer-events-none" style={{ left: '-96px', top: '-96px', width: 'calc(100vw + 192px)', height: 'calc(100vh + 192px)' }}>
            {gridCells.map(({ row, col }) => {
              const cols = Math.ceil(window.innerWidth / 32) + 3;
              // Calculate delay based on column position (right to left) - add 0.8s for content to slide out first
              const delay = 0.8 + (cols - col) * 0.035;
              
              return (
                <motion.div
                  key={`${row}-${col}`}
                  className="absolute"
                  style={{
                    left: col * 32,
                    top: row * 32,
                    width: 33,
                    height: 33,
                    backgroundColor: '#F9F4EE',
                    backgroundImage: `
                      linear-gradient(to right, #E5DDD1 1px, transparent 1px),
                      linear-gradient(to bottom, #E5DDD1 1px, transparent 1px)
                    `,
                    backgroundSize: '32px 32px',
                    opacity: 0.4,
                  }}
                  initial={{ scaleX: 1, transformOrigin: 'right' }}
                  animate={{ scaleX: 0 }}
                  transition={{
                    duration: 0.6,
                    delay,
                    ease: [0.65, 0, 0.35, 1],
                  }}
                />
              );
            })}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
