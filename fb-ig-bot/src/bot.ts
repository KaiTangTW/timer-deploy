/**
 * 機器人核心邏輯
 * FAQ 優先 → 找不到則用 AI 生成回覆
 * 支援開關控制、封鎖名單、訊息日誌
 */

import { faqDb, settingsDb, logDb, blocklistDb } from "./database.js";
import { generateAIReply } from "./ai.js";
import {
  replyToComment,
  sendMessengerMessage,
  replyToIGComment,
  sendIGMessage,
} from "./meta-api.js";

// 記錄已回覆的 ID，避免重複回覆
const repliedSet = new Set<string>();
const MAX_REPLIED_CACHE = 10000;

function markReplied(id: string) {
  repliedSet.add(id);
  if (repliedSet.size > MAX_REPLIED_CACHE) {
    const first = repliedSet.values().next().value;
    if (first) repliedSet.delete(first);
  }
}

function alreadyReplied(id: string): boolean {
  return repliedSet.has(id);
}

/** 檢查機器人是否啟用 */
function isBotEnabled(channel: string): boolean {
  // 總開關
  if (!settingsDb.isEnabled("bot_enabled")) return false;

  // 各頻道開關
  switch (channel) {
    case "messenger":
      return settingsDb.isEnabled("bot_messenger_enabled");
    case "fb_comment":
      return settingsDb.isEnabled("bot_comment_enabled");
    case "ig_dm":
      return settingsDb.isEnabled("bot_ig_dm_enabled");
    case "ig_comment":
      return settingsDb.isEnabled("bot_ig_comment_enabled");
    default:
      return true;
  }
}

/** 生成回覆內容（FAQ 優先，AI fallback） */
async function getReply(
  message: string,
  context?: { isComment?: boolean; postContent?: string }
): Promise<{ reply: string; source: string }> {
  // 1. 先查 FAQ（用資料庫）
  const faqMatch = faqDb.match(message);
  if (faqMatch) {
    console.log(`[Bot] FAQ 命中: ${faqMatch.id}`);
    return { reply: faqMatch.answer, source: "faq" };
  }

  // 2. 檢查 AI 是否啟用
  if (!settingsDb.isEnabled("ai_enabled")) {
    return {
      reply: "感謝您的訊息！我們的團隊會盡快回覆您 😊",
      source: "default",
    };
  }

  // 3. AI 生成
  console.log(`[Bot] FAQ 未命中，使用 AI 生成回覆`);
  const reply = await generateAIReply(message, context);
  return { reply, source: "ai" };
}

/** 處理 Facebook 貼文留言 */
export async function handleFBComment(event: {
  commentId: string;
  message: string;
  senderId: string;
  postId?: string;
}) {
  const { commentId, message, senderId } = event;

  if (alreadyReplied(commentId)) return;
  if (!isBotEnabled("fb_comment")) {
    console.log(`[Bot] FB 留言回覆已關閉，跳過`);
    return;
  }
  if (blocklistDb.isBlocked(senderId)) {
    console.log(`[Bot] 用戶 ${senderId} 已封鎖，跳過`);
    return;
  }
  if (message.trim().length < 2) return;

  const { reply, source } = await getReply(message, { isComment: true });
  await replyToComment(commentId, reply);
  markReplied(commentId);

  logDb.add({
    platform: "facebook",
    type: "comment",
    sender_id: senderId,
    message,
    reply,
    reply_source: source,
  });

  console.log(`[Bot] ✅ 已回覆 FB 留言 ${commentId} (${source})`);
}

/** 處理 Facebook Messenger 私訊 */
export async function handleMessengerMessage(event: {
  senderId: string;
  messageId: string;
  message: string;
}) {
  const { senderId, messageId, message } = event;

  if (alreadyReplied(messageId)) return;
  if (!isBotEnabled("messenger")) {
    console.log(`[Bot] Messenger 回覆已關閉，跳過`);
    return;
  }
  if (blocklistDb.isBlocked(senderId)) {
    console.log(`[Bot] 用戶 ${senderId} 已封鎖，跳過`);
    return;
  }

  const { reply, source } = await getReply(message, { isComment: false });
  await sendMessengerMessage(senderId, reply);
  markReplied(messageId);

  logDb.add({
    platform: "facebook",
    type: "messenger",
    sender_id: senderId,
    message,
    reply,
    reply_source: source,
  });

  console.log(`[Bot] ✅ 已回覆 Messenger 私訊 ${messageId} (${source})`);
}

/** 處理 Instagram 留言 */
export async function handleIGComment(event: {
  commentId: string;
  message: string;
  senderId: string;
}) {
  const { commentId, message, senderId } = event;

  if (alreadyReplied(commentId)) return;
  if (!isBotEnabled("ig_comment")) {
    console.log(`[Bot] IG 留言回覆已關閉，跳過`);
    return;
  }
  if (blocklistDb.isBlocked(senderId)) return;
  if (message.trim().length < 2) return;

  const { reply, source } = await getReply(message, { isComment: true });
  await replyToIGComment(commentId, reply);
  markReplied(commentId);

  logDb.add({
    platform: "instagram",
    type: "comment",
    sender_id: senderId,
    message,
    reply,
    reply_source: source,
  });

  console.log(`[Bot] ✅ 已回覆 IG 留言 ${commentId} (${source})`);
}

/** 處理 Instagram DM */
export async function handleIGDirectMessage(event: {
  senderId: string;
  messageId: string;
  message: string;
}) {
  const { senderId, messageId, message } = event;

  if (alreadyReplied(messageId)) return;
  if (!isBotEnabled("ig_dm")) {
    console.log(`[Bot] IG DM 回覆已關閉，跳過`);
    return;
  }
  if (blocklistDb.isBlocked(senderId)) return;

  const { reply, source } = await getReply(message, { isComment: false });
  await sendIGMessage(senderId, reply);
  markReplied(messageId);

  logDb.add({
    platform: "instagram",
    type: "dm",
    sender_id: senderId,
    message,
    reply,
    reply_source: source,
  });

  console.log(`[Bot] ✅ 已回覆 IG DM ${messageId} (${source})`);
}
