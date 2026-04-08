import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar    from './components/Sidebar';
import Login      from './pages/Login';
import Dashboard  from './pages/Dashboard';
import Proyectos  from './pages/Proyectos';
import Sesiones   from './pages/Sesiones';
import PertPage   from './pages/PertPage';
import DelphiPage from './pages/DelphiPage';
import './index.css';

/* ── Layout con sidebar ───────────────────────────────── */
function ProtectedLayout({ children }) {
  const { isAuth } = useAuth();
  if (!isAuth) return <Navigate to="/login" replace />;
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}

/* ── Ruta que requiere un rol específico ──────────────── */
function RolRoute({ children, roles }) {
  const { user } = useAuth();
  if (!roles.includes(user?.rol)) {
    // Expertos que intenten acceder a rutas de moderador → van a Delphi
    return <Navigate to="/delphi" replace />;
  }
  return children;
}

/* ── Todas las rutas ──────────────────────────────────── */
function AppRoutes() {
  const { isAuth } = useAuth();
  return (
    <Routes>
      {/* Pública */}
      <Route
        path="/login"
        element={isAuth ? <Navigate to="/" /> : <Login />}
      />

      {/* Solo admin y moderador */}
      <Route
        path="/"
        element={
          <ProtectedLayout>
            <RolRoute roles={['admin', 'moderador']}>
              <Dashboard />
            </RolRoute>
          </ProtectedLayout>
        }
      />
      <Route
        path="/proyectos"
        element={
          <ProtectedLayout>
            <RolRoute roles={['admin', 'moderador']}>
              <Proyectos />
            </RolRoute>
          </ProtectedLayout>
        }
      />
      <Route
        path="/proyectos/:id"
        element={
          <ProtectedLayout>
            <RolRoute roles={['admin', 'moderador']}>
              <Proyectos />
            </RolRoute>
          </ProtectedLayout>
        }
      />
      <Route
        path="/sesiones"
        element={
          <ProtectedLayout>
            <RolRoute roles={['admin', 'moderador']}>
              <Sesiones />
            </RolRoute>
          </ProtectedLayout>
        }
      />
      <Route
        path="/sesiones/:id"
        element={
          <ProtectedLayout>
            <RolRoute roles={['admin', 'moderador']}>
              <Sesiones />
            </RolRoute>
          </ProtectedLayout>
        }
      />
      <Route
        path="/pert"
        element={
          <ProtectedLayout>
            <RolRoute roles={['admin', 'moderador']}>
              <PertPage />
            </RolRoute>
          </ProtectedLayout>
        }
      />

      {/* Todos los roles autenticados pueden ver Delphi */}
      <Route
        path="/delphi"
        element={
          <ProtectedLayout>
            <DelphiPage />
          </ProtectedLayout>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}