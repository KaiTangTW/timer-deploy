import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

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

export const pageViews = pgTable("page_views", {
  id: serial("id").primaryKey(),
  visitorId: text("visitor_id").notNull(),
  path: text("path").notNull().default("/"),
  visitedAt: timestamp("visited_at").defaultNow().notNull(),
});

export const timerUsage = pgTable("timer_usage", {
  id: serial("id").primaryKey(),
  visitorId: text("visitor_id").notNull(),
  duration: integer("duration").notNull(),
  type: text("type").notNull().default("timer"),
  usedAt: timestamp("used_at").defaultNow().notNull(),
});

export const insertPageViewSchema = createInsertSchema(pageViews).omit({ id: true, visitedAt: true });
export const insertTimerUsageSchema = createInsertSchema(timerUsage).omit({ id: true, usedAt: true });

export type PageView = typeof pageViews.$inferSelect;
export type InsertPageView = z.infer<typeof insertPageViewSchema>;
export type TimerUsage = typeof timerUsage.$inferSelect;
export type InsertTimerUsage = z.infer<typeof insertTimerUsageSchema>;

// ========== 機器人相關 ==========

export const botFaqs = pgTable("bot_faqs", {
  id: text("id").primaryKey(),
  keywords: text("keywords").notNull(),
  answer: text("answer").notNull(),
  category: text("category").default(""),
  priority: integer("priority").default(0),
  enabled: integer("enabled").default(1),
  attachments: text("attachments").default("[]"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const botSettings = pgTable("bot_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const botMessageLogs = pgTable("bot_message_logs", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull(),
  type: text("type").notNull(),
  senderId: text("sender_id").default(""),
  senderName: text("sender_name").default(""),
  message: text("message").default(""),
  reply: text("reply").default(""),
  replySource: text("reply_source").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const botBlocklist = pgTable("bot_blocklist", {
  senderId: text("sender_id").primaryKey(),
  reason: text("reason").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BotFaq = typeof botFaqs.$inferSelect;
export type BotSetting = typeof botSettings.$inferSelect;
export type BotMessageLog = typeof botMessageLogs.$inferSelect;
export type BotBlockEntry = typeof botBlocklist.$inferSelect;
