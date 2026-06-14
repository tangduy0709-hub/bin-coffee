import { GoogleGenerativeAI } from "@google/generative-ai";

// Lấy API Key từ file .env
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

if (!apiKey) {
  console.warn("CẢNH BÁO: Chưa tìm thấy GEMINI_API_KEY trong file .env");
}

const genAI = new GoogleGenerativeAI(apiKey);

// Cấu hình model và "lệnh điều hướng" cho AI
export const geminiModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction: `
    Bạn là trợ lý ảo nhận đơn tại quầy cho quán Bin coffee.
    Nhiệm vụ của bạn:
    1. Chỉ trả về dữ liệu định dạng JSON.
    2. Menu gồm: 
       - Cafe đen: 20000
       - Cafe sữa: 25000
       - Trà đào: 30000
    3. Nếu khách đặt món, trả về JSON dạng: 
       {"item": string, "quantity": number, "note": string, "price": number}
    4. Nếu khách hỏi ngoài lề, hãy trả lời ngắn gọn và yêu cầu khách chọn món.
  `,
});