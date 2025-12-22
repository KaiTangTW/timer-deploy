import { motion } from "framer-motion";
import { X, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FullscreenTimerProps {
  timeLeft: number;
  isActive: boolean;
  onClose: () => void;
  fontFamily?: string;
  color?: string;
}

export function FullscreenTimer({ timeLeft, isActive, onClose, fontFamily = "font-mono", color = "text-foreground" }: FullscreenTimerProps) {
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex items-center justify-center"
      style={{ 
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-3 rounded-full bg-muted/50 hover:bg-muted transition-colors z-10"
        data-testid="button-exit-fullscreen"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="transform rotate-0 landscape:rotate-0 portrait:rotate-90 flex items-center justify-center w-full h-full">
        <motion.div
          key={timeLeft}
          initial={{ scale: 0.98, opacity: 0.8 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className={`${fontFamily} font-bold tracking-tight ${color} select-none`}
          style={{ fontSize: 'clamp(4rem, 20vw, 12rem)' }}
        >
          {formatTime(timeLeft)}
        </motion.div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
        <p className="text-sm text-muted-foreground">
          {isActive ? '計時中' : timeLeft === 0 ? '已完成' : '已暫停'}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          點擊右上角關閉全螢幕
        </p>
      </div>
    </motion.div>
  );
}

interface FullscreenButtonProps {
  onClick: () => void;
}

export function FullscreenButton({ onClick }: FullscreenButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="gap-2 rounded-xl"
      data-testid="button-fullscreen"
    >
      <Maximize2 className="w-4 h-4" />
      橫式全螢幕
    </Button>
  );
}
