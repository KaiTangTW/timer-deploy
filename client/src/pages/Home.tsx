import { useState, useEffect, useRef, useCallback } from "react";
import { TimerDisplay } from "@/components/TimerDisplay";
import { Controls } from "@/components/Controls";
import { PresetList } from "@/components/PresetList";
import { DurationInput } from "@/components/DurationInput";
import { TimerSettings, type TimerStyleSettings, getSoundUrl } from "@/components/TimerSettings";
import { TimerStats } from "@/components/TimerStats";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Banner } from "@/components/Banner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Timer, Keyboard, Settings } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useCreateHistory } from "@/hooks/use-history";

const POMODORO_WORK = 25 * 60;
const POMODORO_BREAK = 5 * 60;

export default function Home() {
  const [totalDuration, setTotalDuration] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pomodoroPhase, setPomodoroPhase] = useState<"work" | "break">("work");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();
  const createHistory = useCreateHistory();
  
  const [timerStyle, setTimerStyle] = useState<TimerStyleSettings>({
    fontFamily: "font-mono",
    color: "text-foreground",
    soundEnabled: true,
    soundType: "bell",
    autoRepeat: false,
    pomodoroMode: false,
  });

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio(getSoundUrl(timerStyle.soundType));
  }, [timerStyle.soundType]);

  // Update browser tab title
  useEffect(() => {
    if (isActive && !isPaused && timeLeft > 0) {
      const hours = Math.floor(timeLeft / 3600);
      const minutes = Math.floor((timeLeft % 3600) / 60);
      const seconds = timeLeft % 60;
      const timeStr = hours > 0 
        ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        : `${minutes}:${String(seconds).padStart(2, '0')}`;
      
      const phase = timerStyle.pomodoroMode ? (pomodoroPhase === "work" ? " - 專注中" : " - 休息中") : "";
      document.title = `${timeStr}${phase} | 專注計時器`;
    } else if (timeLeft === 0 && totalDuration > 0) {
      document.title = "時間到！ | 專注計時器";
    } else {
      document.title = "專注計時器";
    }
  }, [timeLeft, isActive, isPaused, pomodoroPhase, timerStyle.pomodoroMode, totalDuration]);

  const handleStart = useCallback(() => {
    if (timerStyle.pomodoroMode) {
      // In pomodoro mode, only set duration if starting fresh (not resumed)
      if (!isActive && !isPaused && timeLeft === 0) {
        const duration = pomodoroPhase === "work" ? POMODORO_WORK : POMODORO_BREAK;
        setTotalDuration(duration);
        setTimeLeft(duration);
      } else if (!isActive && !isPaused) {
        // Resume with current timeLeft
        setTimeLeft(timeLeft > 0 ? timeLeft : totalDuration);
      }
    } else {
      if (totalDuration === 0 && timeLeft === 0) {
        return;
      }
      if (!isActive && !isPaused) {
        setTimeLeft(totalDuration);
      }
    }
    
    setIsActive(true);
    setIsPaused(false);
  }, [totalDuration, timeLeft, isActive, isPaused, timerStyle.pomodoroMode, pomodoroPhase]);

  const handlePause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const handleReset = useCallback(() => {
    setIsActive(false);
    setIsPaused(false);
    if (timerStyle.pomodoroMode) {
      setPomodoroPhase("work");
      setTotalDuration(POMODORO_WORK);
      setTimeLeft(POMODORO_WORK);
    } else {
      setTimeLeft(totalDuration);
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }, [totalDuration, timerStyle.pomodoroMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.code === "Space") {
        e.preventDefault();
        if (!isActive || isPaused) {
          handleStart();
        } else {
          handlePause();
        }
      } else if (e.code === "KeyR" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleReset();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, isPaused, handleStart, handlePause, handleReset]);

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
    
    const h = Math.floor(duration / 3600);
    const m = Math.floor((duration % 3600) / 60);
    const s = duration % 60;
    const parts = [];
    if (h > 0) parts.push(`${h} 時`);
    if (m > 0) parts.push(`${m} 分`);
    if (s > 0 || parts.length === 0) parts.push(`${s} 秒`);
    
    toast({
      title: "已載入預設",
      description: `計時器設定為 ${parts.join(' ')}`,
    });
  };

  // Handle pomodoro mode toggle
  useEffect(() => {
    if (timerStyle.pomodoroMode && !isActive) {
      setPomodoroPhase("work");
      setTotalDuration(POMODORO_WORK);
      setTimeLeft(POMODORO_WORK);
    }
  }, [timerStyle.pomodoroMode, isActive]);

  // Timer logic
  useEffect(() => {
    if (isActive && !isPaused && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            
            if (timerStyle.soundEnabled) {
              audioRef.current?.play().catch(e => console.log("Audio play failed:", e));
            }
            
            // Record history
            createHistory.mutate({
              duration: totalDuration,
              type: timerStyle.pomodoroMode ? (pomodoroPhase === "work" ? "pomodoro" : "break") : "focus"
            });
            
            // Always reset active state first
            setIsActive(false);
            setIsPaused(false);
            
            // Handle auto-repeat or pomodoro mode
            if (timerStyle.pomodoroMode) {
              const nextPhase = pomodoroPhase === "work" ? "break" : "work";
              const nextDuration = nextPhase === "work" ? POMODORO_WORK : POMODORO_BREAK;
              
              setPomodoroPhase(nextPhase);
              setTotalDuration(nextDuration);
              setTimeLeft(nextDuration);
              
              toast({
                title: pomodoroPhase === "work" ? "專注時間結束！" : "休息時間結束！",
                description: nextPhase === "work" ? "準備開始新的專注時段" : "休息一下吧！",
                duration: 5000,
              });
              
              // Auto-start next phase after a brief pause
              setTimeout(() => {
                setIsActive(true);
                setIsPaused(false);
              }, 1000);
              
              return nextDuration;
            } else if (timerStyle.autoRepeat) {
              setTimeLeft(totalDuration);
              
              toast({
                title: "時間到！",
                description: "自動重新開始計時",
                duration: 3000,
              });
              
              // Auto-start after a brief pause
              setTimeout(() => {
                setIsActive(true);
                setIsPaused(false);
              }, 1000);
              
              return totalDuration;
            } else {
              toast({
                title: "時間到！",
                description: "倒數計時已完成。",
                duration: 5000,
              });
              return 0;
            }
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
  }, [isActive, isPaused, timeLeft, toast, timerStyle.soundEnabled, timerStyle.autoRepeat, timerStyle.pomodoroMode, totalDuration, pomodoroPhase, createHistory]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center py-12 px-4 sm:px-6">
      
      {/* Banner */}
      <Banner />
      
      {/* Header */}
      <div className="w-full max-w-4xl mb-12 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-2xl">
            <Timer className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">專注計時器</h1>
            <p className="text-sm text-muted-foreground">倒數計時工具</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {timerStyle.pomodoroMode && (
            <Badge variant={pomodoroPhase === "work" ? "default" : "secondary"} className="text-xs">
              {pomodoroPhase === "work" ? "專注中" : "休息中"}
            </Badge>
          )}
          <ThemeToggle />
          <Link href="/admin" className="p-2 rounded-full hover:bg-muted transition-colors" title="後台設定" data-testid="link-admin">
            <Settings className="w-5 h-5 text-muted-foreground" />
          </Link>
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
                fontFamily={timerStyle.fontFamily}
                color={timerStyle.color}
              />
              
              <Controls 
                isActive={isActive}
                isPaused={isPaused}
                timeLeft={timeLeft}
                totalDuration={totalDuration}
                onStart={handleStart}
                onPause={handlePause}
                onReset={handleReset}
                timerStyle={timerStyle}
                onStyleChange={setTimerStyle}
              />
            </CardContent>
          </Card>

          {!timerStyle.pomodoroMode && (
            <div className="mt-8">
              <DurationInput 
                onChange={handleDurationChange} 
                isActive={isActive} 
              />
            </div>
          )}

          {/* Keyboard shortcuts hint */}
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Keyboard className="w-3 h-3" />
              <span>空白鍵：開始/暫停</span>
            </div>
            <div className="flex items-center gap-1">
              <span>R：重設</span>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
          {/* Stats */}
          <TimerStats />
          
          {/* Presets */}
          {!timerStyle.pomodoroMode && (
            <Card className="glass-panel rounded-3xl border-0">
              <CardHeader>
                <CardTitle className="text-xl">已儲存的預設</CardTitle>
                <CardDescription>快速存取您的計時器</CardDescription>
              </CardHeader>
              <CardContent>
                <PresetList onSelect={handlePresetSelect} />
              </CardContent>
            </Card>
          )}
          
          {timerStyle.pomodoroMode && (
            <Card className="bg-primary/5 rounded-3xl border border-primary/10">
              <CardContent className="p-6">
                <h3 className="font-semibold text-primary mb-3">番茄鐘模式</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>專注 25 分鐘 → 休息 5 分鐘</p>
                  <p>自動循環切換工作與休息時段</p>
                </div>
              </CardContent>
            </Card>
          )}
          
          <div className="bg-primary/5 rounded-3xl p-6 border border-primary/10">
            <h3 className="font-semibold text-primary mb-2">小技巧</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {timerStyle.pomodoroMode 
                ? "每完成 4 個番茄鐘後，建議休息 15-30 分鐘。"
                : "使用番茄鐘工作法：專注 25 分鐘後休息 5 分鐘，可以有效提升工作效率。"
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
