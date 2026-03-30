/**
 * 機器人資料庫操作（PostgreSQL via Drizzle）
 */

import { db } from "../db";
import { botFaqs, botSettings, botMessageLogs, botBlocklist } from "@shared/schema";
import { eq, desc, sql, count } from "drizzle-orm";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

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

  // 自動匯入 FAQ 種子資料（113 題，只在 FAQ 表為空時匯入）
  const faqCount = await db.select({ count: count() }).from(botFaqs);
  if ((faqCount[0]?.count ?? 0) === 0) {
    try {
      const dir = typeof import.meta.dirname === "string" ? import.meta.dirname : dirname(fileURLToPath(import.meta.url));
      const seedPath = join(dir, "faq-seed.json");
      const seedData = JSON.parse(readFileSync(seedPath, "utf-8")) as Array<{ keywords: string; answer: string; category?: string; priority?: number }>;
      for (const item of seedData) {
        const id = `faq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await db.insert(botFaqs).values({
          id,
          keywords: item.keywords,
          answer: item.answer,
          category: item.category || "",
          priority: item.priority ?? 5,
        });
      }
      console.log(`[Bot] 已自動匯入 ${seedData.length} 筆 FAQ 種子資料`);
    } catch (err) {
      console.error("[Bot] FAQ 種子匯入失敗:", err);
    }
  }

  // Demo 訊息日誌
  const logCount = await db.select({ count: count() }).from(botMessageLogs);
  if ((logCount[0]?.count ?? 0) === 0) {
    const demoLogs = [
      { platform: "facebook", type: "comment", senderId: "fb_user_10001", senderName: "王小明", message: "請問你們的服務怎麼收費？", reply: "感謝您的詢問！關於價格方面，因為每個案子的需求不同，麻煩您私訊我們，我們會盡快為您提供詳細報價 😊", replySource: "faq" },
      { platform: "facebook", type: "messenger", senderId: "fb_user_10002", senderName: "李美玲", message: "你好，想詢問合作事宜", reply: "感謝您的合作邀約！請將合作提案寄到我們的信箱，或直接私訊說明合作內容，我們會儘速回覆 🙏", replySource: "faq" },
      { platform: "instagram", type: "dm", senderId: "ig_user_20001", senderName: "陳大華", message: "哈囉～想問一下你們有接品牌活動嗎？", reply: "嗨你好！我們有接品牌活動企劃喔～可以先跟我們聊聊你的需求和預算，我們再幫你規劃最適合的方案！歡迎直接私訊詳談 💪", replySource: "ai" },
      { platform: "instagram", type: "comment", senderId: "ig_user_20002", senderName: "張雅婷", message: "太厲害了！", reply: "謝謝你的支持！我們會繼續努力的 💪😊", replySource: "ai" },
      { platform: "facebook", type: "comment", senderId: "fb_user_10003", senderName: "林志偉", message: "謝謝分享！", reply: "不客氣！有任何問題隨時都可以問我們 😊", replySource: "faq" },
      { platform: "facebook", type: "messenger", senderId: "fb_user_10004", senderName: "李美玲", message: "你們的email是什麼", reply: "您可以透過以下方式聯繫我們：\n📩 私訊本粉專\n📧 Email: service@kaitang.tw\n我們會盡快回覆您！", replySource: "faq" },
      { platform: "instagram", type: "dm", senderId: "ig_user_20003", senderName: "陳大華", message: "請問可以幫忙做社群代操嗎", reply: "當然可以！我們有提供社群經營代操的服務，包含內容企劃、素材設計和數據分析。方便的話先告訴我們你的品牌和目前的社群狀況，我們可以先幫你評估 📊", replySource: "ai" },
      { platform: "facebook", type: "comment", senderId: "fb_user_10005", senderName: "黃建國", message: "多少錢", reply: "感謝您的詢問！關於價格方面，因為每個案子的需求不同，麻煩您私訊我們，我們會盡快為您提供詳細報價 😊", replySource: "faq" },
      { platform: "instagram", type: "comment", senderId: "ig_user_20004", senderName: "周怡君", message: "想了解更多服務內容", reply: "我們提供品牌策略、整合行銷、社群經營、活動企劃等服務。想了解更多細節，歡迎私訊我們聊聊您的需求！", replySource: "faq" },
      { platform: "facebook", type: "messenger", senderId: "fb_user_spam_001", senderName: "Spam Bot", message: "免費賺錢機會！點擊連結 https://spam.example.com", reply: "感謝您的訊息！我們的團隊會盡快回覆您 😊", replySource: "default" },
    ];
    for (const log of demoLogs) {
      await db.insert(botMessageLogs).values(log);
    }
  }

  // Demo 封鎖名單
  const blockCount = await db.select({ count: count() }).from(botBlocklist);
  if ((blockCount[0]?.count ?? 0) === 0) {
    const demoBlocks = [
      { senderId: "fb_user_spam_001", reason: "垃圾訊息 — 發送詐騙連結" },
      { senderId: "ig_user_spam_002", reason: "重複洗版留言" },
    ];
    for (const block of demoBlocks) {
      await db.insert(botBlocklist).values(block);
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
  async add(data: { platform: string; type: string; sender_id?: string; sender_name?: string; message?: string; reply?: string; reply_source?: string }) {
    await db.insert(botMessageLogs).values({
      platform: data.platform,
      type: data.type,
      senderId: data.sender_id || "",
      senderName: data.sender_name || "",
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

  async getBySender(senderId: string, limit = 50) {
    return db.select().from(botMessageLogs).where(eq(botMessageLogs.senderId, senderId)).orderBy(desc(botMessageLogs.id)).limit(limit);
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
