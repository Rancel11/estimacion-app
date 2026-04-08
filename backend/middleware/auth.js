const jwt = require('jsonwebtoken');

/**
 * authMiddleware
 * Soporta token en:
 *   - Header:  Authorization: Bearer <token>
 *   - Query:   ?token=<token>   ← necesario para EventSource (SSE), que no admite headers custom
 */
const authMiddleware = (req, res, next) => {
  const header     = req.headers['authorization'];
  const queryToken = req.query.token;

  // Prioridad: header > query param
  const raw = header
    ? (header.startsWith('Bearer ') ? header.slice(7) : header)
    : queryToken;

  if (!raw) return res.status(401).json({ error: 'Token requerido' });

  try {
    req.user = jwt.verify(raw, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};


const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!roles.includes(req.user.rol))
    return res.status(403).json({ error: `Permiso insuficiente. Se requiere: ${roles.join(' o ')}` });
  next();
};

module.exports = { authMiddleware, requireRole };