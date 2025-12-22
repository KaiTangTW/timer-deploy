import { useState, useEffect, useRef } from "react";
import { TimerDisplay } from "@/components/TimerDisplay";
import { Controls } from "@/components/Controls";
import { PresetList } from "@/components/PresetList";
import { DurationInput } from "@/components/DurationInput";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [totalDuration, setTotalDuration] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
  }, []);

  const handleStart = () => {
    if (totalDuration === 0 && timeLeft === 0) return;
    
    // If starting fresh
    if (!isActive && !isPaused) {
      setTimeLeft(totalDuration);
    }
    
    setIsActive(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleReset = () => {
    setIsActive(false);
    setIsPaused(false);
    setTimeLeft(totalDuration);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  const handleDurationChange = (duration: number) => {
    if (!isActive) {
      setTotalDuration(duration);
      setTimeLeft(duration);
    }
  };

  const handlePresetSelect = (duration: number) => {
    setTotalDuration(duration);
    setTimeLeft(duration);
    setIsActive(false);
    setIsPaused(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    toast({
      title: "已載入預設",
      description: `計時器設定為 ${Math.floor(duration / 60)} 分 ${duration % 60} 秒`,
    });
  };

  // Timer logic
  useEffect(() => {
    if (isActive && !isPaused && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Timer finished
            clearInterval(intervalRef.current!);
            setIsActive(false);
            setIsPaused(false);
            audioRef.current?.play().catch(e => console.log("Audio play failed:", e));
            toast({
              title: "時間到！",
              description: "倒數計時已完成。",
              duration: 5000,
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, isPaused, timeLeft, toast]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center py-12 px-4 sm:px-6">
      
      {/* Header */}
      <div className="w-full max-w-4xl mb-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-2xl">
            <Timer className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">專注計時器</h1>
            <p className="text-sm text-muted-foreground">倒數計時工具</p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-4xl grid lg:grid-cols-[1fr_350px] gap-8">
        {/* Main Timer Area */}
        <div className="flex flex-col gap-8">
          <Card className="border-0 shadow-none bg-transparent">
            <CardContent className="p-0">
              <TimerDisplay 
                totalDuration={totalDuration} 
                timeLeft={timeLeft} 
                isActive={isActive && !isPaused} 
              />
              
              <Controls 
                isActive={isActive}
                isPaused={isPaused}
                timeLeft={timeLeft}
                totalDuration={totalDuration}
                onStart={handleStart}
                onPause={handlePause}
                onReset={handleReset}
              />
            </CardContent>
          </Card>

          <div className="mt-8">
            <DurationInput 
              onChange={handleDurationChange} 
              isActive={isActive} 
            />
          </div>
        </div>

        {/* Presets Sidebar */}
        <div className="flex flex-col gap-6">
          <Card className="glass-panel rounded-3xl border-0 h-full">
            <CardHeader>
              <CardTitle className="text-xl">已儲存的預設</CardTitle>
              <CardDescription>快速存取您的計時器</CardDescription>
            </CardHeader>
            <CardContent>
              <PresetList onSelect={handlePresetSelect} />
            </CardContent>
          </Card>
          
          <div className="bg-primary/5 rounded-3xl p-6 border border-primary/10">
            <h3 className="font-semibold text-primary mb-2">小技巧</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              使用番茄鐘工作法：專注 25 分鐘後休息 5 分鐘，可以有效提升工作效率。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
