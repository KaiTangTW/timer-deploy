/**
 * 管理後台 API + 網頁介面
 */

import { Router, Request, Response } from "express";
import { faqDb, settingsDb, logDb, blocklistDb } from "./database.js";

export const adminRouter = Router();

// ========== 管理後台網頁 ==========

adminRouter.get("/admin", (_req: Request, res: Response) => {
  res.send(ADMIN_HTML);
});

// ========== 設定 API ==========

adminRouter.get("/api/settings", (_req: Request, res: Response) => {
  res.json({ success: true, data: settingsDb.getAll() });
});

adminRouter.put("/api/settings", (req: Request, res: Response) => {
  const updates = req.body;
  for (const [key, value] of Object.entries(updates)) {
    settingsDb.set(key, String(value));
  }
  res.json({ success: true, data: settingsDb.getAll() });
});

// ========== FAQ API ==========

adminRouter.get("/api/faq", (_req: Request, res: Response) => {
  res.json({ success: true, data: faqDb.getAll() });
});

adminRouter.post("/api/faq", (req: Request, res: Response) => {
  const { keywords, answer, category, priority } = req.body;
  if (!keywords || !answer) {
    res.status(400).json({ success: false, error: "keywords 和 answer 為必填" });
    return;
  }
  const kw = Array.isArray(keywords) ? keywords.join(",") : keywords;
  const entry = faqDb.add({ keywords: kw, answer, category, priority: priority ?? 0 });
  res.json({ success: true, data: entry });
});

adminRouter.put("/api/faq/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  if (updates.keywords && Array.isArray(updates.keywords)) {
    updates.keywords = updates.keywords.join(",");
  }
  const updated = faqDb.update(id, updates);
  if (!updated) {
    res.status(404).json({ success: false, error: "找不到該 FAQ" });
    return;
  }
  res.json({ success: true, data: updated });
});

adminRouter.delete("/api/faq/:id", (req: Request, res: Response) => {
  const deleted = faqDb.delete(req.params.id);
  if (!deleted) {
    res.status(404).json({ success: false, error: "找不到該 FAQ" });
    return;
  }
  res.json({ success: true });
});

// ========== 測試回覆 ==========

adminRouter.post("/api/test-reply", async (req: Request, res: Response) => {
  const { message, isComment } = req.body;
  if (!message) {
    res.status(400).json({ success: false, error: "message 為必填" });
    return;
  }

  const faqMatch = faqDb.match(message);
  if (faqMatch) {
    res.json({ success: true, source: "faq", faqId: faqMatch.id, reply: faqMatch.answer });
    return;
  }

  if (!settingsDb.isEnabled("ai_enabled")) {
    res.json({ success: true, source: "default", reply: "感謝您的訊息！我們的團隊會盡快回覆您 😊" });
    return;
  }

  const { generateAIReply } = await import("./ai.js");
  const aiReply = await generateAIReply(message, { isComment: !!isComment });
  res.json({ success: true, source: "ai", reply: aiReply });
});

// ========== 訊息日誌 API ==========

adminRouter.get("/api/logs", (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  res.json({
    success: true,
    data: logDb.getRecent(limit, offset),
    total: logDb.getCount(),
  });
});

adminRouter.get("/api/stats", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      ...logDb.getStats(),
      faqCount: faqDb.getAll().length,
      uptime: process.uptime(),
      botEnabled: settingsDb.isEnabled("bot_enabled"),
    },
  });
});

// ========== 封鎖名單 API ==========

adminRouter.get("/api/blocklist", (_req: Request, res: Response) => {
  res.json({ success: true, data: blocklistDb.getAll() });
});

adminRouter.post("/api/blocklist", (req: Request, res: Response) => {
  const { sender_id, reason } = req.body;
  if (!sender_id) {
    res.status(400).json({ success: false, error: "sender_id 為必填" });
    return;
  }
  blocklistDb.add(sender_id, reason || "");
  res.json({ success: true });
});

adminRouter.delete("/api/blocklist/:id", (req: Request, res: Response) => {
  blocklistDb.remove(req.params.id);
  res.json({ success: true });
});

// ========== 管理後台 HTML ==========

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>凱爺機器人管理後台</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, "Noto Sans TC", sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }

/* 側邊欄 */
.sidebar { position: fixed; left: 0; top: 0; width: 220px; height: 100vh; background: #1e293b; border-right: 1px solid #334155; padding: 20px 0; z-index: 10; }
.sidebar h1 { font-size: 18px; padding: 0 20px 20px; border-bottom: 1px solid #334155; color: #f8fafc; }
.sidebar nav { padding: 10px 0; }
.sidebar a { display: block; padding: 12px 20px; color: #94a3b8; text-decoration: none; font-size: 14px; transition: all 0.2s; }
.sidebar a:hover, .sidebar a.active { background: #334155; color: #f8fafc; }
.sidebar a span { margin-right: 8px; }

/* 主內容 */
.main { margin-left: 220px; padding: 30px; }

/* 統計卡片 */
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 30px; }
.stat-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; }
.stat-card .label { font-size: 13px; color: #94a3b8; margin-bottom: 4px; }
.stat-card .value { font-size: 28px; font-weight: 700; color: #f8fafc; }
.stat-card .value.on { color: #4ade80; }
.stat-card .value.off { color: #f87171; }

/* 區塊 */
.section { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
.section h2 { font-size: 18px; margin-bottom: 16px; color: #f8fafc; }

/* 開關 */
.toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #334155; }
.toggle-row:last-child { border-bottom: none; }
.toggle-row .label { font-size: 14px; }
.toggle-row .desc { font-size: 12px; color: #64748b; margin-top: 2px; }
.switch { position: relative; width: 48px; height: 26px; cursor: pointer; }
.switch input { display: none; }
.switch .slider { position: absolute; inset: 0; background: #475569; border-radius: 26px; transition: 0.3s; }
.switch .slider:before { content: ""; position: absolute; width: 20px; height: 20px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s; }
.switch input:checked + .slider { background: #4ade80; }
.switch input:checked + .slider:before { transform: translateX(22px); }

/* 表格 */
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th { text-align: left; padding: 10px 12px; color: #94a3b8; font-weight: 500; border-bottom: 1px solid #334155; font-size: 12px; text-transform: uppercase; }
td { padding: 10px 12px; border-bottom: 1px solid #1e293b; }
tr:hover td { background: #334155; }

/* 按鈕 */
.btn { padding: 8px 16px; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; transition: 0.2s; }
.btn-primary { background: #3b82f6; color: white; }
.btn-primary:hover { background: #2563eb; }
.btn-danger { background: #ef4444; color: white; }
.btn-danger:hover { background: #dc2626; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.btn-success { background: #22c55e; color: white; }

/* 表單 */
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 6px; }
.form-group input, .form-group textarea, .form-group select {
  width: 100%; padding: 10px 12px; background: #0f172a; border: 1px solid #334155;
  border-radius: 8px; color: #e2e8f0; font-size: 14px; font-family: inherit;
}
.form-group textarea { min-height: 80px; resize: vertical; }

/* 對話框 */
.modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; align-items: center; justify-content: center; }
.modal-overlay.show { display: flex; }
.modal { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 28px; width: 90%; max-width: 500px; }
.modal h3 { margin-bottom: 20px; font-size: 18px; }
.modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }

/* 標籤 */
.badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.badge-faq { background: #3b82f620; color: #60a5fa; }
.badge-ai { background: #a855f720; color: #c084fc; }
.badge-default { background: #64748b20; color: #94a3b8; }
.badge-fb { background: #1877f220; color: #60a5fa; }
.badge-ig { background: #e1306c20; color: #f472b6; }

/* 測試區 */
.test-area { display: flex; gap: 10px; margin-bottom: 16px; }
.test-area input { flex: 1; }
.test-result { background: #0f172a; border-radius: 8px; padding: 16px; min-height: 60px; }
.test-result .source { margin-bottom: 8px; }

/* 頁面切換 */
.page { display: none; }
.page.active { display: block; }

/* 回應式 */
@media (max-width: 768px) {
  .sidebar { width: 60px; }
  .sidebar h1, .sidebar a span.text { display: none; }
  .main { margin-left: 60px; }
}
</style>
</head>
<body>

<div class="sidebar">
  <h1>KaiBot</h1>
  <nav>
    <a href="#" class="active" data-page="dashboard"><span>📊</span> <span class="text">儀表板</span></a>
    <a href="#" data-page="toggle"><span>🔌</span> <span class="text">開關控制</span></a>
    <a href="#" data-page="faq"><span>📋</span> <span class="text">FAQ 管理</span></a>
    <a href="#" data-page="test"><span>🧪</span> <span class="text">測試回覆</span></a>
    <a href="#" data-page="logs"><span>📜</span> <span class="text">訊息日誌</span></a>
    <a href="#" data-page="blocklist"><span>🚫</span> <span class="text">封鎖名單</span></a>
  </nav>
</div>

<div class="main">

  <!-- 儀表板 -->
  <div class="page active" id="page-dashboard">
    <h2 style="margin-bottom:20px;">儀表板</h2>
    <div class="stats">
      <div class="stat-card">
        <div class="label">機器人狀態</div>
        <div class="value" id="stat-status">載入中...</div>
      </div>
      <div class="stat-card">
        <div class="label">FAQ 數量</div>
        <div class="value" id="stat-faq">-</div>
      </div>
      <div class="stat-card">
        <div class="label">已處理訊息</div>
        <div class="value" id="stat-total">-</div>
      </div>
      <div class="stat-card">
        <div class="label">運行時間</div>
        <div class="value" id="stat-uptime">-</div>
      </div>
    </div>
    <div class="stats">
      <div class="stat-card">
        <div class="label">Facebook 訊息</div>
        <div class="value" id="stat-fb">0</div>
      </div>
      <div class="stat-card">
        <div class="label">Instagram 訊息</div>
        <div class="value" id="stat-ig">0</div>
      </div>
      <div class="stat-card">
        <div class="label">FAQ 回覆</div>
        <div class="value" id="stat-faq-reply">0</div>
      </div>
      <div class="stat-card">
        <div class="label">AI 回覆</div>
        <div class="value" id="stat-ai-reply">0</div>
      </div>
    </div>
  </div>

  <!-- 開關控制 -->
  <div class="page" id="page-toggle">
    <div class="section">
      <h2>機器人開關</h2>
      <div class="toggle-row">
        <div><div class="label">總開關</div><div class="desc">關閉後所有自動回覆停止</div></div>
        <label class="switch"><input type="checkbox" data-setting="bot_enabled"><span class="slider"></span></label>
      </div>
      <div class="toggle-row">
        <div><div class="label">Messenger 私訊</div><div class="desc">Facebook 私訊自動回覆</div></div>
        <label class="switch"><input type="checkbox" data-setting="bot_messenger_enabled"><span class="slider"></span></label>
      </div>
      <div class="toggle-row">
        <div><div class="label">FB 留言</div><div class="desc">Facebook 貼文留言自動回覆</div></div>
        <label class="switch"><input type="checkbox" data-setting="bot_comment_enabled"><span class="slider"></span></label>
      </div>
      <div class="toggle-row">
        <div><div class="label">IG 私訊</div><div class="desc">Instagram DM 自動回覆</div></div>
        <label class="switch"><input type="checkbox" data-setting="bot_ig_dm_enabled"><span class="slider"></span></label>
      </div>
      <div class="toggle-row">
        <div><div class="label">IG 留言</div><div class="desc">Instagram 貼文留言自動回覆</div></div>
        <label class="switch"><input type="checkbox" data-setting="bot_ig_comment_enabled"><span class="slider"></span></label>
      </div>
    </div>
    <div class="section">
      <h2>AI 設定</h2>
      <div class="toggle-row">
        <div><div class="label">AI 回覆</div><div class="desc">FAQ 沒命中時用 AI 自動生成回覆（關閉後會回覆預設文字）</div></div>
        <label class="switch"><input type="checkbox" data-setting="ai_enabled"><span class="slider"></span></label>
      </div>
    </div>
  </div>

  <!-- FAQ 管理 -->
  <div class="page" id="page-faq">
    <div class="section">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h2>FAQ 管理</h2>
        <button class="btn btn-primary" onclick="showAddFaq()">+ 新增 FAQ</button>
      </div>
      <table>
        <thead>
          <tr><th>狀態</th><th>分類</th><th>關鍵字</th><th>回覆內容</th><th>優先級</th><th>操作</th></tr>
        </thead>
        <tbody id="faq-table"></tbody>
      </table>
    </div>
  </div>

  <!-- 測試回覆 -->
  <div class="page" id="page-test">
    <div class="section">
      <h2>測試回覆</h2>
      <p style="color:#94a3b8; font-size:13px; margin-bottom:16px;">輸入訊息模擬客戶提問，查看機器人會怎麼回覆（不會實際發送）</p>
      <div class="test-area">
        <input type="text" id="test-input" placeholder="輸入測試訊息..." onkeydown="if(event.key==='Enter')testReply()">
        <button class="btn btn-primary" onclick="testReply()">測試</button>
      </div>
      <div class="test-result" id="test-result">
        <span style="color:#64748b;">結果會顯示在這裡...</span>
      </div>
    </div>
  </div>

  <!-- 訊息日誌 -->
  <div class="page" id="page-logs">
    <div class="section">
      <h2>訊息日誌</h2>
      <table>
        <thead>
          <tr><th>時間</th><th>平台</th><th>類型</th><th>收到訊息</th><th>回覆內容</th><th>來源</th></tr>
        </thead>
        <tbody id="logs-table"></tbody>
      </table>
      <div style="text-align:center; margin-top:16px;">
        <button class="btn btn-primary btn-sm" id="load-more-logs" onclick="loadMoreLogs()">載入更多</button>
      </div>
    </div>
  </div>

  <!-- 封鎖名單 -->
  <div class="page" id="page-blocklist">
    <div class="section">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h2>封鎖名單</h2>
        <button class="btn btn-primary" onclick="showAddBlock()">+ 新增封鎖</button>
      </div>
      <table>
        <thead>
          <tr><th>用戶 ID</th><th>原因</th><th>封鎖時間</th><th>操作</th></tr>
        </thead>
        <tbody id="block-table"></tbody>
      </table>
    </div>
  </div>

</div>

<!-- FAQ 新增/編輯對話框 -->
<div class="modal-overlay" id="faq-modal">
  <div class="modal">
    <h3 id="faq-modal-title">新增 FAQ</h3>
    <input type="hidden" id="faq-edit-id">
    <div class="form-group">
      <label>關鍵字（逗號分隔）</label>
      <input type="text" id="faq-keywords" placeholder="價格,多少錢,費用">
    </div>
    <div class="form-group">
      <label>回覆內容</label>
      <textarea id="faq-answer" placeholder="輸入機器人回覆的內容..."></textarea>
    </div>
    <div style="display:flex; gap:12px;">
      <div class="form-group" style="flex:1;">
        <label>分類</label>
        <input type="text" id="faq-category" placeholder="價格">
      </div>
      <div class="form-group" style="flex:1;">
        <label>優先級（數字越大越優先）</label>
        <input type="number" id="faq-priority" value="5">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn" style="background:#475569;color:white;" onclick="closeFaqModal()">取消</button>
      <button class="btn btn-primary" onclick="saveFaq()">儲存</button>
    </div>
  </div>
</div>

<!-- 封鎖新增對話框 -->
<div class="modal-overlay" id="block-modal">
  <div class="modal">
    <h3>新增封鎖</h3>
    <div class="form-group">
      <label>用戶 ID（Sender ID）</label>
      <input type="text" id="block-sender-id" placeholder="從訊息日誌複製">
    </div>
    <div class="form-group">
      <label>原因（選填）</label>
      <input type="text" id="block-reason" placeholder="騷擾、spam...">
    </div>
    <div class="modal-actions">
      <button class="btn" style="background:#475569;color:white;" onclick="closeBlockModal()">取消</button>
      <button class="btn btn-danger" onclick="saveBlock()">封鎖</button>
    </div>
  </div>
</div>

<script>
const API = '';
let logOffset = 0;

// ========== 頁面切換 ==========
document.querySelectorAll('.sidebar a').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.sidebar a').forEach(x => x.classList.remove('active'));
    a.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + a.dataset.page).classList.add('active');
    if (a.dataset.page === 'dashboard') loadStats();
    if (a.dataset.page === 'faq') loadFaqs();
    if (a.dataset.page === 'logs') { logOffset = 0; loadLogs(); }
    if (a.dataset.page === 'toggle') loadSettings();
    if (a.dataset.page === 'blocklist') loadBlocklist();
  });
});

// ========== 統計 ==========
async function loadStats() {
  const res = await fetch(API + '/api/stats').then(r => r.json());
  const d = res.data;
  const el = id => document.getElementById(id);
  el('stat-status').textContent = d.botEnabled ? '運行中' : '已暫停';
  el('stat-status').className = 'value ' + (d.botEnabled ? 'on' : 'off');
  el('stat-faq').textContent = d.faqCount;
  el('stat-total').textContent = d.total;
  el('stat-uptime').textContent = formatUptime(d.uptime);
  el('stat-fb').textContent = (d.byPlatform.facebook || 0);
  el('stat-ig').textContent = (d.byPlatform.instagram || 0);
  el('stat-faq-reply').textContent = (d.bySource.faq || 0);
  el('stat-ai-reply').textContent = (d.bySource.ai || 0);
}
function formatUptime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
}

// ========== 設定/開關 ==========
async function loadSettings() {
  const res = await fetch(API + '/api/settings').then(r => r.json());
  document.querySelectorAll('[data-setting]').forEach(input => {
    input.checked = res.data[input.dataset.setting] === 'true';
  });
}
document.querySelectorAll('[data-setting]').forEach(input => {
  input.addEventListener('change', async () => {
    await fetch(API + '/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [input.dataset.setting]: String(input.checked) })
    });
  });
});

// ========== FAQ ==========
async function loadFaqs() {
  const res = await fetch(API + '/api/faq').then(r => r.json());
  const tbody = document.getElementById('faq-table');
  tbody.innerHTML = res.data.map(f => \`
    <tr>
      <td><label class="switch" style="transform:scale(0.8);">
        <input type="checkbox" \${f.enabled ? 'checked' : ''} onchange="toggleFaq('\${f.id}', this.checked)">
        <span class="slider"></span>
      </label></td>
      <td>\${f.category || '-'}</td>
      <td style="max-width:200px;">\${f.keywords.split(',').map(k => '<code style="background:#334155;padding:2px 6px;border-radius:4px;font-size:12px;margin:1px;">'+k.trim()+'</code>').join(' ')}</td>
      <td style="max-width:300px;font-size:13px;color:#94a3b8;">\${f.answer.substring(0, 80)}\${f.answer.length > 80 ? '...' : ''}</td>
      <td>\${f.priority}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="editFaq('\${f.id}')">編輯</button>
        <button class="btn btn-sm btn-danger" onclick="deleteFaq('\${f.id}')">刪除</button>
      </td>
    </tr>
  \`).join('');
}
let allFaqs = [];
async function editFaq(id) {
  const res = await fetch(API + '/api/faq').then(r => r.json());
  const faq = res.data.find(f => f.id === id);
  if (!faq) return;
  document.getElementById('faq-modal-title').textContent = '編輯 FAQ';
  document.getElementById('faq-edit-id').value = id;
  document.getElementById('faq-keywords').value = faq.keywords;
  document.getElementById('faq-answer').value = faq.answer;
  document.getElementById('faq-category').value = faq.category;
  document.getElementById('faq-priority').value = faq.priority;
  document.getElementById('faq-modal').classList.add('show');
}
function showAddFaq() {
  document.getElementById('faq-modal-title').textContent = '新增 FAQ';
  document.getElementById('faq-edit-id').value = '';
  document.getElementById('faq-keywords').value = '';
  document.getElementById('faq-answer').value = '';
  document.getElementById('faq-category').value = '';
  document.getElementById('faq-priority').value = '5';
  document.getElementById('faq-modal').classList.add('show');
}
function closeFaqModal() { document.getElementById('faq-modal').classList.remove('show'); }
async function saveFaq() {
  const id = document.getElementById('faq-edit-id').value;
  const data = {
    keywords: document.getElementById('faq-keywords').value,
    answer: document.getElementById('faq-answer').value,
    category: document.getElementById('faq-category').value,
    priority: parseInt(document.getElementById('faq-priority').value) || 0,
  };
  if (id) {
    await fetch(API + '/api/faq/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  } else {
    await fetch(API + '/api/faq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  }
  closeFaqModal();
  loadFaqs();
}
async function deleteFaq(id) {
  if (!confirm('確定要刪除這筆 FAQ？')) return;
  await fetch(API + '/api/faq/' + id, { method: 'DELETE' });
  loadFaqs();
}
async function toggleFaq(id, enabled) {
  await fetch(API + '/api/faq/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: enabled ? 1 : 0 }) });
}

// ========== 測試 ==========
async function testReply() {
  const input = document.getElementById('test-input');
  const msg = input.value.trim();
  if (!msg) return;
  document.getElementById('test-result').innerHTML = '<span style="color:#64748b;">AI 思考中...</span>';
  const res = await fetch(API + '/api/test-reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) }).then(r => r.json());
  const badgeClass = res.source === 'faq' ? 'badge-faq' : res.source === 'ai' ? 'badge-ai' : 'badge-default';
  const label = res.source === 'faq' ? 'FAQ' : res.source === 'ai' ? 'AI' : '預設';
  document.getElementById('test-result').innerHTML = \`
    <div class="source"><span class="badge \${badgeClass}">\${label}</span> \${res.faqId ? '(' + res.faqId + ')' : ''}</div>
    <div style="white-space:pre-wrap;">\${res.reply}</div>
  \`;
}

// ========== 日誌 ==========
async function loadLogs(append) {
  if (!append) { logOffset = 0; }
  const res = await fetch(API + '/api/logs?limit=30&offset=' + logOffset).then(r => r.json());
  const tbody = document.getElementById('logs-table');
  const html = res.data.map(l => \`
    <tr>
      <td style="white-space:nowrap;font-size:12px;color:#64748b;">\${l.created_at}</td>
      <td><span class="badge \${l.platform === 'facebook' ? 'badge-fb' : 'badge-ig'}">\${l.platform === 'facebook' ? 'FB' : 'IG'}</span></td>
      <td style="font-size:13px;">\${l.type}</td>
      <td style="max-width:250px;font-size:13px;">\${(l.message||'').substring(0,60)}</td>
      <td style="max-width:250px;font-size:13px;color:#94a3b8;">\${(l.reply||'').substring(0,60)}</td>
      <td><span class="badge \${l.reply_source === 'faq' ? 'badge-faq' : l.reply_source === 'ai' ? 'badge-ai' : 'badge-default'}">\${l.reply_source || '-'}</span></td>
    </tr>
  \`).join('');
  if (append) { tbody.innerHTML += html; } else { tbody.innerHTML = html; }
  logOffset += res.data.length;
  document.getElementById('load-more-logs').style.display = res.data.length < 30 ? 'none' : '';
}
function loadMoreLogs() { loadLogs(true); }

// ========== 封鎖名單 ==========
async function loadBlocklist() {
  const res = await fetch(API + '/api/blocklist').then(r => r.json());
  document.getElementById('block-table').innerHTML = res.data.map(b => \`
    <tr>
      <td style="font-family:monospace;font-size:13px;">\${b.sender_id}</td>
      <td>\${b.reason || '-'}</td>
      <td style="font-size:12px;color:#64748b;">\${b.created_at}</td>
      <td><button class="btn btn-sm btn-danger" onclick="removeBlock('\${b.sender_id}')">解除</button></td>
    </tr>
  \`).join('') || '<tr><td colspan="4" style="text-align:center;color:#64748b;">目前沒有封鎖的用戶</td></tr>';
}
function showAddBlock() { document.getElementById('block-modal').classList.add('show'); }
function closeBlockModal() { document.getElementById('block-modal').classList.remove('show'); }
async function saveBlock() {
  const sid = document.getElementById('block-sender-id').value.trim();
  if (!sid) return;
  await fetch(API + '/api/blocklist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender_id: sid, reason: document.getElementById('block-reason').value }) });
  closeBlockModal();
  loadBlocklist();
}
async function removeBlock(id) {
  if (!confirm('確定解除封鎖？')) return;
  await fetch(API + '/api/blocklist/' + encodeURIComponent(id), { method: 'DELETE' });
  loadBlocklist();
}

// ========== 初始載入 ==========
loadStats();
loadSettings();
</script>
</body>
</html>`;
