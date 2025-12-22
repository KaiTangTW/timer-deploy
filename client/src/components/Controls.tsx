import { Play, Pause, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useCreatePreset } from "@/hooks/use-presets";

interface ControlsProps {
  isActive: boolean;
  isPaused: boolean;
  timeLeft: number;
  totalDuration: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}

export function Controls({
  isActive,
  isPaused,
  timeLeft,
  totalDuration,
  onStart,
  onPause,
  onReset,
}: ControlsProps) {
  const [presetName, setPresetName] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const createPreset = useCreatePreset();

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    
    createPreset.mutate({
      name: presetName,
      duration: totalDuration
    }, {
      onSuccess: () => {
        setIsOpen(false);
        setPresetName("");
      }
    });
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm mx-auto mt-8">
      <div className="flex items-center justify-center gap-4 w-full">
        {!isActive || isPaused ? (
          <Button
            size="lg"
            className="w-20 h-20 rounded-full shadow-lg hover:shadow-primary/25 hover:scale-105 transition-all duration-300"
            onClick={onStart}
            disabled={timeLeft === 0 && totalDuration === 0}
          >
            <Play className="w-8 h-8 ml-1" fill="currentColor" />
          </Button>
        ) : (
          <Button
            size="lg"
            variant="secondary"
            className="w-20 h-20 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 bg-white dark:bg-zinc-800 border-2 border-transparent hover:border-border"
            onClick={onPause}
          >
            <Pause className="w-8 h-8" fill="currentColor" />
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="rounded-full w-12 h-12 border-2 hover:bg-muted/50"
          onClick={onReset}
          title="重設計時器"
        >
          <RotateCcw className="w-5 h-5" />
        </Button>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full w-12 h-12 border-2 hover:bg-muted/50"
              disabled={totalDuration === 0}
              title="儲存為預設"
            >
              <Save className="w-5 h-5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>儲存計時器預設</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">預設名稱</Label>
                <Input
                  id="name"
                  placeholder="例如：番茄專注時間"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  className="rounded-xl border-2 focus:ring-offset-0 focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                目前時長：{Math.floor(totalDuration / 3600) > 0 ? `${Math.floor(totalDuration / 3600)} 時 ` : ''}{Math.floor((totalDuration % 3600) / 60)} 分 {totalDuration % 60} 秒
              </div>
            </div>
            <DialogFooter className="sm:justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="secondary" className="rounded-xl">
                  取消
                </Button>
              </DialogClose>
              <Button 
                type="button" 
                onClick={handleSavePreset} 
                disabled={!presetName.trim() || createPreset.isPending}
                className="rounded-xl px-6"
              >
                {createPreset.isPending ? "儲存中..." : "儲存預設"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
