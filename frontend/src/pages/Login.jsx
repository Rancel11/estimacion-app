import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { register as apiRegister } from '../services/api';

export default function Login() {
  const [mode,    setMode]    = useState('login'); // 'login' | 'register'
  const [form,    setForm]    = useState({ nombre: '', email: '', password: '', confirm: '' });
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  const reset = () => {
    setForm({ nombre: '', email: '', password: '', confirm: '' });
    setError(''); setSuccess('');
  };

  const switchMode = m => { setMode(m); reset(); };

  /* ── LOGIN ─────────────────────────────────────────── */
  const handleLogin = async e => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Credenciales inválidas. Verifica tu correo y contraseña.');
    } finally { setLoading(false); }
  };

  /* ── REGISTER ──────────────────────────────────────── */
  const handleRegister = async e => {
    e.preventDefault(); setError(''); setSuccess(''); setLoading(true);
    if (form.password !== form.confirm) {
      setError('Las contraseñas no coinciden.'); setLoading(false); return;
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.'); setLoading(false); return;
    }
    try {
      await apiRegister({ nombre: form.nombre, email: form.email, password: form.password, rol_id: 2 });
      setSuccess('✓ Cuenta creada correctamente. Ya puedes iniciar sesión.');
      setForm({ nombre: '', email: '', password: '', confirm: '' });
      setTimeout(() => switchMode('login'), 1800);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Error al registrarse.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Background blobs */}
      <div style={{ position:'fixed', inset:0, overflow:'hidden', pointerEvents:'none' }}>
        <div style={{ position:'absolute', top:'-20%', left:'30%', width:600, height:600,
          borderRadius:'50%', background:'radial-gradient(circle, rgba(79,142,247,.12) 0%, transparent 70%)' }}/>
        <div style={{ position:'absolute', bottom:'-10%', right:'-10%', width:400, height:400,
          borderRadius:'50%', background:'radial-gradient(circle, rgba(124,92,252,.1) 0%, transparent 70%)' }}/>
      </div>

      <div style={{ width:'100%', maxWidth:440, padding:'0 24px', position:'relative' }}>

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--accent)',
            letterSpacing:'.2em', textTransform:'uppercase', marginBottom:10 }}>
            EstimaSoft v1.0
          </div>
          <h1 style={{ fontSize:28, fontWeight:700, color:'var(--text)', marginBottom:8 }}>
            {mode === 'login' ? 'Bienvenido' : 'Crear Cuenta'}
          </h1>
          <p style={{ color:'var(--text2)', fontSize:14 }}>
            {mode === 'login'
              ? 'Sistema de Estimación PERT & Wideband Delphi'
              : 'Completa los datos para registrarte'}
          </p>
        </div>

        {/* Toggle tabs */}
        <div style={{ display:'flex', background:'var(--bg3)', borderRadius:'var(--radius)',
          padding:4, marginBottom:24, border:'1px solid var(--border)' }}>
          {[['login','Iniciar Sesión'],['register','Registrarse']].map(([m, label]) => (
            <button key={m} onClick={() => switchMode(m)}
              style={{
                flex:1, padding:'9px 0', border:'none', borderRadius:'calc(var(--radius) - 2px)',
                fontFamily:'var(--font-sans)', fontSize:13.5, fontWeight:600, cursor:'pointer',
                transition:'var(--transition)',
                background: mode === m ? 'var(--bg2)' : 'transparent',
                color:      mode === m ? 'var(--text)' : 'var(--text2)',
                boxShadow:  mode === m ? 'var(--shadow)' : 'none',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Card */}
        <div className="card">
          {error   && <div className="alert alert-error"   style={{marginBottom:16}}>{error}</div>}
          {success && <div className="alert alert-success" style={{marginBottom:16}}>{success}</div>}

          {/* ── LOGIN FORM ────────────────────────── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Correo Electrónico</label>
                <input className="form-control" type="email" placeholder="correo@ejemplo.com"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <input className="form-control" type="password" placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading}
                style={{ width:'100%', justifyContent:'center', padding:'12px', marginTop:8 }}>
                {loading ? <><span className="spinner" /> Ingresando…</> : '→ Iniciar Sesión'}
              </button>
              <p style={{ textAlign:'center', marginTop:16, fontSize:12.5, color:'var(--text3)' }}>
                ¿No tienes cuenta?{' '}
                <span style={{ color:'var(--accent)', cursor:'pointer', fontWeight:600 }}
                  onClick={() => switchMode('register')}>
                  Regístrate aquí
                </span>
              </p>
            </form>
          )}

          {/* ── REGISTER FORM ─────────────────────── */}
          {mode === 'register' && (
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label>Nombre Completo</label>
                <input className="form-control" type="text" placeholder="Ej: Juan Pérez"
                  value={form.nombre}
                  onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Correo Electrónico</label>
                <input className="form-control" type="email" placeholder="correo@ejemplo.com"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <input className="form-control" type="password" placeholder="Mínimo 6 caracteres"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Confirmar Contraseña</label>
                <input className="form-control" type="password" placeholder="Repite tu contraseña"
                  value={form.confirm}
                  onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))} required />
                {form.confirm && form.password !== form.confirm && (
                  <span style={{ fontSize:11, color:'var(--red)', marginTop:4, display:'block' }}>
                    ✕ Las contraseñas no coinciden
                  </span>
                )}
                {form.confirm && form.password === form.confirm && form.confirm.length >= 6 && (
                  <span style={{ fontSize:11, color:'var(--green)', marginTop:4, display:'block' }}>
                    ✓ Las contraseñas coinciden
                  </span>
                )}
              </div>

              {/* Password strength bar */}
              {form.password && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:11, color:'var(--text3)', marginBottom:5 }}>
                    Seguridad de contraseña
                  </div>
                  <div style={{ display:'flex', gap:4 }}>
                    {[6, 8, 10, 14].map((min, i) => (
                      <div key={i} style={{
                        flex:1, height:4, borderRadius:2, transition:'background .3s',
                        background: form.password.length >= min
                          ? ['var(--red)','var(--amber)','var(--accent)','var(--green)'][i]
                          : 'var(--border)',
                      }}/>
                    ))}
                  </div>
                </div>
              )}

              <button className="btn btn-primary" type="submit"
                disabled={
                  loading ||
                  !form.nombre ||
                  !form.email ||
                  form.password !== form.confirm ||
                  form.password.length < 6
                }
                style={{ width:'100%', justifyContent:'center', padding:'12px', marginTop:4 }}>
                {loading ? <><span className="spinner" /> Creando cuenta…</> : '✓ Crear Cuenta'}
              </button>

              <p style={{ textAlign:'center', marginTop:16, fontSize:12.5, color:'var(--text3)' }}>
                ¿Ya tienes cuenta?{' '}
                <span style={{ color:'var(--accent)', cursor:'pointer', fontWeight:600 }}
                  onClick={() => switchMode('login')}>
                  Inicia sesión aquí
                </span>
              </p>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}