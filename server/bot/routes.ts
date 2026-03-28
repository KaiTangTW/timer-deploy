/**
 * 機器人路由（Webhook + Admin API + 管理後台 UI）
 * 權限：@2him.net 網域的使用者才能存取管理後台
 */

import { Router, type Request, type Response, type RequestHandler } from "express";
import { faqOps, settingsOps, logOps, blocklistOps, initBotData } from "./db";
import { generateAIReply } from "./ai";
import {
  handleFBComment,
  handleMessengerMessage,
  handleIGComment,
  handleIGDirectMessage,
} from "./handler";

export const botRouter = Router();

// ========== @2him.net 權限中介 ==========

const isBotAdmin: RequestHandler = (req, res, next) => {
  const user = req.user as any;
  if (!req.isAuthenticated?.() || !user?.claims?.email) {
    return res.status(401).json({ message: "請先登入" });
  }
  const email: string = user.claims.email;
  if (!email.endsWith("@2him.net")) {
    return res.status(403).json({ message: "僅限 @2him.net 網域使用者存取" });
  }
  next();
};

// ========== Webhook（公開，Meta 會打這個） ==========

botRouter.get("/webhook", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const verifyToken = process.env.META_VERIFY_TOKEN || "kaitang_bot_verify_2024";

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[Webhook] ✅ 驗證成功");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

botRouter.post("/webhook", async (req: Request, res: Response) => {
  const body = req.body;
  res.sendStatus(200); // Meta 要求快速回應

  try {
    if (body.object === "page") {
      for (const entry of body.entry || []) {
        if (entry.messaging) {
          for (const event of entry.messaging) {
            if (event.message && !event.message.is_echo) {
              await handleMessengerMessage({
                senderId: event.sender.id,
                messageId: event.message.mid,
                message: event.message.text || "",
              });
            }
          }
        }
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === "feed" && change.value?.item === "comment") {
              const val = change.value;
              if (val.from?.id === entry.id) continue;
              await handleFBComment({
                commentId: val.comment_id,
                message: val.message || "",
                senderId: val.from?.id || "",
                postId: val.post_id,
              });
            }
          }
        }
      }
    } else if (body.object === "instagram") {
      for (const entry of body.entry || []) {
        if (entry.messaging) {
          for (const event of entry.messaging) {
            if (event.message && !event.message.is_echo) {
              await handleIGDirectMessage({
                senderId: event.sender.id,
                messageId: event.message.mid,
                message: event.message.text || "",
              });
            }
          }
        }
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === "comments") {
              const val = change.value;
              await handleIGComment({
                commentId: val.id,
                message: val.text || "",
                senderId: val.from?.id || "",
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("[Webhook] 錯誤:", error);
  }
});

// ========== 管理 API（需 @2him.net 登入） ==========

// 設定
botRouter.get("/api/bot/settings", isBotAdmin, async (_req: Request, res: Response) => {
  res.json({ success: true, data: await settingsOps.getAll() });
});

botRouter.put("/api/bot/settings", isBotAdmin, async (req: Request, res: Response) => {
  for (const [key, value] of Object.entries(req.body)) {
    await settingsOps.set(key, String(value));
  }
  res.json({ success: true, data: await settingsOps.getAll() });
});

// FAQ
botRouter.get("/api/bot/faq", isBotAdmin, async (_req: Request, res: Response) => {
  res.json({ success: true, data: await faqOps.getAll() });
});

botRouter.post("/api/bot/faq", isBotAdmin, async (req: Request, res: Response) => {
  const { keywords, answer, category, priority, attachments } = req.body;
  if (!keywords || !answer) {
    res.status(400).json({ success: false, error: "keywords 和 answer 為必填" });
    return;
  }
  const kw = Array.isArray(keywords) ? keywords.join(",") : keywords;
  const attStr = attachments ? JSON.stringify(attachments) : "[]";
  const entry = await faqOps.add({ keywords: kw, answer, category, priority: priority ?? 0, attachments: attStr });
  res.json({ success: true, data: entry });
});

botRouter.put("/api/bot/faq/:id", isBotAdmin, async (req: Request, res: Response) => {
  const updates = req.body;
  if (updates.keywords && Array.isArray(updates.keywords)) {
    updates.keywords = updates.keywords.join(",");
  }
  if (updates.attachments && typeof updates.attachments !== "string") {
    updates.attachments = JSON.stringify(updates.attachments);
  }
  const updated = await faqOps.update(req.params.id, updates);
  if (!updated) {
    res.status(404).json({ success: false, error: "找不到該 FAQ" });
    return;
  }
  res.json({ success: true, data: updated });
});

botRouter.delete("/api/bot/faq/:id", isBotAdmin, async (req: Request, res: Response) => {
  await faqOps.delete(req.params.id);
  res.json({ success: true });
});

// 測試回覆
botRouter.post("/api/bot/test-reply", isBotAdmin, async (req: Request, res: Response) => {
  const { message, isComment } = req.body;
  if (!message) {
    res.status(400).json({ success: false, error: "message 為必填" });
    return;
  }
  const faqMatch = await faqOps.match(message);
  if (faqMatch) {
    let attachments: any[] = [];
    try { attachments = JSON.parse(faqMatch.attachments || "[]"); } catch {}
    res.json({ success: true, source: "faq", faqId: faqMatch.id, reply: faqMatch.answer, attachments });
    return;
  }
  if (!(await settingsOps.isEnabled("ai_enabled"))) {
    res.json({ success: true, source: "default", reply: "感謝您的訊息！我們的團隊會盡快回覆您 😊", attachments: [] });
    return;
  }
  const aiReply = await generateAIReply(message, { isComment: !!isComment });
  res.json({ success: true, source: "ai", reply: aiReply, attachments: [] });
});

// 日誌
botRouter.get("/api/bot/logs", isBotAdmin, async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  res.json({ success: true, data: await logOps.getRecent(limit, offset), total: await logOps.getCount() });
});

botRouter.get("/api/bot/stats", isBotAdmin, async (_req: Request, res: Response) => {
  const stats = await logOps.getStats();
  const faqs = await faqOps.getAll();
  res.json({
    success: true,
    data: {
      ...stats,
      faqCount: faqs.length,
      uptime: process.uptime(),
      botEnabled: await settingsOps.isEnabled("bot_enabled"),
    },
  });
});

// 封鎖名單
botRouter.get("/api/bot/blocklist", isBotAdmin, async (_req: Request, res: Response) => {
  res.json({ success: true, data: await blocklistOps.getAll() });
});

botRouter.post("/api/bot/blocklist", isBotAdmin, async (req: Request, res: Response) => {
  const { sender_id, reason } = req.body;
  if (!sender_id) {
    res.status(400).json({ success: false, error: "sender_id 為必填" });
    return;
  }
  await blocklistOps.add(sender_id, reason || "");
  res.json({ success: true });
});

botRouter.delete("/api/bot/blocklist/:id", isBotAdmin, async (req: Request, res: Response) => {
  await blocklistOps.remove(req.params.id);
  res.json({ success: true });
});

// ========== 使用者資訊（前端用來判斷登入狀態） ==========

botRouter.get("/api/bot/me", (req: Request, res: Response) => {
  const user = req.user as any;
  if (!req.isAuthenticated?.() || !user?.claims) {
    res.json({ loggedIn: false });
    return;
  }
  const email = user.claims.email || "";
  res.json({
    loggedIn: true,
    email,
    name: `${user.claims.first_name || ""} ${user.claims.last_name || ""}`.trim(),
    avatar: user.claims.profile_image_url || "",
    hasAccess: email.endsWith("@2him.net"),
  });
});

// ========== 管理後台 HTML ==========

botRouter.get("/bot-admin", (_req: Request, res: Response) => {
  res.send(ADMIN_HTML);
});

// ========== 初始化 ==========

export async function initBot() {
  await initBotData();
  console.log("[Bot] 機器人資料庫初始化完成");
}

// ========== HTML ==========

export const ADMIN_HTML = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>KaiBot 管理後台</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, "Noto Sans TC", sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }

.login-page { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
.login-box { text-align: center; background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 40px; max-width: 400px; }
.login-box h1 { font-size: 24px; margin-bottom: 8px; }
.login-box p { color: #94a3b8; margin-bottom: 24px; font-size: 14px; }
.login-btn { display: inline-block; padding: 12px 32px; background: #3b82f6; color: white; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; }
.login-btn:hover { background: #2563eb; }
.denied { color: #f87171; }
.app { display: none; }

.sidebar { position: fixed; left: 0; top: 0; width: 220px; height: 100vh; background: #1e293b; border-right: 1px solid #334155; padding: 20px 0; z-index: 10; overflow-y: auto; }
.sidebar-header { padding: 0 20px 16px; border-bottom: 1px solid #334155; }
.sidebar-header h1 { font-size: 18px; color: #f8fafc; }
.sidebar-header .user-info { font-size: 12px; color: #64748b; margin-top: 4px; }
.sidebar nav { padding: 10px 0; }
.sidebar a { display: block; padding: 12px 20px; color: #94a3b8; text-decoration: none; font-size: 14px; transition: all 0.2s; cursor: pointer; }
.sidebar a:hover, .sidebar a.active { background: #334155; color: #f8fafc; }
.sidebar .logout { position: absolute; bottom: 20px; left: 0; right: 0; padding: 12px 20px; color: #f87171; font-size: 13px; }
.main { margin-left: 220px; padding: 30px; }

/* Info box — 功能說明 */
.info-box { background: #1e3a5f; border: 1px solid #2563eb40; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px; font-size: 13px; color: #93c5fd; line-height: 1.6; }
.info-box strong { color: #bfdbfe; }

.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 30px; }
.stat-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; }
.stat-card .label { font-size: 13px; color: #94a3b8; margin-bottom: 4px; }
.stat-card .value { font-size: 28px; font-weight: 700; color: #f8fafc; }
.stat-card .value.on { color: #4ade80; }
.stat-card .value.off { color: #f87171; }

.section { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
.section h2 { font-size: 18px; margin-bottom: 16px; color: #f8fafc; }

.toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #334155; }
.toggle-row:last-child { border-bottom: none; }
.toggle-row .desc { font-size: 12px; color: #64748b; margin-top: 2px; }
.switch { position: relative; width: 48px; height: 26px; cursor: pointer; flex-shrink: 0; }
.switch input { display: none; }
.switch .slider { position: absolute; inset: 0; background: #475569; border-radius: 26px; transition: 0.3s; }
.switch .slider:before { content: ""; position: absolute; width: 20px; height: 20px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s; }
.switch input:checked + .slider { background: #4ade80; }
.switch input:checked + .slider:before { transform: translateX(22px); }

table { width: 100%; border-collapse: collapse; font-size: 14px; }
th { text-align: left; padding: 10px 12px; color: #94a3b8; font-weight: 500; border-bottom: 1px solid #334155; font-size: 12px; text-transform: uppercase; }
td { padding: 10px 12px; border-bottom: 1px solid #1e293b; vertical-align: top; }
tr:hover td { background: #334155; }

.btn { padding: 8px 16px; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; transition: 0.2s; }
.btn-primary { background: #3b82f6; color: white; }
.btn-primary:hover { background: #2563eb; }
.btn-danger { background: #ef4444; color: white; }
.btn-danger:hover { background: #dc2626; }
.btn-ghost { background: transparent; color: #94a3b8; border: 1px solid #475569; }
.btn-ghost:hover { background: #334155; color: #e2e8f0; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.btn-xs { padding: 2px 8px; font-size: 11px; }

.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 6px; }
.form-group input, .form-group textarea, .form-group select { width: 100%; padding: 10px 12px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: #e2e8f0; font-size: 14px; font-family: inherit; }
.form-group textarea { min-height: 80px; resize: vertical; }
.form-group .hint { font-size: 11px; color: #64748b; margin-top: 4px; }

.modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; align-items: center; justify-content: center; }
.modal-overlay.show { display: flex; }
.modal { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 28px; width: 90%; max-width: 600px; max-height: 90vh; overflow-y: auto; }
.modal h3 { margin-bottom: 20px; font-size: 18px; }
.modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }

.badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.badge-faq { background: #3b82f620; color: #60a5fa; }
.badge-ai { background: #a855f720; color: #c084fc; }
.badge-default { background: #64748b20; color: #94a3b8; }
.badge-fb { background: #1877f220; color: #60a5fa; }
.badge-ig { background: #e1306c20; color: #f472b6; }

/* FAQ 卡片 */
.faq-cards { display: flex; flex-direction: column; gap: 12px; }
.faq-card { background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 18px; transition: border-color 0.2s; }
.faq-card:hover { border-color: #475569; }
.faq-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.faq-card-header .left { display: flex; align-items: center; gap: 10px; }
.faq-card-meta { font-size: 12px; color: #64748b; }
.faq-card-keywords { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.kw-tag { display: inline-flex; align-items: center; gap: 4px; background: #334155; padding: 3px 10px; border-radius: 6px; font-size: 12px; color: #e2e8f0; }
.faq-card-answer { font-size: 13px; color: #94a3b8; line-height: 1.5; white-space: pre-wrap; max-height: 60px; overflow: hidden; transition: max-height 0.3s; }
.faq-card-answer.expanded { max-height: none; }
.faq-card-footer { display: flex; gap: 8px; margin-top: 10px; align-items: center; }
.faq-card .att-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.att-badge { display: inline-flex; align-items: center; gap: 4px; background: #1e3a5f; border: 1px solid #2563eb30; padding: 3px 8px; border-radius: 6px; font-size: 11px; color: #93c5fd; }
.att-badge img { width: 16px; height: 16px; border-radius: 2px; object-fit: cover; }
.faq-search { display: flex; gap: 10px; margin-bottom: 16px; }
.faq-search input { flex: 1; padding: 10px 14px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: #e2e8f0; font-size: 14px; }
.faq-search select { padding: 10px 12px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: #e2e8f0; font-size: 14px; min-width: 120px; }

/* Tag 輸入 */
.tag-input-wrap { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 10px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; min-height: 42px; align-items: center; cursor: text; }
.tag-input-wrap .tag { display: inline-flex; align-items: center; gap: 4px; background: #334155; padding: 3px 8px; border-radius: 6px; font-size: 12px; color: #e2e8f0; }
.tag-input-wrap .tag .tag-x { cursor: pointer; color: #94a3b8; font-size: 14px; line-height: 1; }
.tag-input-wrap .tag .tag-x:hover { color: #f87171; }
.tag-input-wrap input { border: none; background: none; color: #e2e8f0; font-size: 13px; outline: none; min-width: 80px; flex: 1; padding: 2px 0; }

/* 附件編輯 */
.att-editor { margin-top: 12px; }
.att-editor-title { font-size: 13px; color: #94a3b8; margin-bottom: 8px; }
.att-item { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; background: #0f172a; padding: 8px 10px; border-radius: 8px; border: 1px solid #334155; }
.att-item select { padding: 6px 8px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; color: #e2e8f0; font-size: 12px; }
.att-item input { flex: 1; padding: 6px 8px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; color: #e2e8f0; font-size: 12px; }
.att-item .att-remove { cursor: pointer; color: #94a3b8; font-size: 16px; padding: 0 4px; }
.att-item .att-remove:hover { color: #f87171; }

.test-area { display: flex; gap: 10px; margin-bottom: 16px; }
.test-area input { flex: 1; }
.test-result { background: #0f172a; border-radius: 8px; padding: 16px; min-height: 60px; }

.page { display: none; }
.page.active { display: block; }

.toast { position: fixed; bottom: 24px; right: 24px; background: #22c55e; color: white; padding: 10px 20px; border-radius: 8px; font-size: 13px; z-index: 200; opacity: 0; transition: opacity 0.3s; pointer-events: none; }
.toast.show { opacity: 1; }

@media (max-width: 768px) {
  .sidebar { width: 60px; }
  .sidebar-header h1, .sidebar a .text, .sidebar-header .user-info { display: none; }
  .main { margin-left: 60px; padding: 16px; }
}
</style>
</head>
<body>

<div class="login-page" id="login-page">
  <div class="login-box">
    <h1>KaiBot</h1>
    <p>FB/IG 自動回覆機器人管理後台</p>
    <div id="login-content">
      <a href="/api/login" class="login-btn">登入</a>
      <p style="margin-top:12px;font-size:12px;color:#64748b;">僅限 @2him.net 網域使用者</p>
    </div>
  </div>
</div>

<div class="app" id="app">
  <div class="sidebar">
    <div class="sidebar-header">
      <h1>KaiBot</h1>
      <div class="user-info" id="user-email"></div>
    </div>
    <nav>
      <a class="active" data-page="dashboard"><span>📊</span> <span class="text">儀表板</span></a>
      <a data-page="toggle"><span>🔌</span> <span class="text">開關控制</span></a>
      <a data-page="faq"><span>📋</span> <span class="text">FAQ 管理</span></a>
      <a data-page="test"><span>🧪</span> <span class="text">測試回覆</span></a>
      <a data-page="logs"><span>📜</span> <span class="text">訊息日誌</span></a>
      <a data-page="blocklist"><span>🚫</span> <span class="text">封鎖名單</span></a>
    </nav>
    <a href="/api/logout" class="logout">登出</a>
  </div>

  <div class="main">
    <!-- ===== 儀表板 ===== -->
    <div class="page active" id="page-dashboard">
      <h2 style="margin-bottom:12px;">儀表板</h2>
      <div class="info-box">機器人運作狀態總覽。顯示各平台訊息量、FAQ 與 AI 回覆統計。</div>
      <div class="stats">
        <div class="stat-card"><div class="label">機器人狀態</div><div class="value" id="stat-status">-</div></div>
        <div class="stat-card"><div class="label">FAQ 數量</div><div class="value" id="stat-faq">-</div></div>
        <div class="stat-card"><div class="label">已處理訊息</div><div class="value" id="stat-total">-</div></div>
        <div class="stat-card"><div class="label">運行時間</div><div class="value" id="stat-uptime">-</div></div>
      </div>
      <div class="stats">
        <div class="stat-card"><div class="label">Facebook</div><div class="value" id="stat-fb">0</div></div>
        <div class="stat-card"><div class="label">Instagram</div><div class="value" id="stat-ig">0</div></div>
        <div class="stat-card"><div class="label">FAQ 回覆</div><div class="value" id="stat-faq-reply">0</div></div>
        <div class="stat-card"><div class="label">AI 回覆</div><div class="value" id="stat-ai-reply">0</div></div>
      </div>
    </div>

    <!-- ===== 開關控制 ===== -->
    <div class="page" id="page-toggle">
      <div class="info-box"><strong>開關控制</strong>：「總開關」關閉後機器人完全停止所有自動回覆。各平台開關可個別控制 Messenger 私訊、FB 貼文留言、IG 私訊、IG 留言。「AI 回覆」開啟後，FAQ 沒命中的訊息會交由 AI 產生回覆；關閉則回傳預設文字。</div>
      <div class="section">
        <h2>機器人開關</h2>
        <div class="toggle-row"><div><div>總開關</div><div class="desc">關閉後所有自動回覆停止</div></div><label class="switch"><input type="checkbox" data-setting="bot_enabled"><span class="slider"></span></label></div>
        <div class="toggle-row"><div><div>Messenger 私訊</div><div class="desc">Facebook Messenger 私訊自動回覆</div></div><label class="switch"><input type="checkbox" data-setting="bot_messenger_enabled"><span class="slider"></span></label></div>
        <div class="toggle-row"><div><div>FB 留言</div><div class="desc">Facebook 貼文留言自動回覆</div></div><label class="switch"><input type="checkbox" data-setting="bot_comment_enabled"><span class="slider"></span></label></div>
        <div class="toggle-row"><div><div>IG 私訊</div><div class="desc">Instagram DM 自動回覆</div></div><label class="switch"><input type="checkbox" data-setting="bot_ig_dm_enabled"><span class="slider"></span></label></div>
        <div class="toggle-row"><div><div>IG 留言</div><div class="desc">Instagram 貼文留言自動回覆</div></div><label class="switch"><input type="checkbox" data-setting="bot_ig_comment_enabled"><span class="slider"></span></label></div>
      </div>
      <div class="section">
        <h2>AI 設定</h2>
        <div class="toggle-row"><div><div>AI 回覆</div><div class="desc">FAQ 沒命中時用 AI 生成回覆；關閉後回覆預設文字「感謝您的訊息！我們的團隊會盡快回覆您」</div></div><label class="switch"><input type="checkbox" data-setting="ai_enabled"><span class="slider"></span></label></div>
      </div>
    </div>

    <!-- ===== FAQ 管理 ===== -->
    <div class="page" id="page-faq">
      <div class="info-box"><strong>FAQ 自動回覆</strong>：當收到的訊息包含任一關鍵字時，自動回覆對應內容。優先級越高越先比對（數字大 = 優先）。可附加連結、圖片或檔案，私訊會以獨立訊息發送附件，留言則自動將連結附在回覆文字末尾。</div>
      <div class="section">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h2 style="margin-bottom:0;">FAQ 管理</h2>
          <button class="btn btn-primary" onclick="showFaqModal()">+ 新增 FAQ</button>
        </div>
        <div class="faq-search">
          <input type="text" id="faq-search" placeholder="搜尋關鍵字或回覆內容..." oninput="filterFaqs()">
          <select id="faq-filter-cat" onchange="filterFaqs()"><option value="">全部分類</option></select>
          <select id="faq-filter-status" onchange="filterFaqs()"><option value="">全部狀態</option><option value="1">啟用</option><option value="0">停用</option></select>
        </div>
        <div class="faq-cards" id="faq-list"></div>
      </div>
    </div>

    <!-- ===== 測試回覆 ===== -->
    <div class="page" id="page-test">
      <div class="info-box"><strong>測試回覆</strong>：模擬使用者傳送訊息，預覽機器人會如何回覆。<strong>不會真的發送任何訊息</strong>。可用來測試 FAQ 關鍵字是否正確命中，或預覽 AI 生成的回覆內容。</div>
      <div class="section">
        <h2 style="margin-bottom:16px;">測試回覆</h2>
        <div class="test-area">
          <input type="text" id="test-input" placeholder="輸入測試訊息，例如：你們怎麼收費？" onkeydown="if(event.key==='Enter')testReply()">
          <button class="btn btn-primary" onclick="testReply()">測試</button>
        </div>
        <div class="test-result" id="test-result"><span style="color:#64748b;">輸入訊息後按「測試」，結果會顯示在這裡</span></div>
      </div>
    </div>

    <!-- ===== 訊息日誌 ===== -->
    <div class="page" id="page-logs">
      <div class="info-box"><strong>訊息日誌</strong>：所有收到的訊息與機器人回覆的完整紀錄。可查看每則訊息來自哪個平台、回覆來源是 FAQ 還是 AI。</div>
      <div class="section">
        <h2>訊息日誌</h2>
        <table><thead><tr><th>時間</th><th>平台</th><th>類型</th><th>收到訊息</th><th>回覆</th><th>來源</th></tr></thead><tbody id="logs-table"></tbody></table>
        <div style="text-align:center;margin-top:16px;"><button class="btn btn-primary btn-sm" id="load-more-logs" onclick="loadMoreLogs()">載入更多</button></div>
      </div>
    </div>

    <!-- ===== 封鎖名單 ===== -->
    <div class="page" id="page-blocklist">
      <div class="info-box"><strong>封鎖名單</strong>：被封鎖的用戶將不會收到任何自動回覆。用戶 ID 可從「訊息日誌」中複製。</div>
      <div class="section">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h2 style="margin-bottom:0;">封鎖名單</h2>
          <button class="btn btn-primary" onclick="showAddBlock()">+ 新增封鎖</button>
        </div>
        <table><thead><tr><th>用戶 ID</th><th>原因</th><th>封鎖時間</th><th>操作</th></tr></thead><tbody id="block-table"></tbody></table>
      </div>
    </div>
  </div>
</div>

<!-- FAQ 新增/編輯 Modal -->
<div class="modal-overlay" id="faq-modal">
  <div class="modal">
    <h3 id="faq-modal-title">新增 FAQ</h3>
    <input type="hidden" id="faq-edit-id">

    <div class="form-group">
      <label>關鍵字</label>
      <div class="tag-input-wrap" id="kw-tags" onclick="document.getElementById('kw-input').focus()">
        <input type="text" id="kw-input" placeholder="輸入關鍵字後按 Enter">
      </div>
      <div class="hint">每個關鍵字獨立比對，訊息中包含任一關鍵字就會命中此 FAQ</div>
    </div>

    <div class="form-group">
      <label>回覆內容</label>
      <textarea id="faq-answer" rows="4" placeholder="機器人回覆內容...支援換行"></textarea>
    </div>

    <div style="display:flex;gap:12px;">
      <div class="form-group" style="flex:1;"><label>分類</label><input type="text" id="faq-category" placeholder="例如：價格、服務"><div class="hint">用於篩選，選填</div></div>
      <div class="form-group" style="width:100px;"><label>優先級</label><input type="number" id="faq-priority" value="5"><div class="hint">越大越先比對</div></div>
    </div>

    <div class="att-editor">
      <div class="att-editor-title">附件（選填）— 命中時隨回覆一起發送</div>
      <div id="att-list"></div>
      <button class="btn btn-ghost btn-sm" onclick="addAttRow()" style="margin-top:4px;">+ 新增附件</button>
    </div>

    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeFaqModal()">取消</button>
      <button class="btn btn-primary" onclick="saveFaq()">儲存</button>
    </div>
  </div>
</div>

<!-- Block Modal -->
<div class="modal-overlay" id="block-modal">
  <div class="modal">
    <h3>新增封鎖</h3>
    <div class="form-group"><label>用戶 ID</label><input type="text" id="block-sender-id" placeholder="從訊息日誌中複製用戶 ID"></div>
    <div class="form-group"><label>原因（選填）</label><input type="text" id="block-reason" placeholder="例如：騷擾、spam"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeBlockModal()">取消</button>
      <button class="btn btn-danger" onclick="saveBlock()">封鎖</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
const API = '/api/bot';
let logOffset = 0;
let allFaqs = [];

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ===== Auth =====
async function checkAuth() {
  const res = await fetch(API+'/me').then(r=>r.json());
  if (!res.loggedIn) return;
  if (!res.hasAccess) {
    document.getElementById('login-content').innerHTML='<p class="denied">您的帳號（'+esc(res.email)+'）沒有存取權限</p><p style="margin-top:8px;font-size:12px;color:#64748b;">僅限 @2him.net 網域</p><a href="/api/logout" class="login-btn" style="margin-top:16px;background:#475569;">登出</a>';
    return;
  }
  document.getElementById('login-page').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('user-email').textContent=res.email;
  loadStats(); loadSettings();
}
checkAuth();

// ===== Nav =====
document.querySelectorAll('.sidebar nav a').forEach(a=>{
  a.addEventListener('click',e=>{
    e.preventDefault();
    document.querySelectorAll('.sidebar nav a').forEach(x=>x.classList.remove('active'));
    a.classList.add('active');
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.getElementById('page-'+a.dataset.page).classList.add('active');
    if(a.dataset.page==='dashboard') loadStats();
    if(a.dataset.page==='faq') loadFaqs();
    if(a.dataset.page==='logs') { logOffset=0; loadLogs(); }
    if(a.dataset.page==='toggle') loadSettings();
    if(a.dataset.page==='blocklist') loadBlocklist();
  });
});

// ===== Stats =====
async function loadStats() {
  const res = await fetch(API+'/stats').then(r=>r.json());
  const d=res.data, el=id=>document.getElementById(id);
  el('stat-status').textContent=d.botEnabled?'運行中':'已暫停';
  el('stat-status').className='value '+(d.botEnabled?'on':'off');
  el('stat-faq').textContent=d.faqCount;
  el('stat-total').textContent=d.total;
  const h=Math.floor(d.uptime/3600),m=Math.floor((d.uptime%3600)/60);
  el('stat-uptime').textContent=h>0?h+'h '+m+'m':m+'m';
  el('stat-fb').textContent=d.byPlatform.facebook||0;
  el('stat-ig').textContent=d.byPlatform.instagram||0;
  el('stat-faq-reply').textContent=d.bySource.faq||0;
  el('stat-ai-reply').textContent=d.bySource.ai||0;
}

// ===== Settings =====
async function loadSettings() {
  const res=await fetch(API+'/settings').then(r=>r.json());
  document.querySelectorAll('[data-setting]').forEach(input=>{input.checked=res.data[input.dataset.setting]==='true';});
}
document.querySelectorAll('[data-setting]').forEach(input=>{
  input.addEventListener('change',async()=>{
    await fetch(API+'/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({[input.dataset.setting]:String(input.checked)})});
    toast(input.checked?'已開啟':'已關閉');
  });
});

// ===== FAQ =====
async function loadFaqs() {
  const res=await fetch(API+'/faq').then(r=>r.json());
  allFaqs=res.data;
  // 填充分類篩選
  const cats=[...new Set(allFaqs.map(f=>f.category).filter(Boolean))];
  const sel=document.getElementById('faq-filter-cat');
  const cur=sel.value;
  sel.innerHTML='<option value="">全部分類</option>'+cats.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('');
  sel.value=cur;
  renderFaqs();
}

function filterFaqs() { renderFaqs(); }

function renderFaqs() {
  const q=(document.getElementById('faq-search').value||'').toLowerCase();
  const cat=document.getElementById('faq-filter-cat').value;
  const status=document.getElementById('faq-filter-status').value;
  let list=allFaqs;
  if(q) list=list.filter(f=>(f.keywords+' '+f.answer).toLowerCase().includes(q));
  if(cat) list=list.filter(f=>f.category===cat);
  if(status!=='') list=list.filter(f=>String(f.enabled)===status);

  document.getElementById('faq-list').innerHTML=list.length===0
    ?'<div style="text-align:center;color:#64748b;padding:40px;">沒有符合條件的 FAQ</div>'
    :list.map(f=>{
      const kws=(f.keywords||'').split(',').filter(Boolean);
      let atts=[];
      try{atts=JSON.parse(f.attachments||'[]');}catch{}
      const attHtml=atts.length?'<div class="att-list">'+atts.map(a=>{
        const icon=a.type==='image'?'🖼️':a.type==='file'?'📄':'🔗';
        return '<span class="att-badge">'+icon+' '+esc(a.title||a.url).substring(0,30)+'</span>';
      }).join('')+'</div>':'';
      return '<div class="faq-card" data-id="'+f.id+'">'
        +'<div class="faq-card-header">'
          +'<div class="left">'
            +'<label class="switch" style="transform:scale(0.8);"><input type="checkbox" '+(f.enabled?'checked':'')+' onchange="toggleFaq(event,\\''+f.id+'\\',this.checked)"><span class="slider"></span></label>'
            +'<span class="faq-card-meta">'+(f.category?'<span class="badge badge-faq">'+esc(f.category)+'</span> ':'')+'優先級: '+f.priority+'</span>'
          +'</div>'
          +'<div style="display:flex;gap:6px;">'
            +'<button class="btn btn-sm btn-ghost" onclick="editFaq(\\''+f.id+'\\')">編輯</button>'
            +'<button class="btn btn-sm btn-danger" onclick="deleteFaq(\\''+f.id+'\\')">刪除</button>'
          +'</div>'
        +'</div>'
        +'<div class="faq-card-keywords">'+kws.map(k=>'<span class="kw-tag">'+esc(k.trim())+'</span>').join('')+'</div>'
        +'<div class="faq-card-answer" onclick="this.classList.toggle(\\'expanded\\')">'+esc(f.answer)+'</div>'
        +attHtml
      +'</div>';
    }).join('');
}

// ===== Tag Input =====
let faqKeywords=[];
function renderTags() {
  const wrap=document.getElementById('kw-tags');
  const input=document.getElementById('kw-input');
  wrap.querySelectorAll('.tag').forEach(t=>t.remove());
  faqKeywords.forEach((kw,i)=>{
    const span=document.createElement('span');
    span.className='tag';
    span.innerHTML=esc(kw)+'<span class="tag-x" onclick="removeTag('+i+')">&times;</span>';
    wrap.insertBefore(span,input);
  });
}
function removeTag(i) { faqKeywords.splice(i,1); renderTags(); }
document.getElementById('kw-input').addEventListener('keydown',e=>{
  if(e.key==='Enter'||e.key===','){
    e.preventDefault();
    const v=e.target.value.trim().replace(/,/g,'');
    if(v&&!faqKeywords.includes(v)){faqKeywords.push(v);e.target.value='';renderTags();}
  }
  if(e.key==='Backspace'&&!e.target.value&&faqKeywords.length){faqKeywords.pop();renderTags();}
});

// ===== Attachment Editor =====
let faqAttachments=[];
function renderAtts() {
  document.getElementById('att-list').innerHTML=faqAttachments.map((a,i)=>
    '<div class="att-item">'
      +'<select onchange="faqAttachments['+i+'].type=this.value">'
        +'<option value="link"'+(a.type==='link'?' selected':'')+'>🔗 連結</option>'
        +'<option value="image"'+(a.type==='image'?' selected':'')+'>🖼️ 圖片</option>'
        +'<option value="file"'+(a.type==='file'?' selected':'')+'>📄 檔案</option>'
      +'</select>'
      +'<input placeholder="標題（選填）" value="'+esc(a.title||'')+'" onchange="faqAttachments['+i+'].title=this.value">'
      +'<input placeholder="URL" value="'+esc(a.url||'')+'" onchange="faqAttachments['+i+'].url=this.value" style="flex:2;">'
      +'<span class="att-remove" onclick="faqAttachments.splice('+i+',1);renderAtts();">&times;</span>'
    +'</div>'
  ).join('');
}
function addAttRow() { faqAttachments.push({type:'link',url:'',title:''}); renderAtts(); }

// ===== FAQ Modal =====
function showFaqModal(id) {
  const isEdit=!!id;
  document.getElementById('faq-modal-title').textContent=isEdit?'編輯 FAQ':'新增 FAQ';
  document.getElementById('faq-edit-id').value=id||'';
  if(isEdit){
    const f=allFaqs.find(x=>x.id===id);if(!f)return;
    faqKeywords=(f.keywords||'').split(',').map(k=>k.trim()).filter(Boolean);
    document.getElementById('faq-answer').value=f.answer;
    document.getElementById('faq-category').value=f.category||'';
    document.getElementById('faq-priority').value=f.priority||0;
    try{faqAttachments=JSON.parse(f.attachments||'[]');}catch{faqAttachments=[];}
  } else {
    faqKeywords=[]; faqAttachments=[];
    document.getElementById('faq-answer').value='';
    document.getElementById('faq-category').value='';
    document.getElementById('faq-priority').value='5';
  }
  document.getElementById('kw-input').value='';
  renderTags(); renderAtts();
  document.getElementById('faq-modal').classList.add('show');
}
function editFaq(id){showFaqModal(id);}
function closeFaqModal(){document.getElementById('faq-modal').classList.remove('show');}

async function saveFaq() {
  if(!faqKeywords.length){alert('請至少輸入一個關鍵字');return;}
  const answer=document.getElementById('faq-answer').value.trim();
  if(!answer){alert('請輸入回覆內容');return;}
  const id=document.getElementById('faq-edit-id').value;
  const data={
    keywords:faqKeywords,
    answer,
    category:document.getElementById('faq-category').value.trim(),
    priority:parseInt(document.getElementById('faq-priority').value)||0,
    attachments:faqAttachments.filter(a=>a.url),
  };
  if(id) await fetch(API+'/faq/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  else await fetch(API+'/faq',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  closeFaqModal(); loadFaqs(); toast('FAQ 已儲存');
}
async function deleteFaq(id){if(!confirm('確定刪除這則 FAQ？'))return;await fetch(API+'/faq/'+id,{method:'DELETE'});loadFaqs();toast('已刪除');}
function toggleFaq(e,id,on){e.stopPropagation();fetch(API+'/faq/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:on?1:0})}).then(()=>toast(on?'已啟用':'已停用'));}

// ===== Test =====
async function testReply() {
  const msg=document.getElementById('test-input').value.trim();if(!msg)return;
  document.getElementById('test-result').innerHTML='<span style="color:#64748b;">思考中...</span>';
  const res=await fetch(API+'/test-reply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})}).then(r=>r.json());
  const bc=res.source==='faq'?'badge-faq':res.source==='ai'?'badge-ai':'badge-default';
  const lb=res.source==='faq'?'FAQ 命中':res.source==='ai'?'AI 生成':'預設回覆';
  let attHtml='';
  if(res.attachments&&res.attachments.length){
    attHtml='<div style="margin-top:10px;padding-top:10px;border-top:1px solid #334155;"><div style="font-size:12px;color:#64748b;margin-bottom:6px;">附件：</div>'
      +res.attachments.map(a=>{
        const icon=a.type==='image'?'🖼️':a.type==='file'?'📄':'🔗';
        return '<div style="font-size:13px;margin-bottom:4px;">'+icon+' '+(a.title?esc(a.title)+' — ':'')+esc(a.url)+'</div>';
      }).join('')+'</div>';
  }
  document.getElementById('test-result').innerHTML='<div style="margin-bottom:8px;"><span class="badge '+bc+'">'+lb+'</span> '+(res.faqId?'<span style="font-size:12px;color:#64748b;">('+esc(res.faqId)+')</span>':'')+'</div><div style="white-space:pre-wrap;">'+esc(res.reply)+'</div>'+attHtml;
}

// ===== Logs =====
async function loadLogs(append) {
  if(!append) logOffset=0;
  const res=await fetch(API+'/logs?limit=30&offset='+logOffset).then(r=>r.json());
  const html=res.data.map(l=>'<tr>'
    +'<td style="white-space:nowrap;font-size:12px;color:#64748b;">'+(l.createdAt||'')+'</td>'
    +'<td><span class="badge '+(l.platform==='facebook'?'badge-fb':'badge-ig')+'">'+(l.platform==='facebook'?'FB':'IG')+'</span></td>'
    +'<td style="font-size:13px;">'+esc(l.type)+'</td>'
    +'<td style="max-width:250px;font-size:13px;">'+esc((l.message||'').substring(0,80))+'</td>'
    +'<td style="max-width:250px;font-size:13px;color:#94a3b8;">'+esc((l.reply||'').substring(0,80))+'</td>'
    +'<td><span class="badge '+(l.replySource==='faq'?'badge-faq':l.replySource==='ai'?'badge-ai':'badge-default')+'">'+(l.replySource||'-')+'</span></td>'
    +'</tr>').join('');
  const tbody=document.getElementById('logs-table');
  if(append) tbody.innerHTML+=html; else tbody.innerHTML=html;
  logOffset+=res.data.length;
  document.getElementById('load-more-logs').style.display=res.data.length<30?'none':'';
}
function loadMoreLogs(){loadLogs(true);}

// ===== Blocklist =====
async function loadBlocklist() {
  const res=await fetch(API+'/blocklist').then(r=>r.json());
  document.getElementById('block-table').innerHTML=res.data.map(b=>'<tr><td style="font-family:monospace;font-size:13px;">'+esc(b.senderId)+'</td><td>'+esc(b.reason||'-')+'</td><td style="font-size:12px;color:#64748b;">'+(b.createdAt||'')+'</td><td><button class="btn btn-sm btn-danger" onclick="removeBlock(\\''+esc(b.senderId)+'\\')">解除</button></td></tr>').join('')
    ||'<tr><td colspan="4" style="text-align:center;color:#64748b;">目前沒有封鎖的用戶</td></tr>';
}
function showAddBlock(){document.getElementById('block-sender-id').value='';document.getElementById('block-reason').value='';document.getElementById('block-modal').classList.add('show');}
function closeBlockModal(){document.getElementById('block-modal').classList.remove('show');}
async function saveBlock(){
  const sid=document.getElementById('block-sender-id').value.trim();if(!sid)return;
  await fetch(API+'/blocklist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sender_id:sid,reason:document.getElementById('block-reason').value})});
  closeBlockModal();loadBlocklist();toast('已封鎖');
}
async function removeBlock(id){if(!confirm('確定解除封鎖？'))return;await fetch(API+'/blocklist/'+encodeURIComponent(id),{method:'DELETE'});loadBlocklist();toast('已解除');}
</script>
</body>
</html>`;
