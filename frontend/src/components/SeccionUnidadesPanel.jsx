/**
 * src/components/SeccionUnidadesPanel.jsx
 * Panel completo de secciones para sesiones Delphi.
 * Permite:
 *  - Crear / editar / eliminar secciones
 *  - Asignar múltiples unidades de medida por sección (ej: horas, líneas de código, puntos)
 *  - Marcar la unidad principal de cada sección
 *  - Agregar ítems a cada sección con unidad de medida propia (hereda o sobreescribe la sección)
 *
 * Props:
 *   sesionId   {number}   ID de la sesión activa
 *   unidades   {Array}    Catálogo global de unidades_medida  [{id, codigo, nombre}]
 *   onItemsChange {fn}    Callback cuando se crean/eliminan ítems (para refrescar el padre)
 *   readOnly   {boolean}  Si true, solo muestra datos sin editar
 */
import { useState, useEffect, useCallback } from 'react';
import API from '../services/api'; // ajusta si tu ruta es distinta

/* ── Helpers ──────────────────────────────────────────────────────────── */
const COMPLEJIDAD_BADGE = { alta: 'badge-red', media: 'badge-amber', baja: 'badge-green' };
const COMPLEJIDAD_OPTS  = ['', 'baja', 'media', 'alta'];

export default function SeccionUnidadesPanel({
  sesionId,
  unidades = [],
  onItemsChange,
  readOnly = false,
}) {
  const [secciones,    setSecciones]    = useState([]);
  const [itemsBySec,   setItemsBySec]   = useState({});   // secId → items[]
  const [expandedSec,  setExpandedSec]  = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');

  // ── Formulario Sección ──────────────────────────────────────────────
  const [showSecForm,  setShowSecForm]  = useState(false);
  const [editSec,      setEditSec]      = useState(null);
  const [secForm,      setSecForm]      = useState({ nombre: '', descripcion: '' });
  const [savingSec,    setSavingSec]    = useState(false);

  // ── Agregar unidad a sección ────────────────────────────────────────
  const [addingUnit,   setAddingUnit]   = useState(null);  // secId
  const [unitSel,      setUnitSel]      = useState('');
  const [unitPrinc,    setUnitPrinc]    = useState(false);
  const [savingUnit,   setSavingUnit]   = useState(false);

  // ── Formulario Ítem ─────────────────────────────────────────────────
  const [showItemForm, setShowItemForm] = useState(null);  // secId
  const [itemForm,     setItemForm]     = useState({ nombre: '', descripcion: '', complejidad: '', unidad_id: '' });
  const [savingItem,   setSavingItem]   = useState(false);

  /* ── Carga inicial ─────────────────────────────────────────────────── */
  const cargarSecciones = useCallback(async () => {
    if (!sesionId) return;
    setLoading(true);
    try {
      const res = await API.get(`/delphi/sesion/${sesionId}/secciones`);
      setSecciones(res.data);
    } catch (e) {
      setError('Error cargando secciones');
    }
    setLoading(false);
  }, [sesionId]);

  useEffect(() => { cargarSecciones(); }, [cargarSecciones]);

  const cargarItems = async (secId) => {
    try {
      const res = await API.get(`/delphi/secciones/${secId}/items`);
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

  /* ── CRUD Sección ──────────────────────────────────────────────────── */
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
        await API.put(`/delphi/secciones/${editSec.id}`, { ...secForm, orden: editSec.orden });
      } else {
        await API.post(`/delphi/sesion/${sesionId}/secciones`, {
          ...secForm,
          orden: secciones.length,
        });
      }
      await cargarSecciones();
      setShowSecForm(false);
      setEditSec(null);
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar sección');
    }
    setSavingSec(false);
  };

  const eliminarSeccion = async (sec, e) => {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar la sección "${sec.nombre}" y todos sus ítems?`)) return;
    try {
      await API.delete(`/delphi/secciones/${sec.id}`);
      if (expandedSec === sec.id) setExpandedSec(null);
      await cargarSecciones();
      setItemsBySec(prev => { const n = { ...prev }; delete n[sec.id]; return n; });
      onItemsChange?.();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al eliminar sección');
    }
  };

  /* ── Unidades de sección ───────────────────────────────────────────── */
  const unidadesDisponibles = (sec) => {
    const asignadas = new Set((sec.unidades || []).map(u => u.id));
    return unidades.filter(u => !asignadas.has(u.id));
  };

  const agregarUnidad = async (secId) => {
    if (!unitSel) return;
    setSavingUnit(true);
    try {
      await API.post(`/delphi/secciones/${secId}/unidades`, {
        unidad_id:    +unitSel,
        es_principal: unitPrinc,
      });
      await cargarSecciones();
      setAddingUnit(null);
      setUnitSel('');
      setUnitPrinc(false);
    } catch (e) {
      setError(e.response?.data?.error || 'Error al agregar unidad');
    }
    setSavingUnit(false);
  };

  const quitarUnidad = async (secId, unidadId, e) => {
    e.stopPropagation();
    try {
      await API.delete(`/delphi/secciones/${secId}/unidades/${unidadId}`);
      await cargarSecciones();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al quitar unidad');
    }
  };

  /* ── CRUD Ítem ─────────────────────────────────────────────────────── */
  const abrirNuevoItem = (sec, e) => {
    e.stopPropagation();
    // Preseleccionar la unidad principal de la sección
    const principal = (sec.unidades || []).find(u => u.es_principal);
    setItemForm({ nombre: '', descripcion: '', complejidad: '', unidad_id: principal?.id || '' });
    setError('');
    setShowItemForm(sec.id);
  };

  const guardarItem = async (sec) => {
    if (!itemForm.nombre.trim()) return setError('El nombre del ítem es requerido');
    setSavingItem(true);
    try {
      await API.post(`/delphi/secciones/${sec.id}/items`, {
        ...itemForm,
        unidad_id: itemForm.unidad_id ? +itemForm.unidad_id : null,
        sesion_id: sesionId,
      });
      await cargarItems(sec.id);
      setShowItemForm(null);
      setItemForm({ nombre: '', descripcion: '', complejidad: '', unidad_id: '' });
      onItemsChange?.();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al crear ítem');
    }
    setSavingItem(false);
  };

  const eliminarItem = async (sec, itemId) => {
    if (!window.confirm('¿Eliminar este ítem?')) return;
    try {
      await API.delete(`/sesiones/${sesionId}/items/${itemId}`);
      await cargarItems(sec.id);
      onItemsChange?.();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al eliminar ítem');
    }
  };

  /* ── Render ──────────────────────────────────────────────────────────  */
  return (
    <div>
      {/* Header de la sección */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div>
          <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            📂 Secciones e Ítems
          </h4>
          <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>
            Organiza los ítems y asigna unidades de medida por sección
          </p>
        </div>
        {!readOnly && !showSecForm && (
          <button className="btn btn-primary btn-sm" onClick={abrirNuevaSeccion}>
            ＋ Nueva Sección
          </button>
        )}
      </div>

      {/* Alerta de error */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          {error}
          <button
            onClick={() => setError('')}
            style={{ float:'right', background:'none', border:'none', color:'inherit', cursor:'pointer' }}
          >✕</button>
        </div>
      )}

      {/* Formulario nueva/editar sección */}
      {showSecForm && (
        <div className="card" style={{
          marginBottom: 16,
          background: 'var(--bg3)',
          border: '1px solid var(--accent)',
        }}>
          <h5 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--accent)' }}>
            {editSec ? `✏️ Editar: ${editSec.nombre}` : '➕ Nueva Sección'}
          </h5>
          <div className="grid-2">
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
              {savingSec ? '⏳' : (editSec ? '💾 Actualizar' : '✅ Crear Sección')}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowSecForm(false); setEditSec(null); }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          Cargando secciones...
        </div>
      ) : secciones.length === 0 ? (
        <div className="empty-state" style={{ padding: '30px 20px' }}>
          <div className="emoji">📂</div>
          <p>No hay secciones. Crea una para organizar los ítems de estimación.</p>
          {!readOnly && (
            <button className="btn btn-primary btn-sm" onClick={abrirNuevaSeccion}>
              ＋ Crear primera sección
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {secciones.map(sec => {
            const isOpen = expandedSec === sec.id;
            const items  = itemsBySec[sec.id] || [];

            return (
              <div
                key={sec.id}
                className="card"
                style={{ padding: 0, overflow: 'hidden' }}
              >
                {/* ── Cabecera de sección (clickable) ── */}
                <div
                  style={{
                    padding: '14px 18px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    cursor: 'pointer',
                    background: isOpen ? 'rgba(79,142,247,.06)' : 'var(--bg2)',
                    borderBottom: isOpen ? '1px solid var(--border)' : 'none',
                    transition: 'background .15s',
                  }}
                  onClick={() => toggleExpand(sec.id)}
                >
                  <span style={{ fontSize: 13, color: 'var(--text3)', minWidth: 14 }}>
                    {isOpen ? '▼' : '▶'}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                      {sec.nombre}
                    </div>
                    {sec.descripcion && (
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                        {sec.descripcion}
                      </div>
                    )}
                  </div>

                  {/* Badges de unidades */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 260 }}>
                    {(sec.unidades || []).map(u => (
                      <span
                        key={u.id}
                        className={`badge ${u.es_principal ? 'badge-blue' : 'badge-gray'}`}
                        style={{ fontSize: 10 }}
                        title={`${u.nombre}${u.es_principal ? ' (principal)' : ''}`}
                      >
                        {u.es_principal ? '★ ' : ''}{u.codigo}
                      </span>
                    ))}
                    {(sec.unidades || []).length === 0 && (
                      <span style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic' }}>
                        Sin unidades
                      </span>
                    )}
                  </div>

                  <span className="badge badge-gray" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>
                    {sec.total_items || 0} ítem{sec.total_items !== 1 ? 's' : ''}
                  </span>

                  {/* Botones de la sección (no propagan el click al toggle) */}
                  {!readOnly && (
                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: 12 }}
                        onClick={e => abrirEditarSeccion(sec, e)}
                        title="Editar sección"
                      >✏️</button>
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ padding: '4px 8px', fontSize: 12 }}
                        onClick={e => eliminarSeccion(sec, e)}
                        title="Eliminar sección"
                      >🗑️</button>
                    </div>
                  )}
                </div>

                {/* ── Contenido expandido ── */}
                {isOpen && (
                  <div style={{ padding: '18px 20px' }}>

                    {/* ── Panel de Unidades de Medida ── */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
                      }}>
                        <span style={{
                          fontSize: 11, fontFamily: 'var(--font-mono)',
                          color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em',
                        }}>
                          📏 Unidades de Medida
                        </span>
                        {!readOnly && addingUnit !== sec.id && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11, padding: '3px 9px' }}
                            onClick={() => {
                              setAddingUnit(sec.id);
                              setUnitSel('');
                              setUnitPrinc((sec.unidades || []).length === 0);
                            }}
                          >
                            ＋ Agregar unidad
                          </button>
                        )}
                        <small style={{ fontSize: 11, color: 'var(--text3)' }}>
                          Puedes asignar múltiples unidades (horas, líneas de código, puntos de función, etc.)
                        </small>
                      </div>

                      {/* Unidades actuales */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: addingUnit === sec.id ? 10 : 0 }}>
                        {(sec.unidades || []).length === 0 ? (
                          <span style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', padding: '6px 0' }}>
                            Sin unidades asignadas. Las unidades definen cómo los expertos estimarán los ítems.
                          </span>
                        ) : (sec.unidades || []).map(u => (
                          <div
                            key={u.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              background: u.es_principal
                                ? 'rgba(79,142,247,.12)'
                                : 'var(--bg3)',
                              border: `1px solid ${u.es_principal ? 'rgba(79,142,247,.35)' : 'var(--border)'}`,
                              borderRadius: 8, padding: '5px 10px', fontSize: 13,
                            }}
                          >
                            {u.es_principal && (
                              <span title="Unidad principal" style={{ fontSize: 12 }}>★</span>
                            )}
                            <span style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                              {u.codigo}
                            </span>
                            <span style={{ color: 'var(--text2)', fontSize: 12 }}>{u.nombre}</span>
                            {u.es_principal && (
                              <span className="badge badge-blue" style={{ fontSize: 9, padding: '1px 5px' }}>principal</span>
                            )}
                            {!readOnly && (
                              <button
                                onClick={e => quitarUnidad(sec.id, u.id, e)}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  color: 'var(--text3)', fontSize: 14, padding: '0 2px', lineHeight: 1,
                                }}
                                title="Quitar unidad"
                              >✕</button>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Formulario agregar unidad */}
                      {!readOnly && addingUnit === sec.id && (
                        <div style={{
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          borderRadius: 8, padding: '12px 14px',
                          display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
                        }}>
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <select
                              className="form-control"
                              style={{ fontSize: 13 }}
                              value={unitSel}
                              onChange={e => setUnitSel(e.target.value)}
                            >
                              <option value="">— Seleccionar unidad —</option>
                              {unidadesDisponibles(sec).map(u => (
                                <option key={u.id} value={u.id}>
                                  {u.codigo} — {u.nombre}
                                </option>
                              ))}
                            </select>
                          </div>
                          <label style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            fontSize: 13, color: 'var(--text2)', cursor: 'pointer', whiteSpace: 'nowrap',
                          }}>
                            <input
                              type="checkbox"
                              checked={unitPrinc}
                              onChange={e => setUnitPrinc(e.target.checked)}
                              style={{ accentColor: 'var(--accent)' }}
                            />
                            Marcar como principal
                          </label>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => agregarUnidad(sec.id)}
                            disabled={!unitSel || savingUnit}
                          >
                            {savingUnit ? '⏳' : '✅ Agregar'}
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setAddingUnit(null)}
                          >Cancelar</button>
                          {unidadesDisponibles(sec).length === 0 && (
                            <span style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>
                              No hay más unidades disponibles en el catálogo.
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ── Panel de Ítems ── */}
                    <div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
                      }}>
                        <span style={{
                          fontSize: 11, fontFamily: 'var(--font-mono)',
                          color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em',
                        }}>
                          📋 Ítems de Trabajo
                        </span>
                        {!readOnly && showItemForm !== sec.id && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11, padding: '3px 9px' }}
                            onClick={e => abrirNuevoItem(sec, e)}
                          >
                            ＋ Agregar ítem
                          </button>
                        )}
                        <small style={{ fontSize: 11, color: 'var(--text3)' }}>
                          Cada ítem puede tener su propia unidad de medida
                        </small>
                      </div>

                      {/* Formulario nuevo ítem */}
                      {!readOnly && showItemForm === sec.id && (
                        <div className="card" style={{
                          marginBottom: 10,
                          background: 'var(--bg)',
                          border: '1px solid var(--accent)',
                        }}>
                          <h6 style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: 'var(--accent)' }}>
                            ➕ Nuevo Ítem en "{sec.nombre}"
                          </h6>
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

                            {/* Selector de unidad — prioriza las de la sección */}
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Unidad de Medida</label>
                              <select
                                className="form-control"
                                value={itemForm.unidad_id}
                                onChange={e => setItemForm(f => ({ ...f, unidad_id: e.target.value }))}
                              >
                                <option value="">Sin unidad específica</option>

                                {(sec.unidades || []).length > 0 && (
                                  <optgroup label={`📌 Unidades de "${sec.nombre}"`}>
                                    {(sec.unidades || []).map(u => (
                                      <option key={u.id} value={u.id}>
                                        {u.es_principal ? '★ ' : ''}{u.codigo} — {u.nombre}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}

                                {/* Resto del catálogo */}
                                {unidades.filter(u => !(sec.unidades || []).find(su => su.id === u.id)).length > 0 && (
                                  <optgroup label="Otras unidades del catálogo">
                                    {unidades
                                      .filter(u => !(sec.unidades || []).find(su => su.id === u.id))
                                      .map(u => (
                                        <option key={u.id} value={u.id}>
                                          {u.codigo} — {u.nombre}
                                        </option>
                                      ))}
                                  </optgroup>
                                )}
                              </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Complejidad</label>
                              <select
                                className="form-control"
                                value={itemForm.complejidad}
                                onChange={e => setItemForm(f => ({ ...f, complejidad: e.target.value }))}
                              >
                                {COMPLEJIDAD_OPTS.map(c => (
                                  <option key={c} value={c} style={{ textTransform: 'capitalize' }}>
                                    {c || 'Sin especificar'}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Descripción</label>
                              <input
                                className="form-control"
                                placeholder="Descripción opcional"
                                value={itemForm.descripcion}
                                onChange={e => setItemForm(f => ({ ...f, descripcion: e.target.value }))}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => guardarItem(sec)}
                              disabled={savingItem}
                            >
                              {savingItem ? '⏳ Guardando...' : '✅ Crear Ítem'}
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setShowItemForm(null)}
                            >Cancelar</button>
                          </div>
                        </div>
                      )}

                      {/* Lista de ítems */}
                      {!itemsBySec[sec.id] ? (
                        <div style={{ color: 'var(--text3)', fontSize: 12, fontStyle: 'italic', padding: '4px 0' }}>
                          <span className="spinner" style={{ width: 12, height: 12, display: 'inline-block', marginRight: 6 }} />
                          Cargando ítems...
                        </div>
                      ) : items.length === 0 ? (
                        <div style={{
                          color: 'var(--text3)', fontSize: 12, fontStyle: 'italic',
                          padding: '10px 14px',
                          background: 'var(--bg3)', borderRadius: 6,
                          border: '1px dashed var(--border)',
                          textAlign: 'center',
                        }}>
                          Esta sección no tiene ítems. {!readOnly && 'Agrega el primero con el botón de arriba.'}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {items.map(item => (
                            <div
                              key={item.id}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '9px 13px',
                                background: 'var(--bg3)',
                                border: '1px solid var(--border)',
                                borderRadius: 7,
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.nombre}
                                </div>
                                {item.descripcion && (
                                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {item.descripcion}
                                  </div>
                                )}
                              </div>

                              {item.unidad_codigo && (
                                <span
                                  className="badge badge-blue"
                                  style={{ fontSize: 10, whiteSpace: 'nowrap' }}
                                  title={item.unidad_nombre}
                                >
                                  {item.unidad_codigo}
                                </span>
                              )}

                              {item.complejidad && (
                                <span
                                  className={`badge ${COMPLEJIDAD_BADGE[item.complejidad] || 'badge-gray'}`}
                                  style={{ fontSize: 10, textTransform: 'capitalize', whiteSpace: 'nowrap' }}
                                >
                                  {item.complejidad}
                                </span>
                              )}

                              {!readOnly && (
                                <button
                                  className="btn btn-danger btn-sm"
                                  style={{ fontSize: 11, padding: '3px 8px', flexShrink: 0 }}
                                  onClick={() => eliminarItem(sec, item.id)}
                                  title="Eliminar ítem"
                                >🗑️</button>
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