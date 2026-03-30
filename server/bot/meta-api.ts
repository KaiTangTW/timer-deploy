/**
 * Meta Graph API 呼叫
 */

const API_VERSION = "v21.0";

function getToken() {
  return process.env.META_PAGE_ACCESS_TOKEN || "";
}

async function callApi(endpoint: string, body: Record<string, any>) {
  const url = `https://graph.facebook.com/${API_VERSION}/${endpoint}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, access_token: getToken() }),
    });
    const data = await res.json();
    if (data.error) {
      console.error(`[Meta API] 錯誤:`, data.error);
    }
    return data;
  } catch (error) {
    console.error(`[Meta API] 請求失敗:`, error);
    throw error;
  }
}

// 快取 sender name，避免重複呼叫 API
const nameCache = new Map<string, string>();

/** 取得用戶名稱（from Meta Graph API） */
export async function getSenderName(userId: string): Promise<string> {
  if (!userId || !getToken()) return "";
  const cached = nameCache.get(userId);
  if (cached !== undefined) return cached;
  try {
    const url = `https://graph.facebook.com/${API_VERSION}/${userId}?fields=name&access_token=${getToken()}`;
    const res = await fetch(url);
    const data = await res.json();
    const name = data.name || "";
    nameCache.set(userId, name);
    // 快取上限 5000
    if (nameCache.size > 5000) {
      const first = nameCache.keys().next().value;
      if (first) nameCache.delete(first);
    }
    return name;
  } catch {
    nameCache.set(userId, "");
    return "";
  }
}

/** 回覆 FB 貼文留言 */
export async function replyToComment(commentId: string, message: string) {
  return callApi(`${commentId}/comments`, { message });
}

/** 附件類型 */
export type Attachment = { type: "link" | "image" | "file"; url: string; title?: string };

/** 發送 Messenger 訊息 */
export async function sendMessengerMessage(recipientId: string, message: string) {
  return callApi("me/messages", {
    recipient: { id: recipientId },
    message: { text: message },
  });
}

/** 發送 Messenger 附件（圖片或檔案） */
export async function sendMessengerAttachment(recipientId: string, att: Attachment) {
  if (att.type === "link") {
    // 連結以按鈕模板發送
    return callApi("me/messages", {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: att.title || att.url,
            buttons: [{ type: "web_url", url: att.url, title: att.title || "開啟連結" }],
          },
        },
      },
    });
  }
  // 圖片或檔案
  const metaType = att.type === "image" ? "image" : "file";
  return callApi("me/messages", {
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: metaType,
        payload: { url: att.url, is_reusable: true },
      },
    },
  });
}

/** 回覆 IG 留言 */
export async function replyToIGComment(commentId: string, message: string) {
  return callApi(`${commentId}/replies`, { message });
}

/** 發送 IG 私訊 */
export async function sendIGMessage(recipientId: string, message: string) {
  return callApi("me/messages", {
    recipient: { id: recipientId },
    message: { text: message },
  });
}

/** 發送 IG 圖片私訊 */
export async function sendIGAttachment(recipientId: string, att: Attachment) {
  if (att.type === "image") {
    return callApi("me/messages", {
      recipient: { id: recipientId },
      message: {
        attachment: { type: "image", payload: { url: att.url } },
      },
    });
  }
  // IG DM 不支援 file/template，改為文字連結
  const text = att.title ? `${att.title}：${att.url}` : att.url;
  return sendIGMessage(recipientId, text);
}
