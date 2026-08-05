import mqtt from 'mqtt';

// Kết nối tới HiveMQ qua WebSockets bảo mật (Port 8884)
const client = mqtt.connect('wss://broker.hivemq.com:8884/mqtt');

client.on('connect', () => {
  console.log('✅ Web đã kết nối thành công với MQTT Broker!');
});

client.on('error', (err) => {
  console.error('❌ Lỗi kết nối MQTT:', err);
});

export default client;
