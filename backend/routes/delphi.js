/**
 * routes/delphi.js  — EstimaSoft v2  (fix: sin dependencia de vistas)
 * Todas las queries están inline — funciona aunque las vistas no existan aún.
 */

const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.use(authMiddleware);

/* ── Helpers ────────────────────────────────────────────────── */
const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(422).json({ errors: errors.array() }); return false; }
  return true;
};
const isExperto   = req => req.user.rol === 'experto';
const isModerador = req => ['admin', 'moderador'].includes(req.user.rol);

/* ═══════════════════════════════════════════════════════════════
   EXPERTOS DISPONIBLES  (usuarios con rol = experto)
═══════════════════════════════════════════════════════════════ */

// GET /api/delphi/expertos
router.get('/expertos', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT u.id, u.nombre, u.email, u.creado_en
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       WHERE r.nombre = 'experto' AND u.activo = 1
       ORDER BY u.nombre`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════════════════════════════════════════════
   PARTICIPANTES DE SESIÓN
═══════════════════════════════════════════════════════════════ */

// GET /api/delphi/sesion/:sid/participantes
router.get('/sesion/:sid/participantes', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT sp.id, sp.usuario_id, u.nombre, u.email, sp.invitado_en
       FROM sesion_participantes sp
       JOIN usuarios u ON u.id = sp.usuario_id
       WHERE sp.sesion_id = ?
       ORDER BY u.nombre`,
      [req.params.sid]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/delphi/sesion/:sid/participantes  { usuario_id }
router.post('/sesion/:sid/participantes',
  requireRole('admin', 'moderador'),
  [body('usuario_id').isInt({ min: 1 })],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const [r] = await db.execute(
        `INSERT IGNORE INTO sesion_participantes (sesion_id, usuario_id) VALUES (?,?)`,
        [req.params.sid, req.body.usuario_id]
      );

      // ✅ CREAR TAMBIÉN EN expertos_sesion
      const [[usuario]] = await db.execute(
        'SELECT nombre, email FROM usuarios WHERE id = ?',
        [req.body.usuario_id]
      );
      if (usuario) {
        await db.execute(
          `INSERT IGNORE INTO expertos_sesion (sesion_id, usuario_id, nombre, email)
           VALUES (?, ?, ?, ?)`,
          [req.params.sid, req.body.usuario_id, usuario.nombre, usuario.email]
        );
      }

      res.status(201).json({ id: r.insertId, usuario_id: req.body.usuario_id });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// POST /api/delphi/sesion/:sid/participantes/bulk  { usuario_ids: [] }
router.post('/sesion/:sid/participantes/bulk',
  requireRole('admin', 'moderador'),
  async (req, res) => {
    const { usuario_ids } = req.body;
    if (!Array.isArray(usuario_ids) || !usuario_ids.length)
      return res.status(400).json({ error: 'usuario_ids debe ser un array no vacío' });
    try {
      for (const uid of usuario_ids) {
        // 1. Agregar a sesion_participantes
        await db.execute(
          `INSERT IGNORE INTO sesion_participantes (sesion_id, usuario_id) VALUES (?,?)`,
          [req.params.sid, uid]
        );

        // 2. ✅ CREAR TAMBIÉN EN expertos_sesion
        const [[usuario]] = await db.execute(
          'SELECT nombre, email FROM usuarios WHERE id = ?',
          [uid]
        );
        if (usuario) {
          await db.execute(
            `INSERT IGNORE INTO expertos_sesion (sesion_id, usuario_id, nombre, email)
             VALUES (?, ?, ?, ?)`,
            [req.params.sid, uid, usuario.nombre, usuario.email]
          );
        }
      }
      res.status(201).json({ agregados: usuario_ids.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);
// DELETE /api/delphi/sesion/:sid/participantes/:uid
router.delete('/sesion/:sid/participantes/:uid',
  requireRole('admin', 'moderador'),
  async (req, res) => {
    try {
      await db.execute(
        `DELETE FROM sesion_participantes WHERE sesion_id = ? AND usuario_id = ?`,
        [req.params.sid, req.params.uid]
      );
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

/* ═══════════════════════════════════════════════════════════════
   SECCIONES
═══════════════════════════════════════════════════════════════ */

// GET /api/delphi/sesion/:sid/secciones
router.get('/sesion/:sid/secciones', async (req, res) => {
  try {
    const [secciones] = await db.execute(
      `SELECT s.*,
              COUNT(DISTINCT it.id) AS total_items,
              GROUP_CONCAT(
                DISTINCT CONCAT(um.id,':',um.codigo,':',um.nombre,':',su.es_principal)
                ORDER BY su.es_principal DESC, um.id
                SEPARATOR '|'
              ) AS unidades_raw
       FROM secciones s
       LEFT JOIN seccion_unidades su ON su.seccion_id = s.id
       LEFT JOIN unidades_medida  um ON um.id = su.unidad_id
       LEFT JOIN items_trabajo    it ON it.seccion_id = s.id
       WHERE s.sesion_id = ?
       GROUP BY s.id
       ORDER BY s.orden, s.id`,
      [req.params.sid]
    );

    const result = secciones.map(s => ({
      ...s,
      unidades: s.unidades_raw
        ? s.unidades_raw.split('|').map(u => {
            const [id, codigo, nombre, principal] = u.split(':');
            return { id: +id, codigo, nombre, es_principal: principal === '1' };
          })
        : [],
    }));

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/delphi/sesion/:sid/secciones
router.post('/sesion/:sid/secciones',
  requireRole('admin', 'moderador'),
  [body('nombre').trim().notEmpty()],
  async (req, res) => {
    if (!validate(req, res)) return;
    const { nombre, descripcion, orden = 0 } = req.body;
    try {
      const [r] = await db.execute(
        `INSERT INTO secciones (sesion_id, nombre, descripcion, orden) VALUES (?,?,?,?)`,
        [req.params.sid, nombre, descripcion || null, orden]
      );
      res.status(201).json({ id: r.insertId, nombre, descripcion, orden, unidades: [], total_items: 0 });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// PUT /api/delphi/secciones/:id
router.put('/secciones/:id',
  requireRole('admin', 'moderador'),
  async (req, res) => {
    const { nombre, descripcion, orden } = req.body;
    const campos = []; const vals = [];
    if (nombre !== undefined)      { campos.push('nombre = ?');      vals.push(nombre); }
    if (descripcion !== undefined) { campos.push('descripcion = ?'); vals.push(descripcion); }
    if (orden !== undefined)       { campos.push('orden = ?');       vals.push(orden); }
    if (!campos.length) return res.status(400).json({ error: 'Sin cambios' });
    vals.push(req.params.id);
    try {
      await db.execute(`UPDATE secciones SET ${campos.join(', ')} WHERE id = ?`, vals);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// DELETE /api/delphi/secciones/:id
router.delete('/secciones/:id',
  requireRole('admin', 'moderador'),
  async (req, res) => {
    try {
      await db.execute('DELETE FROM secciones WHERE id = ?', [req.params.id]);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

/* ── Unidades por sección ──────────────────────────────────── */

// POST /api/delphi/secciones/:id/unidades
router.post('/secciones/:id/unidades',
  requireRole('admin', 'moderador'),
  [body('unidad_id').isInt({ min: 1 })],
  async (req, res) => {
    if (!validate(req, res)) return;
    const { unidad_id, es_principal = false } = req.body;
    try {
      if (es_principal) {
        await db.execute(
          `UPDATE seccion_unidades SET es_principal = 0 WHERE seccion_id = ?`,
          [req.params.id]
        );
      }
      await db.execute(
        `INSERT INTO seccion_unidades (seccion_id, unidad_id, es_principal) VALUES (?,?,?)
         ON DUPLICATE KEY UPDATE es_principal = VALUES(es_principal)`,
        [req.params.id, unidad_id, es_principal ? 1 : 0]
      );
      res.status(201).json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// DELETE /api/delphi/secciones/:id/unidades/:uid
router.delete('/secciones/:id/unidades/:uid',
  requireRole('admin', 'moderador'),
  async (req, res) => {
    try {
      await db.execute(
        `DELETE FROM seccion_unidades WHERE seccion_id = ? AND unidad_id = ?`,
        [req.params.id, req.params.uid]
      );
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

/* ── Ítems por sección ─────────────────────────────────────── */

// GET /api/delphi/secciones/:id/items
router.get('/secciones/:id/items', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT it.*, um.codigo AS unidad_codigo, um.nombre AS unidad_nombre
       FROM items_trabajo it
       LEFT JOIN unidades_medida um ON um.id = it.unidad_id
       WHERE it.seccion_id = ?
       ORDER BY it.orden, it.id`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/delphi/secciones/:id/items
router.post('/secciones/:id/items',
  requireRole('admin', 'moderador'),
  [body('nombre').trim().notEmpty()],
  async (req, res) => {
    if (!validate(req, res)) return;
    const { nombre, descripcion, complejidad, unidad_id, orden = 0, sesion_id } = req.body;
    if (!sesion_id) return res.status(400).json({ error: 'sesion_id requerido' });
    try {
      const [r] = await db.execute(
        `INSERT INTO items_trabajo
           (sesion_id, seccion_id, nombre, descripcion, complejidad, unidad_id, orden)
         VALUES (?,?,?,?,?,?,?)`,
        [sesion_id, req.params.id, nombre, descripcion || null,
         complejidad || null, unidad_id || null, orden]
      );
      res.status(201).json({ id: r.insertId, nombre, complejidad, unidad_id, orden });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// POST /api/delphi/secciones/:id/items/bulk
router.post('/secciones/:id/items/bulk',
  requireRole('admin', 'moderador'),
  async (req, res) => {
    const { items, sesion_id } = req.body;
    if (!Array.isArray(items) || !items.length || !sesion_id)
      return res.status(400).json({ error: 'items[] y sesion_id requeridos' });
    try {
      const vals = items.map((it, i) => [
        sesion_id, req.params.id, it.nombre,
        it.descripcion || null, it.complejidad || null, it.unidad_id || null, i
      ]);
      await db.query(
        `INSERT INTO items_trabajo
           (sesion_id, seccion_id, nombre, descripcion, complejidad, unidad_id, orden)
         VALUES ?`,
        [vals]
      );
      res.status(201).json({ insertados: vals.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

/* ═══════════════════════════════════════════════════════════════
   RONDAS
   ⚠ Sin JOIN a v_progreso_ronda — progreso calculado con subqueries inline
═══════════════════════════════════════════════════════════════ */

// GET /api/delphi/sesion/:sid/rondas
router.get('/sesion/:sid/rondas', async (req, res) => {
  try {
    const [rondas] = await db.execute(
      `SELECT
         r.*,
         /* Participantes de la sesión */
         (SELECT COUNT(*)
          FROM sesion_participantes sp
          WHERE sp.sesion_id = r.sesion_id)                              AS total_participantes,
         /* Cuántos ya estimaron en esta ronda */
         (SELECT COUNT(DISTINCT de.usuario_id)
          FROM estimaciones_delphi de
          WHERE de.ronda_id = r.id)                                      AS participantes_que_estimaron,
         /* Total de ítems de la sesión */
         (SELECT COUNT(*)
          FROM items_trabajo it
          WHERE it.sesion_id = r.sesion_id)                              AS total_items,
         /* Total de estimaciones recibidas */
         (SELECT COUNT(*)
          FROM estimaciones_delphi de2
          WHERE de2.ronda_id = r.id)                                     AS estimaciones_recibidas
       FROM rondas_delphi r
       WHERE r.sesion_id = ?
       ORDER BY r.numero_ronda`,
      [req.params.sid]
    );

    /* Calcular % completado en JS para evitar división en SQL */
    const enriched = rondas.map(r => {
      const total = (r.total_participantes || 0) * (r.total_items || 0);
      return {
        ...r,
        pct_completado: total > 0
          ? Math.round((r.estimaciones_recibidas / total) * 100)
          : 0,
      };
    });

    res.json(enriched);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/delphi/sesion/:sid/rondas
router.post('/sesion/:sid/rondas',
  requireRole('admin', 'moderador'),
  async (req, res) => {
    try {
      /* No permitir dos rondas abiertas simultáneas */
      const [[{ abiertas }]] = await db.execute(
        `SELECT COUNT(*) AS abiertas
         FROM rondas_delphi WHERE sesion_id = ? AND estado = 'abierta'`,
        [req.params.sid]
      );
      if (abiertas > 0)
        return res.status(409).json({
          error: 'Ya hay una ronda abierta. Ciérrala antes de crear otra.',
        });

      const [[{ max_ronda }]] = await db.execute(
        `SELECT COALESCE(MAX(numero_ronda), 0) AS max_ronda
         FROM rondas_delphi WHERE sesion_id = ?`,
        [req.params.sid]
      );
      const nuevo_numero = max_ronda + 1;

      const [r] = await db.execute(
        `INSERT INTO rondas_delphi (sesion_id, numero_ronda, notas) VALUES (?,?,?)`,
        [req.params.sid, nuevo_numero, req.body.notas || null]
      );

      /* Poner sesión en_progreso si estaba en borrador */
      await db.execute(
        `UPDATE sesiones_estimacion
         SET estado = 'en_progreso'
         WHERE id = ? AND estado = 'borrador'`,
        [req.params.sid]
      );

      res.status(201).json({
        id: r.insertId,
        sesion_id: +req.params.sid,
        numero_ronda: nuevo_numero,
        estado: 'abierta',
        total_participantes: 0,
        participantes_que_estimaron: 0,
        total_items: 0,
        estimaciones_recibidas: 0,
        pct_completado: 0,
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// PUT /api/delphi/rondas/:rid/cerrar
router.put('/rondas/:rid/cerrar',
  requireRole('admin', 'moderador'),
  async (req, res) => {
    try {
      await db.execute(
        `UPDATE rondas_delphi
         SET estado = 'cerrada', cerrada_en = NOW()
         WHERE id = ?`,
        [req.params.rid]
      );
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

/* ═══════════════════════════════════════════════════════════════
   ESTIMACIONES
═══════════════════════════════════════════════════════════════ */

// GET /api/delphi/rondas/:rid/estimaciones
router.get('/rondas/:rid/estimaciones', async (req, res) => {
  try {
    const whereExtra = isExperto(req) ? 'AND de.usuario_id = ?' : '';
    const params     = isExperto(req)
      ? [req.params.rid, req.user.id]
      : [req.params.rid];

    const [rows] = await db.execute(
      `SELECT de.id, de.ronda_id, de.usuario_id, de.item_id,
              de.estimacion, de.comentario, de.enviado_en,
              u.nombre   AS experto_nombre,
              it.nombre  AS item_nombre,
              um.codigo  AS unidad_codigo,
              sc.nombre  AS seccion_nombre
       FROM estimaciones_delphi de
       JOIN  usuarios u       ON u.id  = de.usuario_id
       JOIN  items_trabajo it ON it.id = de.item_id
       LEFT JOIN unidades_medida um ON um.id = it.unidad_id
       LEFT JOIN secciones       sc ON sc.id = it.seccion_id
       WHERE de.ronda_id = ? ${whereExtra}
       ORDER BY sc.orden, it.orden, u.nombre`,
      params
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/delphi/rondas/:rid/estimaciones/bulk
router.post('/rondas/:rid/estimaciones/bulk',
  [body('estimaciones').isArray({ min: 1 })],
  async (req, res) => {
    if (!validate(req, res)) return;

    const usuario_id = isExperto(req)
      ? req.user.id
      : (req.body.usuario_id || req.user.id);

    try {
      const [[ronda]] = await db.execute(
        `SELECT id, sesion_id, estado FROM rondas_delphi WHERE id = ?`,
        [req.params.rid]
      );
      if (!ronda) return res.status(404).json({ error: 'Ronda no encontrada' });
      if (ronda.estado !== 'abierta')
        return res.status(409).json({ error: 'La ronda está cerrada' });

      if (isExperto(req)) {
        const [[{ es_part }]] = await db.execute(
          `SELECT COUNT(*) AS es_part
           FROM sesion_participantes
           WHERE sesion_id = ? AND usuario_id = ?`,
          [ronda.sesion_id, req.user.id]
        );
        if (!es_part)
          return res.status(403).json({ error: 'No eres participante de esta sesión' });
      }

      // ✅ Obtener el experto_id correcto de expertos_sesion
      const [[expertoData]] = await db.execute(
        `SELECT id FROM expertos_sesion WHERE sesion_id = ? AND usuario_id = ?`,
        [ronda.sesion_id, usuario_id]
      );
      const experto_id = expertoData?.id || 0;

      for (const e of req.body.estimaciones) {
        await db.execute(
          `INSERT INTO estimaciones_delphi
             (ronda_id, experto_id, usuario_id, item_id, estimacion, comentario)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             estimacion = VALUES(estimacion),
             comentario = VALUES(comentario),
             enviado_en = NOW()`,
          [req.params.rid, experto_id, usuario_id, e.item_id, e.estimacion, e.comentario || null]
        );
      }

      broadcastToSession(ronda.sesion_id, {
        type:       'estimacion_actualizada',
        usuario_id,
        ronda_id:   +req.params.rid,
      });

      res.status(201).json({ guardadas: req.body.estimaciones.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

/* ═══════════════════════════════════════════════════════════════
   ESTADÍSTICAS
   ⚠ Sin v_estadisticas_delphi_v2 — query inline
═══════════════════════════════════════════════════════════════ */

// GET /api/delphi/rondas/:rid/estadisticas
router.get('/rondas/:rid/estadisticas', async (req, res) => {
  try {
    /* Obtener sesion_id de la ronda */
    const [[ronda]] = await db.execute(
      `SELECT sesion_id FROM rondas_delphi WHERE id = ?`,
      [req.params.rid]
    );
    if (!ronda) return res.status(404).json({ error: 'Ronda no encontrada' });

    /* Estadísticas por ítem — calculadas inline */
    const [stats] = await db.execute(
      `SELECT
         rd.sesion_id,
         rd.id                             AS ronda_id,
         rd.numero_ronda,
         de.item_id,
         it.nombre                         AS item,
         it.seccion_id,
         sc.nombre                         AS seccion,
         um.codigo                         AS unidad_codigo,
         um.nombre                         AS unidad_nombre,
         COUNT(de.id)                      AS total_expertos,
         ROUND(AVG(de.estimacion), 2)      AS promedio,
         ROUND(MIN(de.estimacion), 2)      AS minimo,
         ROUND(MAX(de.estimacion), 2)      AS maximo,
         ROUND(STD(de.estimacion), 2)      AS desv_estandar,
         ROUND(
           CASE WHEN AVG(de.estimacion) = 0 THEN 0
                ELSE (STD(de.estimacion) / AVG(de.estimacion)) * 100
           END, 2
         )                                 AS coef_variacion_pct
       FROM rondas_delphi rd
       JOIN  estimaciones_delphi de ON de.ronda_id = rd.id
       JOIN  items_trabajo        it ON it.id = de.item_id
       LEFT JOIN secciones        sc ON sc.id = it.seccion_id
       LEFT JOIN unidades_medida  um ON um.id = it.unidad_id
       WHERE rd.id = ?
       GROUP BY rd.sesion_id, rd.id, rd.numero_ronda,
                de.item_id, it.nombre, it.seccion_id, sc.nombre,
                um.codigo, um.nombre
       ORDER BY sc.orden, it.orden`,
      [req.params.rid]
    );

    const enriched = stats.map(s => ({
      ...s,
      consenso: parseFloat(s.coef_variacion_pct) < 20,
      nivel_cv:
        parseFloat(s.coef_variacion_pct) < 20  ? 'consenso'
        : parseFloat(s.coef_variacion_pct) < 35 ? 'divergente'
        : 'alta_divergencia',
    }));

    /* Agrupar por sección para el frontend */
    const por_seccion = enriched.reduce((acc, s) => {
      const key = s.seccion || 'General';
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
      return acc;
    }, {});

    /* Progreso de la ronda (inline, sin vista) */
    const [[progreso]] = await db.execute(
      `SELECT
         r.id                                               AS ronda_id,
         r.sesion_id,
         r.numero_ronda,
         r.estado,
         (SELECT COUNT(*) FROM sesion_participantes sp
          WHERE sp.sesion_id = r.sesion_id)                AS total_participantes,
         (SELECT COUNT(DISTINCT de2.usuario_id)
          FROM estimaciones_delphi de2
          WHERE de2.ronda_id = r.id)                       AS participantes_que_estimaron,
         (SELECT COUNT(*) FROM items_trabajo it2
          WHERE it2.sesion_id = r.sesion_id)               AS total_items,
         COUNT(de.id)                                       AS estimaciones_recibidas
       FROM rondas_delphi r
       LEFT JOIN estimaciones_delphi de ON de.ronda_id = r.id
       WHERE r.id = ?
       GROUP BY r.id`,
      [req.params.rid]
    );

    if (progreso) {
      const total = (progreso.total_participantes || 0) * (progreso.total_items || 0);
      progreso.pct_completado = total > 0
        ? Math.round((progreso.estimaciones_recibidas / total) * 100)
        : 0;
    }

    res.json({ items: enriched, por_seccion, progreso: progreso || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════════════════════════════════════════════
   SSE — TIEMPO REAL
═══════════════════════════════════════════════════════════════ */

const sseClients = new Map(); // sesion_id → Set<res>

function broadcastToSession(sesionId, payload) {
  const clients = sseClients.get(String(sesionId));
  if (!clients || !clients.size) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  clients.forEach(client => {
    try { client.write(data); } catch { /* cliente desconectado */ }
  });
}

// GET /api/delphi/sesion/:sid/live
router.get('/sesion/:sid/live', async (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx: deshabilitar buffering
  res.flushHeaders();

  const sid = req.params.sid;
  if (!sseClients.has(sid)) sseClients.set(sid, new Set());
  sseClients.get(sid).add(res);

  /* Snapshot inicial */
  try {
    const [[rondaActiva]] = await db.execute(
      `SELECT id FROM rondas_delphi WHERE sesion_id = ? AND estado = 'abierta' LIMIT 1`,
      [sid]
    );
    if (rondaActiva) {
      const [estadisticas] = await db.execute(
        `SELECT de.item_id, it.nombre AS item,
                ROUND(AVG(de.estimacion),2) AS promedio,
                COUNT(de.id) AS total_expertos
         FROM estimaciones_delphi de
         JOIN items_trabajo it ON it.id = de.item_id
         WHERE de.ronda_id = ?
         GROUP BY de.item_id, it.nombre`,
        [rondaActiva.id]
      );
      res.write(`data: ${JSON.stringify({
        type:        'snapshot',
        ronda_id:    rondaActiva.id,
        estadisticas,
      })}\n\n`);
    }
  } catch { /* no bloquear si falla el snapshot */ }

  /* Heartbeat cada 25s */
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.get(sid)?.delete(res);
    if (sseClients.get(sid)?.size === 0) sseClients.delete(sid);
  });
});

/* ═══════════════════════════════════════════════════════════════
   CONSENSO FINAL
═══════════════════════════════════════════════════════════════ */

// GET /api/delphi/sesion/:sid/consenso
router.get('/sesion/:sid/consenso', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT cd.*, it.nombre AS item,
              sc.nombre  AS seccion,
              um.codigo  AS unidad_codigo,
              um.nombre  AS unidad_nombre
       FROM consenso_delphi cd
       JOIN  items_trabajo it        ON it.id = cd.item_id
       LEFT JOIN secciones sc        ON sc.id = it.seccion_id
       LEFT JOIN unidades_medida um  ON um.id = it.unidad_id
       WHERE cd.sesion_id = ?
       ORDER BY sc.orden, it.orden`,
      [req.params.sid]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/delphi/sesion/:sid/consenso/bulk
router.post('/sesion/:sid/consenso/bulk',
  requireRole('admin', 'moderador'),
  async (req, res) => {
    const { consensos } = req.body;
    if (!Array.isArray(consensos))
      return res.status(400).json({ error: 'Array requerido' });
    try {
      for (const c of consensos) {
        await db.execute(
          `INSERT INTO consenso_delphi
             (sesion_id, item_id, estimacion_final, rondas_necesarias, consenso_logrado, notas)
           VALUES (?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE
             estimacion_final  = VALUES(estimacion_final),
             rondas_necesarias = VALUES(rondas_necesarias),
             consenso_logrado  = VALUES(consenso_logrado),
             notas             = VALUES(notas)`,
          [req.params.sid, c.item_id, c.estimacion_final,
           c.rondas_necesarias || 1, c.consenso_logrado ? 1 : 0, c.notas || null]
        );
      }
      res.status(201).json({ guardados: consensos.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

/* ═══════════════════════════════════════════════════════════════
   RESUMEN COMPLETO
═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   RESUMEN COMPLETO - FIXED
═══════════════════════════════════════════════════════════════ */

// GET /api/delphi/sesion/:sid/resumen
router.get('/sesion/:sid/resumen', async (req, res) => {
  try {
    const [[sesion]] = await db.execute(
      `SELECT s.*, 
              p.nombre AS proyecto,
              p.metodo_id,
              m.nombre AS metodo_nombre, 
              m.codigo AS metodo_codigo,
              u.codigo AS unidad_codigo,
              u.nombre AS unidad_nombre
       FROM sesiones_estimacion s
       JOIN proyectos p ON p.id = s.proyecto_id
       JOIN metodos_estimacion m ON m.id = p.metodo_id  -- ← Fixed: use p.metodo_id
       JOIN unidades_medida u ON u.id = s.unidad_id
       WHERE s.id = ?`,
      [req.params.sid]
    );
    
    if (!sesion) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    // Get total rounds
    const [[{ total_rondas }]] = await db.execute(
      `SELECT COUNT(*) AS total_rondas FROM rondas_delphi WHERE sesion_id = ?`,
      [req.params.sid]
    );
    
    // Get total participants
    const [[{ total_participantes }]] = await db.execute(
      `SELECT COUNT(*) AS total_participantes FROM sesion_participantes WHERE sesion_id = ?`,
      [req.params.sid]
    );
    
    // Get sections with items count
    const [secciones] = await db.execute(
      `SELECT sc.*, COUNT(it.id) AS total_items
       FROM secciones sc
       LEFT JOIN items_trabajo it ON it.seccion_id = sc.id
       WHERE sc.sesion_id = ?
       GROUP BY sc.id 
       ORDER BY sc.orden`,
      [req.params.sid]
    );
    
    // Get consensus data
    const [consenso] = await db.execute(
      `SELECT cd.*, 
              it.nombre AS item, 
              it.seccion_id,
              sc.nombre AS seccion,
              um.codigo AS unidad_codigo,
              um.nombre AS unidad_nombre
       FROM consenso_delphi cd
       JOIN items_trabajo it ON it.id = cd.item_id
       LEFT JOIN secciones sc ON sc.id = it.seccion_id
       LEFT JOIN unidades_medida um ON um.id = it.unidad_id
       WHERE cd.sesion_id = ?
       ORDER BY sc.orden, it.orden`,
      [req.params.sid]
    );

    // Calculate total estimate
    const gran_total = consenso.reduce((s, c) => s + parseFloat(c.estimacion_final), 0);

    // Get items with PERT estimates (if any)
    const [items] = await db.execute(
      `SELECT it.*,
              ep.optimista, ep.mas_probable, ep.pesimista,
              ROUND(ep.valor_esperado, 2) AS valor_esperado,
              ROUND(ep.desv_estandar, 2) AS desv_estandar,
              ROUND(ep.varianza, 4) AS varianza
       FROM items_trabajo it
       LEFT JOIN estimaciones_pert ep ON ep.item_id = it.id
       WHERE it.sesion_id = ?
       ORDER BY it.orden`,
      [req.params.sid]
    );

    // Get adjustment factors
    const [factores] = await db.execute(
      'SELECT * FROM factores_ajuste WHERE sesion_id = ?',
      [req.params.sid]
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

    // Get current open round if exists
    const [rondaActiva] = await db.execute(
      `SELECT * FROM rondas_delphi 
       WHERE sesion_id = ? AND estado = 'abierta' 
       LIMIT 1`,
      [req.params.sid]
    );

    res.json({
      sesion,
      total_rondas,
      total_participantes,
      secciones,
      consenso,
      items,
      factores,
      gran_total: +gran_total.toFixed(2),
      resumen: {
        total_items: items.length,
        total_estimacion: totalEstimacion,
        desviacion_estandar_total: desviacionTotal,
        varianza_total: totalVarianza,
        intervalo_confianza_95: intervaloConfianza95,
        items_estimados: items.filter(i => i.valor_esperado).length
      },
      ronda_activa: rondaActiva[0] || null
    });
  } catch (err) { 
    console.error('Error in /resumen:', err);
    res.status(500).json({ error: err.message, details: err.sqlMessage }); 
  }
});
/* ═══════════════════════════════════════════════════════════════
   VISTA DEL EXPERTO — mis sesiones
═══════════════════════════════════════════════════════════════ */

// GET /api/delphi/mis-sesiones
router.get('/mis-sesiones', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT
         s.id, s.nombre, s.estado, s.creado_en,
         p.nombre AS proyecto,
         r.id     AS ronda_activa_id,
         r.numero_ronda AS ronda_activa_num,
         (SELECT COUNT(DISTINCT de2.usuario_id)
          FROM estimaciones_delphi de2
          WHERE de2.ronda_id = r.id)           AS participantes_que_estimaron,
         (SELECT COUNT(*)
          FROM estimaciones_delphi de3
          WHERE de3.ronda_id = r.id
            AND de3.usuario_id = ?)            AS ya_estimo
       FROM sesion_participantes sp
       JOIN sesiones_estimacion s ON s.id = sp.sesion_id
       JOIN proyectos p           ON p.id = s.proyecto_id
       LEFT JOIN rondas_delphi r
         ON r.sesion_id = s.id AND r.estado = 'abierta'
       WHERE sp.usuario_id = ?
       ORDER BY s.creado_en DESC`,
      [req.user.id, req.user.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════════════════════════════════════════════
   EXPORTACIÓN
═══════════════════════════════════════════════════════════════ */

// GET /api/delphi/formatos-exportacion
router.get('/formatos-exportacion', async (_req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT * FROM formatos_exportacion WHERE activo = 1 ORDER BY id`
    );
    res.json(rows);
  } catch (err) {
    /* Si la tabla aún no existe devolver lista por defecto */
    res.json([
      { id: 1, codigo: 'JSON', nombre: 'JSON',        descripcion: 'Datos estructurados JSON' },
      { id: 2, codigo: 'CSV',  nombre: 'CSV',         descripcion: 'Hoja de datos CSV' },
      { id: 3, codigo: 'PDF',  nombre: 'Reporte PDF', descripcion: 'PDF (requiere librería)' },
      { id: 4, codigo: 'XLSX', nombre: 'Excel XLSX',  descripcion: 'Excel (requiere librería)' },
    ]);
  }
});

// GET /api/delphi/sesion/:sid/exportar?formato=JSON|CSV
router.get('/sesion/:sid/exportar', async (req, res) => {
  const formato = (req.query.formato || 'JSON').toUpperCase();
  try {
    const [[sesion]] = await db.execute(
      `SELECT s.*, p.nombre AS proyecto, m.codigo AS metodo
       FROM sesiones_estimacion s
       JOIN proyectos p          ON p.id = s.proyecto_id
       JOIN metodos_estimacion m ON m.id = s.metodo_id
       WHERE s.id = ?`,
      [req.params.sid]
    );
    const [consenso] = await db.execute(
      `SELECT cd.*, it.nombre AS item, sc.nombre AS seccion, um.codigo AS unidad
       FROM consenso_delphi cd
       JOIN  items_trabajo it       ON it.id = cd.item_id
       LEFT JOIN secciones sc       ON sc.id = it.seccion_id
       LEFT JOIN unidades_medida um ON um.id = it.unidad_id
       WHERE cd.sesion_id = ?
       ORDER BY sc.orden, it.orden`,
      [req.params.sid]
    );
    const [estadisticas] = await db.execute(
      `SELECT de.item_id, it.nombre AS item, sc.nombre AS seccion,
              ROUND(AVG(de.estimacion),2) AS promedio,
              ROUND(MIN(de.estimacion),2) AS minimo,
              ROUND(MAX(de.estimacion),2) AS maximo,
              ROUND(STD(de.estimacion),2) AS desv_estandar,
              ROUND(
                CASE WHEN AVG(de.estimacion) = 0 THEN 0
                     ELSE (STD(de.estimacion)/AVG(de.estimacion))*100 END
              ,2) AS coef_variacion_pct
       FROM estimaciones_delphi de
       JOIN items_trabajo it   ON it.id = de.item_id
       LEFT JOIN secciones sc  ON sc.id = it.seccion_id
       JOIN rondas_delphi rd   ON rd.id = de.ronda_id
       WHERE rd.sesion_id = ?
       GROUP BY de.item_id, it.nombre, sc.nombre
       ORDER BY sc.orden, it.orden`,
      [req.params.sid]
    );

    const payload = { sesion, consenso, estadisticas, exportado_en: new Date() };

    if (formato === 'JSON') {
      res.setHeader('Content-Disposition', `attachment; filename="delphi_${req.params.sid}.json"`);
      return res.json(payload);
    }
    if (formato === 'CSV') {
      const header = 'seccion,item,promedio,minimo,maximo,cv_pct,consenso,estimacion_final\n';
      const rows = consenso.map(c => {
        const stat = estadisticas.find(s => s.item_id === c.item_id) || {};
        return [
          `"${(c.seccion || '').replace(/"/g, '')}"`,
          `"${(c.item    || '').replace(/"/g, '')}"`,
          stat.promedio || '',
          stat.minimo   || '',
          stat.maximo   || '',
          stat.coef_variacion_pct || '',
          c.consenso_logrado ? 'SI' : 'NO',
          c.estimacion_final,
        ].join(',');
      }).join('\n');
      res.setHeader('Content-Disposition', `attachment; filename="delphi_${req.params.sid}.csv"`);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      return res.send('\uFEFF' + header + rows); // BOM para Excel
    }

    res.status(501).json({
      message: `${formato} requiere librería adicional (jsPDF / ExcelJS).`,
      datos:   payload,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;