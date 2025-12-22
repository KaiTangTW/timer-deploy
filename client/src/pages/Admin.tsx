import { useState, useEffect } from "react";
import { useBanner, useUpdateBanner } from "@/hooks/use-banner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save, Image, Link } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link as RouterLink } from "wouter";

export default function Admin() {
  const { data: banner, isLoading } = useBanner();
  const updateBanner = useUpdateBanner();
  const { toast } = useToast();
  
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (banner) {
      setImageUrl(banner.imageUrl);
      setLinkUrl(banner.linkUrl);
      setIsActive(banner.isActive === 1);
    }
  }, [banner]);

  const handleSave = () => {
    if (!imageUrl.trim() || !linkUrl.trim()) {
      toast({
        title: "請填寫完整",
        description: "圖片網址和連結網址都是必填的",
        variant: "destructive",
      });
      return;
    }

    updateBanner.mutate({
      imageUrl: imageUrl.trim(),
      linkUrl: linkUrl.trim(),
      isActive: isActive ? 1 : 0,
    }, {
      onSuccess: () => {
        toast({
          title: "儲存成功",
          description: "Banner 設定已更新",
        });
      },
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <RouterLink href="/">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              返回計時器
            </Button>
          </RouterLink>
        </div>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-2xl">Banner 廣告設定</CardTitle>
            <CardDescription>設定首頁顯示的廣告橫幅</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="imageUrl" className="flex items-center gap-2">
                <Image className="w-4 h-4" />
                圖片網址
              </Label>
              <Input
                id="imageUrl"
                placeholder="https://example.com/banner.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="rounded-xl"
                data-testid="input-image-url"
              />
              <p className="text-xs text-muted-foreground">
                建議尺寸：1200 x 200 像素（或類似的橫幅比例）
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="linkUrl" className="flex items-center gap-2">
                <Link className="w-4 h-4" />
                連結網址
              </Label>
              <Input
                id="linkUrl"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="rounded-xl"
                data-testid="input-link-url"
              />
              <p className="text-xs text-muted-foreground">
                點擊 Banner 時會開啟的網址
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
              <div>
                <Label htmlFor="isActive" className="text-sm font-medium">啟用 Banner</Label>
                <p className="text-xs text-muted-foreground">關閉後首頁將不會顯示廣告</p>
              </div>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
                data-testid="switch-banner-active"
              />
            </div>

            {imageUrl && (
              <div className="space-y-2">
                <Label>預覽</Label>
                <div className="rounded-xl overflow-hidden border">
                  <img
                    src={imageUrl}
                    alt="Banner 預覽"
                    className="w-full h-auto object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              </div>
            )}

            <Button
              onClick={handleSave}
              disabled={updateBanner.isPending}
              className="w-full rounded-xl gap-2"
              data-testid="button-save-banner"
            >
              <Save className="w-4 h-4" />
              {updateBanner.isPending ? "儲存中..." : "儲存設定"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
