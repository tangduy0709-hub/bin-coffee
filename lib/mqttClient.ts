import mqtt from 'mqtt';

// Kết nối đến Mosquitto WebSocket công khai (Khớp với server của mạch Arduino)
// Lưu ý: Phải dùng wss (bảo mật) và cổng 8081 dành riêng cho Web
const client = mqtt.connect('wss://test.mosquitto.org:8081/mqtt', {
  clientId: 'web_dashboard_' + Math.random().toString(16).substring(2, 8),
  clean: true,
  connectTimeout: 5000,
});

client.on('connect', () => {
  console.log('✅ Web đã kết nối thành công với Mosquitto!');
});

client.on('error', (err) => {
  console.error('❌ Lỗi kết nối MQTT:', err);
});

export default client;