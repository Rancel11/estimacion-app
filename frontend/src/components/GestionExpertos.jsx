/**
 * src/components/GestionExpertos.jsx
 * Modal para crear y gestionar usuarios (expertos + todos los roles si eres admin).
 * Admin: ve y crea todos los roles.
 * Moderador: solo ve y crea expertos.
 */
import { useState, useEffect } from 'react';
import API from '../services/api'; // ajusta si tu ruta de API es distinta

export default function GestionExpertos({ onClose }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user?.rol === 'admin';

  const [usuarios,  setUsuarios]  = useState([]);
  const [roles,     setRoles]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editando,  setEditando]  = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const [filtroRol, setFiltroRol] = useState('');

  const formInit = { nombre: '', email: '', password: '', rol_id: '', activo: true };
  const [form, setForm] = useState(formInit);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const [uRes, rRes] = await Promise.all([
        API.get('/usuarios'),
        API.get('/usuarios/roles'),
      ]);
      setUsuarios(uRes.data);
      // Moderadores: solo pueden asignar rol experto
      const rolesDisponibles = isAdmin
        ? rRes.data
        : rRes.data.filter(r => r.nombre === 'experto');
      setRoles(rolesDisponibles);
    } catch (e) {
      setError('Error cargando datos');
    }
    setLoading(false);
  };

  const abrirNuevo = () => {
    setEditando(null);
    const rolPorDefecto = roles.find(r => r.nombre === 'experto')?.id || roles[0]?.id || '';
    setForm({ ...formInit, rol_id: rolPorDefecto });
    setError('');
    setShowForm(true);
  };

  const abrirEditar = (u) => {
    setEditando(u);
    setForm({
      nombre: u.nombre,
      email:  u.email,
      password: '',
      rol_id: u.rol_id,
      activo: !!u.activo,
    });
    setError('');
    setShowForm(true);
  };

  const guardar = async () => {
    if (!form.nombre.trim() || !form.email.trim()) {
      return setError('Nombre y email son requeridos');
    }
    if (!editando && form.password.length < 6) {
      return setError('La contraseña debe tener al menos 6 caracteres');
    }
    if (!form.rol_id) return setError('Selecciona un rol');

    setSaving(true);
    setError('');
    try {
      if (editando) {
        const payload = { nombre: form.nombre, email: form.email, activo: form.activo };
        if (isAdmin) payload.rol_id = form.rol_id;
        if (form.password) payload.password = form.password;
        await API.put(`/usuarios/${editando.id}`, payload);
        setSuccess('Usuario actualizado correctamente');
      } else {
        await API.post('/usuarios', {
          nombre:   form.nombre,
          email:    form.email,
          password: form.password,
          rol_id:   form.rol_id,
        });
        setSuccess('Usuario creado correctamente');
      }
      await cargar();
      setShowForm(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    }
    setSaving(false);
  };

  const toggleActivo = async (u) => {
    try {
      await API.put(`/usuarios/${u.id}`, { activo: !u.activo });
      await cargar();
    } catch (e) {
      setError(e.response?.data?.error || 'Error');
    }
  };

  const eliminar = async (u) => {
    if (!window.confirm(`¿Eliminar el usuario "${u.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await API.delete(`/usuarios/${u.id}`);
      await cargar();
      setSuccess('Usuario eliminado');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.response?.data?.error || 'Error al eliminar');
    }
  };

  const ROL_BADGE = {
    admin:     'badge-red',
    moderador: 'badge-purple',
    experto:   'badge-blue',
  };

  const usuariosFiltrados = filtroRol
    ? usuarios.filter(u => u.rol === filtroRol)
    : usuarios;

  return (
    <div
      className="modal-overlay"
      onClick={e => e.target === e.currentTarget && onClose?.()}
    >
      <div className="modal modal-lg" style={{ maxWidth: 800 }}>
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>
              {isAdmin ? '⚙️ Gestión de Usuarios' : '👥 Gestión de Expertos'}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
              {isAdmin
                ? 'Crea y administra todos los usuarios del sistema'
                : 'Crea y administra los expertos para las sesiones Delphi'}
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕ Cerrar</button>
        </div>

        {/* ── Alertas ── */}
        {error   && <div className="alert alert-error"   style={{ marginBottom: 12 }}>{error}   <button onClick={() => setError('')}   style={{ float:'right',background:'none',border:'none',color:'inherit',cursor:'pointer' }}>✕</button></div>}
        {success && <div className="alert alert-success" style={{ marginBottom: 12 }}>{success} <button onClick={() => setSuccess('')} style={{ float:'right',background:'none',border:'none',color:'inherit',cursor:'pointer' }}>✕</button></div>}

        {/* ── Formulario crear/editar ── */}
        {showForm && (
          <div className="card" style={{ marginBottom: 20, background: 'var(--bg3)', border: '1px solid var(--accent)' }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--accent)' }}>
              {editando ? `✏️ Editando: ${editando.nombre}` : '➕ Nuevo Usuario'}
            </h4>
            <div className="grid-2">
              <div className="form-group">
                <label>Nombre completo *</label>
                <input
                  className="form-control"
                  placeholder="ej. María García"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input
                  className="form-control"
                  type="email"
                  placeholder="usuario@empresa.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>
                  {editando ? 'Nueva Contraseña (vacío = sin cambio)' : 'Contraseña *'}
                </label>
                <input
                  className="form-control"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Rol *</label>
                <select
                  className="form-control"
                  value={form.rol_id}
                  onChange={e => setForm(f => ({ ...f, rol_id: +e.target.value }))}
                  disabled={!isAdmin && !!editando}
                >
                  <option value="">— Seleccionar rol —</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id} style={{ textTransform: 'capitalize' }}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
                {!isAdmin && <small style={{ color: 'var(--text3)', fontSize: 11 }}>Los moderadores solo pueden asignar el rol experto.</small>}
              </div>
              {editando && (
                <div className="form-group">
                  <label>Estado</label>
                  <select
                    className="form-control"
                    value={form.activo ? '1' : '0'}
                    onChange={e => setForm(f => ({ ...f, activo: e.target.value === '1' }))}
                  >
                    <option value="1">✅ Activo</option>
                    <option value="0">🚫 Inactivo</option>
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn btn-primary btn-sm" onClick={guardar} disabled={saving}>
                {saving ? '⏳ Guardando...' : (editando ? '💾 Actualizar' : '✅ Crear Usuario')}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowForm(false); setEditando(null); }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ── Toolbar ── */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          {isAdmin && (
            <div style={{ display: 'flex', gap: 4 }}>
              {['', ...new Set(usuarios.map(u => u.rol))].map(r => (
                <button
                  key={r}
                  className={`btn btn-sm ${filtroRol === r ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFiltroRol(r)}
                  style={{ textTransform: 'capitalize' }}
                >
                  {r || 'Todos'} {r ? `(${usuarios.filter(u => u.rol === r).length})` : `(${usuarios.length})`}
                </button>
              ))}
            </div>
          )}
          <div style={{ flex: 1 }} />
          {!showForm && (
            <button className="btn btn-primary btn-sm" onClick={abrirNuevo}>
              ＋ {isAdmin ? 'Nuevo Usuario' : 'Nuevo Experto'}
            </button>
          )}
        </div>

        {/* ── Tabla ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            Cargando usuarios...
          </div>
        ) : usuariosFiltrados.length === 0 ? (
          <div className="empty-state">
            <div className="emoji">👤</div>
            <p>No hay usuarios en esta categoría</p>
            <button className="btn btn-primary btn-sm" onClick={abrirNuevo}>
              ＋ Crear el primero
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Registrado</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map(u => (
                  <tr key={u.id}>
                    <td className="td-mono" style={{ color: 'var(--text3)', fontSize: 12 }}>{u.id}</td>
                    <td style={{ fontWeight: 600 }}>{u.nombre}</td>
                    <td className="td-mono" style={{ fontSize: 12 }}>{u.email}</td>
                    <td>
                      <span className={`badge ${ROL_BADGE[u.rol] || 'badge-gray'}`} style={{ textTransform: 'capitalize' }}>
                        {u.rol}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.activo ? 'badge-green' : 'badge-gray'}`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {new Date(u.creado_en).toLocaleDateString('es-DO')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => abrirEditar(u)}
                          title="Editar usuario"
                        >✏️</button>
                        <button
                          className={`btn btn-sm ${u.activo ? 'btn-danger' : 'btn-success'}`}
                          onClick={() => toggleActivo(u)}
                          title={u.activo ? 'Desactivar' : 'Activar'}
                        >
                          {u.activo ? '🚫' : '✅'}
                        </button>
                        {isAdmin && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => eliminar(u)}
                            title="Eliminar usuario"
                          >🗑️</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info */}
        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 14, textAlign: 'center' }}>
          {isAdmin
            ? 'Admin: puede crear cualquier rol y eliminar usuarios.'
            : 'Moderador: puede crear expertos y activar/desactivar usuarios.'}
        </p>
      </div>
    </div>
  );
}