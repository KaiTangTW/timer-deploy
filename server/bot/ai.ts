/**
 * Claude AI 回覆模組
 */

import Anthropic from "@anthropic-ai/sdk";
import { settingsOps } from "./db";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });
  }
  return client;
}

export async function generateAIReply(
  userMessage: string,
  context?: { isComment?: boolean; postContent?: string }
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return "感謝您的訊息！我們的團隊會盡快回覆您 😊";
  }

  try {
    const brandName = (await settingsOps.get("brand_name")) || "凱爺";
    const brandTone = (await settingsOps.get("brand_tone")) || "親切、專業、有幽默感的台灣繁體中文";

    const systemPrompt = `你是「${brandName}」品牌的社群小編 AI 助手。

## 角色設定
- 語氣風格：${brandTone}
- 你負責回覆粉絲專頁的留言和私訊
- 回覆要簡潔有力，不要太長（建議 50-150 字）
- 使用繁體中文

## 回覆原則
1. 友善親切，讓粉絲感受到被重視
2. 如果是具體的服務/價格問題，引導對方私訊詳談
3. 如果是負面留言，保持冷靜專業，不要反擊
4. 如果是讚美/感謝，真誠回應
5. 如果問題超出你的知識範圍，誠實說「我幫你問一下團隊，稍後回覆您」
6. 適度使用 emoji 讓回覆更親切，但不要過度

## 禁止事項
- 不要承諾具體價格或折扣
- 不要提供個人聯繫方式
- 不要回覆政治敏感話題
- 不要與人爭吵`;

    const contextInfo = context?.isComment
      ? `\n[情境] 這是粉專貼文下的留言${context.postContent ? `，貼文內容：「${context.postContent}」` : ""}`
      : "\n[情境] 這是私訊對話";

    const response = await getClient().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `${contextInfo}\n\n粉絲說：「${userMessage}」\n\n請生成適當的回覆：`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return textBlock?.text || "感謝您的訊息！我們會盡快回覆您 😊";
  } catch (error) {
    console.error("[AI] Claude API 錯誤:", error);
    return "感謝您的訊息！我們的團隊會盡快回覆您 😊";
  }
}
