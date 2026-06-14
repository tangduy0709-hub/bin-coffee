const mysql = require('mysql2/promise');

;(async () => {
  try {
    const conn = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password: '', database: 'mysql' });
    console.log('connected');
    const [rows] = await conn.query('SELECT VERSION() AS version');
    console.log(rows);
    await conn.end();
  } catch (e) {
    console.error('err', e.message);
    process.exit(1);
  }
})();
