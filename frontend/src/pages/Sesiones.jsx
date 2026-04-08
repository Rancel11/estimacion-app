import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSesiones, getProyectos, crearSesion, getCatalogos, eliminarSesion } from '../services/api';

export default function Sesiones() {
  const [sesiones,   setSesiones]   = useState([]);
  const [proyectos,  setProyectos]  = useState([]);
  const [catalogos,  setCatalogos]  = useState({ metodos: [], unidades: [] });
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState(false);
  const [form,       setForm]       = useState({ proyecto_id:'', metodo_id:'', nombre:'', descripcion:'', unidad_id:'1' });
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');
  const [filtro,     setFiltro]     = useState('');
  const navigate = useNavigate();

  const load = async () => {
    const [s, p, c] = await Promise.all([getSesiones(), getProyectos(), getCatalogos()]);
    setSesiones(s.data); setProyectos(p.data); setCatalogos(c.data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async e => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const { data } = await crearSesion(form);
      setModal(false);
      setForm({ proyecto_id:'', metodo_id:'', nombre:'', descripcion:'', unidad_id:'1' });
      navigate(`/sesiones/${data.id}`);
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('¿Eliminar esta sesión?')) return;
    await eliminarSesion(id);
    setSesiones(s => s.filter(x => x.id !== id));
  };

  const filtered = sesiones.filter(s =>
    s.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
    s.proyecto.toLowerCase().includes(filtro.toLowerCase())
  );

  const estadoBadge = e => ({
    borrador:'badge-gray', en_progreso:'badge-amber',
    completada:'badge-green', archivada:'badge-gray'
  }[e] || 'badge-gray');

  return (
    <div className="page-enter">
      <div className="page-header">
        <div><h2>Sesiones de Estimación</h2><p>Administra todas las sesiones PERT y Delphi</p></div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Nueva Sesión</button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input className="form-control" placeholder="Buscar sesión o proyecto…"
          style={{ maxWidth: 360 }} value={filtro} onChange={e => setFiltro(e.target.value)} />
      </div>

      {loading
        ? <div style={{ textAlign:'center', padding:60 }}><span className="spinner" style={{width:32,height:32}} /></div>
        : filtered.length === 0
          ? <div className="card"><div className="empty-state">
              <div className="emoji"></div>
              <p>{filtro ? 'Sin resultados' : 'No hay sesiones todavía'}</p>
              {!filtro && <button className="btn btn-primary" onClick={() => setModal(true)}>Crear sesión</button>}
            </div></div>
          : (
            <div className="table-wrapper">
              <table>
                <thead><tr>
                  <th>Sesión</th><th>Proyecto</th><th>Método</th><th>Unidad</th>
                  <th>Estado</th><th>Ítems</th><th>Fecha</th><th></th>
                </tr></thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id} style={{ cursor:'pointer' }} onClick={() => navigate(`/sesiones/${s.id}`)}>
                      <td><strong>{s.nombre}</strong></td>
                      <td style={{ color:'var(--text2)' }}>{s.proyecto}</td>
                      <td><span className={`badge ${s.metodo==='PERT'?'badge-blue':'badge-purple'}`}>{s.metodo}</span></td>
                      <td className="td-mono" style={{ fontSize:12 }}>{s.unidad}</td>
                      <td><span className={`badge ${estadoBadge(s.estado)}`}>{s.estado}</span></td>
                      <td className="td-mono td-center">{s.total_items}</td>
                      <td style={{ color:'var(--text3)', fontSize:12 }}>{new Date(s.creado_en).toLocaleDateString('es-DO')}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <button className="btn btn-danger btn-sm" onClick={e => handleDelete(s.id, e)}>🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      }

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Nueva Sesión de Estimación</h3>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Proyecto *</label>
                <select className="form-control" value={form.proyecto_id}
                  onChange={e => setForm(p=>({...p,proyecto_id:e.target.value}))} required>
                  <option value="">Seleccionar proyecto…</option>
                  {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label>Método *</label>
                  <select className="form-control" value={form.metodo_id}
                    onChange={e => setForm(p=>({...p,metodo_id:e.target.value}))} required>
                    <option value="">Seleccionar…</option>
                    {catalogos.metodos.map(m => <option key={m.id} value={m.id}>{m.codigo} – {m.nombre.split('(')[0]}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Unidad de Medida</label>
                  <select className="form-control" value={form.unidad_id}
                    onChange={e => setForm(p=>({...p,unidad_id:e.target.value}))}>
                    {catalogos.unidades.map(u => <option key={u.id} value={u.id}>{u.codigo} – {u.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Nombre de la Sesión *</label>
                <input className="form-control" placeholder="Ej: Módulos del sistema de facturación"
                  value={form.nombre} onChange={e => setForm(p=>({...p,nombre:e.target.value}))} required />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <textarea className="form-control" placeholder="Objetivo de esta sesión de estimación…"
                  value={form.descripcion} onChange={e => setForm(p=>({...p,descripcion:e.target.value}))} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner" /> Creando…</> : '✓ Crear Sesión'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
