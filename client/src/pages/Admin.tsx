import { useState, useEffect } from "react";
import { useBanner, useUpdateBanner } from "@/hooks/use-banner";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save, Image, Link, LogIn, LogOut, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/auth-utils";

export default function Admin() {
  const { user, isLoading: authLoading, isAuthenticated, logout } = useAuth();
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
      onError: (error) => {
        if (isUnauthorizedError(error)) {
          toast({
            title: "未授權",
            description: "請先登入...",
            variant: "destructive",
          });
          setTimeout(() => {
            window.location.href = "/api/login";
          }, 500);
          return;
        }
        toast({
          title: "儲存失敗",
          description: "您沒有管理員權限",
          variant: "destructive",
        });
      },
    });
  };

  // Show loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6">
        <div className="max-w-md mx-auto mt-20">
          <Card className="rounded-3xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">管理員登入</CardTitle>
              <CardDescription>請登入以管理 Banner 廣告設定</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => window.location.href = "/api/login"}
                className="w-full rounded-xl gap-2"
                data-testid="button-login"
              >
                <LogIn className="w-4 h-4" />
                登入
              </Button>
              <a href="/">
                <Button variant="ghost" className="w-full gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  返回計時器
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <a href="/">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              返回計時器
            </Button>
          </a>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={() => logout()} className="gap-2" data-testid="button-logout">
              <LogOut className="w-4 h-4" />
              登出
            </Button>
          </div>
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
