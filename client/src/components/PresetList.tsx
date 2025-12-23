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
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    const parts = [];
    if (h > 0) parts.push(`${h}時`);
    if (m > 0) parts.push(`${m}分`);
    if (s > 0 || parts.length === 0) parts.push(`${s}秒`);
    
    return parts.join(' ');
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
          className="group relative bg-card hover:bg-muted/30 border border-border/50 hover:border-primary/30 rounded-2xl p-4 pb-12 transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <div 
            className="cursor-pointer"
            onClick={() => onSelect(preset.duration)}
          >
            <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {preset.name}
            </h4>
            <p className="text-xl font-mono font-bold text-muted-foreground mt-1 group-hover:text-foreground transition-colors">
              {formatDuration(preset.duration)}
            </p>
          </div>
          
          {/* Bottom action bar */}
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
            {/* Play button */}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-3 text-xs text-primary/60 group-hover:text-primary group-hover:bg-primary/10 rounded-lg transition-all"
              onClick={() => onSelect(preset.duration)}
            >
              <PlayCircle className="w-4 h-4 mr-1" />
              使用
            </Button>
            
            {/* Delete button */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  刪除
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
        </div>
      ))}
    </div>
  );
}
