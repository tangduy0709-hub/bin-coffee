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
      description: 'Dùng khi khách hàng gọi món lần đầu tiên.',
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
    // Tool 2: Điều chỉnh đơn hàng / Thêm món
    {
      name: 'adjustOrder',
      description: 'Dùng khi bàn đã có đơn mà khách muốn gọi thêm nước mới, hoặc đổi/hủy món.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          action_type: { type: SchemaType.STRING, description: '"add" nếu thêm món, hoặc "cancel_modify" nếu hủy/đổi món' },
          item_name: { type: SchemaType.STRING, description: 'Tên món muốn thêm (nếu có)' },
          quantity: { type: SchemaType.NUMBER, description: 'Số lượng món muốn thêm' },
          request_details: { type: SchemaType.STRING, description: 'Mô tả chi tiết yêu cầu của khách' }
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
        properties: {},
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
    1. ĐẶT MÓN MỚI (createOrder): Dùng khi bàn chưa hề có đơn nào và khách gọi món lần đầu. Bắt buộc trích xuất customizations (ice, sugar) theo các chữ: "none", "light", "normal", "extra".
    2. GỌI THÊM / ĐIỀU CHỈNH (adjustOrder): Nếu khách đã có đơn trước đó và giờ gọi thêm nước mới (ví dụ: "thêm cho mình 2 cà phê sữa"), BẮT BUỘC DÙNG HÀM NÀY với action_type là "add" để hệ thống gộp thẳng vào đơn cũ!
    3. XEM HÓA ĐƠN (viewBill): Dùng khi khách muốn kiểm tra lại các món đã gọi hoặc hỏi tổng tiền.
    4. TƯ VẤN THEO NGỮ CẢNH: Gợi ý các món trong menu sao cho phù hợp.
    
    Hãy giao tiếp thật tự nhiên, thân thiện, và xưng hô là "em" hoặc "mình" với "quý khách/bạn".`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash-lite',
      tools: [baristaTools] as any,
      systemInstruction: systemPrompt
    });

    const result = await model.generateContent(message);
    const response = await result.response;
    
    const functionCalls = typeof response.functionCalls === 'function' ? response.functionCalls() : response.functionCalls;

    // KHI AI QUYẾT ĐỊNH DÙNG TOOL (GỌI HÀM)
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];

      // --- TRƯỜNG HỢP 1: ĐẶT MÓN MỚI ---
      if (call.name === 'createOrder') {
        const rawItems = (call.args as any).items; 
        
        try {
          const menuRes = await fetch('https://bin-coffee.onrender.com/api/menu');
          const menuItems = await menuRes.json();

          const formattedItems = [];
          for (const raw of rawItems) {
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

      // --- TRƯỜNG HỢP 2: ĐIỀU CHỈNH / THÊM MÓN VÀO ĐƠN CŨ ---
      if (call.name === 'adjustOrder') {
        const { action_type, item_name, quantity, request_details } = call.args as any;
        
        try {
          // 1. Tìm đơn hàng hiện tại chưa thanh toán của bàn
          const ordersRes = await fetch(`https://bin-coffee.onrender.com/api/orders`);
          if (ordersRes.ok) {
            const allOrders = await ordersRes.json();
            const activeOrder = allOrders.find((o: any) => 
              String(o.table_number).match(/\d+/)?.[0] === String(tableNumber) && 
              o.payment_status !== 'paid'
            );

            // Nếu là hành động thêm món và bàn đang có đơn active
            if (action_type === 'add' && activeOrder && item_name) {
              const menuRes = await fetch('https://bin-coffee.onrender.com/api/menu');
              const menuItems = await menuRes.json();

              const matchedItem = menuItems.find((m: any) => 
                m.name.toLowerCase().includes(item_name.toLowerCase()) ||
                item_name.toLowerCase().includes(m.name.toLowerCase())
              );

              if (matchedItem) {
                // Gọi API thêm trực tiếp món vào order hiện tại trên backend
                const addRes = await fetch(`https://bin-coffee.onrender.com/api/orders/${activeOrder.id}/items`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    menu_item_id: matchedItem.id,
                    quantity: quantity || 1,
                    price: Number(matchedItem.price)
                  }),
                });

                if (addRes.ok) {
                  return NextResponse.json({ 
                    reply: `Dạ em đã tự động thêm "${matchedItem.name}" vào đơn hàng hiện tại của bàn mình rồi ạ! Bếp đang chuẩn bị ngay cho mình nhé 🥰`, 
                    action: 'order_adjusted' 
                  });
                }
              }
            }
          }
        } catch (err) {
          console.error("Lỗi gộp thêm món tự động:", err);
        }

        // 2. Dự phòng: Nếu không tìm thấy đơn hoặc là hủy/đổi món phức tạp, bắn note khẩn cấp xuống bếp
        await fetch('https://bin-coffee.onrender.com/api/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableNumber, items: [], note: `🔴 KHÁCH ĐIỀU CHỈNH: ${request_details}` }),
        });

        return NextResponse.json({ 
          reply: `Dạ em đã ghi nhận yêu cầu: "${request_details}". Em đã báo khẩn cấp xuống quầy pha chế xử lý ngay cho mình rồi ạ!`, 
          action: 'order_adjusted' 
        });
      }

      // --- TRƯỜNG HỢP 3: XEM HÓA ĐƠN ---
      if (call.name === 'viewBill') {
        try {
          const res = await fetch(`https://bin-coffee.onrender.com/api/orders`);
          if (res.ok) {
            const allOrders = await res.json();
            const tableOrders = allOrders.filter((o: any) => 
              String(o.table_number).match(/\d+/)?.[0] === String(tableNumber) && 
              o.payment_status !== 'paid'
            );

            if (tableOrders.length === 0) {
              return NextResponse.json({ reply: 'Dạ hiện tại bàn mình chưa có hóa đơn nào chưa thanh toán ạ.' });
            }

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

    // NẾU CHỈ LÀ TRÒ CHUYỆN BÌNH THƯỜNG
    return NextResponse.json({ reply: response.text(), action: 'chat' });

  } catch (error: any) {
    console.error('Lỗi API Chat:', error);
    return NextResponse.json({ reply: `Chi tiết lỗi code: ${error.message}` });
  }
}