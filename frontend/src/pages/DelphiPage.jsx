/**
 * DelphiPage.jsx — EstimaSoft v2
 * Página completa de Wideband Delphi con GestionExpertos y SeccionUnidadesPanel integrados.
 * No requiere importar esos componentes por separado.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Settings, Target, BarChart2, Handshake, Flag, Plus, Trash2,
  ChevronDown, ChevronUp, X, CheckCircle, Download, ArrowLeft,
  Users, Layers, Activity, ClipboardList, UserCog, Edit2,
  ShieldCheck, Eye, EyeOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSesiones, cambiarEstado, eliminarItem, getCatalogos } from '../services/api';
import API from '../services/api';

/* ─────────────────────────────────────────────────────────
   HELPERS API DELPHI
───────────────────────────────────────────────────────── */
const delphi = {
  getExpertos:          ()           => API.get('/delphi/expertos'),
  getParticipantes:     sid          => API.get(`/delphi/sesion/${sid}/participantes`),
  addParticipante:      (sid, uid)   => API.post(`/delphi/sesion/${sid}/participantes`, { usuario_id: uid }),
  addParticipantesBulk: (sid, ids)   => API.post(`/delphi/sesion/${sid}/participantes/bulk`, { usuario_ids: ids }),
  delParticipante:      (sid, uid)   => API.delete(`/delphi/sesion/${sid}/participantes/${uid}`),
  getSecciones:         sid          => API.get(`/delphi/sesion/${sid}/secciones`),
  crearSeccion:         (sid, d)     => API.post(`/delphi/sesion/${sid}/secciones`, d),
  editarSeccion:        (id, d)      => API.put(`/delphi/secciones/${id}`, d),
  delSeccion:           id           => API.delete(`/delphi/secciones/${id}`),
  getItemsSeccion:      secId        => API.get(`/delphi/secciones/${secId}/items`),
  addItem:              (secId, d)   => API.post(`/delphi/secciones/${secId}/items`, d),
  addItemsBulk:         (secId, d)   => API.post(`/delphi/secciones/${secId}/items/bulk`, d),
  addUnidadSeccion:     (secId, d)   => API.post(`/delphi/secciones/${secId}/unidades`, d),
  delUnidadSeccion:     (secId, uid) => API.delete(`/delphi/secciones/${secId}/unidades/${uid}`),
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

const usuariosAPI = {
  getAll:    ()       => API.get('/usuarios'),
  getRoles:  ()       => API.get('/usuarios/roles'),
  create:    data     => API.post('/usuarios', data),
  update:    (id, d)  => API.put(`/usuarios/${id}`, d),
  delete:    id       => API.delete(`/usuarios/${id}`),
};

/* ─────────────────────────────────────────────────────────
   UTILS
───────────────────────────────────────────────────────── */
const cvColor = cv => cv < 20 ? 'var(--green)' : cv < 35 ? 'var(--amber)' : 'var(--red)';
const cvLabel = cv => cv < 20 ? 'Consenso' : cv < 35 ? 'Divergente' : 'Alta divergencia';
const cvBadge = cv => cv < 20 ? 'badge-green' : cv < 35 ? 'badge-amber' : 'badge-red';

const COMPLEJIDAD_BADGE = { alta: 'badge-red', media: 'badge-amber', baja: 'badge-green' };
const COMPLEJIDAD_OPTS  = ['', 'baja', 'media', 'alta'];

const ROL_BADGE = { admin: 'badge-red', moderador: 'badge-purple', experto: 'badge-blue' };

/* ═════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
═════════════════════════════════════════════════════════  */
export default function DelphiPage() {
  const { user } = useAuth();
  const isExperto = user?.rol === 'experto';
  return isExperto ? <ExpertoView user={user} /> : <ModeradorView user={user} />;
}

/* ═════════════════════════════════════════════════════════
   VISTA DEL EXPERTO
═════════════════════════════════════════════════════════  */
function ExpertoView({ user }) {
  const [misSesiones, setMisSesiones] = useState([]);
  const [sesionId,    setSesionId]    = useState(null);
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
    setSesionId(s.id);
    if (s.ronda_activa_id) {
      setRonda({ id: s.ronda_activa_id, numero_ronda: s.ronda_activa_num });
      const secsRes = await delphi.getSecciones(s.id);
      const todosItems = [];
      for (const sec of secsRes.data) {
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
                  <div className={`alert ${mensaje.startsWith('Estimaciones') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>
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
                              type="number" min="0" step="0.5"
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

/* ═════════════════════════════════════════════════════════
   VISTA DEL MODERADOR
═════════════════════════════════════════════════════════  */
function ModeradorView({ user }) {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const sesionParam    = searchParams.get('sesion');
  const proyectoParam  = searchParams.get('proyecto');

  /* ── Estado principal ── */
  const [sesiones,      setSesiones]      = useState([]);
  const [sesionId,      setSesionId]      = useState('');
  const [resumen,       setResumen]       = useState(null);
  const [secciones,     setSecciones]     = useState([]);
  const [participantes, setParticipantes] = useState([]);
  const [expertosDisp,  setExpertosDisp]  = useState([]);
  const [catalogoUnidades, setCatalogoUnidades] = useState([]);
  const [rondas,        setRondas]        = useState([]);
  const [rondaActiva,   setRondaActiva]   = useState(null);
  const [estimaciones,  setEstimaciones]  = useState([]);
  const [stats,         setStats]         = useState({ items: [], por_seccion: {}, progreso: null });
  const [consenso,      setConsenso]      = useState([]);
  const [formatos,      setFormatos]      = useState([]);
  const [tab,           setTab]           = useState('setup');
  const [loading,       setLoading]       = useState(false);
  const [saving,        setSaving]        = useState(false);

  /* ── Modales ── */
  const [gestionModal,  setGestionModal]  = useState(false);   // GestionExpertos
  const [partModal,     setPartModal]     = useState(false);
  const [selectedExp,   setSelectedExp]   = useState([]);
  const [bulkModal,     setBulkModal]     = useState({ open: false, secId: null });
  const [bulkText,      setBulkText]      = useState('');
  const [consensoForm,  setConsensoForm]  = useState({});

  const sseRef = useRef(null);

  /* ── Carga inicial ── */
  useEffect(() => {
    Promise.all([
      getSesiones(),
      delphi.getFormatos(),
      delphi.getExpertos(),
      getCatalogos(),
    ]).then(([sesRes, fmtRes, expRes, catRes]) => {
      const delphiSesiones = sesRes.data.filter(s => s.metodo === 'DELPHI');
      setSesiones(delphiSesiones);
      setFormatos(fmtRes.data);
      setExpertosDisp(expRes.data);
      // getCatalogos devuelve { metodos, unidades, roles }
      setCatalogoUnidades(catRes.data?.unidades || []);

      if (sesionParam) {
        const existe = delphiSesiones.find(s => String(s.id) === sesionParam);
        if (existe) handleSelectSesion(sesionParam);
      } else if (proyectoParam) {
        const delProyecto = delphiSesiones.find(s => String(s.proyecto_id) === proyectoParam);
        if (delProyecto) handleSelectSesion(String(delProyecto.id));
      }
    });
  }, []); // eslint-disable-line

  /* ── Cargar sesión completa ── */
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

  /* ── Ítems de secciones ── */
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

  /* ── SSE ── */
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

  /* ── Participantes ── */
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

  /* ── Bulk ítems ── */
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

  /* ── Rondas ── */
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

  /* ── Consenso ── */
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

  /* ── Exportar ── */
  const handleExportar = async (codigo) => {
    if (codigo === 'JSON') {
      const { data } = await delphi.exportar(sesionId, 'JSON');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `delphi_sesion_${sesionId}.json`; a.click();
    } else if (codigo === 'CSV') {
      const resp = await API.get(`/delphi/sesion/${sesionId}/exportar?formato=CSV`, { responseType: 'blob' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(resp.data);
      a.download = `delphi_sesion_${sesionId}.csv`; a.click();
    }
  };

  const conConsensoLogrado = consenso.filter(c => c.consenso_logrado).length;

  /* ── Pantalla selección sesión ── */
  if (!sesionId) return (
    <div className="page-enter">
      <div className="page-header">
        <div><h2>Wideband Delphi</h2><p>Estimación grupal iterativa con expertos</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setGestionModal(true)}>
            <UserCog size={14} /> Gestión de Expertos
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/proyectos')}>
            <ArrowLeft size={14} /> Proyectos
          </button>
        </div>
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

      {gestionModal && (
        <GestionExpertosModal
          onClose={() => { setGestionModal(false); delphi.getExpertos().then(r => setExpertosDisp(r.data)); }}
          currentUser={user}
        />
      )}
    </div>
  );

  /* ── Sesión seleccionada ── */
  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2>{resumen?.sesion?.nombre || 'Delphi'}</h2>
          <p>{resumen?.sesion?.proyecto}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setGestionModal(true)}>
            <UserCog size={14} /> Expertos
          </button>
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
            <StatCard label="Secciones"  value={secciones.length}    icon={<Layers size={18} />}        color="var(--accent)" />
            <StatCard label="Ítems"       value={allItems.length}      icon={<ClipboardList size={18} />} color="var(--accent2)" />
            <StatCard label="Expertos"    value={participantes.length} sub={`${rondas.length} rondas`}   icon={<Users size={18} />} color="var(--green)" />
            <StatCard label="Consensos"   value={`${conConsensoLogrado}/${allItems.length}`}
              sub={`${rondas.filter(r => r.estado === 'cerrada').length} rondas cerradas`}
              icon={<CheckCircle size={18} />} color="var(--amber)" />
          </div>

          {/* Tabs */}
          <div className="tabs" style={{ flexWrap: 'wrap' }}>
            <TabBtn active={tab === 'setup'}        onClick={() => setTab('setup')}        icon={<Settings size={14} />}>Configuración</TabBtn>
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
              {/* SeccionUnidadesPanel integrado */}
              <SeccionUnidadesPanel
                sesionId={sesionId}
                unidades={catalogoUnidades}
                onItemsChange={() => loadAll(sesionId)}
                onBulkOpen={(secId) => setBulkModal({ open: true, secId })}
              />

              {/* Expertos Participantes */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '28px 0 14px' }}>
                <h3 style={{ fontSize: 15 }}>Expertos Participantes</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setGestionModal(true)}>
                    <UserCog size={13} /> Gestionar Expertos
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => setPartModal(true)}>
                    <Plus size={14} /> Agregar a Sesión
                  </button>
                </div>
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

          {/* ══ RONDA ACTIVA ══ */}
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

              {stats.progreso && (
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, marginBottom: 20, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${stats.progreso.pct_completado || 0}%`, background: 'var(--green)', borderRadius: 3, transition: 'width .5s' }} />
                </div>
              )}

              <div className="alert alert-info" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Activity size={16} />
                <span>Los expertos ingresan sus estimaciones desde su propio panel. Aquí puedes monitorear en tiempo real.</span>
              </div>

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
                        <tr><th>Experto</th><th>Sección</th><th>Ítem</th><th>Estimación</th><th>Comentario</th></tr>
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

          {/* ══ ESTADÍSTICAS ══ */}
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

          {/* ══ CONSENSO FINAL ══ */}
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
                                  type="number" min="0" step="0.5"
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

          {/* ══ RESULTADOS ══ */}
          {tab === 'resultados' && resumen && (
            <div>
              <div className="stats-grid" style={{ marginBottom: 20 }}>
                <StatCard label="Total Estimado"  value={resumen.gran_total}         sub="suma consensuada"      icon={<BarChart2 size={18} />}   color="var(--accent)" />
                <StatCard label="Rondas"           value={resumen.total_rondas}        icon={<Target size={18} />}         color="var(--green)" />
                <StatCard label="Expertos"         value={resumen.total_participantes} icon={<Users size={18} />}          color="var(--accent2)" />
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

      {/* ═══ MODALES ═══ */}

      {/* Bulk ítems */}
      {bulkModal.open && (
        <Modal title="Agregar Ítems en Lote" onClose={() => setBulkModal({ open: false, secId: null })}>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>Un ítem por línea.</p>
          <textarea
            className="form-control" rows={8}
            placeholder={"Login / Auth\nGestión de Usuarios\nReportes\nAPI REST"}
            value={bulkText} onChange={e => setBulkText(e.target.value)}
          />
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setBulkModal({ open: false, secId: null })}>Cancelar</button>
            <button className="btn btn-primary" disabled={saving || !bulkText.trim()} onClick={handleBulkAdd}>
              {saving ? <><Spinner /> Agregando…</> : `+ ${bulkText.split('\n').filter(l => l.trim()).length} ítems`}
            </button>
          </div>
        </Modal>
      )}

      {/* Participantes de sesión */}
      {partModal && (
        <Modal title="Agregar Expertos a la Sesión" onClose={() => setPartModal(false)}>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
            Selecciona expertos del sistema para esta sesión.
          </p>
          {expertosDisp.filter(e => !participantes.find(p => p.usuario_id === e.id)).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text3)', fontSize: 13 }}>
              Todos los expertos ya están agregados a esta sesión.
              <br />
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => { setPartModal(false); setGestionModal(true); }}>
                <UserCog size={13} /> Crear nuevo experto
              </button>
            </div>
          ) : (
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
          )}
          <div className="modal-footer" style={{ marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={() => setPartModal(false)}>Cancelar</button>
            <button className="btn btn-primary" disabled={!selectedExp.length || saving} onClick={handleAddParts}>
              {saving ? <><Spinner /> Agregando…</> : `+ Agregar ${selectedExp.length} experto(s)`}
            </button>
          </div>
        </Modal>
      )}

      {/* Gestión Expertos */}
      {gestionModal && (
        <GestionExpertosModal
          onClose={() => {
            setGestionModal(false);
            delphi.getExpertos().then(r => setExpertosDisp(r.data));
          }}
          currentUser={user}
        />
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════
   SECCION UNIDADES PANEL — integrado
═════════════════════════════════════════════════════════  */
function SeccionUnidadesPanel({ sesionId, unidades = [], onItemsChange, onBulkOpen, readOnly = false }) {
  const [secciones,    setSecciones]    = useState([]);
  const [itemsBySec,   setItemsBySec]   = useState({});
  const [expandedSec,  setExpandedSec]  = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');

  const [showSecForm,  setShowSecForm]  = useState(false);
  const [editSec,      setEditSec]      = useState(null);
  const [secForm,      setSecForm]      = useState({ nombre: '', descripcion: '' });
  const [savingSec,    setSavingSec]    = useState(false);

  const [addingUnit,   setAddingUnit]   = useState(null);
  const [unitSel,      setUnitSel]      = useState('');
  const [unitPrinc,    setUnitPrinc]    = useState(false);
  const [savingUnit,   setSavingUnit]   = useState(false);

  const [showItemForm, setShowItemForm] = useState(null);
  const [itemForm,     setItemForm]     = useState({ nombre: '', descripcion: '', complejidad: '', unidad_id: '' });
  const [savingItem,   setSavingItem]   = useState(false);

  const cargarSecciones = useCallback(async () => {
    if (!sesionId) return;
    setLoading(true);
    try {
      const res = await delphi.getSecciones(sesionId);
      setSecciones(res.data);
    } catch { setError('Error cargando secciones'); }
    setLoading(false);
  }, [sesionId]);

  useEffect(() => { cargarSecciones(); }, [cargarSecciones]);

  const cargarItems = async (secId) => {
    try {
      const res = await delphi.getItemsSeccion(secId);
      setItemsBySec(prev => ({ ...prev, [secId]: res.data }));
    } catch { /* silencioso */ }
  };

  const toggleExpand = async (secId) => {
    if (expandedSec === secId) { setExpandedSec(null); return; }
    setExpandedSec(secId);
    setShowItemForm(null);
    setAddingUnit(null);
    if (!itemsBySec[secId]) await cargarItems(secId);
  };

  /* ── CRUD Sección ── */
  const abrirNuevaSeccion = () => {
    setEditSec(null);
    setSecForm({ nombre: '', descripcion: '' });
    setError('');
    setShowSecForm(true);
  };

  const abrirEditarSeccion = (sec, e) => {
    e.stopPropagation();
    setEditSec(sec);
    setSecForm({ nombre: sec.nombre, descripcion: sec.descripcion || '' });
    setError('');
    setShowSecForm(true);
  };

  const guardarSeccion = async () => {
    if (!secForm.nombre.trim()) return setError('El nombre de la sección es requerido');
    setSavingSec(true);
    try {
      if (editSec) {
        await delphi.editarSeccion(editSec.id, { ...secForm, orden: editSec.orden });
      } else {
        await delphi.crearSeccion(sesionId, { ...secForm, orden: secciones.length });
      }
      await cargarSecciones();
      setShowSecForm(false); setEditSec(null);
    } catch (e) { setError(e.response?.data?.error || 'Error al guardar sección'); }
    setSavingSec(false);
  };

  const eliminarSeccion = async (sec, e) => {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar la sección "${sec.nombre}" y todos sus ítems?`)) return;
    try {
      await delphi.delSeccion(sec.id);
      if (expandedSec === sec.id) setExpandedSec(null);
      await cargarSecciones();
      setItemsBySec(prev => { const n = { ...prev }; delete n[sec.id]; return n; });
      onItemsChange?.();
    } catch (e) { setError(e.response?.data?.error || 'Error al eliminar sección'); }
  };

  /* ── Unidades ── */
  const unidadesDisponibles = (sec) => {
    const asignadas = new Set((sec.unidades || []).map(u => u.id));
    return unidades.filter(u => !asignadas.has(u.id));
  };

  const agregarUnidad = async (secId) => {
    if (!unitSel) return;
    setSavingUnit(true);
    try {
      await delphi.addUnidadSeccion(secId, { unidad_id: +unitSel, es_principal: unitPrinc });
      await cargarSecciones();
      setAddingUnit(null); setUnitSel(''); setUnitPrinc(false);
    } catch (e) { setError(e.response?.data?.error || 'Error al agregar unidad'); }
    setSavingUnit(false);
  };

  const quitarUnidad = async (secId, unidadId, e) => {
    e.stopPropagation();
    try {
      await delphi.delUnidadSeccion(secId, unidadId);
      await cargarSecciones();
    } catch (e) { setError(e.response?.data?.error || 'Error al quitar unidad'); }
  };

  /* ── CRUD Ítem ── */
  const abrirNuevoItem = (sec, e) => {
    e.stopPropagation();
    const principal = (sec.unidades || []).find(u => u.es_principal);
    setItemForm({ nombre: '', descripcion: '', complejidad: '', unidad_id: principal?.id || '' });
    setError('');
    setShowItemForm(sec.id);
  };

  const guardarItem = async (sec) => {
    if (!itemForm.nombre.trim()) return setError('El nombre del ítem es requerido');
    setSavingItem(true);
    try {
      await delphi.addItem(sec.id, { ...itemForm, unidad_id: itemForm.unidad_id ? +itemForm.unidad_id : null, sesion_id: sesionId });
      await cargarItems(sec.id);
      setShowItemForm(null);
      setItemForm({ nombre: '', descripcion: '', complejidad: '', unidad_id: '' });
      onItemsChange?.();
    } catch (e) { setError(e.response?.data?.error || 'Error al crear ítem'); }
    setSavingItem(false);
  };

  const eliminarItemSec = async (sec, itemId) => {
    if (!window.confirm('¿Eliminar este ítem?')) return;
    try {
      await eliminarItem(sesionId, itemId);
      await cargarItems(sec.id);
      onItemsChange?.();
    } catch (e) { setError(e.response?.data?.error || 'Error al eliminar ítem'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Secciones e Ítems</h3>
          <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>
            Organiza los ítems y asigna unidades de medida por sección
          </p>
        </div>
        {!readOnly && !showSecForm && (
          <button className="btn btn-primary btn-sm" onClick={abrirNuevaSeccion}>
            <Plus size={13} /> Nueva Sección
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          {error}
          <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Formulario nueva / editar sección */}
      {showSecForm && (
        <div className="card" style={{ marginBottom: 16, background: 'var(--bg3)', border: '1px solid var(--accent)' }}>
          <h5 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--accent)' }}>
            {editSec ? `Editar: ${editSec.nombre}` : 'Nueva Sección'}
          </h5>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Nombre *</label>
              <input
                className="form-control"
                placeholder="ej. Backend, Frontend, Base de Datos"
                value={secForm.nombre}
                onChange={e => setSecForm(f => ({ ...f, nombre: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && guardarSeccion()}
                autoFocus
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Descripción</label>
              <input
                className="form-control"
                placeholder="Descripción opcional"
                value={secForm.descripcion}
                onChange={e => setSecForm(f => ({ ...f, descripcion: e.target.value }))}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={guardarSeccion} disabled={savingSec}>
              {savingSec ? <><Spinner /> Guardando…</> : (editSec ? 'Actualizar' : 'Crear Sección')}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowSecForm(false); setEditSec(null); }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <Spinner full />
      ) : secciones.length === 0 ? (
        <EmptyState icon={<Layers size={36} />} text="No hay secciones. Crea una para organizar los ítems de estimación." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {secciones.map(sec => {
            const isOpen = expandedSec === sec.id;
            const items  = itemsBySec[sec.id] || [];

            return (
              <div key={sec.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                {/* Cabecera */}
                <div
                  style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: isOpen ? 'rgba(79,142,247,.06)' : 'var(--bg3)', borderBottom: isOpen ? '1px solid var(--border)' : 'none' }}
                  onClick={() => toggleExpand(sec.id)}
                >
                  <span style={{ fontSize: 13, color: 'var(--text3)', minWidth: 14 }}>{isOpen ? '▼' : '▶'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{sec.nombre}</div>
                    {sec.descripcion && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{sec.descripcion}</div>}
                  </div>

                  {/* Badges unidades */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 220 }}>
                    {(sec.unidades || []).map(u => (
                      <span key={u.id} className={`badge ${u.es_principal ? 'badge-blue' : 'badge-gray'}`} style={{ fontSize: 10 }} title={u.nombre}>
                        {u.es_principal ? '★ ' : ''}{u.codigo}
                      </span>
                    ))}
                    {(sec.unidades || []).length === 0 && (
                      <span style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic' }}>Sin unidades</span>
                    )}
                  </div>

                  <span className="badge badge-gray" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>
                    {sec.total_items || 0} ítem{sec.total_items !== 1 ? 's' : ''}
                  </span>

                  {!readOnly && (
                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                      <button className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }} onClick={e => abrirEditarSeccion(sec, e)} title="Editar">
                        <Edit2 size={12} />
                      </button>
                      <button className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }} onClick={e => { e.stopPropagation(); onBulkOpen?.(sec.id); }} title="Agregar en lote">
                        <Plus size={12} /> Bulk
                      </button>
                      <button className="btn btn-danger btn-sm" style={{ padding: '4px 8px' }} onClick={e => eliminarSeccion(sec, e)} title="Eliminar">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Cuerpo expandido */}
                {isOpen && (
                  <div style={{ padding: '18px 20px', background: 'var(--bg2)' }}>

                    {/* Panel unidades */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                          Unidades de Medida
                        </span>
                        {!readOnly && addingUnit !== sec.id && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11, padding: '3px 9px' }}
                            onClick={() => { setAddingUnit(sec.id); setUnitSel(''); setUnitPrinc((sec.unidades || []).length === 0); }}
                          >
                            <Plus size={11} /> Agregar unidad
                          </button>
                        )}
                        <small style={{ fontSize: 11, color: 'var(--text3)' }}>
                          Puedes asignar múltiples unidades (horas, puntos de función, etc.)
                        </small>
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: addingUnit === sec.id ? 10 : 0 }}>
                        {(sec.unidades || []).length === 0 ? (
                          <span style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', padding: '6px 0' }}>
                            Sin unidades asignadas. Las unidades definen cómo los expertos estimarán los ítems.
                          </span>
                        ) : (sec.unidades || []).map(u => (
                          <div key={u.id} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: u.es_principal ? 'rgba(79,142,247,.12)' : 'var(--bg3)',
                            border: `1px solid ${u.es_principal ? 'rgba(79,142,247,.35)' : 'var(--border)'}`,
                            borderRadius: 8, padding: '5px 10px', fontSize: 13,
                          }}>
                            {u.es_principal && <span title="Principal" style={{ fontSize: 12 }}>★</span>}
                            <span style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{u.codigo}</span>
                            <span style={{ color: 'var(--text2)', fontSize: 12 }}>{u.nombre}</span>
                            {u.es_principal && <span className="badge badge-blue" style={{ fontSize: 9, padding: '1px 5px' }}>principal</span>}
                            {!readOnly && (
                              <button onClick={e => quitarUnidad(sec.id, u.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14, padding: '0 2px' }} title="Quitar">✕</button>
                            )}
                          </div>
                        ))}
                      </div>

                      {!readOnly && addingUnit === sec.id && (
                        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          <select
                            className="form-control"
                            style={{ flex: 1, minWidth: 200, fontSize: 13 }}
                            value={unitSel}
                            onChange={e => setUnitSel(e.target.value)}
                          >
                            <option value="">— Seleccionar unidad —</option>
                            {unidadesDisponibles(sec).map(u => (
                              <option key={u.id} value={u.id}>{u.codigo} — {u.nombre}</option>
                            ))}
                          </select>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <input type="checkbox" checked={unitPrinc} onChange={e => setUnitPrinc(e.target.checked)} />
                            Marcar como principal
                          </label>
                          <button className="btn btn-primary btn-sm" onClick={() => agregarUnidad(sec.id)} disabled={!unitSel || savingUnit}>
                            {savingUnit ? <Spinner /> : 'Agregar'}
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setAddingUnit(null)}>Cancelar</button>
                          {unidadesDisponibles(sec).length === 0 && (
                            <span style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>No hay más unidades en el catálogo.</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Panel ítems */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                          Ítems de Trabajo
                        </span>
                        {!readOnly && showItemForm !== sec.id && (
                          <button className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '3px 9px' }} onClick={e => abrirNuevoItem(sec, e)}>
                            <Plus size={11} /> Agregar ítem
                          </button>
                        )}
                        <small style={{ fontSize: 11, color: 'var(--text3)' }}>Cada ítem puede tener su propia unidad de medida</small>
                      </div>

                      {/* Formulario nuevo ítem */}
                      {!readOnly && showItemForm === sec.id && (
                        <div className="card" style={{ marginBottom: 10, background: 'var(--bg)', border: '1px solid var(--accent)' }}>
                          <h6 style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: 'var(--accent)' }}>Nuevo Ítem en "{sec.nombre}"</h6>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Nombre *</label>
                              <input
                                className="form-control"
                                placeholder="ej. Módulo de login"
                                value={itemForm.nombre}
                                onChange={e => setItemForm(f => ({ ...f, nombre: e.target.value }))}
                                autoFocus
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Unidad de Medida</label>
                              <select
                                className="form-control"
                                value={itemForm.unidad_id}
                                onChange={e => setItemForm(f => ({ ...f, unidad_id: e.target.value }))}
                              >
                                <option value="">Sin unidad específica</option>
                                {(sec.unidades || []).length > 0 && (
                                  <optgroup label={`Unidades de "${sec.nombre}"`}>
                                    {(sec.unidades || []).map(u => (
                                      <option key={u.id} value={u.id}>{u.es_principal ? '★ ' : ''}{u.codigo} — {u.nombre}</option>
                                    ))}
                                  </optgroup>
                                )}
                                {unidades.filter(u => !(sec.unidades || []).find(su => su.id === u.id)).length > 0 && (
                                  <optgroup label="Otras unidades del catálogo">
                                    {unidades.filter(u => !(sec.unidades || []).find(su => su.id === u.id)).map(u => (
                                      <option key={u.id} value={u.id}>{u.codigo} — {u.nombre}</option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Complejidad</label>
                              <select className="form-control" value={itemForm.complejidad} onChange={e => setItemForm(f => ({ ...f, complejidad: e.target.value }))}>
                                {COMPLEJIDAD_OPTS.map(c => <option key={c} value={c}>{c || 'Sin especificar'}</option>)}
                              </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Descripción</label>
                              <input className="form-control" placeholder="Descripción opcional" value={itemForm.descripcion} onChange={e => setItemForm(f => ({ ...f, descripcion: e.target.value }))} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button className="btn btn-primary btn-sm" onClick={() => guardarItem(sec)} disabled={savingItem}>
                              {savingItem ? <><Spinner /> Guardando…</> : 'Crear Ítem'}
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowItemForm(null)}>Cancelar</button>
                          </div>
                        </div>
                      )}

                      {/* Lista de ítems */}
                      {!itemsBySec[sec.id] ? (
                        <div style={{ color: 'var(--text3)', fontSize: 12, fontStyle: 'italic', padding: '4px 0' }}>
                          <Spinner /> Cargando ítems...
                        </div>
                      ) : items.length === 0 ? (
                        <div style={{ color: 'var(--text3)', fontSize: 12, fontStyle: 'italic', padding: '10px 14px', background: 'var(--bg3)', borderRadius: 6, border: '1px dashed var(--border)', textAlign: 'center' }}>
                          Esta sección no tiene ítems. {!readOnly && 'Agrega el primero con el botón de arriba.'}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {items.map(item => (
                            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.nombre}</div>
                                {item.descripcion && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{item.descripcion}</div>}
                              </div>
                              {item.unidad_codigo && (
                                <span className="badge badge-blue" style={{ fontSize: 10, whiteSpace: 'nowrap' }} title={item.unidad_nombre}>
                                  {item.unidad_codigo}
                                </span>
                              )}
                              {item.complejidad && (
                                <span className={`badge ${COMPLEJIDAD_BADGE[item.complejidad] || 'badge-gray'}`} style={{ fontSize: 10, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                                  {item.complejidad}
                                </span>
                              )}
                              {!readOnly && (
                                <button className="btn btn-danger btn-sm" style={{ fontSize: 11, padding: '3px 8px', flexShrink: 0 }} onClick={() => eliminarItemSec(sec, item.id)}>
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════
   GESTION EXPERTOS MODAL — integrado
═════════════════════════════════════════════════════════  */
function GestionExpertosModal({ onClose, currentUser }) {
  const isAdmin = currentUser?.rol === 'admin';

  const [usuarios,  setUsuarios]  = useState([]);
  const [roles,     setRoles]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editando,  setEditando]  = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [showPass,  setShowPass]  = useState(false);

  const formInit = { nombre: '', email: '', password: '', rol_id: '', activo: true };
  const [form, setForm] = useState(formInit);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const [uRes, rRes] = await Promise.all([usuariosAPI.getAll(), usuariosAPI.getRoles()]);
      setUsuarios(uRes.data);
      const rolesDisp = isAdmin ? rRes.data : rRes.data.filter(r => r.nombre === 'experto');
      setRoles(rolesDisp);
    } catch { setError('Error cargando datos'); }
    setLoading(false);
  };

  const abrirNuevo = () => {
    setEditando(null);
    const rolPorDefecto = roles.find(r => r.nombre === 'experto')?.id || roles[0]?.id || '';
    setForm({ ...formInit, rol_id: rolPorDefecto });
    setError(''); setShowPass(false);
    setShowForm(true);
  };

  const abrirEditar = (u) => {
    setEditando(u);
    setForm({ nombre: u.nombre, email: u.email, password: '', rol_id: u.rol_id, activo: !!u.activo });
    setError(''); setShowPass(false);
    setShowForm(true);
  };

  const guardar = async () => {
    if (!form.nombre.trim() || !form.email.trim()) return setError('Nombre y email son requeridos');
    if (!editando && form.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres');
    if (!form.rol_id) return setError('Selecciona un rol');
    setSaving(true); setError('');
    try {
      if (editando) {
        const payload = { nombre: form.nombre, email: form.email, activo: form.activo };
        if (isAdmin) payload.rol_id = form.rol_id;
        if (form.password) payload.password = form.password;
        await usuariosAPI.update(editando.id, payload);
        setSuccess('Usuario actualizado correctamente');
      } else {
        await usuariosAPI.create({ nombre: form.nombre, email: form.email, password: form.password, rol_id: form.rol_id });
        setSuccess('Usuario creado correctamente');
      }
      await cargar();
      setShowForm(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) { setError(e.response?.data?.error || 'Error al guardar'); }
    setSaving(false);
  };

  const toggleActivo = async (u) => {
    try {
      await usuariosAPI.update(u.id, { activo: !u.activo });
      await cargar();
    } catch (e) { setError(e.response?.data?.error || 'Error'); }
  };

  const eliminar = async (u) => {
    if (!window.confirm(`¿Eliminar el usuario "${u.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await usuariosAPI.delete(u.id);
      await cargar();
      setSuccess('Usuario eliminado');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) { setError(e.response?.data?.error || 'Error al eliminar'); }
  };

  const usuariosFiltrados = filtroRol ? usuarios.filter(u => u.rol === filtroRol) : usuarios;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="modal modal-lg" style={{ maxWidth: 820 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
              {isAdmin ? <ShieldCheck size={20} /> : <Users size={20} />}
              {isAdmin ? 'Gestión de Usuarios' : 'Gestión de Expertos'}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
              {isAdmin ? 'Crea y administra todos los usuarios del sistema' : 'Crea y administra los expertos para las sesiones Delphi'}
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14} /> Cerrar</button>
        </div>

        {/* Alertas */}
        {error   && <div className="alert alert-error"   style={{ marginBottom: 12 }}>{error}   <button onClick={() => setError('')}   style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>✕</button></div>}
        {success && <div className="alert alert-success" style={{ marginBottom: 12 }}>{success} <button onClick={() => setSuccess('')} style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>✕</button></div>}

        {/* Formulario */}
        {showForm && (
          <div className="card" style={{ marginBottom: 20, background: 'var(--bg3)', border: '1px solid var(--accent)' }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--accent)' }}>
              {editando ? `Editando: ${editando.nombre}` : 'Nuevo Usuario'}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Nombre completo *</label>
                <input className="form-control" placeholder="ej. María García" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input className="form-control" type="email" placeholder="usuario@empresa.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>{editando ? 'Nueva Contraseña (vacío = sin cambio)' : 'Contraseña *'}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-control"
                    type={showPass ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    style={{ paddingRight: 36 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Rol *</label>
                <select className="form-control" value={form.rol_id} onChange={e => setForm(f => ({ ...f, rol_id: +e.target.value }))} disabled={!isAdmin && !!editando}>
                  <option value="">— Seleccionar rol —</option>
                  {roles.map(r => <option key={r.id} value={r.id} style={{ textTransform: 'capitalize' }}>{r.nombre}</option>)}
                </select>
                {!isAdmin && <small style={{ color: 'var(--text3)', fontSize: 11 }}>Los moderadores solo pueden asignar el rol experto.</small>}
              </div>
              {editando && (
                <div className="form-group">
                  <label>Estado</label>
                  <select className="form-control" value={form.activo ? '1' : '0'} onChange={e => setForm(f => ({ ...f, activo: e.target.value === '1' }))}>
                    <option value="1">✅ Activo</option>
                    <option value="0">🚫 Inactivo</option>
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn btn-primary btn-sm" onClick={guardar} disabled={saving}>
                {saving ? <><Spinner /> Guardando…</> : (editando ? 'Actualizar' : 'Crear Usuario')}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowForm(false); setEditando(null); }}>Cancelar</button>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          {isAdmin && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['', ...new Set(usuarios.map(u => u.rol))].map(r => (
                <button
                  key={r}
                  className={`btn btn-sm ${filtroRol === r ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFiltroRol(r)}
                  style={{ textTransform: 'capitalize' }}
                >
                  {r || 'Todos'} ({r ? usuarios.filter(u => u.rol === r).length : usuarios.length})
                </button>
              ))}
            </div>
          )}
          <div style={{ flex: 1 }} />
          {!showForm && (
            <button className="btn btn-primary btn-sm" onClick={abrirNuevo}>
              <Plus size={13} /> {isAdmin ? 'Nuevo Usuario' : 'Nuevo Experto'}
            </button>
          )}
        </div>

        {/* Tabla */}
        {loading ? (
          <Spinner full />
        ) : usuariosFiltrados.length === 0 ? (
          <EmptyState icon={<Users size={36} />} text="No hay usuarios en esta categoría" />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Registrado</th><th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map(u => (
                  <tr key={u.id}>
                    <td className="td-mono" style={{ color: 'var(--text3)', fontSize: 12 }}>{u.id}</td>
                    <td style={{ fontWeight: 600 }}>{u.nombre}</td>
                    <td className="td-mono" style={{ fontSize: 12 }}>{u.email}</td>
                    <td><span className={`badge ${ROL_BADGE[u.rol] || 'badge-gray'}`} style={{ textTransform: 'capitalize' }}>{u.rol}</span></td>
                    <td><span className={`badge ${u.activo ? 'badge-green' : 'badge-gray'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{new Date(u.creado_en).toLocaleDateString('es-DO')}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => abrirEditar(u)} title="Editar">
                          <Edit2 size={12} />
                        </button>
                        <button
                          className={`btn btn-sm ${u.activo ? 'btn-danger' : 'btn-success'}`}
                          onClick={() => toggleActivo(u)}
                          title={u.activo ? 'Desactivar' : 'Activar'}
                          style={{ fontSize: 11 }}
                        >
                          {u.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        {isAdmin && (
                          <button className="btn btn-danger btn-sm" onClick={() => eliminar(u)} title="Eliminar">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 14, textAlign: 'center' }}>
          {isAdmin ? 'Admin: puede crear cualquier rol y eliminar usuarios.' : 'Moderador: puede crear expertos y activar/desactivar usuarios.'}
        </p>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════
   SUB-COMPONENTES COMPARTIDOS
═════════════════════════════════════════════════════════  */

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
    <button
      className={`tab ${active ? 'active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
    >
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