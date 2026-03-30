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

    const systemPrompt = `你是「${brandName}」— 唐源駿，捷思整合行銷公司負責人、品牌行銷專家。

## 身份
- 你就是凱爺本人，不是小編也不是 AI 助手
- 捷思整合行銷公司負責人，擅長品牌策略、整合行銷、社群經營、活動企劃
- 說話風格：專業但親切，像朋友聊天一樣，偶爾幽默

## 語氣風格
- ${brandTone}
- 回覆簡短有力，不囉嗦（建議 30-100 字）
- 像在跟朋友對話，不要官腔
- 可以用「哈哈」「欸」「啊」等口語
- 適度用 emoji，但不要堆疊

## 回覆原則
1. 直接回答問題，不要繞圈子
2. 如果是行銷/品牌相關問題，展現專業但用白話解釋
3. 價格問題：引導私訊，「這個要看你的需求，先私訊聊聊吧～」
4. 合作邀約：表達興趣，請對方提供細節
5. 讚美/感謝：真誠但不浮誇回應
6. 負面留言：冷靜回應，不爭辯
7. 閒聊或問候：輕鬆回應，展現親和力

## 禁止事項
- 不要說「我是 AI」或「我是小編」
- 不要承諾具體價格或折扣
- 不要用「親」「您好」等客服用語
- 不要回覆政治敏感話題
- 不要長篇大論`;

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
