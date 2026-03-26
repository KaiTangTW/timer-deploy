/**
 * FB/IG 自動回覆機器人 — 主程式
 *
 * 功能：
 * - 自動回覆 Facebook 粉專留言
 * - 自動回覆 Messenger 私訊
 * - 自動回覆 Instagram 留言
 * - 自動回覆 Instagram DM
 * - FAQ 優先匹配 + Claude AI 智慧回覆
 * - 管理後台 API（新增/編輯/刪除 FAQ）
 */

import express from "express";
import { config } from "./config.js";
import { webhookRouter } from "./webhook.js";
import { adminRouter } from "./admin.js";

const app = express();

// 解析 JSON body
app.use(express.json());

// 首頁 — 顯示機器人狀態
app.get("/", (_req, res) => {
  res.json({
    name: `${config.brandName} 自動回覆機器人`,
    status: "✅ 運行中",
    endpoints: {
      webhook: "GET/POST /webhook",
      faq: "GET/POST/PUT/DELETE /api/faq",
      testReply: "POST /api/test-reply",
      status: "GET /api/status",
    },
  });
});

// Webhook 路由（接收 Meta 事件）
app.use(webhookRouter);

// 管理後台 API
app.use(adminRouter);

// 啟動伺服器
app.listen(config.port, () => {
  console.log("╔══════════════════════════════════════════╗");
  console.log(`║  ${config.brandName} 自動回覆機器人已啟動！`);
  console.log(`║  🌐 http://localhost:${config.port}`);
  console.log(`║  📡 Webhook: http://localhost:${config.port}/webhook`);
  console.log(`║  🎛️  管理後台: http://localhost:${config.port}/admin`);
  console.log(`║  🧪 測試: POST http://localhost:${config.port}/api/test-reply`);
  console.log("╚══════════════════════════════════════════╝");

  if (!config.pageAccessToken) {
    console.warn("\n⚠️  尚未設定 META_PAGE_ACCESS_TOKEN，請在 .env 中設定");
  }
  if (!config.anthropicApiKey) {
    console.warn("⚠️  尚未設定 ANTHROPIC_API_KEY，AI 回覆將使用預設文字");
  }
});
