import { CircularProgressbarWithChildren, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { motion, AnimatePresence } from 'framer-motion';

interface TimerDisplayProps {
  totalDuration: number;
  timeLeft: number;
  isActive: boolean;
}

export function TimerDisplay({ totalDuration, timeLeft, isActive }: TimerDisplayProps) {
  // Calculate progress (100 to 0)
  const percentage = totalDuration > 0 ? (timeLeft / totalDuration) * 100 : 0;

  // Format time as HH:MM:SS (always show all three units)
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full max-w-md mx-auto aspect-square p-8">
      {/* Background glow effect */}
      <div 
        className={`absolute inset-0 rounded-full blur-3xl opacity-20 transition-all duration-1000 ${
          isActive ? 'bg-primary scale-110' : 'bg-transparent scale-100'
        }`}
      />

      <CircularProgressbarWithChildren
        value={percentage}
        strokeWidth={4}
        styles={buildStyles({
          // Colors
          pathColor: isActive ? `rgba(var(--primary), 1)` : `rgba(var(--muted-foreground), 0.3)`,
          trailColor: 'rgba(var(--muted), 0.3)',
          strokeLinecap: 'round',
          // Animation
          pathTransitionDuration: 0.5,
        })}
      >
        <div className="flex flex-col items-center justify-center text-center z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={timeLeft}
              initial={{ opacity: 0.8, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0.8, y: -5 }}
              transition={{ duration: 0.2 }}
              className="font-mono font-bold tracking-tighter text-foreground timer-shadow text-4xl sm:text-6xl"
            >
              {formatTime(timeLeft)}
            </motion.div>
          </AnimatePresence>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 text-sm sm:text-base font-medium text-muted-foreground uppercase tracking-widest"
          >
            {isActive ? '計時中' : timeLeft === 0 ? '已完成' : '已暫停'}
          </motion.div>
        </div>
      </CircularProgressbarWithChildren>
    </div>
  );
}
