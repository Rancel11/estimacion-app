const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const db     = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

/* ─── POST /api/pert/:itemId ─ Guardar/actualizar estimación ─ */
router.post('/:itemId', [
  body('optimista').isFloat({ min: 0 }),
  body('mas_probable').isFloat({ min: 0 }),
  body('pesimista').isFloat({ min: 0 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { optimista, mas_probable, pesimista } = req.body;
  if (optimista > mas_probable || mas_probable > pesimista) {
    return res.status(400).json({ error: 'Debe cumplirse: O ≤ M ≤ P' });
  }

  try {
    await db.execute(
      `INSERT INTO estimaciones_pert (item_id, optimista, mas_probable, pesimista)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         optimista    = VALUES(optimista),
         mas_probable = VALUES(mas_probable),
         pesimista    = VALUES(pesimista)`,
      [req.params.itemId, optimista, mas_probable, pesimista]
    );

    const [rows] = await db.execute(
      `SELECT optimista, mas_probable, pesimista,
              ROUND(valor_esperado,4) AS valor_esperado,
              ROUND(desv_estandar,4)  AS desv_estandar,
              ROUND(varianza,6)       AS varianza
       FROM estimaciones_pert WHERE item_id = ?`,
      [req.params.itemId]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ─── GET /api/pert/sesion/:sesionId ─ Resultados completos ─ */
router.get('/sesion/:sesionId', async (req, res) => {
  try {
    const [items] = await db.execute(
      `SELECT * FROM v_resultados_pert WHERE sesion_id = ? ORDER BY item_id`,
      [req.params.sesionId]
    );

    if (!items.length) return res.json({ items: [], totales: null });

    // Totales del proyecto
    const total_esperado  = items.reduce((s, i) => s + parseFloat(i.valor_esperado), 0);
    const total_varianza  = items.reduce((s, i) => s + parseFloat(i.varianza), 0);
    const desv_total      = Math.sqrt(total_varianza);

    // Factores de ajuste
    const [factores] = await db.execute(
      'SELECT * FROM factores_ajuste WHERE sesion_id = ?', [req.params.sesionId]
    );
    const factor_prod = factores.reduce((p, f) => p * parseFloat(f.valor), 1);

    // Intervalos de confianza
    const totales = {
      total_esperado:      +total_esperado.toFixed(2),
      total_varianza:      +total_varianza.toFixed(4),
      desv_estandar_total: +desv_total.toFixed(4),
      factor_ajuste:       +factor_prod.toFixed(3),
      total_ajustado:      +(total_esperado * factor_prod).toFixed(2),
      ic_68_inf:  +(total_esperado - desv_total).toFixed(2),
      ic_68_sup:  +(total_esperado + desv_total).toFixed(2),
      ic_90_inf:  +(total_esperado - 1.645 * desv_total).toFixed(2),
      ic_90_sup:  +(total_esperado + 1.645 * desv_total).toFixed(2),
      ic_95_inf:  +(total_esperado - 1.96  * desv_total).toFixed(2),
      ic_95_sup:  +(total_esperado + 1.96  * desv_total).toFixed(2),
      unidad: items[0].unidad,
    };

    res.json({ items, totales, factores });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ─── DELETE /api/pert/:itemId ───────────────────────── */
router.delete('/:itemId', async (req, res) => {
  try {
    await db.execute('DELETE FROM estimaciones_pert WHERE item_id = ?', [req.params.itemId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
