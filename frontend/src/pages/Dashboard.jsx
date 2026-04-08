import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getProyectos, getSesiones } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const [proyectos, setProyectos] = useState([]);
  const [sesiones,  setSesiones]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getProyectos(), getSesiones()])
      .then(([p, s]) => { setProyectos(p.data); setSesiones(s.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
      <span className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  const sByMetodo = sesiones.reduce((acc, s) => {
    acc[s.metodo] = (acc[s.metodo] || 0) + 1; return acc;
  }, {});
  const chartData = Object.entries(sByMetodo).map(([name, value]) => ({ name, value }));

  const sByEstado = sesiones.reduce((acc, s) => {
    acc[s.estado] = (acc[s.estado] || 0) + 1; return acc;
  }, {});
  const estadoChart = Object.entries(sByEstado).map(([name, value]) => ({ name, value }));

  const recientes = sesiones.slice(0, 5);
  const COLORS = ['var(--accent)', 'var(--accent2)', 'var(--green)', 'var(--amber)'];

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Bienvenido, {user?.nombre} · Vista general del sistema</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/proyectos')}>
          + Nuevo Proyecto
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card" style={{ '--c1': 'var(--accent)' }}>
          <div className="stat-label">Proyectos</div>
          <div className="stat-value">{proyectos.length}</div>
          <div className="stat-sub">{proyectos.filter(p=>p.estado==='activo').length} activos</div>
        </div>
        <div className="stat-card" style={{ '--c1': 'var(--accent2)' }}>
          <div className="stat-label">Sesiones</div>
          <div className="stat-value">{sesiones.length}</div>
          <div className="stat-sub">{sesiones.filter(s=>s.estado==='completada').length} completadas</div>
        </div>
        <div className="stat-card" style={{ '--c1': 'var(--green)' }}>
          <div className="stat-label">PERT</div>
          <div className="stat-value">{sByMetodo['PERT'] || 0}</div>
          <div className="stat-sub">sesiones creadas</div>
        </div>
        <div className="stat-card" style={{ '--c1': 'var(--amber)' }}>
          <div className="stat-label">Delphi</div>
          <div className="stat-value">{sByMetodo['DELPHI'] || 0}</div>
          <div className="stat-sub">sesiones creadas</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="chart-container">
          <div className="chart-title">Sesiones por Método</div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barSize={48}>
                <XAxis dataKey="name" tick={{ fill: 'var(--text2)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border)',
                    borderRadius: 8, color: 'var(--text)', fontSize: 13 }}
                  cursor={{ fill: 'rgba(255,255,255,.04)' }}
                />
                <Bar dataKey="value" radius={[6,6,0,0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state"><p>Sin datos aún</p></div>
          )}
        </div>

        <div className="chart-container">
          <div className="chart-title">Sesiones por Estado</div>
          {estadoChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={estadoChart} barSize={40}>
                <XAxis dataKey="name" tick={{ fill: 'var(--text2)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--text)', fontSize: 13 }}
                  cursor={{ fill: 'rgba(255,255,255,.04)' }} />
                <Bar dataKey="value" fill="var(--accent2)" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state"><p>Sin datos aún</p></div>
          )}
        </div>
      </div>

      {/* Recent sessions */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3>Sesiones Recientes</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/sesiones')}>Ver todas</button>
        </div>
        {recientes.length === 0
          ? <div className="empty-state"><div className="emoji"></div><p>No hay sesiones aún</p></div>
          : (
            <div className="table-wrapper">
              <table>
                <thead><tr>
                  <th>Sesión</th><th>Proyecto</th><th>Método</th><th>Estado</th><th>Ítems</th>
                </tr></thead>
                <tbody>
                  {recientes.map(s => (
                    <tr key={s.id} style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/sesiones/${s.id}`)}>
                      <td>{s.nombre}</td>
                      <td style={{ color: 'var(--text2)' }}>{s.proyecto}</td>
                      <td><span className={`badge ${s.metodo==='PERT' ? 'badge-blue' : 'badge-purple'}`}>
                        {s.metodo}</span></td>
                      <td><EstadoBadge e={s.estado} /></td>
                      <td className="td-mono">{s.total_items}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </div>
  );
}

function EstadoBadge({ e }) {
  const map = { borrador: 'badge-gray', en_progreso: 'badge-amber',
    completada: 'badge-green', archivada: 'badge-gray' };
  return <span className={`badge ${map[e] || 'badge-gray'}`}>{e}</span>;
}
