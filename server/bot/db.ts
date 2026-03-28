/**
 * 機器人資料庫操作（PostgreSQL via Drizzle）
 */

import { db } from "../db";
import { botFaqs, botSettings, botMessageLogs, botBlocklist } from "@shared/schema";
import { eq, desc, sql, count } from "drizzle-orm";

// ========== 初始化預設資料 ==========

export async function initBotData() {
  // 預設設定
  const defaultSettings: Record<string, string> = {
    bot_enabled: "true",
    bot_messenger_enabled: "true",
    bot_comment_enabled: "true",
    bot_ig_dm_enabled: "true",
    bot_ig_comment_enabled: "true",
    ai_enabled: "true",
    brand_name: "凱爺",
    brand_tone: "親切、專業、有幽默感的台灣繁體中文",
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    const existing = await db.select().from(botSettings).where(eq(botSettings.key, key));
    if (existing.length === 0) {
      await db.insert(botSettings).values({ key, value });
    }
  }

  // 預設 FAQ
  const defaultFaqs = [
    { id: "faq_price", keywords: "價格,多少錢,費用,收費,報價,價位", answer: "感謝您的詢問！關於價格方面，因為每個案子的需求不同，麻煩您私訊我們，我們會盡快為您提供詳細報價 😊", category: "價格", priority: 10 },
    { id: "faq_contact", keywords: "聯絡,電話,信箱,email,怎麼聯繫,聯繫方式", answer: "您可以透過以下方式聯繫我們：\n📩 私訊本粉專\n📧 Email: service@kaitang.tw\n我們會盡快回覆您！", category: "聯絡", priority: 5 },
    { id: "faq_service", keywords: "服務,項目,做什麼,業務,提供什麼", answer: "我們提供品牌策略、整合行銷、社群經營、活動企劃等服務。想了解更多細節，歡迎私訊我們聊聊您的需求！", category: "服務", priority: 5 },
    { id: "faq_collab", keywords: "合作,業配,邀約,代言,聯名", answer: "感謝您的合作邀約！請將合作提案寄到我們的信箱，或直接私訊說明合作內容，我們會儘速回覆 🙏", category: "合作", priority: 5 },
    { id: "faq_thanks", keywords: "謝謝,感謝,感恩,thx,thanks", answer: "不客氣！有任何問題隨時都可以問我們 😊", category: "回應", priority: 1 },
  ];

  for (const faq of defaultFaqs) {
    const existing = await db.select().from(botFaqs).where(eq(botFaqs.id, faq.id));
    if (existing.length === 0) {
      await db.insert(botFaqs).values(faq);
    }
  }
}

// ========== FAQ 操作 ==========

export const faqOps = {
  async getAll() {
    return db.select().from(botFaqs).orderBy(desc(botFaqs.priority));
  },

  async getEnabled() {
    return db.select().from(botFaqs).where(eq(botFaqs.enabled, 1)).orderBy(desc(botFaqs.priority));
  },

  async match(message: string) {
    const normalized = message.toLowerCase().trim();
    const faqs = await this.getEnabled();
    for (const faq of faqs) {
      const keywords = (faq.keywords ?? "").split(",").map(k => k.trim().toLowerCase());
      if (keywords.some(kw => kw && normalized.includes(kw))) {
        return faq;
      }
    }
    return null;
  },

  async add(data: { keywords: string; answer: string; category?: string; priority?: number; attachments?: string }) {
    const id = `faq_${Date.now()}`;
    await db.insert(botFaqs).values({ id, keywords: data.keywords, answer: data.answer, category: data.category || "", priority: data.priority || 0, attachments: data.attachments || "[]" });
    const rows = await db.select().from(botFaqs).where(eq(botFaqs.id, id));
    return rows[0];
  },

  async update(id: string, data: Partial<{ keywords: string; answer: string; category: string; priority: number; enabled: number; attachments: string }>) {
    const existing = await db.select().from(botFaqs).where(eq(botFaqs.id, id));
    if (existing.length === 0) return null;
    await db.update(botFaqs).set({ ...data, updatedAt: new Date() }).where(eq(botFaqs.id, id));
    const rows = await db.select().from(botFaqs).where(eq(botFaqs.id, id));
    return rows[0];
  },

  async delete(id: string) {
    const result = await db.delete(botFaqs).where(eq(botFaqs.id, id));
    return true;
  },
};

// ========== 設定操作 ==========

export const settingsOps = {
  async get(key: string): Promise<string | null> {
    const rows = await db.select().from(botSettings).where(eq(botSettings.key, key));
    return rows[0]?.value ?? null;
  },

  async getAll(): Promise<Record<string, string>> {
    const rows = await db.select().from(botSettings);
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
  },

  async set(key: string, value: string) {
    const existing = await db.select().from(botSettings).where(eq(botSettings.key, key));
    if (existing.length > 0) {
      await db.update(botSettings).set({ value, updatedAt: new Date() }).where(eq(botSettings.key, key));
    } else {
      await db.insert(botSettings).values({ key, value });
    }
  },

  async isEnabled(key: string): Promise<boolean> {
    return (await this.get(key)) === "true";
  },
};

// ========== 訊息日誌 ==========

export const logOps = {
  async add(data: { platform: string; type: string; sender_id?: string; message?: string; reply?: string; reply_source?: string }) {
    await db.insert(botMessageLogs).values({
      platform: data.platform,
      type: data.type,
      senderId: data.sender_id || "",
      message: data.message || "",
      reply: data.reply || "",
      replySource: data.reply_source || "",
    });
  },

  async getRecent(limit = 50, offset = 0) {
    return db.select().from(botMessageLogs).orderBy(desc(botMessageLogs.id)).limit(limit).offset(offset);
  },

  async getCount(): Promise<number> {
    const rows = await db.select({ count: count() }).from(botMessageLogs);
    return rows[0]?.count ?? 0;
  },

  async getStats() {
    const total = await this.getCount();

    const platformRows = await db
      .select({ platform: botMessageLogs.platform, count: count() })
      .from(botMessageLogs)
      .groupBy(botMessageLogs.platform);
    const byPlatform: Record<string, number> = {};
    for (const row of platformRows) byPlatform[row.platform] = row.count;

    const sourceRows = await db
      .select({ replySource: botMessageLogs.replySource, count: count() })
      .from(botMessageLogs)
      .where(sql`${botMessageLogs.replySource} != ''`)
      .groupBy(botMessageLogs.replySource);
    const bySource: Record<string, number> = {};
    for (const row of sourceRows) bySource[row.replySource ?? ""] = row.count;

    return { total, byPlatform, bySource };
  },
};

// ========== 封鎖名單 ==========

export const blocklistOps = {
  async isBlocked(senderId: string): Promise<boolean> {
    const rows = await db.select().from(botBlocklist).where(eq(botBlocklist.senderId, senderId));
    return rows.length > 0;
  },

  async add(senderId: string, reason = "") {
    const existing = await db.select().from(botBlocklist).where(eq(botBlocklist.senderId, senderId));
    if (existing.length === 0) {
      await db.insert(botBlocklist).values({ senderId, reason });
    }
  },

  async remove(senderId: string) {
    await db.delete(botBlocklist).where(eq(botBlocklist.senderId, senderId));
  },

  async getAll() {
    return db.select().from(botBlocklist).orderBy(desc(botBlocklist.createdAt));
  },
};
