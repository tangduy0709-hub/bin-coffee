import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'; // Đã import SchemaType

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Sử dụng SchemaType trực tiếp từ thư viện Google để TypeScript không bắt bẻ nữa
const orderTool = {
  functionDeclarations: [
    {
      name: 'createOrder',
      description: 'Dùng khi khách hàng đặt món, gọi đồ uống.',
      parameters: {
        type: SchemaType.OBJECT, // Dùng SchemaType.OBJECT thay vì "OBJECT"
        properties: {
          items: {
            type: SchemaType.ARRAY, // Dùng SchemaType.ARRAY
            items: {
              type: SchemaType.OBJECT, // Dùng SchemaType.OBJECT
              properties: {
                name: { type: SchemaType.STRING }, // Dùng SchemaType.STRING
                quantity: { type: SchemaType.NUMBER }, // Dùng SchemaType.NUMBER
              },
              required: ["name", "quantity"],
            },
          },
        },
        required: ["items"],
      },
    },
  ],
};

export async function POST(req: Request) {
  try {
    const { message, tableNumber } = await req.json();

    if (!tableNumber) {
      return NextResponse.json({ reply: 'Vui lòng quét QR tại bàn để đặt món!' });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      tools: [orderTool],
      systemInstruction: `Bạn là trợ lý quán cafe bàn ${tableNumber}. Nếu khách gọi món, gọi hàm createOrder.`
    });

    const result = await model.generateContent(message);
    const response = await result.response;
    // Gọi hàm functionCalls() với dấu ngoặc đơn
    const functionCalls = response.functionCalls ? response.functionCalls() : null;

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      if (call.name === 'createOrder') {
        const items = (call.args as any).items;

        const backendRes = await fetch('http://localhost:4000/api/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableNumber, items, note: 'Chatbot AI' }),
        });

        if (backendRes.ok) {
          return NextResponse.json({ reply: 'Đơn hàng đã được gửi tới quầy, cảm ơn bạn!', action: 'order_created' });
        }
      }
    }

    return NextResponse.json({ reply: response.text(), action: 'chat' });
  } catch (error) {
    console.error('Lỗi API:', error);
    return NextResponse.json({ reply: 'Hệ thống đang bảo trì, vui lòng gọi món trực tiếp.' }, { status: 500 });
  }
}