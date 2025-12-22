import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Settings, Volume2, VolumeX } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export interface TimerStyleSettings {
  fontFamily: string;
  color: string;
  soundEnabled: boolean;
}

interface TimerSettingsProps {
  settings: TimerStyleSettings;
  onChange: (settings: TimerStyleSettings) => void;
}

const fontOptions = [
  { value: "font-mono", label: "等寬字體" },
  { value: "font-sans", label: "無襯線字體" },
  { value: "font-serif", label: "襯線字體" },
  { value: "font-display", label: "標題字體" },
];

const colorOptions = [
  { value: "text-foreground", label: "預設", preview: "bg-foreground" },
  { value: "text-primary", label: "主色", preview: "bg-primary" },
  { value: "text-red-500", label: "紅色", preview: "bg-red-500" },
  { value: "text-orange-500", label: "橘色", preview: "bg-orange-500" },
  { value: "text-amber-500", label: "琥珀色", preview: "bg-amber-500" },
  { value: "text-green-500", label: "綠色", preview: "bg-green-500" },
  { value: "text-teal-500", label: "青色", preview: "bg-teal-500" },
  { value: "text-blue-500", label: "藍色", preview: "bg-blue-500" },
  { value: "text-indigo-500", label: "靛藍色", preview: "bg-indigo-500" },
  { value: "text-purple-500", label: "紫色", preview: "bg-purple-500" },
  { value: "text-pink-500", label: "粉色", preview: "bg-pink-500" },
];

export function TimerSettings({ settings, onChange }: TimerSettingsProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full w-12 h-12 border-2 hover:bg-muted/50"
          title="樣式設定"
          data-testid="button-settings"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 rounded-2xl" align="center">
        <div className="space-y-4">
          <h4 className="font-semibold text-sm">計時器設定</h4>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {settings.soundEnabled ? (
                <Volume2 className="w-4 h-4 text-muted-foreground" />
              ) : (
                <VolumeX className="w-4 h-4 text-muted-foreground" />
              )}
              <Label htmlFor="sound-toggle" className="text-sm">到時提醒</Label>
            </div>
            <Switch
              id="sound-toggle"
              checked={settings.soundEnabled}
              onCheckedChange={(checked) => onChange({ ...settings, soundEnabled: checked })}
              data-testid="switch-sound"
            />
          </div>
          
          <div className="border-t pt-4">
            <Label className="text-xs text-muted-foreground mb-2 block">字體樣式</Label>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">字體</Label>
            <Select
              value={settings.fontFamily}
              onValueChange={(value) => onChange({ ...settings, fontFamily: value })}
            >
              <SelectTrigger className="rounded-xl" data-testid="select-font">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fontOptions.map((font) => (
                  <SelectItem key={font.value} value={font.value} data-testid={`option-font-${font.value}`}>
                    <span className={font.value}>{font.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">顏色</Label>
            <div className="grid grid-cols-6 gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  onClick={() => onChange({ ...settings, color: color.value })}
                  className={`w-8 h-8 rounded-full ${color.preview} transition-all ${
                    settings.color === color.value
                      ? "ring-2 ring-offset-2 ring-primary"
                      : "hover:scale-110"
                  }`}
                  title={color.label}
                  data-testid={`button-color-${color.value}`}
                />
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
