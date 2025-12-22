import { usePresets, useDeletePreset } from "@/hooks/use-presets";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Trash2, PlayCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PresetListProps {
  onSelect: (duration: number) => void;
}

export function PresetList({ onSelect }: PresetListProps) {
  const { data: presets, isLoading } = usePresets();
  const deletePreset = useDeletePreset();

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s > 0 ? `${s}s` : ''}`;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!presets || presets.length === 0) {
    return (
      <div className="text-center py-10 px-6 border-2 border-dashed border-muted rounded-2xl bg-muted/10">
        <Clock className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
        <h3 className="text-lg font-medium text-muted-foreground">尚無預設</h3>
        <p className="text-sm text-muted-foreground/80 mt-1">設定計時器後點擊儲存圖示即可建立預設。</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
      {presets.map((preset) => (
        <div
          key={preset.id}
          className="group relative bg-card hover:bg-muted/30 border border-border/50 hover:border-primary/30 rounded-2xl p-4 transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div 
              className="flex-1 cursor-pointer pr-8"
              onClick={() => onSelect(preset.duration)}
            >
              <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {preset.name}
              </h4>
              <p className="text-2xl font-mono font-bold text-muted-foreground mt-1 group-hover:text-foreground transition-colors">
                {formatDuration(preset.duration)}
              </p>
            </div>
            
            <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>刪除預設</AlertDialogTitle>
                    <AlertDialogDescription>
                      確定要刪除「{preset.name}」嗎？此操作無法復原。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deletePreset.mutate(preset.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                    >
                      刪除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <Button
              size="icon"
              variant="ghost"
              className="absolute bottom-4 right-4 h-10 w-10 text-primary/20 group-hover:text-primary group-hover:bg-primary/10 rounded-full transition-all"
              onClick={() => onSelect(preset.duration)}
            >
              <PlayCircle className="w-6 h-6 fill-current" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
