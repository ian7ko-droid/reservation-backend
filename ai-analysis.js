// ai-analysis.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const dotenv = require("dotenv");

// 載入 .env（本地用，Render 不會用這個）
dotenv.config();

// =============================
// Express 初始化
// =============================
const app = express();
app.use(cors());
app.use(express.json());

// =============================
// 🔍 環境變數自我檢查（不洩漏 Key）
// =============================
app.get("/api/env-check", (req, res) => {
  res.json({
    hasGoogleApiKey: !!process.env.GOOGLE_API_KEY,
    googleApiKeyLength: process.env.GOOGLE_API_KEY
      ? process.env.GOOGLE_API_KEY.length
      : 0,
    nodeEnv: process.env.NODE_ENV || "undefined",
  });
});

// =============================
// 餐廳情境資料
// =============================
const RESTAURANT_CONTEXT = {
  name: "高檔餐廳",
  description:
    "本餐廳主打頂級牛排與新鮮海鮮，提供舒適優雅的用餐環境，適合家庭聚餐、商務宴請及浪漫約會。",
  hours: "週一至週日 11:00 - 22:00",
  address: "台北市信義區XX路XX號",
  phone: "02-1234-5678",
  transport: "捷運信義安和站步行5分鐘，公車信義路口站下車即達。",
  parking: "本餐廳備有地下停車場，亦可於鄰近停車場停車。",
  website: "https://luxury-restaurant.example.com",
  payment: "現金、信用卡、行動支付皆可。",
  service: "免費Wi-Fi、包廂、兒童座椅、素食選項、生日蛋糕預訂。",
  menu: [
    { name: "招牌牛排", price: "$1200" },
    { name: "海鮮義大利麵", price: "$800" },
    { name: "經典沙拉", price: "$300" },
    { name: "松露薯條", price: "$220" },
    { name: "手工甜點", price: "$180" },
    { name: "主廚濃湯", price: "$150" },
  ],
};

const MENU_TEXT = RESTAURANT_CONTEXT.menu
  .map((item) => `- ${item.name} (${item.price})`)
  .join("\n");

// =============================
// System Prompt
// =============================
const SYSTEM_PROMPT_TEMPLATE = `
你是一位專業且友善的高檔餐廳客服助理。
僅使用下列餐廳資訊回答問題。

[餐廳資訊]
餐廳名稱: ${RESTAURANT_CONTEXT.name}
地址: ${RESTAURANT_CONTEXT.address}
電話: ${RESTAURANT_CONTEXT.phone}
營業時間: ${RESTAURANT_CONTEXT.hours}

[菜單]
${MENU_TEXT}
`;

// =============================
// Gemini 設定
// =============================
const API_KEY = process.env.GOOGLE_API_KEY;
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent";

// =============================
// Chat API
// =============================
app.post("/api/chat", async (req, res) => {
  console.log("=== 🚀 /api/chat 收到請求 ===");
  console.log("body:", req.body);

  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  if (!API_KEY) {
    return res.status(500).json({
      error: "GOOGLE_API_KEY not loaded",
    });
  }

  try {
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${API_KEY}`,
      {
        contents: [
          {
            role: "user",
            parts: [{ text: SYSTEM_PROMPT_TEMPLATE }],
          },
          {
            role: "user",
            parts: [{ text: message }],
          },
        ],
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    );

    const reply =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      return res.status(500).json({
        error: "Gemini response empty",
        raw: response.data,
      });
    }

    res.json({ reply });
  } catch (error) {
    return res.status(error.response?.status || 500).json({
      error: "Gemini API Error",
      details: error.response?.data || error.message,
    });
  }
});

// =============================
// React build（部署用）
// =============================
app.use(express.static(path.join(__dirname, "build")));

app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api/")) {
    return res.sendFile(path.join(__dirname, "build", "index.html"));
  }
  next();
});

// =============================
// 啟動伺服器
// =============================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
