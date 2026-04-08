import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProyectos, crearProyecto, eliminarProyecto, getCatalogos } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Proyectos() {
  const [proyectos, setProyectos] = useState([]);
  const [catalogos, setCatalogos] = useState({ metodos: [], unidades: [] });
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(false);
  const [form,      setForm]      = useState({
    nombre:      '',
    descripcion: '',
    cliente:     '',
    estado:      'activo',
    metodo_id:   '',
    unidad_id:   '1',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  const isMod = ['admin', 'moderador'].includes(user?.rol);

  const load = async () => {
    try {
      const [p, c] = await Promise.all([getProyectos(), getCatalogos()]);
      setProyectos(p.data);
      setCatalogos(c.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async e => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { data } = await crearProyecto(form);
      setModal(false);
      setForm({ nombre: '', descripcion: '', cliente: '', estado: 'activo', metodo_id: '', unidad_id: '1' });

      // ── Redirección directa según método ──────────────────────
      // El backend devuelve: { id, metodo, sesion_id }
      if (data.metodo === 'PERT') {
        navigate(`/pert?sesion=${data.sesion_id}&proyecto=${data.id}`);
      } else if (data.metodo === 'DELPHI') {
        navigate(`/delphi?sesion=${data.sesion_id}&proyecto=${data.id}`);
      } else {
        load();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear proyecto');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('¿Eliminar este proyecto y todos sus datos?')) return;
    await eliminarProyecto(id);
    setProyectos(p => p.filter(x => x.id !== id));
  };

  const estadoColor = e => ({
    activo:     'badge-green',
    completado: 'badge-blue',
    pausado:    'badge-amber',
    cancelado:  'badge-red',
  }[e] || 'badge-gray');

  const metodoColor = m => ({
    PERT:   'badge-blue',
    DELPHI: 'badge-purple',
  }[m] || 'badge-gray');

  // Navegar a la página del método cuando el usuario abre un proyecto existente
  const handleOpenProyecto = (proyecto) => {
    if (proyecto.metodo === 'PERT') {
      navigate(`/pert?proyecto=${proyecto.id}`);
    } else if (proyecto.metodo === 'DELPHI') {
      navigate(`/delphi?proyecto=${proyecto.id}`);
    } else {
      navigate(`/proyectos/${proyecto.id}`);
    }
  };

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h2>Proyectos</h2>
          <p>Gestión de proyectos de estimación</p>
        </div>
        {isMod && (
          <button className="btn btn-primary" onClick={() => setModal(true)}>
            + Nuevo Proyecto
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <span className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : proyectos.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="emoji"></div>
            <p>No hay proyectos todavía</p>
            {isMod && (
              <button className="btn btn-primary" onClick={() => setModal(true)}>
                Crear primer proyecto
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px,1fr))', gap: 16 }}>
          {proyectos.map(p => (
            <div
              key={p.id}
              className="card"
              style={{ cursor: 'pointer', transition: 'var(--transition)' }}
              onClick={() => handleOpenProyecto(p)}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>{p.nombre}</h3>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <span className={`badge ${metodoColor(p.metodo)}`}>{p.metodo}</span>
                  <span className={`badge ${estadoColor(p.estado)}`}>{p.estado}</span>
                </div>
              </div>

              {p.descripcion && (
                <p style={{ marginBottom: 10, fontSize: 13, color: 'var(--text2)' }}>{p.descripcion}</p>
              )}

              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
                {p.cliente && <span>👤 {p.cliente}</span>}
                <span>📋 {p.total_sesiones} sesiones</span>
                <span>📅 {new Date(p.creado_en).toLocaleDateString('es-DO')}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>por {p.creado_por}</span>
                {isMod && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={e => handleDelete(p.id, e)}
                  >
                    🗑 Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: Nuevo Proyecto ──────────────────────────────── */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Nuevo Proyecto</h3>

            {error && (
              <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>
            )}

            <form onSubmit={handleCreate}>
              {/* Nombre */}
              <div className="form-group">
                <label>Nombre del Proyecto *</label>
                <input
                  className="form-control"
                  placeholder="Ej: Sistema de Facturación"
                  value={form.nombre}
                  onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                  required
                />
              </div>

              {/* Método — PRIMERO para que guíe el resto */}
              <div className="form-group">
                <label>Método de Estimación *</label>
                <select
                  className="form-control"
                  value={form.metodo_id}
                  onChange={e => setForm(p => ({ ...p, metodo_id: e.target.value }))}
                  required
                >
                  <option value="">— Seleccionar método —</option>
                  {catalogos.metodos.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.codigo} – {m.nombre}
                    </option>
                  ))}
                </select>
                {form.metodo_id && (
                  <small style={{ color: 'var(--text3)', marginTop: 4, display: 'block' }}>
                    {catalogos.metodos.find(m => String(m.id) === String(form.metodo_id))?.codigo === 'PERT'
                      ? '→ Serás redirigido al módulo PERT para estimar tiempos con O/M/P'
                      : '→ Serás redirigido al módulo Delphi para estimación grupal con expertos'}
                  </small>
                )}
              </div>

              {/* Unidad de medida */}
              <div className="form-group">
                <label>Unidad de Medida</label>
                <select
                  className="form-control"
                  value={form.unidad_id}
                  onChange={e => setForm(p => ({ ...p, unidad_id: e.target.value }))}
                >
                  {catalogos.unidades.map(u => (
                    <option key={u.id} value={u.id}>{u.codigo} – {u.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Cliente */}
              <div className="form-group">
                <label>Cliente / Patrocinador</label>
                <input
                  className="form-control"
                  placeholder="Ej: Empresa XYZ"
                  value={form.cliente}
                  onChange={e => setForm(p => ({ ...p, cliente: e.target.value }))}
                />
              </div>

              {/* Descripción */}
              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  className="form-control"
                  placeholder="Objetivo del proyecto…"
                  value={form.descripcion}
                  onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                />
              </div>

              {/* Estado inicial */}
              <div className="form-group">
                <label>Estado Inicial</label>
                <select
                  className="form-control"
                  value={form.estado}
                  onChange={e => setForm(p => ({ ...p, estado: e.target.value }))}
                >
                  <option value="activo">Activo</option>
                  <option value="pausado">Pausado</option>
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving
                    ? <><span className="spinner" /> Creando…</>
                    : '✓ Crear Proyecto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}