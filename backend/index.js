require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app = express();

// ── Middleware ────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Rutas ─────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/proyectos', require('./routes/proyectos'));
app.use('/api/sesiones',  require('./routes/sesiones'));
app.use('/api/pert',      require('./routes/pert'));
app.use('/api/delphi',    require('./routes/delphi'));

// ── Catálogos (sin auth) ──────────────────────────────────
app.get('/api/catalogos', async (_req, res) => {
  const db = require('./config/db');
  try {
    const [metodos]  = await db.execute('SELECT * FROM metodos_estimacion ORDER BY id');
    const [unidades] = await db.execute('SELECT * FROM unidades_medida ORDER BY id');
    const [roles]    = await db.execute('SELECT * FROM roles ORDER BY id');
    res.json({ metodos, unidades, roles });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Health check ──────────────────────────────────────────
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', ts: new Date() })
);

// ── 404 ───────────────────────────────────────────────────
app.use((_req, res) =>
  res.status(404).json({ error: 'Ruta no encontrada' })
);

// ── Error global ──────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀  Servidor corriendo → http://localhost:${PORT}`)
);