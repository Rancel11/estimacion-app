const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db      = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

/* ── POST /api/auth/register ─────────────────────────── */
router.post('/register', [
  body('nombre').trim().notEmpty().withMessage('Nombre requerido'),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Mínimo 6 caracteres'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { nombre, email, password, rol_id = 3 } = req.body;
  try {
    const [exists] = await db.execute('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (exists.length) return res.status(409).json({ error: 'Email ya registrado' });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.execute(
      'INSERT INTO usuarios (nombre, email, password_hash, rol_id) VALUES (?, ?, ?, ?)',
      [nombre, email, hash, rol_id]
    );
    res.status(201).json({ id: result.insertId, nombre, email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── POST /api/auth/login ────────────────────────────── */
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { email, password } = req.body;
  try {
    const [rows] = await db.execute(
      `SELECT u.id, u.nombre, u.email, u.password_hash, u.activo,
              r.nombre AS rol
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       WHERE u.email = ?`,
      [email]
    );
    const user = rows[0];
    if (!user || !user.activo) return res.status(401).json({ error: 'Credenciales inválidas' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = jwt.sign(
      { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );
    res.json({ token, user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── GET /api/auth/me ────────────────────────────────── */
router.get('/me', authMiddleware, async (req, res) => {
  const [rows] = await db.execute(
    `SELECT u.id, u.nombre, u.email, r.nombre AS rol, u.creado_en
     FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = ?`,
    [req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(rows[0]);
});

module.exports = router;
