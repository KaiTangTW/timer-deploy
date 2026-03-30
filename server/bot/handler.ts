/**
 * 機器人核心邏輯
 */

import { faqOps, settingsOps, logOps, blocklistOps } from "./db";
import { generateAIReply } from "./ai";
import {
  replyToComment,
  sendMessengerMessage,
  sendMessengerAttachment,
  replyToIGComment,
  sendIGMessage,
  sendIGAttachment,
  getSenderName,
  type Attachment,
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

/** 留言回覆不支援附件，改為文字連結附在末尾 */
function appendAttachmentLinks(text: string, attachments: Attachment[]): string {
  if (attachments.length === 0) return text;
  const links = attachments.map(a => a.title ? `${a.title}：${a.url}` : a.url);
  return text + "\n\n" + links.join("\n");
}

function resolveUrl(url: string): string {
  if (url.startsWith("/objects/")) {
    return `https://msg.aiboss.com.tw${url}`;
  }
  return url;
}

function parseAttachments(raw?: string | null): Attachment[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map(a => ({ ...a, url: resolveUrl(a.url) }));
  }
  catch { return []; }
}

async function getReply(message: string, context?: { isComment?: boolean; postContent?: string }) {
  const faqMatch = await faqOps.match(message);
  if (faqMatch) {
    console.log(`[Bot] FAQ 命中: ${faqMatch.id}`);
    return { reply: faqMatch.answer, source: "faq", attachments: parseAttachments(faqMatch.attachments) };
  }

  if (!(await settingsOps.isEnabled("ai_enabled"))) {
    return { reply: "感謝您的訊息！我們的團隊會盡快回覆您 😊", source: "default", attachments: [] as Attachment[] };
  }

  console.log(`[Bot] FAQ 未命中，使用 AI`);
  const reply = await generateAIReply(message, context);
  return { reply, source: "ai", attachments: [] as Attachment[] };
}

export async function handleFBComment(event: { commentId: string; message: string; senderId: string; postId?: string }) {
  const { commentId, message, senderId } = event;
  if (repliedSet.has(commentId)) return;
  if (!(await isBotEnabled("fb_comment"))) return;
  if (await blocklistOps.isBlocked(senderId)) return;
  if (message.trim().length < 2) return;

  const [{ reply, source, attachments }, senderName] = await Promise.all([
    getReply(message, { isComment: true }),
    getSenderName(senderId),
  ]);
  // 留言只能回文字，附件連結附在文字末尾
  const replyText = appendAttachmentLinks(reply, attachments);
  await replyToComment(commentId, replyText);
  markReplied(commentId);
  await logOps.add({ platform: "facebook", type: "comment", sender_id: senderId, sender_name: senderName, message, reply: replyText, reply_source: source });
  console.log(`[Bot] ✅ FB 留言 ${commentId} (${source}) from ${senderName || senderId}`);
}

export async function handleMessengerMessage(event: { senderId: string; messageId: string; message: string }) {
  const { senderId, messageId, message } = event;
  if (repliedSet.has(messageId)) return;
  if (!(await isBotEnabled("messenger"))) return;
  if (await blocklistOps.isBlocked(senderId)) return;

  const [{ reply, source, attachments }, senderName] = await Promise.all([
    getReply(message, { isComment: false }),
    getSenderName(senderId),
  ]);
  await sendMessengerMessage(senderId, reply);
  for (const att of attachments) {
    await sendMessengerAttachment(senderId, att);
  }
  markReplied(messageId);
  await logOps.add({ platform: "facebook", type: "messenger", sender_id: senderId, sender_name: senderName, message, reply, reply_source: source });
  console.log(`[Bot] ✅ Messenger ${messageId} (${source}) from ${senderName || senderId}`);
}

export async function handleIGComment(event: { commentId: string; message: string; senderId: string }) {
  const { commentId, message, senderId } = event;
  if (repliedSet.has(commentId)) return;
  if (!(await isBotEnabled("ig_comment"))) return;
  if (await blocklistOps.isBlocked(senderId)) return;
  if (message.trim().length < 2) return;

  const [{ reply, source, attachments }, senderName] = await Promise.all([
    getReply(message, { isComment: true }),
    getSenderName(senderId),
  ]);
  const replyText = appendAttachmentLinks(reply, attachments);
  await replyToIGComment(commentId, replyText);
  markReplied(commentId);
  await logOps.add({ platform: "instagram", type: "comment", sender_id: senderId, sender_name: senderName, message, reply: replyText, reply_source: source });
  console.log(`[Bot] ✅ IG 留言 ${commentId} (${source}) from ${senderName || senderId}`);
}

export async function handleIGDirectMessage(event: { senderId: string; messageId: string; message: string }) {
  const { senderId, messageId, message } = event;
  if (repliedSet.has(messageId)) return;
  if (!(await isBotEnabled("ig_dm"))) return;
  if (await blocklistOps.isBlocked(senderId)) return;

  const [{ reply, source, attachments }, senderName] = await Promise.all([
    getReply(message, { isComment: false }),
    getSenderName(senderId),
  ]);
  await sendIGMessage(senderId, reply);
  for (const att of attachments) {
    await sendIGAttachment(senderId, att);
  }
  markReplied(messageId);
  await logOps.add({ platform: "instagram", type: "dm", sender_id: senderId, sender_name: senderName, message, reply, reply_source: source });
  console.log(`[Bot] ✅ IG DM ${messageId} (${source}) from ${senderName || senderId}`);
}
