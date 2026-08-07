const express = require('express')
const http = require('http')
const cors = require('cors')
const mqtt = require('mqtt')
const mysql = require('mysql2/promise')
const { Server } = require('socket.io')
const WebSocket = require('ws'); 
const https = require('https'); // Dùng cho Firebase
require('dotenv').config()

const BACKEND_PORT = process.env.BACKEND_PORT || 4000
const DATABASE_PASSWORD = process.env.DATABASE_PASSWORD || ''
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://test.mosquitto.org:1883'

// =========================================================
// 🚀 ĐIỀN LINK CỦA TẤT CẢ CÁC BÀN VÀO ĐÂY
// =========================================================
const XIAO_ZHI_WSS_URLS = [
  "wss://api.xiaozhi.me/mcp/?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjk2NjE1OCwiYWdlbnRJZCI6MjAwNzI0NywiZW5kcG9pbnRJZCI6ImFnZW50XzIwMDcyNDciLCJwdXJwb3NlIjoibWNwLWVuZHBvaW50IiwiaWF0IjoxNzgzMjc5OTY5LCJleHAiOjE4MTQ4Mzc1Njl9.OSjXO--WevFiUADNrk28UkmhDEQpbk5v5iXuCE0xgp7fVcqmOWz8FUIUyfp9zhBkEbH1v4Fr62O-zyuyz8S8XA", // BÀN 1
  "wss://api.xiaozhi.me/mcp/?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjk2NjE1OCwiYWdlbnRJZCI6MjIwNTQxMywiZW5kcG9pbnRJZCI6ImFnZW50XzIyMDU0MTMiLCJwdXJwb3NlIjoibWNwLWVuZHBvaW50IiwiaWF0IjoxNzg1ODMzMzc0LCJleHAiOjE4MTczOTA5NzR9.Vi5To9JsZ6g8lDXcNgcjU-74y6CxSfoN74CnE4icyr4T1Y9X2x7bosQ9Vfe8eM4VbZKK3Da-w31tzNUAaDJd0g" // BÀN 2
];

const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } })

app.use(cors())
app.use(express.json())

let pool
let mqttClient

// =========================================================
// 🚀 HÀM KHỬ DẤU TIẾNG VIỆT (DÀNH RIÊNG CHO ESP32)
// =========================================================
function boDauTiengViet(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

// =========================================================
// 🚀 HÀM GỌI CÒI FIREBASE DÙNG CHUNG (CHỈ KHI PHA XONG - READY)
// =========================================================
function triggerFirebaseBell(tableNumber) {
  try {
    const matchSoBan = String(tableNumber).match(/\d+/);
    const soBanFirebase = matchSoBan ? matchSoBan[0] : "1";
    
    const payloadData = JSON.stringify({
      ban: soBanFirebase,
      trang_thai: "READY",
      thoi_gian: Date.now()
    });

    const options = {
      hostname: 'cafe-thong-bao-default-rtdb.firebaseio.com',
      port: 443,
      path: '/thong_bao.json',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payloadData)
      }
    };

    const reqData = https.request(options, (resFirebase) => {
      console.log(`🔥 Đã bắn tín hiệu Firebase gọi còi Bàn ${soBanFirebase} (Mã trạng thái: ${resFirebase.statusCode})`);
    });

    reqData.on('error', (e) => {
      console.error(`Lỗi kết nối Firebase từ backend: ${e.message}`);
    });

    reqData.write(payloadData);
    reqData.end();
  } catch (err) {
    console.error('Lỗi gọi Firebase từ backend:', err.message);
  }
}

async function connectDatabase() {
  const maxAttempts = 5
  const connectionString = process.env.DATABASE_URL;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      if (!connectionString) {
        throw new Error("Chưa có biến DATABASE_URL. Hãy thêm biến này trên Render!");
      }

      pool = mysql.createPool({
        uri: connectionString,
        ssl: { rejectUnauthorized: false },
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        multipleStatements: true,
        connectTimeout: 10000
      })

      const connection = await pool.getConnection();
      console.log(`✅ Đã kết nối thành công tới Database Aiven Cloud!`);
      connection.release();

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

// =========================================================
// 🚀 HÀM TẠO ĐƠN MỚI
// =========================================================
async function createOrderRecord({ tableNumber, items, note }) {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`
  
  const [result] = await pool.query(
    `INSERT INTO orders (order_number, table_number, total, status, note) VALUES (?, ?, ?, 'pending', ?)`, 
    [orderNumber, tableNumber, total, note || '']
  )
  const orderId = result.insertId
  const details = items.map((item) => [orderId, item.id, item.name, item.quantity, item.price])
  await pool.query(`INSERT INTO order_details (order_id, menu_item_id, menu_item_name, quantity, price) VALUES ?`, [details])

  const newOrderObj = { 
    id: orderId, order_number: orderNumber, table_number: tableNumber, table: tableNumber, 
    total, status: 'pending', note: note || '', created_at: new Date(), items 
  };

  io.emit('order:new', newOrderObj);
  io.emit('order:updated', newOrderObj); 

  if (mqttClient && mqttClient.connected) {
    const chuoiMonAn = items.map(i => `${i.quantity}x ${i.name}`).join(', ');
    const chuoiKhongDau = boDauTiengViet(chuoiMonAn);
    const espPayload = JSON.stringify({ id: orderNumber, table: String(tableNumber), item: chuoiKhongDau });
    
    mqttClient.publish('coffee/kitchen', espPayload, { qos: 0 });
    mqttClient.publish('cafe/dashboard/new_order', espPayload, { qos: 0 });
  }
  return newOrderObj;
}

// =========================================================
// 🚀 HÀM ĐỔI/CẬP NHẬT ĐƠN HÀNG KHI KHÁCH ĐỔI Ý (DÀNH CHO AI)
// =========================================================
async function modifyOrderRecord({ tableNumber, items }) {
  const [rows] = await pool.query(
    `SELECT * FROM orders WHERE table_number = ? AND status IN ('pending', 'preparing') ORDER BY created_at DESC`,
    [tableNumber]
  );

  if (rows.length === 0) {
    return await createOrderRecord({ tableNumber, items, note: 'Khách gọi qua AI (Tự động tạo mới)' });
  }

  const order = rows[0];
  const orderId = order.id;

  if (rows.length > 1) {
    for (let i = 1; i < rows.length; i++) {
      await pool.query(`DELETE FROM order_details WHERE order_id = ?`, [rows[i].id]);
      await pool.query(`DELETE FROM orders WHERE id = ?`, [rows[i].id]);
    }
  }

  await pool.query(`DELETE FROM order_details WHERE order_id = ?`, [orderId]);

  if (!items || items.length === 0) {
    await pool.query(`DELETE FROM orders WHERE id = ?`, [orderId]);
    io.emit('order:updated', { id: orderId, isDeleted: true, table_number: tableNumber });
    return null;
  }

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const details = items.map((item) => [orderId, item.id, item.name, item.quantity, item.price]);
  
  await pool.query(`INSERT INTO order_details (order_id, menu_item_id, menu_item_name, quantity, price) VALUES ?`, [details]);
  await pool.query(`UPDATE orders SET total = ? WHERE id = ?`, [total, orderId]);

  const ordersList = await fetchOrders();
  const updatedOrder = ordersList.find(o => o.id === orderId);

  io.emit('order:updated', updatedOrder);
  await publishTableNotification(tableNumber, { 
    event: 'order_updated', 
    order: updatedOrder 
  });

  if (mqttClient && mqttClient.connected) {
    const chuoiMonAn = items.map(i => `${i.quantity}x ${i.name}`).join(', ');
    const chuoiKhongDau = boDauTiengViet(chuoiMonAn);
    const espPayload = JSON.stringify({
      id: order.order_number,
      table: String(tableNumber),
      item: "[DOI MON] " + chuoiKhongDau 
    });
    mqttClient.publish('coffee/kitchen', espPayload, { qos: 0 });
    mqttClient.publish('cafe/dashboard/new_order', espPayload, { qos: 0 }); 
  }

  return updatedOrder;
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

// =========================================================
// CÁC ĐƯỜNG DẪN API HTTP CỦA DASHBOARD & WEB BÀN
// =========================================================
app.get('/api/menu', async (req, res) => {
  try { const [rows] = await pool.query('SELECT * FROM menu ORDER BY category, name'); res.json(rows) } 
  catch (error) { res.status(500).json({ error: 'Không thể tải menu' }) }
})

app.get('/api/orders', async (req, res) => {
  try { const orders = await fetchOrders(); res.json(orders) } 
  catch (error) { res.status(500).json({ error: 'Không thể lấy danh sách đơn hàng' }) }
})

// 🚀 API LẤY ĐƠN HÀNG CHƯA HOÀN THÀNH CỦA BÀN (GIÚP KHÁCH F5 HOẶC THOÁT RA VÀO LẠI KHÔNG BỊ MẤT ĐƠN)
app.get('/api/table/:tableNumber/active-order', async (req, res) => {
  try {
    const { tableNumber } = req.params;
    const [rows] = await pool.query(
      `SELECT * FROM orders WHERE table_number = ? AND status != 'completed' ORDER BY created_at DESC LIMIT 1`,
      [tableNumber]
    );

    if (rows.length === 0) {
      return res.json({ order: null });
    }

    const order = rows[0];
    const [details] = await pool.query(`SELECT * FROM order_details WHERE order_id = ?`, [order.id]);
    
    const fullOrder = {
      ...order,
      items: details.map((detail) => ({
        id: detail.menu_item_id,
        name: detail.menu_item_name,
        quantity: detail.quantity,
        price: parseFloat(detail.price)
      }))
    };

    res.json({ order: fullOrder });
  } catch (error) {
    res.status(500).json({ error: 'Không thể lấy thông tin đơn hàng của bàn' });
  }
});

app.post('/api/order', async (req, res) => {
  try {
    const { tableNumber, items, note } = req.body
    if (!tableNumber || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Bàn và danh sách món là bắt buộc' })
    const order = await createOrderRecord({ tableNumber, items, note })
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

    if (order && order.table_number) {
      await publishTableNotification(order.table_number, { event: 'order_updated', order: order });
      if (status === 'ready') { triggerFirebaseBell(order.table_number); }
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

    if (order && order.table_number) {
      await publishTableNotification(order.table_number, { event: 'order_updated', order: order });
    }
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Lỗi' }); }
};
app.post('/api/order/:id/payment', updatePaymentHandler);
app.put('/api/order/:id/payment', updatePaymentHandler);

// =========================================================
// 🚀 KẾT NỐI XIAO ZHI AI 
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
          jsonrpc: "2.0", id: message.id, 
          result: { 
            tools: [
              { 
                name: "create_voice_order", 
                description: "Tạo đơn hàng MỚI gồm nhiều món. Chỉ dùng khi khách GỌI LẦN ĐẦU. Gửi theo mẫu JSON: {\"tableNumber\":\"1\",\"items\":[{\"itemName\":\"Cà Phê Đá\",\"quantity\":2}]}", 
                inputSchema: { 
                  type: "object", 
                  properties: { 
                    tableNumber: { type: "string" }, 
                    items: { type: "array", items: { type: "object", properties: { itemName: { type: "string" }, quantity: { type: "number" } }, required: ["itemName", "quantity"] } } 
                  }, required: ["tableNumber", "items"]
                } 
              },
              {
                name: "update_voice_order",
                description: "Dùng để ĐỔI MÓN, THÊM MÓN, hoặc HỦY MÓN ĐÃ CHỐT trước đó. Truyền vào danh sách MỚI HOÀN TOÀN (tổng hợp lại các món khách giữ và món mới). Nếu khách hủy toàn bộ, truyền mảng items rỗng.",
                inputSchema: { 
                  type: "object", 
                  properties: { 
                    tableNumber: { type: "string" }, 
                    items: { type: "array", items: { type: "object", properties: { itemName: { type: "string" }, quantity: { type: "number" } }, required: ["itemName", "quantity"] } } 
                  }, required: ["tableNumber", "items"]
                }
              }
            ] 
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
          if (rawArguments.itemName) { items = [{ itemName: rawArguments.itemName, quantity: rawArguments.quantity ?? 1 }]; }
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
              orderItems.push({ id: menuItem.id, name: menuItem.name, quantity: Number(rawItem.quantity || 1), price: Number(menuItem.price) });
            }
          }

          if (orderItems.length === 0) {
            ws.send(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: "Lỗi: Quán không có các món này trong menu." }] } })); 
            return;
          }

          const order = await createOrderRecord({ tableNumber: String(tableNumber), items: orderItems, note: 'Khách gọi qua AI' });
          await publishTableNotification(tableNumber, { event: 'voice_order_received', order });
          
          ws.send(JSON.stringify({
            jsonrpc: "2.0", id: message.id, 
            result: { content: [{ type: "text", text: `Tạo đơn thành công! Hãy báo khách: "Dạ vâng, em đã lên đủ các món cho anh chị rồi ạ. Anh chị đợi một lát nhé!"` }] }
          }));

        } catch (dbError) { 
          ws.send(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: "Lỗi hệ thống khi lưu đơn." }] } }));
        }
      } 
      else if (message.method === 'tools/call' && message.params?.name === 'update_voice_order') {
        const rawArguments = message.params?.arguments || {};
        const tableNumber = rawArguments.tableNumber;
        const items = rawArguments.items || [];
        
        try {
          const orderItems = [];
          for (const rawItem of items) {
            const menuItem = await findMenuItemByName(rawItem.itemName);
            if (menuItem) {
              orderItems.push({ id: menuItem.id, name: menuItem.name, quantity: Number(rawItem.quantity || 1), price: Number(menuItem.price) });
            }
          }

          await modifyOrderRecord({ tableNumber: String(tableNumber), items: orderItems });
          
          ws.send(JSON.stringify({
            jsonrpc: "2.0", id: message.id, 
            result: { content: [{ type: "text", text: `Đổi món thành công. Hãy báo khách: "Dạ vâng, em đã cập nhật lại đơn cho mình rồi ạ!"` }] }
          }));

        } catch (error) {
          if (error.message === "TOO_LATE") {
            ws.send(JSON.stringify({
              jsonrpc: "2.0", id: message.id, 
              result: { content: [{ type: "text", text: "Báo khách khéo léo: Dạ món của mình quầy đã pha xong mất rồi, em không đổi được nữa, anh chị thông cảm nhé!" }] }
            }));
          } else {
            ws.send(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: "Lỗi hệ thống khi sửa đơn." }] } }));
          }
        }
      }
    } catch (error) { 
      console.error('Lỗi JSON:', error); 
    }
  });

  ws.on('close', () => {
    console.log(`❌ Mất kết nối Xiao Zhi Bàn ${index + 1}. Tự động kết nối lại...`);
    setTimeout(() => connectXiaoZhi(url, index), 5000);
  });
  ws.on('error', (err) => console.error(`Lỗi WebSocket Bàn ${index + 1}:`, err.message));
}

// =========================================================
// 🚀 KHỞI ĐỘNG HỆ THỐNG
// =========================================================
async function startServer() {
  try {
    await connectDatabase()
    
    mqttClient = mqtt.connect(MQTT_BROKER_URL, { 
      clientId: 'coffee-backend-' + Math.random().toString(16).slice(2),
      reconnectPeriod: 5000, 
      connectTimeout: 30000 
    })
    
    mqttClient.on('connect', () => { 
      console.log('MQTT connected successfully!')
      mqttClient.subscribe('cafe/dashboard/status', (err) => {
        if (!err) console.log('Đã subscribe thành công kênh cafe/dashboard/status');
      });
    })

    mqttClient.on('error', (error) => { console.warn('MQTT error:', error.message) })

    mqttClient.on('message', async (topic, message) => {
      if (topic === 'cafe/dashboard/status') {
        try {
          const data = JSON.parse(message.toString());
          const orderIdOrNum = data.id;
          const newStatus = data.status === 'COMPLETED' ? 'ready' : (data.status === 'PREPARING' ? 'preparing' : 'pending');

          if (orderIdOrNum) {
            if (String(orderIdOrNum).startsWith('ORD')) {
              await pool.query('UPDATE orders SET status = ? WHERE order_number = ?', [newStatus, orderIdOrNum]);
            } else {
              await pool.query('UPDATE orders SET status = ? WHERE id = ?', [newStatus, orderIdOrNum]);
            }

            const ordersList = await fetchOrders();
            const updatedOrder = ordersList.find(o => String(o.id) === String(orderIdOrNum) || o.order_number === orderIdOrNum);

            if (updatedOrder) {
              io.emit('order:updated', updatedOrder);

              if (updatedOrder.table_number) {
                await publishTableNotification(updatedOrder.table_number, { event: 'order_updated', order: updatedOrder });
                if (newStatus === 'ready') { triggerFirebaseBell(updatedOrder.table_number); }
              }
            }
          }
        } catch (e) {
          console.error('Lỗi xử lý tin nhắn MQTT từ ESP32:', e.message);
        }
      }
    });

    server.listen(BACKEND_PORT, () => {
      console.log(`Backend Hub running on http://localhost:${BACKEND_PORT}`)
      XIAO_ZHI_WSS_URLS.forEach((url, index) => {
        if (url && url.includes('token=')) { connectXiaoZhi(url, index) }
      });
    })
  } catch (error) { console.error('Startup failed:', error); process.exit(1) }
}

startServer()