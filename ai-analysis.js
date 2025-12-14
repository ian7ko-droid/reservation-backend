// ai-analysis.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const dotenv = require("dotenv");

// 加載 .env 文件中的環境變數
dotenv.config();

// === Render/Firebase Admin 初始化區塊 ===
// 若未來需連接 Firebase Admin，請將服務帳號 JSON 存於環境變數 FIREBASE_SERVICE_ACCOUNT
// 例如：FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
// const admin = require("firebase-admin");
// if (process.env.FIREBASE_SERVICE_ACCOUNT) {
//   admin.initializeApp({
//     credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
//   });
// }

// 🚨 1. 定義餐廳情境資訊 (Contextual Information)

const RESTAURANT_CONTEXT = {
    name: "高檔餐廳",
    description: "本餐廳主打頂級牛排與新鮮海鮮，提供舒適優雅的用餐環境，適合家庭聚餐、商務宴請及浪漫約會。",
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
        { name: "香煎鴨胸", price: "$950" },
        { name: "炙燒干貝", price: "$680" },
        { name: "義式烤雞腿", price: "$520" },
        { name: "蒜香奶油蝦", price: "$480" },
        { name: "田園蔬菜烘蛋", price: "$350" },
        { name: "法式洋蔥湯", price: "$180" },
        { name: "經典提拉米蘇", price: "$160" },
        { name: "現打果汁", price: "$120" },
        { name: "精品咖啡", price: "$100" },
    ],
};

// 將菜單格式化為易於 AI 閱讀的純文本
const MENU_TEXT = RESTAURANT_CONTEXT.menu
        .map(item => `- ${item.name} (${item.price})`)
        .join('\n');

// 🚨 2. 建立系統提示詞 (System Instruction)
const SYSTEM_PROMPT_TEMPLATE = `
你是一位專業且友善的高檔餐廳客服助理。你的任務是根據你收到的資訊和以下的餐廳情境資料來回答使用者關於訂位、菜單或餐廳的問題。

請嚴格遵守以下規則：
1. 僅使用你提供的情境資訊來回答問題。
2. 保持專業、禮貌和熱情。
3. 如果資訊中沒有答案，請禮貌地告知使用者這超出了你的服務範圍。

[餐廳資訊]
餐廳名稱: ${RESTAURANT_CONTEXT.name}
簡介: ${RESTAURANT_CONTEXT.description}
地址: ${RESTAURANT_CONTEXT.address}
電話: ${RESTAURANT_CONTEXT.phone}
營業時間: ${RESTAURANT_CONTEXT.hours}
交通方式: ${RESTAURANT_CONTEXT.transport}
停車資訊: ${RESTAURANT_CONTEXT.parking}
付款方式: ${RESTAURANT_CONTEXT.payment}
服務設施: ${RESTAURANT_CONTEXT.service}
官方網站: ${RESTAURANT_CONTEXT.website}

[菜單]
${MENU_TEXT}
`;

const app = express();

// 允許所有來源 (CORS) - 讓 Port 3000 的前端可以呼叫 Port 5000 的後端
app.use(cors());

// 確保 Express 可以解析 JSON
app.use(express.json());

// 從環境變數中獲取 API_KEY
const API_KEY = process.env.GOOGLE_API_KEY;
// 這裡使用的是最新的 Gemini 2.5 Flash 模型
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent"; 

if (!API_KEY) {
    console.error("Error: GOOGLE_API_KEY is not set in .env file. Please check your .env file.");
    process.exit(1);
}

// -----------------
// API 路由 (處理聊天機器人請求)
// -----------------
app.post("/api/chat", async (req, res) => {
    // 🚨 終極連線測試點：確認請求是否到達後端
    console.log("=== 🚀 成功接收到 /api/chat POST 請求 🚀 ==="); 
    console.log("請求內容:", req.body);
    
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: "Message is required" });
    }

    try {
        console.log("Sending request to Gemini API with message:", message);

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
                timeout: 30000, // 30 秒
            }
        );

        // 取回文字回答
        const candidates = response.data?.candidates;
        const replyPart = candidates?.[0]?.content?.parts?.[0];
        const reply = replyPart?.text;

        // 🚨 關鍵測試點：強制輸出 reply 變數的值
        console.log("--- 提取的 reply 實際值是:", reply);

        if (!reply) {
            console.error("Gemini API response missing text. Full response:", JSON.stringify(response.data, null, 2));
            // 這裡回傳 500 錯誤，但提供詳細資訊
            return res.status(500).json({ error: "Gemini API response invalid or empty", fullResponse: response.data });
        }

        // 成功時回傳
        res.json({ reply });
    } catch (error) {
        // 捕捉並輸出 429 配額錯誤
        if (error.response?.status === 429) {
             console.error("Error calling Gemini API: 429 Too Many Requests (Quota Exceeded)");
        } else {
             console.error("Error calling Gemini API:", error.response?.data || error.message);
        }
       
        res.status(500).json({
            error: "Failed to connect to Gemini API",
            details: error.response?.data || error.message,
        });
    }
});

// -----------------
// 提供 React build 靜態文件 (部署時使用)
// -----------------


// 設定靜態檔案路徑：假設 build 資料夾在 Express 專案的上一層的上一層 (即專案根目錄)
app.use(express.static(path.join(__dirname, "../../build")));

// 🚨 萬用路由修正：只針對 GET 且非 /api/ 開頭的請求回傳 index.html
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
        const indexPath = path.join(__dirname, "../../build", "index.html");
        return res.sendFile(indexPath, (err) => {
            if (err) {
                console.log("Warning: index.html not found. Are you in development mode?");
            }
        });
    }
    next();
});

// -----------------
// 啟動伺服器
// -----------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    if (process.env.RENDER) {
        console.log("[INFO] Running on Render. PORT:", PORT);
    }
});