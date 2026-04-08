const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const db     = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.use(authMiddleware);

/* ── GET /api/proyectos ──────────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT p.id, p.nombre, p.descripcion, p.cliente, p.estado,
              p.creado_en, u.nombre AS creado_por,
              m.codigo  AS metodo,
              m.nombre  AS metodo_nombre,
              p.metodo_id,
              COUNT(DISTINCT s.id) AS total_sesiones
       FROM proyectos p
       JOIN usuarios u ON u.id = p.creado_por
       JOIN metodos_estimacion m ON m.id = p.metodo_id
       LEFT JOIN sesiones_estimacion s ON s.proyecto_id = p.id
       GROUP BY p.id
       ORDER BY p.creado_en DESC`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── POST /api/proyectos ─────────────────────────────── */
// Solo admin y moderador pueden crear proyectos
router.post('/',
  requireRole('admin', 'moderador'),
  [
    body('nombre').trim().notEmpty().withMessage('Nombre requerido'),
    body('metodo_id').isInt({ min: 1 }).withMessage('Método de estimación requerido'),
    body('estado').optional().isIn(['activo', 'completado', 'pausado', 'cancelado']),
    body('unidad_id').optional().isInt({ min: 1 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const {
      nombre,
      descripcion,
      cliente,
      estado    = 'activo',
      metodo_id,
      unidad_id = 1,
    } = req.body;

    try {
      // 1. Obtener el código del método para devolver al frontend
      const [[metodo]] = await db.execute(
        'SELECT id, codigo, nombre FROM metodos_estimacion WHERE id = ?',
        [metodo_id]
      );
      if (!metodo) return res.status(400).json({ error: 'Método no encontrado' });

      // 2. Crear el proyecto
      const [rProyecto] = await db.execute(
        `INSERT INTO proyectos
           (nombre, descripcion, cliente, estado, metodo_id, creado_por)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [nombre, descripcion || null, cliente || null, estado, metodo_id, req.user.id]
      );
      const proyecto_id = rProyecto.insertId;

      // 3. Auto-crear la sesión inicial (lazy: solo si no existe una para este proyecto)
      const [sesionExistente] = await db.execute(
        'SELECT id FROM sesiones_estimacion WHERE proyecto_id = ? LIMIT 1',
        [proyecto_id]
      );

      let sesion_id = null;
      if (!sesionExistente.length) {
        const [rSesion] = await db.execute(
          `INSERT INTO sesiones_estimacion
             (proyecto_id, nombre, descripcion, unidad_id, creado_por)
           VALUES (?, ?, ?, ?, ?)`,
          [
            proyecto_id,
            `Estimación - ${nombre}`,
            descripcion || null,
            unidad_id,
            req.user.id,
          ]
        );
        sesion_id = rSesion.insertId;
      } else {
        sesion_id = sesionExistente[0].id;
      }

      res.status(201).json({
        id:           proyecto_id,
        nombre,
        descripcion,
        cliente,
        estado,
        metodo_id,
        metodo:       metodo.codigo,   // "PERT" o "DELPHI" → usado por el frontend para redirigir
        metodo_nombre: metodo.nombre,
        sesion_id,                     // ID de la sesión creada → para pre-cargar en PertPage/DelphiPage
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

/* ── GET /api/proyectos/:id ──────────────────────────── */
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT p.*, u.nombre AS creado_por_nombre,
              m.codigo AS metodo, m.nombre AS metodo_nombre
       FROM proyectos p
       JOIN usuarios u ON u.id = p.creado_por
       JOIN metodos_estimacion m ON m.id = p.metodo_id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Proyecto no encontrado' });

    // Sesiones del proyecto (sin metodo_id propio, heredan del proyecto)
    const [sesiones] = await db.execute(
      `SELECT s.id, s.nombre, s.estado, s.creado_en,
              u2.codigo AS unidad_codigo, u2.nombre AS unidad_nombre
       FROM sesiones_estimacion s
       JOIN unidades_medida u2 ON u2.id = s.unidad_id
       WHERE s.proyecto_id = ?
       ORDER BY s.creado_en DESC`,
      [req.params.id]
    );

    res.json({ ...rows[0], sesiones });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── PUT /api/proyectos/:id ──────────────────────────── */
router.put('/:id',
  requireRole('admin', 'moderador'),
  [body('nombre').optional().trim().notEmpty()],
  async (req, res) => {
    const { nombre, descripcion, cliente, estado } = req.body;
    const campos = [];
    const vals   = [];
    if (nombre      !== undefined) { campos.push('nombre = ?');      vals.push(nombre); }
    if (descripcion !== undefined) { campos.push('descripcion = ?'); vals.push(descripcion); }
    if (cliente     !== undefined) { campos.push('cliente = ?');     vals.push(cliente); }
    if (estado      !== undefined) { campos.push('estado = ?');      vals.push(estado); }
    // Nota: metodo_id NO se permite cambiar después de creado
    if (!campos.length) return res.status(400).json({ error: 'Sin cambios' });
    vals.push(req.params.id);
    try {
      await db.execute(`UPDATE proyectos SET ${campos.join(', ')} WHERE id = ?`, vals);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

/* ── DELETE /api/proyectos/:id ───────────────────────── */
router.delete('/:id',
  requireRole('admin', 'moderador'),
  async (req, res) => {
    try {
      await db.execute('DELETE FROM proyectos WHERE id = ?', [req.params.id]);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

module.exports = router;