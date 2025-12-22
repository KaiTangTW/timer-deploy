import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { BannerSettings, InsertBanner } from "@shared/schema";

export function useBanner() {
  return useQuery<BannerSettings | null>({
    queryKey: ["/api/banner"],
  });
}

export function useUpdateBanner() {
  return useMutation({
    mutationFn: async (banner: InsertBanner) => {
      const res = await apiRequest("POST", "/api/banner", banner);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/banner"] });
    },
  });
}
