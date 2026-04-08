
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Settings,
  Target,
  BarChart2,
  Handshake,
  Flag,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle,
  Download,
  ArrowLeft,
  Users,
  Layers,
  Activity,
  AlertTriangle,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSesiones, cambiarEstado, eliminarItem } from '../services/api';
import API from '../services/api';

/* ── Helpers de API Delphi ─────────────────────────────── */
const delphi = {
  getExpertos:          ()           => API.get('/delphi/expertos'),
  getParticipantes:     sid          => API.get(`/delphi/sesion/${sid}/participantes`),
  addParticipante:      (sid, uid)   => API.post(`/delphi/sesion/${sid}/participantes`, { usuario_id: uid }),
  addParticipantesBulk: (sid, ids)   => API.post(`/delphi/sesion/${sid}/participantes/bulk`, { usuario_ids: ids }),
  delParticipante:      (sid, uid)   => API.delete(`/delphi/sesion/${sid}/participantes/${uid}`),
  getSecciones:         sid          => API.get(`/delphi/sesion/${sid}/secciones`),
  crearSeccion:         (sid, d)     => API.post(`/delphi/sesion/${sid}/secciones`, d),
  delSeccion:           id           => API.delete(`/delphi/secciones/${id}`),
  getItemsSeccion:      secId        => API.get(`/delphi/secciones/${secId}/items`),
  addItem:              (secId, d)   => API.post(`/delphi/secciones/${secId}/items`, d),
  addItemsBulk:         (secId, d)   => API.post(`/delphi/secciones/${secId}/items/bulk`, d),
  getRondas:            sid          => API.get(`/delphi/sesion/${sid}/rondas`),
  crearRonda:           (sid, d)     => API.post(`/delphi/sesion/${sid}/rondas`, d),
  cerrarRonda:          rid          => API.put(`/delphi/rondas/${rid}/cerrar`),
  getEstimaciones:      rid          => API.get(`/delphi/rondas/${rid}/estimaciones`),
  guardarBulk:          (rid, d)     => API.post(`/delphi/rondas/${rid}/estimaciones/bulk`, d),
  getStats:             rid          => API.get(`/delphi/rondas/${rid}/estadisticas`),
  getConsenso:          sid          => API.get(`/delphi/sesion/${sid}/consenso`),
  guardarConsenso:      (sid, d)     => API.post(`/delphi/sesion/${sid}/consenso/bulk`, { consensos: d }),
  getResumen:           sid          => API.get(`/delphi/sesion/${sid}/resumen`),
  getMisSesiones:       ()           => API.get('/delphi/mis-sesiones'),
  getFormatos:          ()           => API.get('/delphi/formatos-exportacion'),
  exportar:             (sid, fmt)   => API.get(`/delphi/sesion/${sid}/exportar?formato=${fmt}`, { responseType: fmt === 'JSON' ? 'json' : 'blob' }),
};

const cvColor = cv => cv < 20 ? 'var(--green)' : cv < 35 ? 'var(--amber)' : 'var(--red)';
const cvLabel = cv => cv < 20 ? 'Consenso' : cv < 35 ? 'Divergente' : 'Alta divergencia';
const cvBadge = cv => cv < 20 ? 'badge-green' : cv < 35 ? 'badge-amber' : 'badge-red';

/* ════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
════════════════════════════════════════════════════════ */
export default function DelphiPage() {
  const { user } = useAuth();
  const isExperto = user?.rol === 'experto';
  return isExperto ? <ExpertoView user={user} /> : <ModeradorView user={user} />;
}

/* ════════════════════════════════════════════════════════
   VISTA DEL EXPERTO
════════════════════════════════════════════════════════ */
function ExpertoView({ user }) {
  const [misSesiones, setMisSesiones] = useState([]);
  const [sesionId,    setSesionId]    = useState(null);
  const [sesionInfo,  setSesionInfo]  = useState(null);
  const [ronda,       setRonda]       = useState(null);
  const [items,       setItems]       = useState([]);
  const [capture,     setCapture]     = useState({});
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [mensaje,     setMensaje]     = useState('');

  useEffect(() => {
    delphi.getMisSesiones().then(r => {
      setMisSesiones(r.data);
      setLoading(false);
    });
  }, []);

  const seleccionar = async (s) => {
    setSesionInfo(s);
    setSesionId(s.id);
    if (s.ronda_activa_id) {
      setRonda({ id: s.ronda_activa_id, numero_ronda: s.ronda_activa_num });
      const secsRes = await delphi.getSecciones(s.id);
      const secs = secsRes.data;
      const todosItems = [];
      for (const sec of secs) {
        const itRes = await delphi.getItemsSeccion(sec.id);
        itRes.data.forEach(it => todosItems.push({ ...it, seccion_nombre: sec.nombre }));
      }
      setItems(todosItems);
    }
  };

  const handleSubmit = async () => {
    if (!ronda) return;
    const estimaciones = items
      .map(it => ({
        item_id:    it.id,
        estimacion: parseFloat(capture[it.id] || 0),
        comentario: capture[`nota_${it.id}`] || '',
      }))
      .filter(e => e.estimacion > 0);
    if (!estimaciones.length) { setMensaje('Ingresa al menos una estimación'); return; }
    setSaving(true);
    try {
      await delphi.guardarBulk(ronda.id, { estimaciones });
      setMensaje('Estimaciones guardadas correctamente');
    } catch (e) {
      setMensaje('Error: ' + (e.response?.data?.error || 'Error al guardar'));
    } finally { setSaving(false); }
  };

  if (loading) return <Spinner full />;

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h2>Panel del Experto</h2>
          <p>Bienvenido, {user?.nombre} — Ingresa tus estimaciones</p>
        </div>
      </div>

      {!sesionId ? (
        <div>
          <h3 style={{ marginBottom: 16, fontSize: 15 }}>Tus Sesiones Asignadas</h3>
          {misSesiones.length === 0
            ? <EmptyState icon={<Target size={36} />} text="No tienes sesiones asignadas actualmente" />
            : misSesiones.map(s => (
              <div
                key={s.id}
                className="card"
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}
                onClick={() => seleccionar(s)}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{s.nombre}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{s.proyecto}</div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {s.ronda_activa_id
                    ? <span className="badge badge-green">Ronda {s.ronda_activa_num} activa</span>
                    : <span className="badge badge-gray">Sin ronda activa</span>}
                  {s.ya_estimo > 0 && <span className="badge badge-blue">Ya estimaste</span>}
                </div>
                <button className="btn btn-primary btn-sm">Participar</button>
              </div>
            ))
          }
        </div>
      ) : (
        <div>
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginBottom: 20 }}
            onClick={() => { setSesionId(null); setRonda(null); setCapture({}); setItems([]); }}
          >
            <ArrowLeft size={14} /> Volver a mis sesiones
          </button>

          {!ronda
            ? <EmptyState icon={<Activity size={36} />} text="No hay rondas activas. Espera a que el moderador abra una." />
            : (
              <>
                <div className="card" style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3>Ronda {ronda.numero_ronda} — En curso</h3>
                      <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text2)' }}>
                        Estima cada ítem de forma independiente, sin ver las estimaciones de otros.
                      </p>
                    </div>
                    <span className="badge badge-green">Activa</span>
                  </div>
                </div>

                {mensaje && (
                  <div className={`alert ${mensaje.startsWith('Estimaciones') ? 'alert-success' : mensaje.startsWith('Error') ? 'alert-error' : 'alert-info'}`} style={{ marginBottom: 16 }}>
                    {mensaje}
                  </div>
                )}

                <div className="table-wrapper" style={{ marginBottom: 20 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>#</th><th>Ítem / Módulo</th><th>Sección</th>
                        <th>Unidad</th><th>Tu Estimación</th><th>Justificación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, i) => (
                        <tr key={it.id}>
                          <td className="td-mono" style={{ color: 'var(--text3)' }}>{i + 1}</td>
                          <td>
                            <strong>{it.nombre}</strong>
                            {it.descripcion && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{it.descripcion}</div>}
                          </td>
                          <td style={{ color: 'var(--text2)', fontSize: 12 }}>{it.seccion_nombre || '—'}</td>
                          <td><span className="badge badge-blue">{it.unidad_codigo || '—'}</span></td>
                          <td>
                            <input
                              className="form-control"
                              type="number"
                              min="0"
                              step="0.5"
                              style={{ width: 120 }}
                              placeholder="0"
                              value={capture[it.id] || ''}
                              onChange={e => setCapture(p => ({ ...p, [it.id]: e.target.value }))}
                            />
                          </td>
                          <td>
                            <input
                              className="form-control"
                              placeholder="Justificación…"
                              value={capture[`nota_${it.id}`] || ''}
                              onChange={e => setCapture(p => ({ ...p, [`nota_${it.id}`]: e.target.value }))}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-success"
                    disabled={saving}
                    onClick={handleSubmit}
                    style={{ padding: '12px 32px', fontSize: 14 }}
                  >
                    {saving ? <><Spinner /> Guardando…</> : <><CheckCircle size={16} /> Enviar mis estimaciones</>}
                  </button>
                </div>
              </>
            )
          }
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   VISTA DEL MODERADOR
════════════════════════════════════════════════════════ */
function ModeradorView({ user }) {
  const navigate        = useNavigate();
  const [searchParams]  = useSearchParams();
  const sesionParam     = searchParams.get('sesion');
  const proyectoParam   = searchParams.get('proyecto');

  const [sesiones,      setSesiones]      = useState([]);
  const [sesionId,      setSesionId]      = useState('');
  const [resumen,       setResumen]       = useState(null);
  const [secciones,     setSecciones]     = useState([]);
  const [participantes, setParticipantes] = useState([]);
  const [expertosDisp,  setExpertosDisp]  = useState([]);
  const [rondas,        setRondas]        = useState([]);
  const [rondaActiva,   setRondaActiva]   = useState(null);
  const [estimaciones,  setEstimaciones]  = useState([]);
  const [stats,         setStats]         = useState({ items: [], por_seccion: {}, progreso: null });
  const [consenso,      setConsenso]      = useState([]);
  const [formatos,      setFormatos]      = useState([]);
  const [tab,           setTab]           = useState('setup');
  const [loading,       setLoading]       = useState(false);
  const [saving,        setSaving]        = useState(false);

  // Modals
  const [seccionModal, setSeccionModal] = useState(false);
  const [seccionForm,  setSeccionForm]  = useState({ nombre: '', descripcion: '' });
  const [itemModal,    setItemModal]    = useState({ open: false, secId: null });
  const [itemForm,     setItemForm]     = useState({ nombre: '', complejidad: '' });
  const [bulkModal,    setBulkModal]    = useState({ open: false, secId: null });
  const [bulkText,     setBulkText]     = useState('');
  const [partModal,    setPartModal]    = useState(false);
  const [selectedExp,  setSelectedExp]  = useState([]);
  const [consensoForm, setConsensoForm] = useState({});

  const sseRef = useRef(null);

  /* ── Carga inicial ──────────────────────────────────── */
  useEffect(() => {
    Promise.all([
      getSesiones(),
      delphi.getFormatos(),
      delphi.getExpertos(),
    ]).then(([sesRes, fmtRes, expRes]) => {
      const delphiSesiones = sesRes.data.filter(s => s.metodo === 'DELPHI');
      setSesiones(delphiSesiones);
      setFormatos(fmtRes.data);
      setExpertosDisp(expRes.data);

      if (sesionParam) {
        const existe = delphiSesiones.find(s => String(s.id) === sesionParam);
        if (existe) handleSelectSesion(sesionParam);
      } else if (proyectoParam) {
        const delProyecto = delphiSesiones.find(s => String(s.proyecto_id) === proyectoParam);
        if (delProyecto) handleSelectSesion(String(delProyecto.id));
      }
    });
  }, []); // eslint-disable-line

  /* ── Cargar todo de la sesión ───────────────────────── */
  const loadAll = useCallback(async (sid) => {
    setLoading(true);
    try {
      const [sec, par, ron, con, res] = await Promise.all([
        delphi.getSecciones(sid),
        delphi.getParticipantes(sid),
        delphi.getRondas(sid),
        delphi.getConsenso(sid),
        delphi.getResumen(sid),
      ]);
      setSecciones(sec.data);
      setParticipantes(par.data);
      setRondas(ron.data);
      setConsenso(con.data);
      setResumen(res.data);

      const ultima = ron.data.find(r => r.estado === 'abierta') || ron.data[ron.data.length - 1];
      if (ultima) {
        setRondaActiva(ultima);
        await loadRonda(ultima.id);
      }
    } finally { setLoading(false); }
  }, []); // eslint-disable-line

  const loadRonda = async (rid) => {
    const [est, st] = await Promise.all([
      delphi.getEstimaciones(rid),
      delphi.getStats(rid),
    ]);
    setEstimaciones(est.data);
    setStats(st.data);
  };

  /* ── Cargar ítems de cada sección ───────────────────── */
  useEffect(() => {
    if (!secciones.length || !sesionId) return;
    Promise.all(
      secciones.map(s => delphi.getItemsSeccion(s.id).then(r => ({ id: s.id, items: r.data })))
    ).then(results => {
      setSecciones(prev => prev.map(s => {
        const found = results.find(r => r.id === s.id);
        return found ? { ...s, _items: found.items } : s;
      }));
    });
  }, [secciones.length, sesionId]); // eslint-disable-line

  /* ── SSE ────────────────────────────────────────────── */
  const conectarSSE = useCallback((sid) => {
    if (sseRef.current) sseRef.current.close();
    const token = localStorage.getItem('token');
    const es = new EventSource(`/api/delphi/sesion/${sid}/live?token=${token}`);
    es.onmessage = async (e) => {
      const data = JSON.parse(e.data);
      if ((data.type === 'snapshot' || data.type === 'estimacion_actualizada') && rondaActiva?.id) {
        const [st, est] = await Promise.all([
          delphi.getStats(rondaActiva.id),
          delphi.getEstimaciones(rondaActiva.id),
        ]);
        setStats(st.data);
        setEstimaciones(est.data);
      }
    };
    es.onerror = () => es.close();
    sseRef.current = es;
  }, [rondaActiva]); // eslint-disable-line

  useEffect(() => () => sseRef.current?.close(), []);

  const handleSelectSesion = (sid) => {
    setSesionId(sid);
    if (sid) {
      loadAll(sid);
      conectarSSE(sid);
      setTab('setup');
    } else {
      setSecciones([]); setParticipantes([]); setRondas([]); setConsenso([]); setResumen(null);
    }
  };

  /* ── Secciones ──────────────────────────────────────── */
  const handleCrearSeccion = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await delphi.crearSeccion(sesionId, { ...seccionForm, orden: secciones.length });
      setSeccionModal(false); setSeccionForm({ nombre: '', descripcion: '' });
      loadAll(sesionId);
    } finally { setSaving(false); }
  };

  const handleDelSeccion = async (id) => {
    if (!window.confirm('¿Eliminar la sección y todos sus ítems?')) return;
    await delphi.delSeccion(id);
    loadAll(sesionId);
  };

  /* ── Ítems ──────────────────────────────────────────── */
  const handleAddItem = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await delphi.addItem(itemModal.secId, { ...itemForm, sesion_id: sesionId });
      setItemModal({ open: false, secId: null });
      setItemForm({ nombre: '', complejidad: '' });
      loadAll(sesionId);
    } finally { setSaving(false); }
  };

  const handleBulkAdd = async () => {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setSaving(true);
    try {
      await delphi.addItemsBulk(bulkModal.secId, { sesion_id: sesionId, items: lines.map(nombre => ({ nombre })) });
      setBulkModal({ open: false, secId: null }); setBulkText('');
      loadAll(sesionId);
    } finally { setSaving(false); }
  };

  /* ── Participantes ──────────────────────────────────── */
  const handleAddParts = async () => {
    if (!selectedExp.length) return;
    setSaving(true);
    try {
      await delphi.addParticipantesBulk(sesionId, selectedExp);
      setPartModal(false); setSelectedExp([]);
      loadAll(sesionId);
    } finally { setSaving(false); }
  };

  const handleDelPart = async (uid) => {
    await delphi.delParticipante(sesionId, uid);
    setParticipantes(p => p.filter(x => x.usuario_id !== uid));
  };

  /* ── Rondas ─────────────────────────────────────────── */
  const handleCrearRonda = async () => {
    setSaving(true);
    try {
      const { data } = await delphi.crearRonda(sesionId, {});
      setRondaActiva(data);
      await loadAll(sesionId);
      setTab('ronda');
    } catch (e) { alert(e.response?.data?.error || 'Error al crear ronda'); }
    finally { setSaving(false); }
  };

  const handleCerrarRonda = async () => {
    if (!window.confirm('¿Cerrar la ronda? Las estimaciones quedarán bloqueadas.')) return;
    await delphi.cerrarRonda(rondaActiva.id);
    loadAll(sesionId);
  };

  /* ── Consenso ───────────────────────────────────────── */
  const allItems = secciones.flatMap(s => (s._items || []).map(it => ({ ...it, seccion_nombre: s.nombre })));

  const preFillConsenso = () => {
    const fill = {};
    stats.items.forEach(s => { fill[s.item_id] = s.promedio; });
    setConsensoForm(fill);
  };

  const handleGuardarConsenso = async () => {
    const payload = allItems.map(it => ({
      item_id:           it.id,
      estimacion_final:  parseFloat(consensoForm[it.id] || 0),
      rondas_necesarias: rondas.length,
      consenso_logrado:  (stats.items.find(s => s.item_id === it.id)?.consenso) || false,
    })).filter(c => c.estimacion_final > 0);
    if (!payload.length) return;
    setSaving(true);
    try {
      await delphi.guardarConsenso(sesionId, payload);
      await cambiarEstado(sesionId, 'completada');
      await loadAll(sesionId);
      setTab('resultados');
    } finally { setSaving(false); }
  };

  /* ── Exportar ───────────────────────────────────────── */
  const handleExportar = async (codigo) => {
    if (codigo === 'JSON') {
      const { data } = await delphi.exportar(sesionId, 'JSON');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `delphi_sesion_${sesionId}.json`;
      a.click();
    } else if (codigo === 'CSV') {
      const resp = await API.get(`/delphi/sesion/${sesionId}/exportar?formato=CSV`, { responseType: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(resp.data);
      a.download = `delphi_sesion_${sesionId}.csv`;
      a.click();
    }
  };

  const conConsensoLogrado = consenso.filter(c => c.consenso_logrado).length;

  /* ── Pantalla de selección de sesión ────────────────── */
  if (!sesionId) return (
    <div className="page-enter">
      <div className="page-header">
        <div><h2>Wideband Delphi</h2><p>Estimación grupal iterativa con expertos</p></div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/proyectos')}>
          <ArrowLeft size={14} /> Proyectos
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{
          background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
          padding: '16px 20px', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.8,
        }}>
          <strong style={{ color: 'var(--accent)' }}>Proceso Wideband Delphi</strong><br />
          1. Crear secciones y agregar ítems a estimar<br />
          2. Seleccionar expertos participantes<br />
          3. Abrir ronda — cada experto estima de forma independiente<br />
          4. Revisar estadísticas (CV &lt; 20% = consenso)<br />
          5. Si hay divergencia: discutir y abrir nueva ronda<br />
          6. Registrar consenso final y exportar resultados
        </div>
      </div>

      <div className="card">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Seleccionar Sesión Delphi</label>
          <select
            className="form-control"
            style={{ maxWidth: 480 }}
            value={sesionId}
            onChange={e => handleSelectSesion(e.target.value)}
          >
            <option value="">— Elegir sesión —</option>
            {sesiones.map(s => (
              <option key={s.id} value={s.id}>{s.nombre} ({s.proyecto})</option>
            ))}
          </select>
          {sesiones.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
              No hay sesiones Delphi. Crea un proyecto con método Delphi desde{' '}
              <span
                style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => navigate('/proyectos')}
              >
                Proyectos
              </span>.
            </p>
          )}
        </div>
      </div>
    </div>
  );

  /* ── Sesión seleccionada ────────────────────────────── */
  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2>{resumen?.sesion?.nombre || 'Delphi'}</h2>
          <p>{resumen?.sesion?.proyecto}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="form-control"
            style={{ maxWidth: 300 }}
            value={sesionId}
            onChange={e => handleSelectSesion(e.target.value)}
          >
            {sesiones.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.proyecto})</option>)}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/proyectos')}>
            <ArrowLeft size={14} /> Proyectos
          </button>
        </div>
      </div>

      {loading ? <Spinner full /> : (
        <>
          {/* Stats */}
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            <StatCard label="Secciones"  value={secciones.length}    icon={<Layers size={18} />}   color="var(--accent)" />
            <StatCard label="Ítems"       value={allItems.length}      icon={<ClipboardList size={18} />} color="var(--accent2)" />
            <StatCard label="Expertos"    value={participantes.length} sub={`${rondas.length} rondas`} icon={<Users size={18} />} color="var(--green)" />
            <StatCard label="Consensos"  value={`${conConsensoLogrado}/${allItems.length}`}
              sub={`${rondas.filter(r => r.estado === 'cerrada').length} rondas cerradas`}
              icon={<CheckCircle size={18} />} color="var(--amber)" />
          </div>

          {/* Tabs */}
          <div className="tabs" style={{ flexWrap: 'wrap' }}>
            <TabBtn active={tab === 'setup'}        onClick={() => setTab('setup')}
              icon={<Settings size={14} />}>Configuración</TabBtn>
            <TabBtn active={tab === 'ronda'}        onClick={() => setTab('ronda')}
              disabled={!rondas.length || !allItems.length || !participantes.length}
              icon={<Target size={14} />}>
              Ronda Activa {rondaActiva ? `#${rondaActiva.numero_ronda}` : ''}
            </TabBtn>
            <TabBtn active={tab === 'estadisticas'} onClick={() => setTab('estadisticas')}
              disabled={!stats.items.length}
              icon={<BarChart2 size={14} />}>
              Estadísticas {stats.progreso ? `(${stats.progreso.pct_completado}%)` : ''}
            </TabBtn>
            <TabBtn active={tab === 'consenso'}     onClick={() => setTab('consenso')}
              disabled={!stats.items.length}
              icon={<Handshake size={14} />}>Consenso Final</TabBtn>
            <TabBtn active={tab === 'resultados'}   onClick={() => setTab('resultados')}
              disabled={!consenso.length}
              icon={<Flag size={14} />}>Resultados</TabBtn>
          </div>

          {/* ══ CONFIGURACIÓN ══════════════════════════════ */}
          {tab === 'setup' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 15 }}>Secciones e Ítems</h3>
                <button className="btn btn-primary btn-sm" onClick={() => setSeccionModal(true)}>
                  <Plus size={14} /> Sección
                </button>
              </div>

              {secciones.length === 0
                ? <EmptyState icon={<Layers size={36} />} text="Sin secciones. Crea la primera para organizar los ítems." />
                : secciones.map(sec => (
                  <SeccionCard
                    key={sec.id}
                    seccion={sec}
                    sesionId={sesionId}
                    onDelSeccion={() => handleDelSeccion(sec.id)}
                    onAddItem={() => setItemModal({ open: true, secId: sec.id })}
                    onBulk={() => setBulkModal({ open: true, secId: sec.id })}
                    onDelItem={async iid => { await eliminarItem(sesionId, iid); loadAll(sesionId); }}
                  />
                ))
              }

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '28px 0 14px' }}>
                <h3 style={{ fontSize: 15 }}>Expertos Participantes</h3>
                <button className="btn btn-primary btn-sm" onClick={() => setPartModal(true)}>
                  <Plus size={14} /> Agregar Expertos
                </button>
              </div>

              {participantes.length === 0
                ? <EmptyState icon={<Users size={36} />} text="Sin expertos. Selecciona expertos del sistema." />
                : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 10 }}>
                    {participantes.map(p => (
                      <div key={p.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                        background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                      }}>
                        <Avatar nombre={p.nombre} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{p.nombre}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.email}</div>
                        </div>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelPart(p.usuario_id)}>
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              }

              <div className="card" style={{ marginTop: 28 }}>
                <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
                  {allItems.length > 0 && participantes.length > 0
                    ? `${allItems.length} ítems en ${secciones.length} sección(es) · ${participantes.length} expertos. ¡Listo para estimar!`
                    : 'Necesitas al menos 1 sección con ítems y 1 experto para comenzar.'}
                </p>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: 14 }}
                  disabled={!allItems.length || !participantes.length || saving}
                  onClick={handleCrearRonda}
                >
                  {saving
                    ? <><Spinner /> Creando…</>
                    : rondas.length === 0 ? 'Iniciar Ronda 1' : `Crear Ronda ${rondas.length + 1}`}
                </button>
              </div>
            </div>
          )}

          {/* ══ RONDA ACTIVA ════════════════════════════════
              El moderador SOLO VE las estimaciones recibidas.
              Los expertos las ingresan desde su propia vista.
          ════════════════════════════════════════════════ */}
          {tab === 'ronda' && rondaActiva && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ background: 'var(--accent)', borderRadius: 8, padding: '6px 16px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                    Ronda {rondaActiva.numero_ronda}
                  </div>
                  <span className={`badge ${rondaActiva.estado === 'abierta' ? 'badge-green' : 'badge-gray'}`}>
                    {rondaActiva.estado}
                  </span>
                  {stats.progreso && (
                    <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                      {stats.progreso.pct_completado}% · {stats.progreso.participantes_que_estimaron}/{stats.progreso.total_participantes} expertos
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    className="form-control"
                    style={{ maxWidth: 200 }}
                    value={rondaActiva.id}
                    onChange={e => {
                      const r = rondas.find(x => x.id === parseInt(e.target.value));
                      if (r) { setRondaActiva(r); loadRonda(r.id); }
                    }}
                  >
                    {rondas.map(r => <option key={r.id} value={r.id}>Ronda {r.numero_ronda} ({r.estado})</option>)}
                  </select>
                  {rondaActiva.estado === 'abierta' && (
                    <button className="btn btn-danger btn-sm" onClick={handleCerrarRonda}>Cerrar Ronda</button>
                  )}
                </div>
              </div>

              {/* Barra de progreso */}
              {stats.progreso && (
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, marginBottom: 20, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${stats.progreso.pct_completado || 0}%`, background: 'var(--green)', borderRadius: 3, transition: 'width .5s' }} />
                </div>
              )}

              {/* Aviso informativo: el moderador solo observa */}
              <div className="alert alert-info" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Activity size={16} />
                <span>
                  Los expertos ingresan sus estimaciones desde su propio panel. Aquí puedes monitorear las respuestas en tiempo real.
                </span>
              </div>

              {/* Estimaciones recibidas — solo lectura */}
              {estimaciones.length === 0 ? (
                <EmptyState icon={<Activity size={36} />} text="Aún no hay estimaciones recibidas. Esperando a los expertos…" />
              ) : (
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                    Estimaciones recibidas ({estimaciones.length})
                  </h4>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Experto</th>
                          <th>Sección</th>
                          <th>Ítem</th>
                          <th>Estimación</th>
                          <th>Comentario</th>
                        </tr>
                      </thead>
                      <tbody>
                        {estimaciones.map(e => (
                          <tr key={e.id}>
                            <td style={{ fontWeight: 600 }}>{e.experto_nombre}</td>
                            <td style={{ color: 'var(--text3)', fontSize: 12 }}>{e.seccion_nombre || '—'}</td>
                            <td style={{ color: 'var(--text2)' }}>{e.item_nombre}</td>
                            <td className="td-mono" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                              {e.estimacion} {e.unidad_codigo}
                            </td>
                            <td style={{ color: 'var(--text3)', fontSize: 12 }}>{e.comentario || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ ESTADÍSTICAS ════════════════════════════════ */}
          {tab === 'estadisticas' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 15 }}>Análisis de Dispersión por Ítem</h3>
                  <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                    CV &lt; 20% = Consenso · 20–35% = Requiere discusión · &gt;35% = Alta divergencia
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} />
                  <span style={{ fontSize: 12, color: 'var(--green)' }}>Tiempo real</span>
                </div>
              </div>

              {Object.entries(stats.por_seccion).map(([secNombre, items]) => (
                <div key={secNombre} style={{ marginBottom: 28 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 12 }}>{secNombre}</h4>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr><th>Ítem</th><th>Unidad</th><th>Expertos</th><th>Mín</th><th>Máx</th><th>Promedio</th><th>σ</th><th>CV%</th><th>Estado</th></tr>
                      </thead>
                      <tbody>
                        {items.map(s => (
                          <tr key={s.item_id}>
                            <td><strong>{s.item}</strong></td>
                            <td><span className="badge badge-gray">{s.unidad_codigo || '—'}</span></td>
                            <td className="td-mono td-center">{s.total_expertos}</td>
                            <td className="td-mono" style={{ color: 'var(--green)' }}>{s.minimo}</td>
                            <td className="td-mono" style={{ color: 'var(--red)' }}>{s.maximo}</td>
                            <td className="td-mono" style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 15 }}>{s.promedio}</td>
                            <td className="td-mono" style={{ color: 'var(--text2)' }}>{s.desv_estandar}</td>
                            <td>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: cvColor(parseFloat(s.coef_variacion_pct)) }}>
                                {s.coef_variacion_pct}%
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${cvBadge(parseFloat(s.coef_variacion_pct))}`}>
                                {cvLabel(parseFloat(s.coef_variacion_pct))}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {stats.items.length > 0 && (
                <div className="chart-container">
                  <div className="chart-title">Promedio por Ítem — Ronda {rondaActiva?.numero_ronda}</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={stats.items.map(s => ({ name: s.item.slice(0, 16), promedio: parseFloat(s.promedio), cv: parseFloat(s.coef_variacion_pct) }))}
                      barSize={36}
                    >
                      <XAxis dataKey="name" tick={{ fill: 'var(--text2)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 }} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
                      <Bar dataKey="promedio" radius={[6, 6, 0, 0]}>
                        {stats.items.map((s, i) => (
                          <Cell key={i} fill={s.consenso ? 'var(--green)' : parseFloat(s.coef_variacion_pct) < 35 ? 'var(--amber)' : 'var(--red)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ══ CONSENSO FINAL ══════════════════════════════ */}
          {tab === 'consenso' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3>Estimación Final de Consenso</h3>
                  <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>Define el valor acordado por el equipo.</p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={preFillConsenso}>
                  Cargar promedios
                </button>
              </div>

              {secciones.map(sec => (
                <div key={sec.id} style={{ marginBottom: 28 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 12 }}>{sec.nombre}</h4>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr><th>#</th><th>Ítem</th><th>Unidad</th><th>Promedio</th><th>CV%</th><th>Valor Final</th></tr>
                      </thead>
                      <tbody>
                        {(sec._items || []).map((it, i) => {
                          const stat = stats.items.find(s => s.item_id === it.id);
                          return (
                            <tr key={it.id}>
                              <td className="td-mono" style={{ color: 'var(--text3)' }}>{i + 1}</td>
                              <td><strong>{it.nombre}</strong></td>
                              <td><span className="badge badge-gray">{it.unidad_codigo || '—'}</span></td>
                              <td className="td-mono" style={{ color: 'var(--accent)' }}>{stat?.promedio ?? '—'}</td>
                              <td>
                                {stat
                                  ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: cvColor(parseFloat(stat.coef_variacion_pct)) }}>
                                    {stat.coef_variacion_pct}%
                                  </span>
                                  : '—'}
                              </td>
                              <td>
                                <input
                                  className="form-control"
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  style={{ width: 140 }}
                                  value={consensoForm[it.id] || ''}
                                  onChange={e => setConsensoForm(p => ({ ...p, [it.id]: e.target.value }))}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              <div style={{ background: 'rgba(79,142,247,.08)', border: '1px solid rgba(79,142,247,.3)', borderRadius: 'var(--radius)', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontWeight: 600, color: 'var(--text2)' }}>TOTAL CONSENSUADO</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>
                  {Object.values(consensoForm).reduce((s, v) => s + parseFloat(v || 0), 0).toFixed(2)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-success"
                  style={{ padding: '12px 32px' }}
                  disabled={saving || !Object.values(consensoForm).some(v => parseFloat(v) > 0)}
                  onClick={handleGuardarConsenso}
                >
                  {saving ? <><Spinner /> Guardando…</> : <><Flag size={16} /> Guardar Consenso Final</>}
                </button>
              </div>
            </div>
          )}

          {/* ══ RESULTADOS ══════════════════════════════════ */}
          {tab === 'resultados' && resumen && (
            <div>
              <div className="stats-grid" style={{ marginBottom: 20 }}>
                <StatCard label="Total Estimado"  value={resumen.gran_total}         sub="suma consensuada"     icon={<BarChart2 size={18} />} color="var(--accent)" />
                <StatCard label="Rondas"           value={resumen.total_rondas}        icon={<Target size={18} />}      color="var(--green)" />
                <StatCard label="Expertos"         value={resumen.total_participantes} icon={<Users size={18} />}       color="var(--accent2)" />
                <StatCard label="Consensos"        value={`${conConsensoLogrado}/${resumen.consenso.length}`} icon={<CheckCircle size={18} />} color="var(--amber)" />
              </div>

              {resumen.secciones.map(sec => {
                const itemsCon = resumen.consenso.filter(c => {
                  const it = allItems.find(i => i.id === c.item_id);
                  return it?.seccion_id === sec.id;
                });
                const subtotal = itemsCon.reduce((s, c) => s + parseFloat(c.estimacion_final), 0);
                return (
                  <div key={sec.id} className="card" style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <h3 style={{ fontSize: 15 }}>{sec.nombre}</h3>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 700 }}>
                        Subtotal: {subtotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="table-wrapper">
                      <table>
                        <thead><tr><th>#</th><th>Ítem</th><th>Unidad</th><th>Estimación Final</th><th>Rondas</th><th>Estado</th></tr></thead>
                        <tbody>
                          {itemsCon.map((c, i) => (
                            <tr key={c.id}>
                              <td className="td-mono" style={{ color: 'var(--text3)' }}>{i + 1}</td>
                              <td><strong>{c.item}</strong></td>
                              <td><span className="badge badge-gray">{c.unidad_codigo || '—'}</span></td>
                              <td className="td-mono" style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 15 }}>{c.estimacion_final}</td>
                              <td className="td-mono td-center">{c.rondas_necesarias}</td>
                              <td>
                                <span className={`badge ${c.consenso_logrado ? 'badge-green' : 'badge-amber'}`}>
                                  {c.consenso_logrado ? 'Consenso' : 'Forzado'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              <div style={{ background: 'rgba(79,142,247,.1)', border: '1px solid rgba(79,142,247,.4)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text2)' }}>GRAN TOTAL DEL PROYECTO</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 800, color: 'var(--accent)' }}>
                  {resumen.gran_total}
                </span>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: 14 }}>Exportar Resultados</h3>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {formatos.map(f => (
                    <button key={f.id} className="btn btn-secondary" onClick={() => handleExportar(f.codigo)}>
                      <Download size={14} /> {f.nombre}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ MODALES ═════════════════════════════════════════ */}

      {seccionModal && (
        <Modal title="Nueva Sección" onClose={() => setSeccionModal(false)}>
          <form onSubmit={handleCrearSeccion}>
            <div className="form-group">
              <label>Nombre *</label>
              <input className="form-control" placeholder="Ej: Módulo de Backend"
                value={seccionForm.nombre} onChange={e => setSeccionForm(p => ({ ...p, nombre: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Descripción</label>
              <textarea className="form-control" value={seccionForm.descripcion}
                onChange={e => setSeccionForm(p => ({ ...p, descripcion: e.target.value }))} />
            </div>
            <ModalFooter onCancel={() => setSeccionModal(false)} saving={saving} label="Crear Sección" />
          </form>
        </Modal>
      )}

      {itemModal.open && (
        <Modal title="Agregar Ítem" onClose={() => setItemModal({ open: false, secId: null })}>
          <form onSubmit={handleAddItem}>
            <div className="form-group">
              <label>Nombre *</label>
              <input className="form-control" placeholder="Ej: Autenticación JWT"
                value={itemForm.nombre} onChange={e => setItemForm(p => ({ ...p, nombre: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Complejidad</label>
              <select className="form-control" value={itemForm.complejidad}
                onChange={e => setItemForm(p => ({ ...p, complejidad: e.target.value }))}>
                <option value="">Sin especificar</option>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <ModalFooter onCancel={() => setItemModal({ open: false, secId: null })} saving={saving} label="Agregar Ítem" />
          </form>
        </Modal>
      )}

      {bulkModal.open && (
        <Modal title="Agregar Ítems en Lote" onClose={() => setBulkModal({ open: false, secId: null })}>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>Un ítem por línea.</p>
          <textarea className="form-control" rows={8}
            placeholder={"Login / Auth\nGestión de Usuarios\nReportes\nAPI REST"}
            value={bulkText} onChange={e => setBulkText(e.target.value)} />
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setBulkModal({ open: false, secId: null })}>Cancelar</button>
            <button className="btn btn-primary" disabled={saving || !bulkText.trim()} onClick={handleBulkAdd}>
              {saving ? <><Spinner /> Agregando…</> : `+ ${bulkText.split('\n').filter(l => l.trim()).length} ítems`}
            </button>
          </div>
        </Modal>
      )}

      {partModal && (
        <Modal title="Agregar Expertos" onClose={() => setPartModal(false)}>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
            Selecciona expertos registrados en el sistema.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
            {expertosDisp.filter(e => !participantes.find(p => p.usuario_id === e.id)).map(exp => (
              <label key={exp.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                background: selectedExp.includes(exp.id) ? 'rgba(79,142,247,.1)' : 'var(--bg3)',
                border: `1px solid ${selectedExp.includes(exp.id) ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)', cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={selectedExp.includes(exp.id)}
                  onChange={e => setSelectedExp(prev =>
                    e.target.checked ? [...prev, exp.id] : prev.filter(id => id !== exp.id)
                  )}
                />
                <Avatar nombre={exp.nombre} size={28} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{exp.nombre}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{exp.email}</div>
                </div>
              </label>
            ))}
          </div>
          <div className="modal-footer" style={{ marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={() => setPartModal(false)}>Cancelar</button>
            <button className="btn btn-primary" disabled={!selectedExp.length || saving} onClick={handleAddParts}>
              {saving ? <><Spinner /> Agregando…</> : `+ Agregar ${selectedExp.length} experto(s)`}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   SUB-COMPONENTES
════════════════════════════════════════════════════════ */

function SeccionCard({ seccion, onDelSeccion, onAddItem, onBulk, onDelItem }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div style={{ marginBottom: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'var(--bg3)', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 700 }}>§</span>
          <strong style={{ fontSize: 14 }}>{seccion.nombre}</strong>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{(seccion._items || []).length} ítems</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
          <button className="btn btn-secondary btn-sm" onClick={onBulk}>
            <Plus size={12} /> Bulk
          </button>
          <button className="btn btn-primary btn-sm" onClick={onAddItem}>
            <Plus size={12} /> Ítem
          </button>
          <button className="btn btn-danger btn-sm" onClick={onDelSeccion}>
            <Trash2 size={12} />
          </button>
          <span style={{ color: 'var(--text3)', marginLeft: 4 }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '16px 18px', background: 'var(--bg2)' }}>
          {(!seccion._items || seccion._items.length === 0)
            ? <p style={{ color: 'var(--text3)', fontSize: 13 }}>Sin ítems todavía.</p>
            : seccion._items.map((it, i) => (
              <div key={it.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6,
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)', minWidth: 22 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{it.nombre}</span>
                {it.complejidad && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: { baja: 'var(--green)', media: 'var(--amber)', alta: 'var(--red)' }[it.complejidad] }}>
                    {it.complejidad.toUpperCase()}
                  </span>
                )}
                <button className="btn btn-danger btn-sm" onClick={() => onDelItem(it.id)}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div className="stat-card" style={{ '--c1': color }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="stat-label">{label}</div>
        {icon && <span style={{ color, opacity: 0.7 }}>{icon}</span>}
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function TabBtn({ active, onClick, disabled, children, icon }) {
  return (
    <button className={`tab ${active ? 'active' : ''}`} onClick={onClick} disabled={disabled}
      style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {icon}{children}
    </button>
  );
}

function Avatar({ nombre, size = 32 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.38, color: '#fff',
    }}>
      {nombre?.[0]?.toUpperCase()}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ onCancel, saving, label }) {
  return (
    <div className="modal-footer">
      <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? <><Spinner /> Guardando…</> : `+ ${label}`}
      </button>
    </div>
  );
}

function Spinner({ full }) {
  if (full) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
      <span className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );
  return <span className="spinner" />;
}

function EmptyState({ icon, text }) {
  return (
    <div className="card">
      <div className="empty-state">
        <div style={{ color: 'var(--text3)', marginBottom: 12 }}>{icon}</div>
        <p>{text}</p>
      </div>
    </div>
  );
}