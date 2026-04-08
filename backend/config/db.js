const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               process.env.DB_PORT     || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '809523',
  database:           process.env.DB_NAME     || 'estimacion_db',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '+00:00',
  charset:            'utf8mb4',
});

// Verificar conexión al iniciar
pool.getConnection()
  .then(conn => {
    console.log('MySQL conectado →', process.env.DB_NAME);
    conn.release();
  })
  .catch(err => {
    console.error('Error MySQL:', err.message);
    process.exit(1);
  });

module.exports = pool;
