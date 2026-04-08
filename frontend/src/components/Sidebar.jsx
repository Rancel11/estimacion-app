import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Íconos simples en texto (puedes reemplazar por SVG o lucide-react si quieres)
const NAV_COMPLETO = [
  { section: 'Principal' },
  { path: '/',          label: 'Dashboard',       icon: '', roles: ['admin', 'moderador'] },
  { path: '/proyectos', label: 'Proyectos',        icon: '', roles: ['admin', 'moderador'] },
  { section: 'Métodos' },
  { path: '/pert',      label: 'PERT',             icon: '', roles: ['admin', 'moderador'] },
  { path: '/delphi',    label: 'Wideband Delphi',  icon: '', roles: ['admin', 'moderador', 'experto'] },
];

export default function Sidebar() {
  const nav  = useNavigate();
  const loc  = useLocation();
  const { user, logout } = useAuth();

  // Filtrar ítems de navegación según el rol del usuario
  const navFiltrado = NAV_COMPLETO.filter(item => {
    if (item.section) {
      // Las secciones se muestran solo si hay al menos un ítem visible en ellas
      return true; // Se manejará en el render
    }
    if (!item.roles) return true;
    return item.roles.includes(user?.rol);
  });

  // Calcular si una sección tiene hijos visibles
  const itemsVisibles = navFiltrado.filter(item => !item.section);

  // Para determinar si mostrar una sección, miramos si hay ítems después de ella
  const renderItems = () => {
    const result = [];
    for (let i = 0; i < NAV_COMPLETO.length; i++) {
      const item = NAV_COMPLETO[i];
      if (item.section) {
        // Verificar si hay al menos un ítem visible en esta sección
        let j = i + 1;
        let tieneHijos = false;
        while (j < NAV_COMPLETO.length && !NAV_COMPLETO[j].section) {
          const hijo = NAV_COMPLETO[j];
          if (!hijo.roles || hijo.roles.includes(user?.rol)) {
            tieneHijos = true;
            break;
          }
          j++;
        }
        if (tieneHijos) {
          result.push(
            <div key={`section-${i}`} className="nav-section">
              {item.section}
            </div>
          );
        }
      } else {
        // Solo mostrar si el rol tiene acceso
        if (!item.roles || item.roles.includes(user?.rol)) {
          result.push(
            <div
              key={item.path}
              className={`nav-item ${loc.pathname === item.path ? 'active' : ''}`}
              onClick={() => nav(item.path)}
            >
              <span className="icon">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          );
        }
      }
    }
    return result;
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>EstimaSoft</h1>
        <span>Sistema de Estimación</span>
      </div>

      <nav className="sidebar-nav">
        {renderItems()}
      </nav>

      {/* Indicador de rol */}
      {user?.rol === 'experto' && (
        <div style={{
          margin: '0 16px 12px',
          padding: '8px 12px',
          background: 'rgba(79,142,247,.1)',
          border: '1px solid rgba(79,142,247,.25)',
          borderRadius: 8,
          fontSize: 11,
          color: 'var(--accent)',
          textAlign: 'center',
        }}>
          Vista Experto
        </div>
      )}

      <div className="sidebar-user">
        <div className="avatar">
          {user?.nombre?.[0]?.toUpperCase()}
        </div>
        <div className="info">
          <strong>{user?.nombre}</strong>
          <small style={{ textTransform: 'capitalize' }}>{user?.rol}</small>
        </div>
        <button className="logout-btn" onClick={logout} title="Cerrar sesión">
          ⏻
        </button>
      </div>
    </aside>
  );
}