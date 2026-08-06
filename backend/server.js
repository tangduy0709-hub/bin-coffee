const express = require('express')
const http = require('http')
const cors = require('cors')
const mqtt = require('mqtt')
const mysql = require('mysql2/promise')
const { Server } = require('socket.io')
const WebSocket = require('ws'); 
require('dotenv').config()

const BACKEND_PORT = process.env.BACKEND_PORT || 4000
// 🔒 Đã xóa sạch mật khẩu cứng ở đây để GitHub không chặn
const DATABASE_PASSWORD = process.env.DATABASE_PASSWORD || ''
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://test.mosquitto.org:1883'

// =========================================================
// 🚀 ĐIỀN LINK CỦA TẤT CẢ CÁC BÀN VÀO ĐÂY (Trong dấu ngoặc kép, cách nhau dấu phẩy)
// =========================================================
const XIAO_ZHI_WSS_URLS = [
  "wss://api.xiaozhi.me/mcp/?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjk2NjE1OCwiYWdlbnRJZCI6MjAwNzI0NywiZW5kcG9pbnRJZCI6ImFnZW50XzIwMDcyNDciLCJwdXJwb3NlIjoibWNwLWVuZHBvaW50IiwiaWF0IjoxNzgzMjc5OTY5LCJleHAiOjE4MTQ4Mzc1Njl9.OSjXO--WevFiUADNrk28UkmhDEQpbk5v5iXuCE0xgp7fVcqmOWz8FUIUyfp9zhBkEbH1v4Fr62O-zyuyz8S8XA", // BÀN 1
  "wss://api.xiaozhi.me/mcp/?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjk2NjE1OCwiYWdlbnRJZCI6MjIwNTQxMywiZW5kcG9pbnRJZCI6ImFnZW50XzIyMDU0MTMiLCJwdXJwb3NlIjoibWNwLWVuZHBvaW50IiwiaWF0IjoxNzg1ODMzMzc0LCJleHAiOjE4MTczOTA5NzR9.Vi5To9JsZ6g8lDXcNgcjU-74y6CxSfoN74CnE4icyr4T1Y9X2x7bosQ9Vfe8eM4VbZKK3Da-w31tzNUAaDJd0g" // BÀN 2 (Copy từ giao diện XiaoZhi)
];

const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } })

app.use(cors())
app.use(express.json())

let pool
let mqttClient

async function connectDatabase() {
  const maxAttempts = 5
  
  // 🔒 CHỈ DÙNG BIẾN MÔI TRƯỜNG ĐỂ QUA MẶT GITHUB
  const connectionString = process.env.DATABASE_URL;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      if (!connectionString) {
        throw new Error("Chưa có biến DATABASE_URL. Hãy thêm biến này trên Render!");
      }

      // Tạo pool trực tiếp bằng chuỗi kết nối an toàn từ Render
      pool = mysql.createPool({
        uri: connectionString,
        ssl: { rejectUnauthorized: false }, // THÊM DÒNG NÀY ĐỂ BẬT SSL CHUẨN
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        multipleStatements: true,
        connectTimeout: 10000
      })

      // Test kết nối thử xem thông suốt chưa
      const connection = await pool.getConnection();
      console.log(`✅ Đã kết nối thành công tới Database Aiven Cloud!`);
      connection.release();

      // Tự động tạo các bảng nếu chưa có
      await pool.query(`
        CREATE TABLE IF NOT EXISTS menu (
          id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(191) NOT NULL, description TEXT, price DECIMAL(10,2) NOT NULL,
          image VARCHAR(255), category VARCHAR(50), tags TEXT, recommended BOOLEAN DEFAULT FALSE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)

      await pool.query(`
        CREATE TABLE IF NOT EXISTS tables (
          id INT AUTO_INCREMENT PRIMARY KEY, table_number VARCHAR(32) NOT NULL UNIQUE, token VARCHAR(128) NOT NULL UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)

      await pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id INT AUTO_INCREMENT PRIMARY KEY, order_number VARCHAR(64) NOT NULL UNIQUE, table_number VARCHAR(32) NOT NULL,
          total DECIMAL(10,2) NOT NULL, status ENUM('pending', 'preparing', 'ready', 'completed') DEFAULT 'pending',
          note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          payment_status VARCHAR(20) DEFAULT 'unpaid'
        )
      `)
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS order_details (
          id INT AUTO_INCREMENT PRIMARY KEY, order_id INT NOT NULL, menu_item_id INT NOT NULL, menu_item_name VARCHAR(191) NOT NULL,
          quantity INT NOT NULL, price DECIMAL(10,2) NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE, FOREIGN KEY (menu_item_id) REFERENCES menu(id) ON DELETE CASCADE
        )
      `)

      const [menuRows] = await pool.query('SELECT COUNT(*) AS count FROM menu')
      if (menuRows[0].count === 0) {
        await pool.query(`INSERT INTO menu (name, description, price, image, category, tags, recommended) VALUES ?`, [
          [
            ['Cà Phê Đá', 'Cà phê pha phin, phục vụ kèm đá', 28000, '/images/ca-phe-da.jpg', 'coffee', JSON.stringify(['Tươi']), false],
            ['Cà Phê Sữa', 'Cà phê pha với sữa đặc, thơm và ngọt dịu', 30000, '/images/ca-phe-sua.jpg', 'coffee', JSON.stringify(['Ngọt']), false],
            ['Bạc Xỉu', 'Cà phê nhẹ nhàng pha nhiều sữa, vị mềm mịn', 32000, '/images/bac-xiu.jpg', 'coffee', JSON.stringify(['Mềm']), false],
            ['Trà Đào', 'Trà đào đá tươi, thơm mùi đào', 28000, '/images/tra-dao.jpg', 'tea', JSON.stringify(['Trái cây']), false],
            ['Nước Cam', 'Nước cam vắt tươi, không đường', 35000, '/images/nuoc-cam.jpg', 'specialty', JSON.stringify(['Tươi']), false],
          ],
        ])
      }

      const [tableRows] = await pool.query('SELECT COUNT(*) AS count FROM tables')
      if (tableRows[0].count === 0) {
        const tableData = Array.from({ length: 8 }, (_, index) => [ `${index + 1}`, `token-table-${index + 1}-${Math.random().toString(36).slice(2, 8)}` ])
        await pool.query('INSERT INTO tables (table_number, token) VALUES ?', [tableData])
      }

      console.log(`Database initialized successfully!`)
      return
    } catch (error) {
      console.warn(`Lần thử kết nối ${attempt} thất bại:`, error.message);
      if (attempt === maxAttempts) throw error
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }
  }
}

async function publishTableNotification(tableNumber, payload) {
  try {
    if (!mqttClient || !mqttClient.connected) return
    const [rows] = await pool.query('SELECT token FROM tables WHERE table_number = ? LIMIT 1', [tableNumber])
    if (!rows.length) return
    const token = rows[0].token
    mqttClient.publish(`coffee/table/${token}/notify`, JSON.stringify(payload), { qos: 0 })
  } catch (error) { console.warn('MQTT publish failed:', error.message) }
}

async function findMenuItemByName(itemName) {
  try {
    const [menuItems] = await pool.query('SELECT * FROM menu');
    const removeAccents = (str) => {
      if (!str) return '';
      return str.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]/g, '');
    };
    const searchName = removeAccents(itemName);
    for (const item of menuItems) {
      const dbName = removeAccents(item.name);
      if (dbName === searchName || dbName.includes(searchName) || searchName.includes(dbName)) return item;
    }
    const firstWord = searchName.substring(0, 4);
    for (const item of menuItems) {
      const dbName = removeAccents(item.name);
      if (dbName.includes(firstWord)) return item;
    }
    return null;
  } catch (error) { return null; }
}

async function createOrderRecord({ tableNumber, items, note }) {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`
  const [result] = await pool.query(`INSERT INTO orders (order_number, table_number, total, status, note) VALUES (?, ?, ?, 'pending', ?)`, [orderNumber, tableNumber, total, note || ''])
  const orderId = result.insertId
  const details = items.map((item) => [orderId, item.id, item.name, item.quantity, item.price])
  await pool.query(`INSERT INTO order_details (order_id, menu_item_id, menu_item_name, quantity, price) VALUES ?`, [details])
  return { id: orderId, order_number: orderNumber, table_number: tableNumber, total, status: 'pending', note: note || '', created_at: new Date(), items }
}

async function fetchOrders() {
  const [rows] = await pool.query(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 50`)
  const orders = []
  for (const row of rows) {
    const [details] = await pool.query(`SELECT * FROM order_details WHERE order_id = ?`, [row.id])
    orders.push({ ...row, items: details.map((detail) => ({ id: detail.menu_item_id, name: detail.menu_item_name, quantity: detail.quantity, price: parseFloat(detail.price) })) })
  }
  return orders
}

app.get('/api/menu', async (req, res) => {
  try { const [rows] = await pool.query('SELECT * FROM menu ORDER BY category, name'); res.json(rows) } 
  catch (error) { res.status(500).json({ error: 'Không thể tải menu' }) }
})

app.get('/api/orders', async (req, res) => {
  try { const orders = await fetchOrders(); res.json(orders) } 
  catch (error) { res.status(500).json({ error: 'Không thể lấy danh sách đơn hàng' }) }
})

app.post('/api/order', async (req, res) => {
  try {
    const { tableNumber, items, note } = req.body
    if (!tableNumber || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Bàn và danh sách món là bắt buộc' })
    const order = await createOrderRecord({ tableNumber, items, note })
    io.emit('order:new', order)
    await publishTableNotification(tableNumber, { event: 'order_received', order })
    res.status(201).json(order)
  } catch (error) { res.status(500).json({ error: 'Không thể tạo đơn hàng' }) }
})

app.get('/api/table-entry', async (req, res) => {
  try {
    const token = String(req.query.token || '')
    if (!token) return res.status(400).json({ error: 'Token bàn không được để trống' })
    const [rows] = await pool.query('SELECT table_number FROM tables WHERE token = ? OR table_number = ? LIMIT 1', [token, token])
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy thông tin bàn tương ứng' })
    return res.json({ tableNumber: rows[0].table_number })
  } catch (error) { res.status(500).json({ error: 'Lỗi tra cứu cổng vào bàn' }) }
})

// =========================================================
// API HOÀN THÀNH ĐƠN (GỌI CÒI + LED BÀN ĐÓ KÊU)
// =========================================================
app.post('/api/order/:orderId/complete', async (req, res) => {
  try {
    const { orderId } = req.params
    await pool.query('UPDATE orders SET status = ? WHERE id = ?', ['completed', orderId])
    const [rows] = await pool.query('SELECT table_number FROM orders WHERE id = ?', [orderId])
    const tableNumber = rows.length ? rows[0].table_number : null

    const updatedOrder = await fetchOrders()
    const completedOrder = updatedOrder.find((order) => order.id === Number(orderId))
    io.emit('order:updated', completedOrder || null)
    
    if (tableNumber) {
      await publishTableNotification(tableNumber, { event: 'order_completed', orderId: Number(orderId) })
      console.log(`🎉 ĐÃ BẤM HOÀN THÀNH! Hệ thống web sẽ tự gọi Firebase để báo CÒI cho Bàn ${tableNumber}!`);
    }
    res.json({ success: true })
  } catch (error) { res.status(500).json({ error: 'Không thể cập nhật đơn hàng' }) }
})

const updateStatusHandler = async (req, res) => {
  try {
    const { id } = req.params; const { status } = req.body;
    await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    const updatedOrder = await fetchOrders();
    const order = updatedOrder.find((o) => o.id === Number(id));
    io.emit('order:updated', order || null);

    // 🚀 BỔ SUNG: Bắn thông báo qua MQTT để web khách hàng tự động cập nhật!
    if (order && order.table_number) {
      await publishTableNotification(order.table_number, { 
        event: 'order_updated', 
        order: order 
      });
    }

    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Lỗi' }); }
};
app.post('/api/order/:id/status', updateStatusHandler);
app.put('/api/order/:id/status', updateStatusHandler);

const updatePaymentHandler = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE orders SET payment_status = ? WHERE id = ?', ['paid', id]);
    const updatedOrder = await fetchOrders();
    const order = updatedOrder.find((o) => o.id === Number(id));
    io.emit('order:updated', order || null);

    // 🚀 BỔ SUNG TƯƠNG TỰ CHO THANH TOÁN
    if (order && order.table_number) {
      await publishTableNotification(order.table_number, { 
        event: 'order_updated', 
        order: order 
      });
    }

    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Lỗi' }); }
};
app.post('/api/order/:id/payment', updatePaymentHandler);
app.put('/api/order/:id/payment', updatePaymentHandler);


// =========================================================
// HÀM KẾT NỐI XIAO ZHI CHO TỪNG BÀN (HỖ TRỢ NHIỀU BÀN CÙNG LÚC)
// =========================================================
function connectXiaoZhi(url, index) {
  console.log(`⏳ Đang kết nối Xiao Zhi cho Bàn ${index + 1}...`);
  const ws = new WebSocket(url);

  ws.on('open', () => console.log(`✅ KẾT NỐI XIAO ZHI BÀN ${index + 1} THÀNH CÔNG!`));

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);

      if (message.method === 'initialize') {
        ws.send(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "server", version: "1.0.0" } } })); return;
      }
      if (message.method === 'tools/list') {
        ws.send(JSON.stringify({ 
          jsonrpc: "2.0", 
          id: message.id, 
          result: { 
            tools: [{ 
              name: "create_voice_order", 
              description: "Tạo đơn hàng gồm nhiều món. Gửi theo mẫu JSON: {\"tableNumber\":\"1\",\"items\":[{\"itemName\":\"Cà Phê Đá\",\"quantity\":2}]}", 
              inputSchema: { 
                type: "object", 
                properties: { 
                  tableNumber: { type: "string" }, 
                  items: { 
                    type: "array", 
                    items: {
                      type: "object",
                      properties: {
                        itemName: { type: "string" },
                        quantity: { type: "number" }
                      },
                      required: ["itemName", "quantity"]
                    }
                  } 
                }, 
                required: ["tableNumber", "items"],
                examples: [{
                  tableNumber: "1",
                  items: [{ itemName: "Cà Phê Đá", quantity: 2 }, { itemName: "Trà Đào", quantity: 1 }]
                }]
              } 
            }] 
          } 
        })); 
        return;
      }
      if (message.method === 'ping') {
        ws.send(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} })); return;
      }

      if (message.method === 'tools/call' && message.params?.name === 'create_voice_order') {
        const rawArguments = message.params?.arguments || {};
        const tableNumber = rawArguments.tableNumber;
        let items = rawArguments.items;

        if (!Array.isArray(items) || items.length === 0) {
          if (rawArguments.itemName) {
            items = [{ itemName: rawArguments.itemName, quantity: rawArguments.quantity ?? 1 }];
          }
        }
        
        try {
          if (!items || !Array.isArray(items) || items.length === 0) {
            ws.send(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: "Lỗi: Không có món nào trong đơn." }] } })); 
            return;
          }

          const orderItems = [];
          for (const rawItem of items) {
            const menuItem = await findMenuItemByName(rawItem.itemName);
            if (menuItem) {
              orderItems.push({
                id: menuItem.id,
                name: menuItem.name,
                quantity: Number(rawItem.quantity || 1),
                price: Number(menuItem.price)
              });
            }
          }

          if (orderItems.length === 0) {
            ws.send(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: "Lỗi: Quán không có các món này trong menu." }] } })); 
            return;
          }

          const order = await createOrderRecord({
            tableNumber: String(tableNumber),
            items: orderItems,
            note: 'Khách gọi qua AI', 
          });

          // 1. Bắn qua Socket để Dashboard quản lý tự động nhảy đơn ngay lập tức
          io.emit('order:new', order);

          // 2. BỔ SUNG: Bắn tín hiệu qua MQTT để phần cứng ở quầy nhận được đơn
          await publishTableNotification(tableNumber, { event: 'voice_order_received', order });
          
          // Gửi thêm một lệnh tổng cho quầy (nếu phần cứng quầy của bạn đang lắng nghe kênh chung)
          if (mqttClient && mqttClient.connected) {
            const espPayload = JSON.stringify({
              id: order.order_number || String(order.id),
              table: String(order.table_number),
              item: order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')
            });
            
            // Bắn vào đúng kênh mà ESP32 đang lắng nghe
            mqttClient.publish('coffee/kitchen', espPayload, { qos: 0 });
            // Đồng thời bắn sang kênh cũ nếu cần
            mqttClient.publish('cafe/dashboard/new_order', espPayload, { qos: 0 });
          }

          console.log(`✅ Đã tạo đơn AI cho Bàn ${tableNumber} và báo phần cứng thành công!`);
          
          ws.send(JSON.stringify({
            jsonrpc: "2.0", 
            id: message.id, 
            result: { 
              content: [{ 
                type: "text", 
                text: `Tạo đơn thành công! Hãy báo khách: "Dạ vâng, em đã lên đủ các món cho anh chị rồi ạ. Anh chị đợi một lát nhé!"` 
              }] 
            }
          }));

        } catch (dbError) { 
          console.error('Lỗi lưu đơn:', dbError); 
          ws.send(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: "Lỗi hệ thống khi lưu đơn." }] } }));
        }
      }
    } catch (error) { console.error('Lỗi JSON:', error); }
  });

  ws.on('close', () => {
    console.log(`❌ Mất kết nối Xiao Zhi Bàn ${index + 1}. Tự động kết nối lại...`);
    setTimeout(() => connectXiaoZhi(url, index), 5000);
  });
  ws.on('error', (err) => console.error(`Lỗi WebSocket Bàn ${index + 1}:`, err.message));
}

async function startServer() {
  try {
    await connectDatabase()
    
    // THÊM CLIENT ID ĐỂ CHỐNG LỖI MQTT BỊ VĂNG (ECONNRESET)
    mqttClient = mqtt.connect(MQTT_BROKER_URL, { 
      clientId: 'coffee-backend-' + Math.random().toString(16).slice(2),
      reconnectPeriod: 5000, 
      connectTimeout: 30000 
    })
    
    mqttClient.on('connect', () => { console.log('MQTT connected successfully!') })
    mqttClient.on('error', (error) => { console.warn('MQTT error:', error.message) })

    server.listen(BACKEND_PORT, () => {
      console.log(`Backend Hub running on http://localhost:${BACKEND_PORT}`)
      
      // KHỞI ĐỘNG KẾT NỐI XIAO ZHI CHO TOÀN BỘ CÁC BÀN
      XIAO_ZHI_WSS_URLS.forEach((url, index) => {
        if (url && url.includes('token=')) { connectXiaoZhi(url, index) }
      });
    })
  } catch (error) { console.error('Startup failed:', error); process.exit(1) }
}

startServer()