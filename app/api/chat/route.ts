import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// =====================================================================
// 1. KHAI BÁO 3 QUYỀN NĂNG (TOOLS) CHO AI
// =====================================================================
const baristaTools = {
  functionDeclarations: [
    // Tool 1: Đặt món mới
    {
      name: 'createOrder',
      description: 'Dùng khi khách hàng gọi món mới, đặt thêm đồ uống.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          items: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING },
                quantity: { type: SchemaType.NUMBER },
                customizations: {
                  type: SchemaType.OBJECT,
                  properties: {
                    ice: { type: SchemaType.STRING, description: '"none", "light", "normal", "extra"' },
                    sugar: { type: SchemaType.STRING, description: '"none", "light", "normal", "extra"' }
                  }
                }
              },
              required: ["name", "quantity"],
            },
          },
        },
        required: ["items"],
      },
    },
    // Tool 2: Điều chỉnh đơn hàng (Thêm, bớt, đổi, hủy)
    {{
      name: 'adjustOrder',
      description: 'Dùng khi khách muốn thêm món mới vào đơn hiện tại, hoặc đổi/hủy món.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          action_type: { type: SchemaType.STRING, description: '"add" nếu thêm món, hoặc "cancel_modify" nếu hủy/đổi món' },
          item_name: { type: SchemaType.STRING, description: 'Tên món muốn thêm (nếu có)' },
          quantity: { type: SchemaType.NUMBER, description: 'Số lượng món muốn thêm' },
          request_details: { type: SchemaType.STRING, description: 'Mô tả chi tiết yêu cầu' }
        },
        required: ["action_type", "request_details"],
      },
    },
    // Tool 3: Xem hóa đơn / Tính tiền
    {
      name: 'viewBill',
      description: 'Dùng khi khách hỏi "Tôi đã gọi gì?", "Tổng tiền bao nhiêu?", hoặc yêu cầu tính tiền/xem hóa đơn.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {}, // Không cần tham số vì mình tự lấy theo tableNumber
      },
    }
  ],
};

// =====================================================================
// 2. XỬ LÝ LOGIC CHAT & GỌI HÀM
// =====================================================================
export async function POST(req: Request) {
  try {
    const { message, tableNumber } = await req.json();

    if (!tableNumber) {
      return NextResponse.json({ reply: 'Vui lòng quét QR tại bàn để đặt món!' });
    }

    const systemPrompt = `Bạn là trợ lý Barista ảo cao cấp tại bàn ${tableNumber} của quán cafe.
    
    MENU CỦA QUÁN (CHỈ ĐƯỢC PHÉP TƯ VẤN VÀ BÁN CÁC MÓN NÀY):
    - Cà phê đá
    - Cà phê sữa
    - Bạc xỉu
    - Trà đào
    - Nước cam
    (Tuyệt đối không tự ý bịa thêm món khác ngoài danh sách trên).

    NHIỆM VỤ VÀ QUY TẮC:
    1. ĐẶT MÓN MỚI (createOrder): Dùng khi khách gọi món lần đầu. Bắt buộc trích xuất customizations (ice, sugar) theo các chữ: "none", "light", "normal", "extra".
    2. GỌI THÊM / ĐIỀU CHỈNH (adjustOrder): Nếu khách đã gọi món trước đó và giờ gọi thêm nước mới (ví dụ: "thêm cho mình 1 bạc xỉu"), BẮT BUỘC DÙNG HÀM NÀY để gửi yêu cầu gộp thêm vào đơn hiện tại, không tạo đơn mới hoàn toàn!
    3. XEM HÓA ĐƠN (viewBill): Dùng khi khách muốn kiểm tra lại các món đã gọi hoặc hỏi tổng tiền.
    4. TƯ VẤN THEO NGỮ CẢNH: Gợi ý các món trong menu sao cho phù hợp (Sáng ưu tiên Cà phê đá/sữa/bạc xỉu để tỉnh táo; Trưa/Chiều/Tối ưu tiên Trà đào hoặc Nước cam thanh mát).
    
    Hãy giao tiếp thật tự nhiên, thân thiện, và xưng hô là "em" hoặc "mình" với "quý khách/bạn".`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash-lite', // Hoặc 'gemini-3.7-flash'
      tools: [baristaTools] as any,
      systemInstruction: systemPrompt
    });

    const result = await model.generateContent(message);
    const response = await result.response;
    
    const functionCalls = typeof response.functionCalls === 'function' ? response.functionCalls() : response.functionCalls;

    // KHI AI QUYẾT ĐỊNH DÙNG TOOL (GỌI HÀM)
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];

      // --- TRƯỜNG HỢP 1: ĐẶT MÓN MỚI (ĐÃ ĐƯỢC CHUẨN HÓA DỮ LIỆU) ---
      if (call.name === 'createOrder') {
        const rawItems = (call.args as any).items; 
        
        try {
          // 1. Lấy menu từ Backend về để chuẩn hóa tên món, lấy ID và Price chính xác
          const menuRes = await fetch('https://bin-coffee.onrender.com/api/menu');
          const menuItems = await menuRes.json();

          const formattedItems = [];
          for (const raw of rawItems) {
            // Tìm món trong menu (khớp chuỗi tương đối)
            const matched = menuItems.find((m: any) => 
              m.name.toLowerCase().includes(raw.name.toLowerCase()) ||
              raw.name.toLowerCase().includes(m.name.toLowerCase())
            );

            if (matched) {
              formattedItems.push({
                id: matched.id,
                name: matched.name,
                quantity: raw.quantity || 1,
                price: Number(matched.price),
                customizations: raw.customizations || null
              });
            }
          }

          if (formattedItems.length === 0) {
            return NextResponse.json({ reply: 'Dạ quán không tìm thấy món bạn vừa chọn trong menu, bạn chọn lại món khác giúp em nhé!' });
          }

          // 2. Gửi đơn hàng chuẩn đã có ID và Price xuống Backend
          const backendRes = await fetch('https://bin-coffee.onrender.com/api/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tableNumber, items: formattedItems, note: 'AI Chat Chốt Đơn' }),
          });

          if (backendRes.ok) {
            return NextResponse.json({ reply: 'Dạ, đơn hàng của mình đã được chuyển xuống bếp pha chế rồi ạ! Quý khách đợi một lát nhé 🥰', action: 'order_created' });
          } else {
            throw new Error("Lưu đơn thất bại");
          }
        } catch (error) {
          console.error("Lỗi khi đồng bộ đơn với Backend:", error);
          return NextResponse.json({ reply: 'Dạ hệ thống đặt món đang bị gián đoạn đôi chút, bạn chờ em kiểm tra lại nha!' });
        }
      }

      // --- TRƯỜNG HỢP 2: ĐIỀU CHỈNH / HỦY MÓN ---
      if (call.name === 'adjustOrder') {
        const { request_details } = call.args as any;
        // Bắn 1 order khẩn cấp xuống bếp với items rỗng nhưng có note đỏ để bếp chú ý xử lý
        await fetch('https://bin-coffee.onrender.com/api/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableNumber, items: [], note: `🔴 KHÁCH ĐIỀU CHỈNH: ${request_details}` }),
        });
        return NextResponse.json({ 
          reply: `Dạ em đã ghi nhận yêu cầu điều chỉnh: "${request_details}". Em đã báo khẩn cấp xuống quầy pha chế xử lý ngay cho mình rồi ạ!`, 
          action: 'order_adjusted' 
        });
      }

      // --- TRƯỜNG HỢP 3: XEM HÓA ĐƠN TRỰC TIẾP TRONG CHAT ---
      if (call.name === 'viewBill') {
        try {
          const res = await fetch(`https://bin-coffee.onrender.com/api/orders`);
          if (res.ok) {
            const allOrders = await res.json();
            // Lọc ra các đơn của Bàn hiện tại và Chưa thanh toán
            const tableOrders = allOrders.filter((o: any) => 
              String(o.table_number).match(/\d+/)?.[0] === String(tableNumber) && 
              o.payment_status !== 'paid'
            );

            if (tableOrders.length === 0) {
              return NextResponse.json({ reply: 'Dạ hiện tại bàn mình chưa có hóa đơn nào chưa thanh toán ạ.' });
            }

            // Tạo chuỗi hóa đơn để in ra chat
            let billText = `🧾 **HÓA ĐƠN BÀN ${tableNumber}**\n\n`;
            let totalAmount = 0;

            tableOrders.forEach((order: any) => {
              order.items.forEach((item: any) => {
                const qty = item.quantity || 1;
                const price = item.price || 0;
                totalAmount += (qty * price);
                billText += `- ${qty}x ${item.name} (${(qty * price).toLocaleString('vi-VN')}đ)\n`;
              });
            });

            billText += `\n💰 **Tổng cộng: ${totalAmount.toLocaleString('vi-VN')}đ**\n\nQuý khách kiểm tra lại xem có muốn thêm món gì không nhé!`;
            
            return NextResponse.json({ reply: billText, action: 'view_bill' });
          }
        } catch (error) {
          return NextResponse.json({ reply: 'Dạ hệ thống đang hơi bận, anh/chị có thể xem hóa đơn ở tab "Sơ đồ bàn" giúp em nhé.' });
        }
      }
    }

    // NẾU CHỈ LÀ TRÒ CHUYỆN BÌNH THƯỜNG (Tư vấn, hỏi đáp)
    return NextResponse.json({ reply: response.text(), action: 'chat' });

  } catch (error: any) {
    console.error('Lỗi API Chat:', error);
    // 🚀 Đưa thẳng lỗi thật ra đây để nhìn thấy trên giao diện web
    return NextResponse.json({ reply: `Chi tiết lỗi code: ${error.message}` });
  }
}