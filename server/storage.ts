import { presets, timerHistory, bannerSettings, pageViews, timerUsage, type Preset, type InsertPreset, type TimerHistory, type InsertTimerHistory, type BannerSettings, type InsertBanner, type PageView, type InsertPageView, type TimerUsage, type InsertTimerUsage } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, gte } from "drizzle-orm";

export interface IStorage {
  getPresets(): Promise<Preset[]>;
  createPreset(preset: InsertPreset): Promise<Preset>;
  deletePreset(id: number): Promise<void>;
  getTimerHistory(): Promise<TimerHistory[]>;
  createTimerHistory(history: InsertTimerHistory): Promise<TimerHistory>;
  getTimerStats(): Promise<{ totalTime: number; sessionCount: number; todayTime: number }>;
  getBanner(): Promise<BannerSettings | null>;
  updateBanner(banner: InsertBanner): Promise<BannerSettings>;
}

export class DatabaseStorage implements IStorage {
  async getPresets(): Promise<Preset[]> {
    return await db.select().from(presets);
  }

  async createPreset(insertPreset: InsertPreset): Promise<Preset> {
    const [preset] = await db.insert(presets).values(insertPreset).returning();
    return preset;
  }

  async deletePreset(id: number): Promise<void> {
    await db.delete(presets).where(eq(presets.id, id));
  }

  async getTimerHistory(): Promise<TimerHistory[]> {
    return await db.select().from(timerHistory).orderBy(desc(timerHistory.completedAt)).limit(50);
  }

  async createTimerHistory(insertHistory: InsertTimerHistory): Promise<TimerHistory> {
    const [history] = await db.insert(timerHistory).values(insertHistory).returning();
    return history;
  }

  async getTimerStats(): Promise<{ totalTime: number; sessionCount: number; todayTime: number }> {
    const allHistory = await db.select().from(timerHistory);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayHistory = allHistory.filter(h => new Date(h.completedAt) >= today);
    
    return {
      totalTime: allHistory.reduce((sum, h) => sum + h.duration, 0),
      sessionCount: allHistory.length,
      todayTime: todayHistory.reduce((sum, h) => sum + h.duration, 0)
    };
  }

  async getBanner(): Promise<BannerSettings | null> {
    const [banner] = await db.select().from(bannerSettings).where(eq(bannerSettings.isActive, 1)).limit(1);
    return banner || null;
  }

  async updateBanner(insertBanner: InsertBanner): Promise<BannerSettings> {
    const existing = await db.select().from(bannerSettings).limit(1);
    if (existing.length > 0) {
      const [updated] = await db.update(bannerSettings)
        .set(insertBanner)
        .where(eq(bannerSettings.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(bannerSettings).values(insertBanner).returning();
      return created;
    }
  }

  async recordPageView(view: InsertPageView): Promise<PageView> {
    const [created] = await db.insert(pageViews).values(view).returning();
    return created;
  }

  async recordTimerUsage(usage: InsertTimerUsage): Promise<TimerUsage> {
    const [created] = await db.insert(timerUsage).values(usage).returning();
    return created;
  }

  async getAnalytics(): Promise<{
    totalPageViews: number;
    todayPageViews: number;
    uniqueVisitors: number;
    todayVisitors: number;
    totalTimerUsage: number;
    todayTimerUsage: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allPageViews = await db.select().from(pageViews);
    const todayViews = allPageViews.filter(v => new Date(v.visitedAt) >= today);
    
    const uniqueVisitorIds = new Set(allPageViews.map(v => v.visitorId));
    const todayVisitorIds = new Set(todayViews.map(v => v.visitorId));

    const allUsage = await db.select().from(timerUsage);
    const todayUsage = allUsage.filter(u => new Date(u.usedAt) >= today);

    return {
      totalPageViews: allPageViews.length,
      todayPageViews: todayViews.length,
      uniqueVisitors: uniqueVisitorIds.size,
      todayVisitors: todayVisitorIds.size,
      totalTimerUsage: allUsage.length,
      todayTimerUsage: todayUsage.length,
    };
  }
}

export const storage = new DatabaseStorage();
