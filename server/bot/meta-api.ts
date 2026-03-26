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

/** 回覆 FB 貼文留言 */
export async function replyToComment(commentId: string, message: string) {
  return callApi(`${commentId}/comments`, { message });
}

/** 發送 Messenger 訊息 */
export async function sendMessengerMessage(recipientId: string, message: string) {
  return callApi("me/messages", {
    recipient: { id: recipientId },
    message: { text: message },
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
