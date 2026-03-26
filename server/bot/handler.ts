/**
 * 機器人核心邏輯
 */

import { faqOps, settingsOps, logOps, blocklistOps } from "./db";
import { generateAIReply } from "./ai";
import {
  replyToComment,
  sendMessengerMessage,
  replyToIGComment,
  sendIGMessage,
} from "./meta-api";

// 已回覆快取
const repliedSet = new Set<string>();
const MAX_CACHE = 10000;

function markReplied(id: string) {
  repliedSet.add(id);
  if (repliedSet.size > MAX_CACHE) {
    const first = repliedSet.values().next().value;
    if (first) repliedSet.delete(first);
  }
}

async function isBotEnabled(channel: string): Promise<boolean> {
  if (!(await settingsOps.isEnabled("bot_enabled"))) return false;
  const map: Record<string, string> = {
    messenger: "bot_messenger_enabled",
    fb_comment: "bot_comment_enabled",
    ig_dm: "bot_ig_dm_enabled",
    ig_comment: "bot_ig_comment_enabled",
  };
  return map[channel] ? settingsOps.isEnabled(map[channel]) : true;
}

async function getReply(message: string, context?: { isComment?: boolean; postContent?: string }) {
  const faqMatch = await faqOps.match(message);
  if (faqMatch) {
    console.log(`[Bot] FAQ 命中: ${faqMatch.id}`);
    return { reply: faqMatch.answer, source: "faq" };
  }

  if (!(await settingsOps.isEnabled("ai_enabled"))) {
    return { reply: "感謝您的訊息！我們的團隊會盡快回覆您 😊", source: "default" };
  }

  console.log(`[Bot] FAQ 未命中，使用 AI`);
  const reply = await generateAIReply(message, context);
  return { reply, source: "ai" };
}

export async function handleFBComment(event: { commentId: string; message: string; senderId: string; postId?: string }) {
  const { commentId, message, senderId } = event;
  if (repliedSet.has(commentId)) return;
  if (!(await isBotEnabled("fb_comment"))) return;
  if (await blocklistOps.isBlocked(senderId)) return;
  if (message.trim().length < 2) return;

  const { reply, source } = await getReply(message, { isComment: true });
  await replyToComment(commentId, reply);
  markReplied(commentId);
  await logOps.add({ platform: "facebook", type: "comment", sender_id: senderId, message, reply, reply_source: source });
  console.log(`[Bot] ✅ FB 留言 ${commentId} (${source})`);
}

export async function handleMessengerMessage(event: { senderId: string; messageId: string; message: string }) {
  const { senderId, messageId, message } = event;
  if (repliedSet.has(messageId)) return;
  if (!(await isBotEnabled("messenger"))) return;
  if (await blocklistOps.isBlocked(senderId)) return;

  const { reply, source } = await getReply(message, { isComment: false });
  await sendMessengerMessage(senderId, reply);
  markReplied(messageId);
  await logOps.add({ platform: "facebook", type: "messenger", sender_id: senderId, message, reply, reply_source: source });
  console.log(`[Bot] ✅ Messenger ${messageId} (${source})`);
}

export async function handleIGComment(event: { commentId: string; message: string; senderId: string }) {
  const { commentId, message, senderId } = event;
  if (repliedSet.has(commentId)) return;
  if (!(await isBotEnabled("ig_comment"))) return;
  if (await blocklistOps.isBlocked(senderId)) return;
  if (message.trim().length < 2) return;

  const { reply, source } = await getReply(message, { isComment: true });
  await replyToIGComment(commentId, reply);
  markReplied(commentId);
  await logOps.add({ platform: "instagram", type: "comment", sender_id: senderId, message, reply, reply_source: source });
  console.log(`[Bot] ✅ IG 留言 ${commentId} (${source})`);
}

export async function handleIGDirectMessage(event: { senderId: string; messageId: string; message: string }) {
  const { senderId, messageId, message } = event;
  if (repliedSet.has(messageId)) return;
  if (!(await isBotEnabled("ig_dm"))) return;
  if (await blocklistOps.isBlocked(senderId)) return;

  const { reply, source } = await getReply(message, { isComment: false });
  await sendIGMessage(senderId, reply);
  markReplied(messageId);
  await logOps.add({ platform: "instagram", type: "dm", sender_id: senderId, message, reply, reply_source: source });
  console.log(`[Bot] ✅ IG DM ${messageId} (${source})`);
}
