const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const db     = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.use(authMiddleware);

/* ─── GET /api/sesiones ──────────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT s.id, s.nombre, s.estado, s.creado_en,
              p.nombre      AS proyecto,
              p.id          AS proyecto_id,
              p.metodo_id,
              m.codigo      AS metodo,
              m.nombre      AS metodo_nombre,
              u.codigo      AS unidad,
              u.nombre      AS unidad_nombre,
              COUNT(it.id)  AS total_items
       FROM sesiones_estimacion s
       JOIN proyectos p           ON p.id = s.proyecto_id
       JOIN metodos_estimacion m  ON m.id = p.metodo_id
       JOIN unidades_medida u     ON u.id = s.unidad_id
       LEFT JOIN items_trabajo it ON it.sesion_id = s.id
       GROUP BY s.id
       ORDER BY s.creado_en DESC`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ─── POST /api/sesiones ─────────────────────────────── */
// Ya NO recibe metodo_id — lo hereda del proyecto
router.post('/',
  requireRole('admin', 'moderador'),
  [
    body('proyecto_id').isInt({ min: 1 }),
    body('nombre').trim().notEmpty(),
    body('unidad_id').optional().isInt({ min: 1 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { proyecto_id, nombre, descripcion, unidad_id = 1 } = req.body;
    try {
      // Verificar que el proyecto existe
      const [[proyecto]] = await db.execute(
        'SELECT id, metodo_id FROM proyectos WHERE id = ?',
        [proyecto_id]
      );
      if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

      const [r] = await db.execute(
        `INSERT INTO sesiones_estimacion
           (proyecto_id, nombre, descripcion, unidad_id, creado_por)
         VALUES (?, ?, ?, ?, ?)`,
        [proyecto_id, nombre, descripcion || null, unidad_id, req.user.id]
      );
      res.status(201).json({ id: r.insertId, nombre, proyecto_id });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

/* ─── GET /api/sesiones/:id ──────────────────────────── */
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT s.*,
              p.nombre      AS proyecto,
              p.metodo_id,
              m.codigo      AS metodo,
              m.nombre      AS metodo_nombre,
              u.codigo      AS unidad_codigo,
              u.nombre      AS unidad_nombre
       FROM sesiones_estimacion s
       JOIN proyectos p          ON p.id = s.proyecto_id
       JOIN metodos_estimacion m ON m.id = p.metodo_id
       JOIN unidades_medida u    ON u.id = s.unidad_id
       WHERE s.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Sesión no encontrada' });

    const [items] = await db.execute(
      `SELECT it.*,
              ep.optimista, ep.mas_probable, ep.pesimista,
              ROUND(ep.valor_esperado, 2) AS valor_esperado,
              ROUND(ep.desv_estandar,  2) AS desv_estandar,
              ROUND(ep.varianza,       4) AS varianza
       FROM items_trabajo it
       LEFT JOIN estimaciones_pert ep ON ep.item_id = it.id
       WHERE it.sesion_id = ?
       ORDER BY it.orden`,
      [req.params.id]
    );
    res.json({ ...rows[0], items });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ─── GET /api/sesiones/:id/resumen ──────────────────────────── */
// Get summary/resume of a session (for Delphi/PERT)
router.get('/:id/resumen', async (req, res) => {
  try {
    // Get session basic info
    const [[sesion]] = await db.execute(
      `SELECT s.*,
              p.nombre AS proyecto,
              p.metodo_id,
              m.codigo AS metodo,
              m.nombre AS metodo_nombre,
              u.codigo AS unidad_codigo,
              u.nombre AS unidad_nombre
       FROM sesiones_estimacion s
       JOIN proyectos p ON p.id = s.proyecto_id
       JOIN metodos_estimacion m ON m.id = p.metodo_id
       JOIN unidades_medida u ON u.id = s.unidad_id
       WHERE s.id = ?`,
      [req.params.id]
    );
    
    if (!sesion) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    // Get items with PERT estimates
    const [items] = await db.execute(
      `SELECT it.*,
              ep.optimista, 
              ep.mas_probable, 
              ep.pesimista,
              ROUND(ep.valor_esperado, 2) AS valor_esperado,
              ROUND(ep.desv_estandar, 2) AS desv_estandar,
              ROUND(ep.varianza, 4) AS varianza
       FROM items_trabajo it
       LEFT JOIN estimaciones_pert ep ON ep.item_id = it.id
       WHERE it.sesion_id = ?
       ORDER BY it.orden`,
      [req.params.id]
    );

    // Get adjustment factors if any
    const [factores] = await db.execute(
      'SELECT * FROM factores_ajuste WHERE sesion_id = ?',
      [req.params.id]
    );

    // Calculate summary statistics
    let totalEstimacion = 0;
    let totalVarianza = 0;
    
    items.forEach(item => {
      if (item.valor_esperado) {
        totalEstimacion += parseFloat(item.valor_esperado);
        if (item.varianza) {
          totalVarianza += parseFloat(item.varianza);
        }
      }
    });
    
    const desviacionTotal = Math.sqrt(totalVarianza);
    const intervaloConfianza95 = {
      inferior: totalEstimacion - (1.96 * desviacionTotal),
      superior: totalEstimacion + (1.96 * desviacionTotal)
    };

    // For Delphi sessions, get rounds and consensus info
    let delphiData = null;
    if (sesion.metodo === 'DELPHI') {
      const [rondas] = await db.execute(
        `SELECT r.*,
                COUNT(DISTINCT e.id) AS total_expertos,
                COUNT(DISTINCT est.id) AS total_estimaciones
         FROM rondas_delphi r
         LEFT JOIN expertos_sesion e ON e.sesion_id = r.sesion_id
         LEFT JOIN estimaciones_delphi est ON est.ronda_id = r.id
         WHERE r.sesion_id = ?
         GROUP BY r.id
         ORDER BY r.numero_ronda`,
        [req.params.id]
      );
      
      const [consensos] = await db.execute(
        `SELECT c.*, it.nombre AS item_nombre
         FROM consenso_delphi c
         JOIN items_trabajo it ON it.id = c.item_id
         WHERE c.sesion_id = ?`,
        [req.params.id]
      );
      
      delphiData = {
        rondas,
        consensos,
        total_rondas: rondas.length,
        ronda_actual: rondas.find(r => r.estado === 'abierta')?.numero_ronda || null
      };
    }

    res.json({
      ...sesion,
      items,
      factores,
      resumen: {
        total_items: items.length,
        total_estimacion: totalEstimacion,
        desviacion_estandar_total: desviacionTotal,
        varianza_total: totalVarianza,
        intervalo_confianza_95: intervaloConfianza95,
        items_estimados: items.filter(i => i.valor_esperado).length
      },
      delphi: delphiData
    });
  } catch (err) { 
    console.error('Error in /resumen:', err);
    res.status(500).json({ error: err.message }); 
  }
});

/* ─── PUT /api/sesiones/:id/estado ──────────────────── */
router.put('/:id/estado',
  requireRole('admin', 'moderador'),
  [body('estado').isIn(['borrador', 'en_progreso', 'completada', 'archivada'])],
  async (req, res) => {
    const extra = req.body.estado === 'completada' ? ', completado_en = NOW()' : '';
    try {
      await db.execute(
        `UPDATE sesiones_estimacion SET estado = ? ${extra} WHERE id = ?`,
        [req.body.estado, req.params.id]
      );
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

/* ─── DELETE /api/sesiones/:id ───────────────────────── */
router.delete('/:id',
  requireRole('admin', 'moderador'),
  async (req, res) => {
    try {
      await db.execute('DELETE FROM sesiones_estimacion WHERE id = ?', [req.params.id]);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

/* ══════════════ ITEMS DE TRABAJO ══════════════════════ */

/* ─── GET /api/sesiones/:id/items ────────────────────── */
router.get('/:id/items', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT it.*,
              ep.optimista, ep.mas_probable, ep.pesimista,
              ROUND(ep.valor_esperado, 2) AS valor_esperado,
              ROUND(ep.desv_estandar,  2) AS desv_estandar,
              ROUND(ep.varianza,       4) AS varianza
       FROM items_trabajo it
       LEFT JOIN estimaciones_pert ep ON ep.item_id = it.id
       WHERE it.sesion_id = ?
       ORDER BY it.orden`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ─── POST /api/sesiones/:id/items ───────────────────── */
router.post('/:id/items',
  requireRole('admin', 'moderador'),
  [body('nombre').trim().notEmpty()],
  async (req, res) => {
    const { nombre, descripcion, complejidad, unidad_id, orden = 0 } = req.body;
    try {
      const [r] = await db.execute(
        `INSERT INTO items_trabajo
           (sesion_id, nombre, descripcion, complejidad, unidad_id, orden)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.params.id, nombre, descripcion || null, complejidad || null, unidad_id || null, orden]
      );
      res.status(201).json({ id: r.insertId, nombre, descripcion, complejidad, orden });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

/* ─── POST /api/sesiones/:id/items/bulk ──────────────── */
router.post('/:id/items/bulk',
  requireRole('admin', 'moderador'),
  async (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items) || !items.length)
      return res.status(400).json({ error: 'items debe ser un array no vacío' });
    try {
      const vals = items.map((it, i) => [
        req.params.id, it.nombre, it.descripcion || null, it.complejidad || null, i
      ]);
      await db.query(
        `INSERT INTO items_trabajo (sesion_id, nombre, descripcion, complejidad, orden) VALUES ?`,
        [vals]
      );
      res.status(201).json({ insertados: vals.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

/* ─── PUT /api/sesiones/:sid/items/:iid ──────────────── */
router.put('/:sid/items/:iid',
  requireRole('admin', 'moderador'),
  async (req, res) => {
    const { nombre, descripcion, complejidad, orden } = req.body;
    const campos = []; const vals = [];
    if (nombre      !== undefined) { campos.push('nombre = ?');      vals.push(nombre); }
    if (descripcion !== undefined) { campos.push('descripcion = ?'); vals.push(descripcion); }
    if (complejidad !== undefined) { campos.push('complejidad = ?'); vals.push(complejidad); }
    if (orden       !== undefined) { campos.push('orden = ?');       vals.push(orden); }
    if (!campos.length) return res.status(400).json({ error: 'Sin cambios' });
    vals.push(req.params.iid);
    try {
      await db.execute(`UPDATE items_trabajo SET ${campos.join(', ')} WHERE id = ?`, vals);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

/* ─── DELETE /api/sesiones/:sid/items/:iid ───────────── */
router.delete('/:sid/items/:iid',
  requireRole('admin', 'moderador'),
  async (req, res) => {
    try {
      await db.execute('DELETE FROM items_trabajo WHERE id = ?', [req.params.iid]);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

/* ══════════════ FACTORES DE AJUSTE ════════════════════ */

/* ── GET /api/sesiones/:id/factores ──────────────────── */
router.get('/:id/factores', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM factores_ajuste WHERE sesion_id = ?',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── POST /api/sesiones/:id/factores ─────────────────── */
router.post('/:id/factores',
  requireRole('admin', 'moderador'),
  async (req, res) => {
    const { nombre, descripcion, valor } = req.body;
    try {
      const [r] = await db.execute(
        'INSERT INTO factores_ajuste (sesion_id, nombre, descripcion, valor) VALUES (?,?,?,?)',
        [req.params.id, nombre, descripcion || null, valor || 1.0]
      );
      res.status(201).json({ id: r.insertId });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

/* ── DELETE /api/sesiones/:id/factores/:fid ──────────── */
router.delete('/:id/factores/:fid',
  requireRole('admin', 'moderador'),
  async (req, res) => {
    try {
      await db.execute(
        'DELETE FROM factores_ajuste WHERE id = ? AND sesion_id = ?',
        [req.params.fid, req.params.id]
      );
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

module.exports = router;