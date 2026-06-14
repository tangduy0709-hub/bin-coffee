import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'

// Config
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const NUM_TABLES = 15 // Số bàn trong quán

async function generateQRCodes() {
  const qrDir = path.join(process.cwd(), 'public', 'qr-codes')
  
  // Tạo folder nếu chưa có
  if (!fs.existsSync(qrDir)) {
    fs.mkdirSync(qrDir, { recursive: true })
    console.log(`✅ Tạo folder: ${qrDir}`)
  }

  // Generate QR code cho mỗi bàn
  for (let tableNum = 1; tableNum <= NUM_TABLES; tableNum++) {
    const url = `${BASE_URL}?table=${tableNum}`
    const filename = path.join(qrDir, `table-${tableNum}.png`)

    try {
      await QRCode.toFile(filename, url, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })
      console.log(`✅ Tạo QR code cho bàn ${tableNum}: ${url}`)
    } catch (error) {
      console.error(`❌ Lỗi tạo QR code bàn ${tableNum}:`, error)
    }
  }

  console.log(`\n✅ Hoàn thành! QR codes lưu tại: ${qrDir}`)
}

generateQRCodes().catch(console.error)
