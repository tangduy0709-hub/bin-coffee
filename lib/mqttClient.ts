import mqtt from 'mqtt';

// Sử dụng HiveMQ WebSocket (Ổn định và không bị chặn như Mosquitto)
const client = mqtt.connect('wss://broker.hivemq.com:8884/mqtt', {
  clientId: 'web_dashboard_' + Math.random().toString(16).substring(2, 8),
  clean: true,
  connectTimeout: 5000,
});

client.on('connect', () => {
  console.log('✅ Web đã kết nối thành công với HiveMQ!');
});

client.on('error', (err) => {
  console.error('❌ Lỗi kết nối MQTT:', err);
});

export default client;