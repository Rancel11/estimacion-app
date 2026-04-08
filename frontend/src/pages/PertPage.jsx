import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ErrorBar,
} from 'recharts';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  BarChart2,
  TrendingUp,
  Sigma,
  Calculator,
  Settings,
  List,
  FileText,
  Save,
} from 'lucide-react';
import {
  getSesiones, getSesion, getItems, crearItem, eliminarItem,
  guardarPert, getResultadosPert, crearFactor, getFactores, eliminarFactor,
  cambiarEstado, crearItemsBulk,
} from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function PertPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const sesionParam = searchParams.get('sesion');
  const proyectoParam = searchParams.get('proyecto');

  const [sesiones, setSesiones] = useState([]);
  const [sesionId, setSesionId] = useState('');
  const [sesion, setSesion] = useState(null);
  const [items, setItems] = useState([]);
  const [resultados, setResultados] = useState(null);
  const [factores, setFactores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('items');

  const [addItem, setAddItem] = useState(false);
  const [itemForm, setItemForm] = useState({ nombre: '', descripcion: '', complejidad: '' });
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [factorModal, setFactorModal] = useState(false);
  const [factorForm, setFactorForm] = useState({ nombre: '', descripcion: '', valor: '1' });
  const [saving, setSaving] = useState(false);

  const [editRow, setEditRow] = useState(null);
  const [pertVals, setPertVals] = useState({ optimista: '', mas_probable: '', pesimista: '' });
  const [pertError, setPertError] = useState('');

  const isMod = ['admin', 'moderador'].includes(user?.rol);

useEffect(() => {
  getSesiones().then(r => {
    const pertSesiones = r.data.filter(s => s.metodo === 'PERT');
    setSesiones(pertSesiones);

    if (sesionParam) {
      const existe = pertSesiones.find(s => String(s.id) === sesionParam);
      if (existe) {
        setSesionId(sesionParam);
        loadSesion(sesionParam);
      }
    } else if (proyectoParam) {
      const delProyecto = pertSesiones.find(s => String(s.proyecto_id) === proyectoParam);
      if (delProyecto) {
        setSesionId(String(delProyecto.id));
        loadSesion(String(delProyecto.id));
      }
    }
  });
}, []);

  const loadSesion = async id => {
    setLoading(true);
    try {
      const [s, r, f] = await Promise.all([
        getSesion(id),
        getResultadosPert(id),
        getFactores(id),
      ]);
      setSesion(s.data);
      setItems(s.data.items || []);
      setResultados(r.data);
      setFactores(f.data);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSesion = id => {
    setSesionId(id);
    setTab('items');
    if (id) loadSesion(id);
    else {
      setSesion(null);
      setItems([]);
      setResultados(null);
      setFactores([]);
    }
  };

  const handleAddItem = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await crearItem(sesionId, itemForm);
      setAddItem(false);
      setItemForm({ nombre: '', descripcion: '', complejidad: '' });
      loadSesion(sesionId);
    } finally {
      setSaving(false);
    }
  };

  const handleBulkAdd = async () => {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setSaving(true);
    try {
      await crearItemsBulk(sesionId, lines.map(nombre => ({ nombre })));
      setBulkModal(false);
      setBulkText('');
      loadSesion(sesionId);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async id => {
    if (!window.confirm('¿Eliminar este ítem y su estimación?')) return;
    await eliminarItem(sesionId, id);
    loadSesion(sesionId);
  };

  const startEdit = item => {
    setEditRow(item.id);
    setPertVals({
      optimista: item.optimista ?? '',
      mas_probable: item.mas_probable ?? '',
      pesimista: item.pesimista ?? '',
    });
    setPertError('');
  };

  const handleSavePert = async itemId => {
    const { optimista, mas_probable, pesimista } = pertVals;
    if (+optimista > +mas_probable || +mas_probable > +pesimista) {
      setPertError('Debe cumplirse: Optimista ≤ Más Probable ≤ Pesimista');
      return;
    }
    setSaving(true);
    try {
      await guardarPert(itemId, {
        optimista: +optimista,
        mas_probable: +mas_probable,
        pesimista: +pesimista,
      });
      setEditRow(null);
      loadSesion(sesionId);
    } finally {
      setSaving(false);
    }
  };

  const handleAddFactor = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await crearFactor(sesionId, factorForm);
      setFactorModal(false);
      setFactorForm({ nombre: '', descripcion: '', valor: '1' });
      loadSesion(sesionId);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFactor = async fid => {
    await eliminarFactor(sesionId, fid);
    loadSesion(sesionId);
  };

  const handleComplete = async () => {
    if (!window.confirm('¿Marcar esta estimación como completada?')) return;
    await cambiarEstado(sesionId, 'completada');
    loadSesion(sesionId);
  };

  const chartData =
    resultados?.items?.map(i => ({
      name: i.item.length > 14 ? i.item.slice(0, 14) + '…' : i.item,
      esperado: parseFloat(i.valor_esperado),
      error: parseFloat(i.desv_estandar),
      optimista: parseFloat(i.optimista),
      pesimista: parseFloat(i.pesimista),
    })) || [];

  const complejidadColor = c =>
    ({
      baja: 'var(--green)',
      media: 'var(--amber)',
      alta: 'var(--red)',
    }[c] || 'var(--text3)');

  const totalEstimados = items.filter(i => i.valor_esperado).length;

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2>Estimación PERT</h2>
          <p>Program Evaluation and Review Technique</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/proyectos')}>
          <ArrowLeft size={14} style={{ marginRight: 4 }} /> Proyectos
        </button>
      </div>

      {/* Fórmula */}
      <div className="pert-formula" style={{ marginBottom: 20 }}>
        <strong>E = (O + 4M + P) / 6</strong>
        &nbsp;·&nbsp;
        <strong>σ = (P − O) / 6</strong>
        &nbsp;·&nbsp;
        <strong>σ² = ((P − O) / 6)²</strong>
      </div>

      {/* Selector de sesión */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 260, marginBottom: 0 }}>
            <label>Sesión PERT</label>
            <select
              className="form-control"
              value={sesionId}
              onChange={e => handleSelectSesion(e.target.value)}
            >
              <option value="">— Elegir sesión —</option>
              {sesiones.map(s => (
                <option key={s.id} value={s.id}>
                  {s.nombre} ({s.proyecto})
                </option>
              ))}
            </select>
          </div>
          {sesion && sesion.estado !== 'completada' && items.some(i => i.valor_esperado) && isMod && (
            <button className="btn btn-success btn-sm" onClick={handleComplete}>
              <Check size={14} style={{ marginRight: 4 }} /> Marcar Completada
            </button>
          )}
        </div>
      </div>

      {/* Sin sesión seleccionada */}
      {!sesionId && (
        <div className="card">
          <div className="empty-state">
            <BarChart2 size={40} style={{ color: 'var(--text3)', marginBottom: 16 }} />
            <p>Selecciona una sesión PERT para comenzar a estimar</p>
            <p style={{ fontSize: 12, color: 'var(--text3)' }}>
              Puedes crear un proyecto PERT desde la sección Proyectos
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <span className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      )}

      {/* Contenido de la sesión */}
      {sesion && !loading && (
        <>
          {/* Stats */}
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card" style={{ '--c1': 'var(--accent)' }}>
              <div className="stat-label">Ítems</div>
              <div className="stat-value">{items.length}</div>
              <div className="stat-sub">{totalEstimados} estimados</div>
            </div>
            {resultados?.totales && (
              <>
                <div className="stat-card" style={{ '--c1': 'var(--green)' }}>
                  <div className="stat-label">Total Esperado</div>
                  <div className="stat-value" style={{ fontSize: 24 }}>
                    {resultados.totales.total_esperado}
                  </div>
                  <div className="stat-sub">{sesion.unidad_codigo}</div>
                </div>
                <div className="stat-card" style={{ '--c1': 'var(--amber)' }}>
                  <div className="stat-label">Total Ajustado</div>
                  <div className="stat-value" style={{ fontSize: 24 }}>
                    {resultados.totales.total_ajustado}
                  </div>
                  <div className="stat-sub">factor × {resultados.totales.factor_ajuste}</div>
                </div>
                <div className="stat-card" style={{ '--c1': 'var(--accent2)' }}>
                  <div className="stat-label">σ Total</div>
                  <div className="stat-value" style={{ fontSize: 24 }}>
                    {resultados.totales.desv_estandar_total}
                  </div>
                  <div className="stat-sub">desviación estándar</div>
                </div>
              </>
            )}
          </div>

          {/* Estado badge */}
          {sesion.estado === 'completada' && (
            <div
              className="alert"
              style={{
                background: 'rgba(34,197,94,.1)',
                border: '1px solid rgba(34,197,94,.3)',
                borderRadius: 'var(--radius)',
                padding: '10px 16px',
                marginBottom: 16,
                color: 'var(--green)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Check size={16} /> Esta estimación está completada.
            </div>
          )}

          {/* Tabs */}
          <div className="tabs">
            <button className={`tab ${tab === 'items' ? 'active' : ''}`} onClick={() => setTab('items')}>
              <List size={14} style={{ marginRight: 6 }} /> Ítems y Estimaciones
            </button>
            <button
              className={`tab ${tab === 'resultados' ? 'active' : ''}`}
              onClick={() => setTab('resultados')}
              disabled={!resultados?.totales}
            >
              <BarChart2 size={14} style={{ marginRight: 6 }} /> Resultados
            </button>
            <button
              className={`tab ${tab === 'factores' ? 'active' : ''}`}
              onClick={() => setTab('factores')}
            >
              <Settings size={14} style={{ marginRight: 6 }} /> Factores de Ajuste
            </button>
          </div>

          {/* ── TAB: ÍTEMS ──────────────────────────────────────── */}
          {tab === 'items' && (
            <>
              {isMod && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => setAddItem(true)}>
                    <Plus size={14} style={{ marginRight: 4 }} /> Agregar Ítem
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setBulkModal(true)}>
                    <FileText size={14} style={{ marginRight: 4 }} /> Agregar Varios
                  </button>
                </div>
              )}

              {items.length === 0 ? (
                <div className="card">
                  <div className="empty-state">
                    <List size={40} style={{ color: 'var(--text3)', marginBottom: 16 }} />
                    <p>Agrega los módulos o tareas a estimar</p>
                    {isMod && (
                      <button className="btn btn-primary btn-sm" onClick={() => setAddItem(true)}>
                        <Plus size={14} style={{ marginRight: 4 }} /> Primer Ítem
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Ítem / Módulo</th>
                        <th>Complejidad</th>
                        <th>Optimista (O)</th>
                        <th>Más Probable (M)</th>
                        <th>Pesimista (P)</th>
                        <th>E = (O+4M+P)/6</th>
                        <th>σ</th>
                        <th>σ²</th>
                        {isMod && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={item.id}>
                          <td className="td-mono" style={{ color: 'var(--text3)' }}>
                            {idx + 1}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{item.nombre}</div>
                            {item.descripcion && (
                              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{item.descripcion}</div>
                            )}
                          </td>
                          <td>
                            {item.complejidad ? (
                              <span
                                style={{
                                  color: complejidadColor(item.complejidad),
                                  fontWeight: 600,
                                  fontSize: 12,
                                }}
                              >
                                {item.complejidad.toUpperCase()}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>
                            )}
                          </td>

                          {editRow === item.id ? (
                            <>
                              {['optimista', 'mas_probable', 'pesimista'].map(k => (
                                <td key={k}>
                                  <input
                                    className="form-control"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    style={{ width: 90, padding: '6px 8px', fontSize: 13 }}
                                    value={pertVals[k]}
                                    onChange={e => setPertVals(p => ({ ...p, [k]: e.target.value }))}
                                  />
                                </td>
                              ))}
                              <td colSpan={3}>
                                {pertError && (
                                  <div style={{ color: 'var(--red)', fontSize: 11, marginBottom: 4 }}>
                                    {pertError}
                                  </div>
                                )}
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    className="btn btn-success btn-sm"
                                    disabled={saving}
                                    onClick={() => handleSavePert(item.id)}
                                  >
                                    <Check size={12} />
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setEditRow(null)}
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="td-mono" style={{ color: 'var(--green)' }}>
                                {item.optimista ?? '—'}
                              </td>
                              <td className="td-mono">{item.mas_probable ?? '—'}</td>
                              <td className="td-mono" style={{ color: 'var(--red)' }}>
                                {item.pesimista ?? '—'}
                              </td>
                              <td className="td-mono" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                                {item.valor_esperado ?? '—'}
                              </td>
                              <td className="td-mono" style={{ color: 'var(--text2)' }}>
                                {item.desv_estandar ?? '—'}
                              </td>
                              <td className="td-mono" style={{ color: 'var(--text3)', fontSize: 12 }}>
                                {item.varianza ?? '—'}
                              </td>
                            </>
                          )}

                          {isMod && (
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {editRow !== item.id && (
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => startEdit(item)}
                                    title="Editar estimación"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                )}
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleDeleteItem(item.id)}
                                  title="Eliminar ítem"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}

                      {/* Fila de totales */}
                      {resultados?.totales && (
                        <tr style={{ background: 'rgba(79,142,247,.08)', fontWeight: 700 }}>
                          <td colSpan={6} style={{ textAlign: 'right', color: 'var(--text2)', fontSize: 12 }}>
                            TOTALES DEL PROYECTO
                          </td>
                          <td className="td-mono" style={{ color: 'var(--accent)', fontWeight: 800 }}>
                            {resultados.totales.total_esperado}
                          </td>
                          <td className="td-mono" style={{ color: 'var(--text2)' }}>
                            {resultados.totales.desv_estandar_total}
                          </td>
                          <td className="td-mono" style={{ color: 'var(--text3)' }}>
                            {resultados.totales.total_varianza}
                          </td>
                          {isMod && <td></td>}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── TAB: RESULTADOS ─────────────────────────────────── */}
          {tab === 'resultados' && resultados?.totales && (
            <div>
              {/* Intervalos de confianza */}
              <div className="card" style={{ marginBottom: 20 }}>
                <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sigma size={18} style={{ color: 'var(--accent)' }} />
                  Intervalos de Confianza del Proyecto
                </h3>
                <div className="grid-3" style={{ gap: 12 }}>
                  {[
                    {
                      label: 'IC 68.3% (±1σ)',
                      inf: resultados.totales.ic_68_inf,
                      sup: resultados.totales.ic_68_sup,
                      color: 'var(--green)',
                    },
                    {
                      label: 'IC 90.0% (±1.645σ)',
                      inf: resultados.totales.ic_90_inf,
                      sup: resultados.totales.ic_90_sup,
                      color: 'var(--amber)',
                    },
                    {
                      label: 'IC 95.0% (±1.96σ)',
                      inf: resultados.totales.ic_95_inf,
                      sup: resultados.totales.ic_95_sup,
                      color: 'var(--accent)',
                    },
                  ].map(ic => (
                    <div key={ic.label} className="ic-block" style={{ borderColor: ic.color + '44' }}>
                      <div className="ic-label">{ic.label}</div>
                      <div className="ic-row">
                        <span className="range" style={{ color: ic.color }}>
                          [{ic.inf} — {ic.sup}]
                        </span>
                        <span className="pct">{sesion.unidad_codigo}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gráfica con barras de error */}
              <div className="chart-container" style={{ marginBottom: 20 }}>
                <div className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <TrendingUp size={16} style={{ color: 'var(--accent)' }} />
                  Valor Esperado por Ítem (con rango O–P)
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <ReBarChart data={chartData} barSize={36}>
                    <XAxis
                      dataKey="name"
                      tick={{ fill: 'var(--text2)', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'var(--text3)', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div
                            style={{
                              background: 'var(--bg3)',
                              border: '1px solid var(--border)',
                              borderRadius: 8,
                              padding: '10px 14px',
                              fontSize: 12,
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 700,
                                marginBottom: 6,
                                color: 'var(--text)',
                              }}
                            >
                              {d.name}
                            </div>
                            <div style={{ color: 'var(--green)' }}>O: {d.optimista}</div>
                            <div style={{ color: 'var(--accent)' }}>E: {d.esperado}</div>
                            <div style={{ color: 'var(--red)' }}>P: {d.pesimista}</div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="esperado" radius={[6, 6, 0, 0]} fill="var(--accent)">
                      <ErrorBar dataKey="error" width={6} strokeWidth={2} stroke="var(--amber)" />
                    </Bar>
                  </ReBarChart>
                </ResponsiveContainer>
              </div>

              {/* Tabla resumen */}
              <div className="card">
                <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calculator size={18} style={{ color: 'var(--accent)' }} />
                  Tabla Resumen Completa
                </h3>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Ítem</th>
                        <th>O</th>
                        <th>M</th>
                        <th>P</th>
                        <th>E=(O+4M+P)/6</th>
                        <th>σ=(P-O)/6</th>
                        <th>σ²</th>
                        <th>IC 68% (±1σ)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultados.items.map(i => (
                        <tr key={i.item_id}>
                          <td>
                            <strong>{i.item}</strong>
                          </td>
                          <td className="td-mono" style={{ color: 'var(--green)' }}>
                            {i.optimista}
                          </td>
                          <td className="td-mono">{i.mas_probable}</td>
                          <td className="td-mono" style={{ color: 'var(--red)' }}>
                            {i.pesimista}
                          </td>
                          <td className="td-mono" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                            {i.valor_esperado}
                          </td>
                          <td className="td-mono" style={{ color: 'var(--text2)' }}>
                            {i.desv_estandar}
                          </td>
                          <td className="td-mono" style={{ color: 'var(--text3)', fontSize: 12 }}>
                            {i.varianza}
                          </td>
                          <td className="td-mono" style={{ fontSize: 12 }}>
                            [{i.limite_inferior_68} — {i.limite_superior_68}]
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background: 'rgba(79,142,247,.1)', fontWeight: 700 }}>
                        <td>TOTAL PROYECTO</td>
                        <td colSpan={3}></td>
                        <td className="td-mono" style={{ color: 'var(--accent)', fontWeight: 800 }}>
                          {resultados.totales.total_esperado}
                        </td>
                        <td className="td-mono" style={{ color: 'var(--text2)' }}>
                          {resultados.totales.desv_estandar_total}
                        </td>
                        <td className="td-mono" style={{ color: 'var(--text3)' }}>
                          {resultados.totales.total_varianza}
                        </td>
                        <td className="td-mono">
                          [{resultados.totales.ic_68_inf} — {resultados.totales.ic_68_sup}]
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: FACTORES ───────────────────────────────────── */}
          {tab === 'factores' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                }}
              >
                <p style={{ fontSize: 13, color: 'var(--text2)' }}>
                  Factores multiplicativos que ajustan el total estimado (riesgo, curva de aprendizaje…)
                </p>
                {isMod && (
                  <button className="btn btn-primary btn-sm" onClick={() => setFactorModal(true)}>
                    <Plus size={14} style={{ marginRight: 4 }} /> Agregar Factor
                  </button>
                )}
              </div>

              {factores.length === 0 ? (
                <div className="card">
                  <div className="empty-state">
                    <Settings size={40} style={{ color: 'var(--text3)', marginBottom: 16 }} />
                    <p>Sin factores de ajuste aplicados</p>
                  </div>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Factor</th>
                        <th>Descripción</th>
                        <th>Valor Multiplicador</th>
                        {isMod && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {factores.map(f => (
                        <tr key={f.id}>
                          <td>
                            <strong>{f.nombre}</strong>
                          </td>
                          <td style={{ color: 'var(--text2)', fontSize: 13 }}>
                            {f.descripcion || '—'}
                          </td>
                          <td
                            className="td-mono"
                            style={{
                              color:
                                f.valor > 1
                                  ? 'var(--amber)'
                                  : f.valor < 1
                                    ? 'var(--green)'
                                    : 'var(--text)',
                              fontWeight: 700,
                            }}
                          >
                            × {parseFloat(f.valor).toFixed(3)}
                          </td>
                          {isMod && (
                            <td>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeleteFactor(f.id)}
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                      <tr style={{ background: 'rgba(79,142,247,.08)', fontWeight: 700 }}>
                        <td colSpan={2} style={{ textAlign: 'right', color: 'var(--text2)' }}>
                          Factor Combinado
                        </td>
                        <td className="td-mono" style={{ color: 'var(--accent)', fontWeight: 800 }}>
                          × {resultados?.totales?.factor_ajuste}
                        </td>
                        {isMod && <td></td>}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {resultados?.totales && (
                <div className="card" style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <div
                        style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}
                      >
                        TOTAL BASE
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        {resultados.totales.total_esperado}
                        <span style={{ fontSize: 13, color: 'var(--text3)', marginLeft: 4 }}>
                          {sesion.unidad_codigo}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: 24, color: 'var(--text3)' }}>×</div>
                    <div>
                      <div
                        style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}
                      >
                        FACTOR AJUSTE
                      </div>
                      <div
                        style={{
                          fontSize: 22,
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--amber)',
                        }}
                      >
                        {resultados.totales.factor_ajuste}
                      </div>
                    </div>
                    <div style={{ fontSize: 24, color: 'var(--text3)' }}>=</div>
                    <div>
                      <div
                        style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}
                      >
                        TOTAL AJUSTADO
                      </div>
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 800,
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--accent)',
                        }}
                      >
                        {resultados.totales.total_ajustado}
                        <span style={{ fontSize: 14, color: 'var(--text3)', marginLeft: 4 }}>
                          {sesion.unidad_codigo}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── MODALES ─────────────────────────────────────────────── */}

      {/* Modal: Agregar Ítem */}
      {addItem && (
        <div className="modal-overlay" onClick={() => setAddItem(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3>Agregar Ítem / Módulo</h3>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer' }}
                onClick={() => setAddItem(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddItem}>
              <div className="form-group">
                <label>Nombre *</label>
                <input
                  className="form-control"
                  placeholder="Ej: Módulo de Autenticación"
                  value={itemForm.nombre}
                  onChange={e => setItemForm(p => ({ ...p, nombre: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Complejidad</label>
                <select
                  className="form-control"
                  value={itemForm.complejidad}
                  onChange={e => setItemForm(p => ({ ...p, complejidad: e.target.value }))}
                >
                  <option value="">Sin especificar</option>
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  className="form-control"
                  placeholder="Descripción opcional del módulo o tarea…"
                  value={itemForm.descripcion}
                  onChange={e => setItemForm(p => ({ ...p, descripcion: e.target.value }))}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAddItem(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? (
                    <>
                      <span className="spinner" /> Guardando…
                    </>
                  ) : (
                    <>
                      <Plus size={14} style={{ marginRight: 4 }} /> Agregar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bulk */}
      {bulkModal && (
        <div className="modal-overlay" onClick={() => setBulkModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3>Agregar Ítems en Lote</h3>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer' }}
                onClick={() => setBulkModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
              Escribe un ítem por línea. Se crearán todos de una vez.
            </p>
            <textarea
              className="form-control"
              rows={10}
              placeholder="Módulo de Autenticación&#10;Gestión de Usuarios&#10;Reportes&#10;API REST&#10;Base de Datos"
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
            />
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setBulkModal(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={saving || !bulkText.trim()}
                onClick={handleBulkAdd}
              >
                {saving ? (
                  <>
                    <span className="spinner" /> Agregando…
                  </>
                ) : (
                  <>
                    <Plus size={14} style={{ marginRight: 4 }} /> Agregar{' '}
                    {bulkText.split('\n').filter(l => l.trim()).length} ítems
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Factor */}
      {factorModal && (
        <div className="modal-overlay" onClick={() => setFactorModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3>Agregar Factor de Ajuste</h3>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer' }}
                onClick={() => setFactorModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddFactor}>
              <div className="form-group">
                <label>Nombre del Factor *</label>
                <input
                  className="form-control"
                  placeholder="Ej: Factor de Riesgo"
                  value={factorForm.nombre}
                  onChange={e => setFactorForm(p => ({ ...p, nombre: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Valor Multiplicador * (0.5 = −50%, 1.2 = +20%)</label>
                <input
                  className="form-control"
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={factorForm.valor}
                  onChange={e => setFactorForm(p => ({ ...p, valor: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Descripción / Justificación</label>
                <textarea
                  className="form-control"
                  placeholder="Por qué se aplica este factor…"
                  value={factorForm.descripcion}
                  onChange={e => setFactorForm(p => ({ ...p, descripcion: e.target.value }))}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setFactorModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? (
                    <>
                      <span className="spinner" /> Guardando…
                    </>
                  ) : (
                    <>
                      <Plus size={14} style={{ marginRight: 4 }} /> Agregar Factor
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}