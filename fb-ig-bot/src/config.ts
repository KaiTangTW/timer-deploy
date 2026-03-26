import dotenv from "dotenv";
dotenv.config({ override: true });

export const config = {
  // Meta / Facebook
  pageAccessToken: process.env.META_PAGE_ACCESS_TOKEN || "",
  appSecret: process.env.META_APP_SECRET || "",
  verifyToken: process.env.META_VERIFY_TOKEN || "kaitang_bot_verify_2024",

  // Claude AI
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",

  // Server
  port: parseInt(process.env.PORT || "3001", 10),

  // Brand
  brandName: process.env.BRAND_NAME || "凱爺",
  brandTone: process.env.BRAND_TONE || "親切、專業、有幽默感的台灣繁體中文",
};
