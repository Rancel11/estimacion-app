import axios from 'axios';

const API = axios.create({ baseURL: '/api' });

// Attach JWT
API.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Auto-logout on 401
API.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

/* ── Auth ─────────────────────────────────────────────── */
export const login    = (data)  => API.post('/auth/login', data);
export const register = (data)  => API.post('/auth/register', data);
export const getMe    = ()      => API.get('/auth/me');

/* ── Catálogos ───────────────────────────────────────── */
export const getCatalogos = () => API.get('/catalogos');

/* ── Proyectos ───────────────────────────────────────── */
export const getProyectos     = ()       => API.get('/proyectos');
export const getProyecto      = id       => API.get(`/proyectos/${id}`);
export const crearProyecto    = data     => API.post('/proyectos', data);
export const actualizarProyecto = (id,d) => API.put(`/proyectos/${id}`, d);
export const eliminarProyecto = id       => API.delete(`/proyectos/${id}`);

/* ── Sesiones ────────────────────────────────────────── */
export const getSesiones      = ()       => API.get('/sesiones');
export const getSesion        = id       => API.get(`/sesiones/${id}`);
export const crearSesion      = data     => API.post('/sesiones', data);
export const cambiarEstado    = (id, estado) => API.put(`/sesiones/${id}/estado`, { estado });
export const eliminarSesion   = id       => API.delete(`/sesiones/${id}`);

/* ── Ítems ───────────────────────────────────────────── */
export const getItems         = sid      => API.get(`/sesiones/${sid}/items`);
export const crearItem        = (sid, d) => API.post(`/sesiones/${sid}/items`, d);
export const crearItemsBulk   = (sid, items) => API.post(`/sesiones/${sid}/items/bulk`, { items });
export const actualizarItem   = (sid, iid, d) => API.put(`/sesiones/${sid}/items/${iid}`, d);
export const eliminarItem     = (sid, iid) => API.delete(`/sesiones/${sid}/items/${iid}`);

/* ── Factores ────────────────────────────────────────── */
export const getFactores      = sid      => API.get(`/sesiones/${sid}/factores`);
export const crearFactor      = (sid, d) => API.post(`/sesiones/${sid}/factores`, d);
export const eliminarFactor   = (sid, fid) => API.delete(`/sesiones/${sid}/factores/${fid}`);

/* ── PERT ────────────────────────────────────────────── */
export const guardarPert      = (iid, d) => API.post(`/pert/${iid}`, d);
export const getResultadosPert = sid     => API.get(`/pert/sesion/${sid}`);
export const eliminarPert     = iid      => API.delete(`/pert/${iid}`);

export const getExpertosDisponibles = () => API.get('/delphi/expertos');
 
/* ── Delphi v2: participantes (usuarios con rol experto) ────── */
export const getParticipantes      = sid       => API.get(`/delphi/sesion/${sid}/participantes`);
export const addParticipante       = (sid, uid)=> API.post(`/delphi/sesion/${sid}/participantes`, { usuario_id: uid });
export const addParticipantesBulk  = (sid, ids)=> API.post(`/delphi/sesion/${sid}/participantes/bulk`, { usuario_ids: ids });
export const delParticipante       = (sid, uid)=> API.delete(`/delphi/sesion/${sid}/participantes/${uid}`);
 
/* ── Delphi v2: secciones ────────────────────────────────────── */
export const getSecciones    = sid        => API.get(`/delphi/sesion/${sid}/secciones`);
export const crearSeccion    = (sid, d)   => API.post(`/delphi/sesion/${sid}/secciones`, d);
export const editarSeccion   = (id, d)    => API.put(`/delphi/secciones/${id}`, d);
export const delSeccion      = id         => API.delete(`/delphi/secciones/${id}`);
 
/* ── Delphi v2: unidades por sección ────────────────────────── */
export const addUnidadSeccion = (secId, d)   => API.post(`/delphi/secciones/${secId}/unidades`, d);
export const delUnidadSeccion = (secId, uid) => API.delete(`/delphi/secciones/${secId}/unidades/${uid}`);
 
/* ── Delphi v2: ítems por sección ───────────────────────────── */
export const getItemsSeccion  = secId      => API.get(`/delphi/secciones/${secId}/items`);
export const addItemSeccion   = (secId, d) => API.post(`/delphi/secciones/${secId}/items`, d);
export const addItemsBulkSec  = (secId, d) => API.post(`/delphi/secciones/${secId}/items/bulk`, d);
 
/* ── Delphi v2: rondas (actualizados) ───────────────────────── */
export const getRondasV2      = sid => API.get(`/delphi/sesion/${sid}/rondas`);
export const crearRondaV2     = (sid, d) => API.post(`/delphi/sesion/${sid}/rondas`, d);
export const cerrarRondaV2    = rid => API.put(`/delphi/rondas/${rid}/cerrar`);
 
/* ── Delphi v2: estimaciones con usuario_id ─────────────────── */
export const getEstimacionesV2    = rid => API.get(`/delphi/rondas/${rid}/estimaciones`);
export const guardarEstimsBulkV2  = (rid, d) => API.post(`/delphi/rondas/${rid}/estimaciones/bulk`, d);
 
/* ── Delphi v2: estadísticas ────────────────────────────────── */
export const getStatsV2 = rid => API.get(`/delphi/rondas/${rid}/estadisticas`);
 
/* ── Delphi v2: consenso ────────────────────────────────────── */
export const getConsensoV2     = sid     => API.get(`/delphi/sesion/${sid}/consenso`);
export const guardarConsensoV2 = (sid,d) => API.post(`/delphi/sesion/${sid}/consenso/bulk`, { consensos: d });
 
/* ── Delphi v2: resumen y exportación ───────────────────────── */
export const getResumenV2      = sid     => API.get(`/delphi/sesion/${sid}/resumen`);
export const getMisSesiones    = ()      => API.get('/delphi/mis-sesiones');
export const getFormatos       = ()      => API.get('/delphi/formatos-exportacion');

export default API;
