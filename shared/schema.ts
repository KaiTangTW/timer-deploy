import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const presets = pgTable("presets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  duration: integer("duration").notNull(), // in seconds
});

export const timerHistory = pgTable("timer_history", {
  id: serial("id").primaryKey(),
  duration: integer("duration").notNull(), // in seconds
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  type: text("type").notNull().default("focus"), // focus, break, pomodoro
});

export const insertPresetSchema = createInsertSchema(presets).omit({ id: true });
export const insertTimerHistorySchema = createInsertSchema(timerHistory).omit({ id: true, completedAt: true });

export type Preset = typeof presets.$inferSelect;
export type InsertPreset = z.infer<typeof insertPresetSchema>;
export type TimerHistory = typeof timerHistory.$inferSelect;
export type InsertTimerHistory = z.infer<typeof insertTimerHistorySchema>;

export const bannerSettings = pgTable("banner_settings", {
  id: serial("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  linkUrl: text("link_url").notNull(),
  isActive: integer("is_active").notNull().default(1),
});

export const insertBannerSchema = createInsertSchema(bannerSettings).omit({ id: true });
export type BannerSettings = typeof bannerSettings.$inferSelect;
export type InsertBanner = z.infer<typeof insertBannerSchema>;
