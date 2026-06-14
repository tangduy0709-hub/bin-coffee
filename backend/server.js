const express = require('express')
const http = require('http')
const cors = require('cors')
const mqtt = require('mqtt')
const mysql = require('mysql2/promise')
const { Server } = require('socket.io')
require('dotenv').config()

const BACKEND_PORT = process.env.BACKEND_PORT || 4000
const DATABASE_HOST = process.env.DATABASE_HOST || '127.0.0.1'
const DATABASE_PORT = Number(process.env.DATABASE_PORT || 3306)
const DATABASE_USER = process.env.DATABASE_USER || 'root'
const DATABASE_PASSWORD = process.env.DATABASE_PASSWORD || ''
const DATABASE_NAME = process.env.DATABASE_NAME || 'coffee_shop'
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://test.mosquitto.org:1883'

const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } })

app.use(cors())
app.use(express.json())

let pool
let mqttClient

async function connectDatabase() {
  const dbConfig = {
    host: DATABASE_HOST,
    port: DATABASE_PORT,
    user: DATABASE_USER,
    password: DATABASE_PASSWORD,
    multipleStatements: true,
    connectTimeout: 10000,
  }

  const maxAttempts = 5
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const initialConnection = await mysql.createConnection(dbConfig)
      await initialConnection.query(`CREATE DATABASE IF NOT EXISTS \`${DATABASE_NAME}\``)
      await initialConnection.end()

      pool = mysql.createPool({
        ...dbConfig,
        database: DATABASE_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      })

      await pool.query(`
        CREATE TABLE IF NOT EXISTS menu (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(191) NOT NULL,
          description TEXT,
          price DECIMAL(10,2) NOT NULL,
          image VARCHAR(255),
          category VARCHAR(50),
          tags TEXT,
          recommended BOOLEAN DEFAULT FALSE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)

      await pool.query(`
        CREATE TABLE IF NOT EXISTS tables (
          id INT AUTO_INCREMENT PRIMARY KEY,
          table_number VARCHAR(32) NOT NULL UNIQUE,
          token VARCHAR(128) NOT NULL UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)

      await pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id INT AUTO_INCREMENT PRIMARY KEY,
          order_number VARCHAR(64) NOT NULL UNIQUE,
          table_number VARCHAR(32) NOT NULL,
          total DECIMAL(10,2) NOT NULL,
          status ENUM('pending', 'preparing', 'ready', 'completed') DEFAULT 'pending',
          note TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `)

      await pool.query(`
        CREATE TABLE IF NOT EXISTS order_details (
          id INT AUTO_INCREMENT PRIMARY KEY,
          order_id INT NOT NULL,
          menu_item_id INT NOT NULL,
          menu_item_name VARCHAR(191) NOT NULL,
          quantity INT NOT NULL,
          price DECIMAL(10,2) NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
          FOREIGN KEY (menu_item_id) REFERENCES menu(id) ON DELETE CASCADE
        )
      `)

      const [menuRows] = await pool.query('SELECT COUNT(*) AS count FROM menu')
      if (menuRows[0].count === 0) {
        await pool.query(`INSERT INTO menu (name, description, price, image, category, tags, recommended) VALUES ?`, [
          [
            ['Espresso Đặc Biệt', 'Espresso đôi đậm đà với hương vị socola đen', 25000, '/images/espresso.jpg', 'coffee', JSON.stringify(['Mạnh', 'Cổ điển']), true],
            ['Latte Caramel', 'Latte kem mịn với caramel tự chế và vani', 32000, '/images/caramel-latte.jpg', 'coffee', JSON.stringify(['Ngọt', 'Phổ biến']), true],
            ['Cappuccino Sữa Yến Mạch', 'Cappuccino mịn với bọt sữa yến mạch hữu cơ', 30000, '/images/cappuccino.jpg', 'coffee', JSON.stringify(['Thực vật', 'Kem mịn']), false],
            ['Cà Phê Lạnh', 'Cà phê ngâm 24 giờ, mượt mà và tươi mát', 28000, '/images/cold-brew.jpg', 'coffee', JSON.stringify(['Tươi mát', 'Mượt mà']), false],
            ['Latte Matcha', 'Matcha cấp độ lễ hội với sữa tùy chọn', 32000, '/images/matcha.jpg', 'tea', JSON.stringify(['Mộc mạc', 'Tỉnh táo']), true],
            ['Latte Chai', 'Hỗn hợp chai gia vị với quế ấm áp và thảo quả', 30000, '/images/chai.jpg', 'tea', JSON.stringify(['Gia vị', 'Ấm áp']), false],
            ['Croissant Hạnh Nhân', 'Croissant bơ lùn nhân kem hạnh nhân', 25000, '/images/croissant.jpg', 'pastry', JSON.stringify(['Tươi', 'Bán chạy']), true],
            ['Bánh Cuộn Quế', 'Bánh cuộn quế ấm áp với kem phô mai', 26000, '/images/roll.jpg', 'pastry', JSON.stringify(['Ngọt', 'Thoải mái']), false],
          ],
        ])
      }

      const [tableRows] = await pool.query('SELECT COUNT(*) AS count FROM tables')
      if (tableRows[0].count === 0) {
        const tableData = Array.from({ length: 8 }, (_, index) => [
          `${index + 1}`,
          `token-table-${index + 1}-${Math.random().toString(36).slice(2, 8)}`,
        ])
        await pool.query('INSERT INTO tables (table_number, token) VALUES ?', [tableData])
      }

      console.log(`Connected to MySQL database '${DATABASE_NAME}' on ${DATABASE_HOST}:${DATABASE_PORT}`)
      return
    } catch (error) {
      const message = error?.message || String(error)
      if (attempt === maxAttempts) {
        const hint = `Please ensure MySQL is running on ${DATABASE_HOST}:${DATABASE_PORT} and DATABASE_USER/DATABASE_PASSWORD are correct.`
        console.error(`Database connection failed after ${maxAttempts} attempts. ${hint}`)
        throw error
      }
      console.warn(`Database connection attempt ${attempt}/${maxAttempts} failed: ${message}`)
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }
  }
}

async function publishTableNotification(tableNumber, payload) {
  try {
    if (!mqttClient || !mqttClient.connected) {
      console.warn('MQTT publish skipped: client is not connected yet')
      return
    }

    const [rows] = await pool.query('SELECT token FROM tables WHERE table_number = ? LIMIT 1', [tableNumber])
    if (!rows.length) return
    const token = rows[0].token
    mqttClient.publish(`coffee/table/${token}/notify`, JSON.stringify(payload), { qos: 0 }, (error) => {
      if (error) {
        console.warn('MQTT publish failed:', error.message)
      }
    })
  } catch (error) {
    console.warn('MQTT publish failed:', error.message)
  }
}

async function findMenuItemByName(itemName) {
  const normalized = itemName.trim().toLowerCase()
  const [rows] = await pool.query(
    `SELECT * FROM menu WHERE LOWER(name) LIKE ? OR LOWER(name) LIKE ? LIMIT 1`,
    [`%${normalized}%`, `%${normalized.split(' ')[0]}%`]
  )
  return rows[0] || null
}

async function createOrderRecord({ tableNumber, items, note }) {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`

  const [result] = await pool.query(
    `INSERT INTO orders (order_number, table_number, total, status, note) VALUES (?, ?, ?, 'pending', ?)`,
    [orderNumber, tableNumber, total, note || '']
  )

  const orderId = result.insertId
  const details = items.map((item) => [
    orderId,
    item.id,
    item.name,
    item.quantity,
    item.price,
  ])
  await pool.query(
    `INSERT INTO order_details (order_id, menu_item_id, menu_item_name, quantity, price) VALUES ?`,
    [details]
  )

  return {
    id: orderId,
    order_number: orderNumber,
    table_number: tableNumber,
    total,
    status: 'pending',
    note: note || '',
    created_at: new Date(),
    items,
  }
}

async function fetchOrders() {
  const [rows] = await pool.query(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 50`)
  const orders = []

  for (const row of rows) {
    const [details] = await pool.query(`SELECT * FROM order_details WHERE order_id = ?`, [row.id])
    orders.push({
      ...row,
      items: details.map((detail) => ({
        id: detail.menu_item_id,
        name: detail.menu_item_name,
        quantity: detail.quantity,
        price: parseFloat(detail.price),
      })),
    })
  }

  return orders
}

app.get('/api/menu', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM menu ORDER BY category, name')
    res.json(rows)
  } catch (error) {
    res.status(500).json({ error: 'Không thể tải menu' })
  }
})

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await fetchOrders()
    res.json(orders)
  } catch (error) {
    res.status(500).json({ error: 'Không thể lấy danh sách đơn hàng' })
  }
})

app.post('/api/order', async (req, res) => {
  try {
    const { tableNumber, items, note } = req.body
    if (!tableNumber || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Bàn và danh sách món là bắt buộc' })
    }

    const order = await createOrderRecord({ tableNumber, items, note })
    io.emit('order:new', order)
    await publishTableNotification(tableNumber, {
      event: 'order_received',
      order,
    })

    res.status(201).json(order)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Không thể tạo đơn hàng' })
  }
})

app.post('/api/voice-order', async (req, res) => {
  try {
    const { tableNumber, itemName, quantity, note } = req.body
    if (!tableNumber || !itemName || !quantity) {
      return res.status(400).json({ error: 'Bàn, tên món và số lượng là bắt buộc' })
    }

    const menuItem = await findMenuItemByName(itemName)
    if (!menuItem) {
      return res.status(404).json({ error: 'Không tìm thấy món trong menu' })
    }

    const order = await createOrderRecord({
      tableNumber,
      items: [
        {
          id: menuItem.id,
          name: menuItem.name,
          quantity: Number(quantity),
          price: Number(menuItem.price),
        },
      ],
      note,
    })

    io.emit('order:new', order)
    await publishTableNotification(tableNumber, {
      event: 'voice_order_received',
      order,
    })

    res.status(201).json(order)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi khi xử lý đơn giọng nói' })
  }
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
      await publishTableNotification(tableNumber, {
        event: 'order_completed',
        orderId: Number(orderId),
      })
    }

    res.json({ success: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Không thể cập nhật đơn hàng' })
  }
})

app.get('/api/tables', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT table_number, token FROM tables ORDER BY table_number')
    res.json(rows)
  } catch (error) {
    res.status(500).json({ error: 'Không thể lấy thông tin bàn' })
  }
})

io.on('connection', (socket) => {
  console.log('Staff dashboard connected', socket.id)
  socket.on('disconnect', () => {
    console.log('Staff dashboard disconnected', socket.id)
  })
})

async function startServer() {
  try {
    await connectDatabase()

    mqttClient = mqtt.connect(MQTT_BROKER_URL, {
      reconnectPeriod: 5000,
      connectTimeout: 30000,
    })
    mqttClient.on('connect', () => {
      console.log('MQTT connected to', MQTT_BROKER_URL)
    })
    mqttClient.on('reconnect', () => {
      console.warn('MQTT reconnecting to', MQTT_BROKER_URL)
    })
    mqttClient.on('offline', () => {
      console.warn('MQTT client is offline')
    })
    mqttClient.on('close', () => {
      console.warn('MQTT connection closed')
    })
    mqttClient.on('error', (error) => {
      console.warn('MQTT error:', error.message)
    })

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${BACKEND_PORT} is already in use. Stop the existing backend or change BACKEND_PORT.`)
      } else {
        console.error('Server error:', error)
      }
      process.exit(1)
    })

    server.listen(BACKEND_PORT, () => {
      console.log(`Backend Hub running on http://localhost:${BACKEND_PORT}`)
    })
  } catch (error) {
    console.error('Startup failed:', error)
    process.exit(1)
  }
}

startServer()
