import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";

interface DurationInputProps {
  onChange: (duration: number) => void;
  isActive: boolean;
}

export function DurationInput({ onChange, isActive }: DurationInputProps) {
  const [hours, setHours] = useState<string>("0");
  const [minutes, setMinutes] = useState<string>("0");
  const [seconds, setSeconds] = useState<string>("0");

  // Recalculate duration whenever inputs change
  useEffect(() => {
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    const s = parseInt(seconds) || 0;
    
    // Clamp values reasonably
    const totalSeconds = (h * 3600) + (m * 60) + s;
    onChange(totalSeconds);
  }, [hours, minutes, seconds]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

  return (
    <div className={`grid grid-cols-3 gap-4 w-full max-w-sm mx-auto transition-opacity duration-300 ${isActive ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
      <div className="space-y-2">
        <Label htmlFor="hours" className="text-xs uppercase tracking-wider text-muted-foreground text-center block">小時</Label>
        <Input
          id="hours"
          type="number"
          min="0"
          max="99"
          value={hours}
          onFocus={handleFocus}
          onChange={(e) => setHours(e.target.value)}
          className="text-center font-mono text-lg h-12 rounded-xl bg-secondary/30 border-transparent focus:border-primary focus:bg-background transition-all"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="minutes" className="text-xs uppercase tracking-wider text-muted-foreground text-center block">分鐘</Label>
        <Input
          id="minutes"
          type="number"
          min="0"
          max="59"
          value={minutes}
          onFocus={handleFocus}
          onChange={(e) => setMinutes(e.target.value)}
          className="text-center font-mono text-lg h-12 rounded-xl bg-secondary/30 border-transparent focus:border-primary focus:bg-background transition-all"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="seconds" className="text-xs uppercase tracking-wider text-muted-foreground text-center block">秒</Label>
        <Input
          id="seconds"
          type="number"
          min="0"
          max="59"
          value={seconds}
          onFocus={handleFocus}
          onChange={(e) => setSeconds(e.target.value)}
          className="text-center font-mono text-lg h-12 rounded-xl bg-secondary/30 border-transparent focus:border-primary focus:bg-background transition-all"
        />
      </div>
    </div>
  );
}
