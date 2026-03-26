/**
 * SQLite 資料庫模組
 * 持久化儲存 FAQ、機器人設定、訊息日誌
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "bot.db");

// 確保 data 目錄存在
import fs from "fs";
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// 啟用 WAL 模式（效能更好）
db.pragma("journal_mode = WAL");

// ========== 建立資料表 ==========

db.exec(`
  -- FAQ 資料表
  CREATE TABLE IF NOT EXISTS faqs (
    id TEXT PRIMARY KEY,
    keywords TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT DEFAULT '',
    priority INTEGER DEFAULT 0,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );

  -- 機器人設定
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );

  -- 訊息日誌
  CREATE TABLE IF NOT EXISTS message_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    type TEXT NOT NULL,
    sender_id TEXT,
    message TEXT,
    reply TEXT,
    reply_source TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  -- 封鎖名單
  CREATE TABLE IF NOT EXISTS blocklist (
    sender_id TEXT PRIMARY KEY,
    reason TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
`);

// ========== 預設設定 ==========

const defaultSettings: Record<string, string> = {
  bot_enabled: "true",
  bot_messenger_enabled: "true",
  bot_comment_enabled: "true",
  bot_ig_dm_enabled: "true",
  bot_ig_comment_enabled: "true",
  ai_enabled: "true",
  ai_max_length: "150",
  brand_name: "凱爺",
  brand_tone: "親切、專業、有幽默感的台灣繁體中文",
};

const insertSetting = db.prepare(
  "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
);
for (const [key, value] of Object.entries(defaultSettings)) {
  insertSetting.run(key, value);
}

// ========== 預設 FAQ ==========

const insertFaq = db.prepare(
  "INSERT OR IGNORE INTO faqs (id, keywords, answer, category, priority) VALUES (?, ?, ?, ?, ?)"
);

const defaultFaqs = [
  {
    id: "faq_price",
    keywords: "價格,多少錢,費用,收費,報價,價位",
    answer:
      "感謝您的詢問！關於價格方面，因為每個案子的需求不同，麻煩您私訊我們，我們會盡快為您提供詳細報價 😊",
    category: "價格",
    priority: 10,
  },
  {
    id: "faq_contact",
    keywords: "聯絡,電話,信箱,email,怎麼聯繫,聯繫方式",
    answer:
      "您可以透過以下方式聯繫我們：\n📩 私訊本粉專\n📧 Email: service@kaitang.tw\n我們會盡快回覆您！",
    category: "聯絡",
    priority: 5,
  },
  {
    id: "faq_service",
    keywords: "服務,項目,做什麼,業務,提供什麼",
    answer:
      "我們提供品牌策略、整合行銷、社群經營、活動企劃等服務。想了解更多細節，歡迎私訊我們聊聊您的需求！",
    category: "服務",
    priority: 5,
  },
  {
    id: "faq_collab",
    keywords: "合作,業配,邀約,代言,聯名",
    answer:
      "感謝您的合作邀約！請將合作提案寄到我們的信箱，或直接私訊說明合作內容，我們會儘速回覆 🙏",
    category: "合作",
    priority: 5,
  },
  {
    id: "faq_thanks",
    keywords: "謝謝,感謝,感恩,thx,thanks",
    answer: "不客氣！有任何問題隨時都可以問我們 😊",
    category: "回應",
    priority: 1,
  },
];

for (const faq of defaultFaqs) {
  insertFaq.run(faq.id, faq.keywords, faq.answer, faq.category, faq.priority);
}

// ========== FAQ 操作 ==========

export interface FaqRow {
  id: string;
  keywords: string;
  answer: string;
  category: string;
  priority: number;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export const faqDb = {
  getAll(): FaqRow[] {
    return db.prepare("SELECT * FROM faqs ORDER BY priority DESC").all() as FaqRow[];
  },

  getEnabled(): FaqRow[] {
    return db
      .prepare("SELECT * FROM faqs WHERE enabled = 1 ORDER BY priority DESC")
      .all() as FaqRow[];
  },

  match(message: string): FaqRow | null {
    const normalized = message.toLowerCase().trim();
    const faqs = this.getEnabled();
    for (const faq of faqs) {
      const keywords = faq.keywords.split(",").map((k) => k.trim().toLowerCase());
      if (keywords.some((kw) => normalized.includes(kw))) {
        return faq;
      }
    }
    return null;
  },

  add(data: {
    keywords: string;
    answer: string;
    category?: string;
    priority?: number;
  }): FaqRow {
    const id = `faq_${Date.now()}`;
    db.prepare(
      "INSERT INTO faqs (id, keywords, answer, category, priority) VALUES (?, ?, ?, ?, ?)"
    ).run(id, data.keywords, data.answer, data.category || "", data.priority || 0);
    return db.prepare("SELECT * FROM faqs WHERE id = ?").get(id) as FaqRow;
  },

  update(
    id: string,
    data: Partial<{ keywords: string; answer: string; category: string; priority: number; enabled: number }>
  ): FaqRow | null {
    const existing = db.prepare("SELECT * FROM faqs WHERE id = ?").get(id) as FaqRow | undefined;
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];

    if (data.keywords !== undefined) { fields.push("keywords = ?"); values.push(data.keywords); }
    if (data.answer !== undefined) { fields.push("answer = ?"); values.push(data.answer); }
    if (data.category !== undefined) { fields.push("category = ?"); values.push(data.category); }
    if (data.priority !== undefined) { fields.push("priority = ?"); values.push(data.priority); }
    if (data.enabled !== undefined) { fields.push("enabled = ?"); values.push(data.enabled); }

    fields.push("updated_at = datetime('now','localtime')");
    values.push(id);

    db.prepare(`UPDATE faqs SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    return db.prepare("SELECT * FROM faqs WHERE id = ?").get(id) as FaqRow;
  },

  delete(id: string): boolean {
    const result = db.prepare("DELETE FROM faqs WHERE id = ?").run(id);
    return result.changes > 0;
  },
};

// ========== 設定操作 ==========

export const settingsDb = {
  get(key: string): string | null {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  },

  getAll(): Record<string, string> {
    const rows = db.prepare("SELECT key, value FROM settings").all() as {
      key: string;
      value: string;
    }[];
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  },

  set(key: string, value: string): void {
    db.prepare(
      "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now','localtime'))"
    ).run(key, value);
  },

  isEnabled(key: string): boolean {
    return this.get(key) === "true";
  },
};

// ========== 訊息日誌 ==========

export const logDb = {
  add(data: {
    platform: string;
    type: string;
    sender_id?: string;
    message?: string;
    reply?: string;
    reply_source?: string;
  }): void {
    db.prepare(
      "INSERT INTO message_logs (platform, type, sender_id, message, reply, reply_source) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      data.platform,
      data.type,
      data.sender_id || "",
      data.message || "",
      data.reply || "",
      data.reply_source || ""
    );
  },

  getRecent(limit = 50, offset = 0): any[] {
    return db
      .prepare("SELECT * FROM message_logs ORDER BY id DESC LIMIT ? OFFSET ?")
      .all(limit, offset);
  },

  getCount(): number {
    const row = db.prepare("SELECT COUNT(*) as count FROM message_logs").get() as { count: number };
    return row.count;
  },

  getStats(): { total: number; byPlatform: Record<string, number>; bySource: Record<string, number> } {
    const total = this.getCount();

    const platformRows = db
      .prepare("SELECT platform, COUNT(*) as count FROM message_logs GROUP BY platform")
      .all() as { platform: string; count: number }[];
    const byPlatform: Record<string, number> = {};
    for (const row of platformRows) byPlatform[row.platform] = row.count;

    const sourceRows = db
      .prepare("SELECT reply_source, COUNT(*) as count FROM message_logs WHERE reply_source != '' GROUP BY reply_source")
      .all() as { reply_source: string; count: number }[];
    const bySource: Record<string, number> = {};
    for (const row of sourceRows) bySource[row.reply_source] = row.count;

    return { total, byPlatform, bySource };
  },
};

// ========== 封鎖名單 ==========

export const blocklistDb = {
  isBlocked(senderId: string): boolean {
    const row = db.prepare("SELECT 1 FROM blocklist WHERE sender_id = ?").get(senderId);
    return !!row;
  },

  add(senderId: string, reason = ""): void {
    db.prepare("INSERT OR REPLACE INTO blocklist (sender_id, reason) VALUES (?, ?)").run(
      senderId,
      reason
    );
  },

  remove(senderId: string): boolean {
    const result = db.prepare("DELETE FROM blocklist WHERE sender_id = ?").run(senderId);
    return result.changes > 0;
  },

  getAll(): { sender_id: string; reason: string; created_at: string }[] {
    return db.prepare("SELECT * FROM blocklist ORDER BY created_at DESC").all() as any[];
  },
};

export default db;
