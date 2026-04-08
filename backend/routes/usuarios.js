/**
 * routes/usuarios.js — EstimaSoft v2
 * CRUD de usuarios. Admin gestiona todos; moderador solo crea/edita expertos.
 */

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db     = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.use(authMiddleware);

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(422).json({ errors: errors.array() }); return false; }
  return true;
};

/* ── GET /api/usuarios/roles  (antes de /:id para que no colisione) ── */
router.get('/roles', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM roles ORDER BY id');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── GET /api/usuarios ──────────────────────────────────────────────── */
router.get('/', requireRole('admin', 'moderador'), async (req, res) => {
  try {
    // Moderadores solo ven expertos
    const whereClause = req.user.rol === 'moderador'
      ? "WHERE r.nombre = 'experto'"
      : '';
    const [rows] = await db.execute(
      `SELECT u.id, u.nombre, u.email, u.activo, u.creado_en,
              r.id   AS rol_id,
              r.nombre AS rol
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       ${whereClause}
       ORDER BY r.nombre, u.nombre`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── POST /api/usuarios ─────────────────────────────────────────────── */
router.post('/',
  requireRole('admin', 'moderador'),
  [
    body('nombre').trim().notEmpty().withMessage('Nombre requerido'),
    body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
    body('password').isLength({ min: 6 }).withMessage('Mínimo 6 caracteres'),
    body('rol_id').isInt({ min: 1 }).withMessage('Rol requerido'),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;

    const { nombre, email, password, rol_id } = req.body;

    try {
      // Verificar que el rol existe
      const [[rol]] = await db.execute(
        'SELECT id, nombre FROM roles WHERE id = ?',
        [rol_id]
      );
      if (!rol) return res.status(400).json({ error: 'Rol no encontrado' });

      // Moderadores solo pueden crear expertos
      if (req.user.rol === 'moderador' && rol.nombre !== 'experto') {
        return res.status(403).json({
          error: 'Los moderadores solo pueden crear usuarios con rol experto',
        });
      }

      // Email único
      const [exists] = await db.execute(
        'SELECT id FROM usuarios WHERE email = ?',
        [email]
      );
      if (exists.length) return res.status(409).json({ error: 'Email ya registrado' });

      const hash = await bcrypt.hash(password, 10);
      const [r] = await db.execute(
        'INSERT INTO usuarios (nombre, email, password_hash, rol_id) VALUES (?, ?, ?, ?)',
        [nombre, email, hash, rol_id]
      );

      res.status(201).json({
        id:     r.insertId,
        nombre,
        email,
        rol_id,
        rol:    rol.nombre,
        activo: 1,
        creado_en: new Date(),
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

/* ── PUT /api/usuarios/:id ──────────────────────────────────────────── */
router.put('/:id',
  requireRole('admin', 'moderador'),
  async (req, res) => {
    const { nombre, email, password, rol_id, activo } = req.body;

    // Solo admin puede cambiar roles
    if (rol_id !== undefined && req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden cambiar roles' });
    }

    const campos = []; const vals = [];
    if (nombre  !== undefined) { campos.push('nombre = ?');  vals.push(nombre); }
    if (email   !== undefined) { campos.push('email = ?');   vals.push(email); }
    if (rol_id  !== undefined) { campos.push('rol_id = ?');  vals.push(rol_id); }
    if (activo  !== undefined) { campos.push('activo = ?');  vals.push(activo ? 1 : 0); }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      campos.push('password_hash = ?');
      vals.push(hash);
    }

    if (!campos.length) return res.status(400).json({ error: 'Sin cambios' });
    vals.push(req.params.id);

    try {
      await db.execute(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`, vals);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

/* ── DELETE /api/usuarios/:id — solo admin ──────────────────────────── */
router.delete('/:id',
  requireRole('admin'),
  async (req, res) => {
    if (+req.params.id === req.user.id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
    }
    try {
      await db.execute('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

module.exports = router;