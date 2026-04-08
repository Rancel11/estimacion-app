-- ============================================================
--  SISTEMA DE ESTIMACIÓN DE SOFTWARE - UCE
--  Métodos: PERT y Wideband Delphi
--  Base de datos normalizada (3FN)
--  MySQL 8.0+
-- ============================================================

CREATE DATABASE IF NOT EXISTS estimacion_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE estimacion_db;

-- ────────────────────────────────────────────────────────────
-- TABLA: roles
--   Catálogo de roles del sistema (evita redundancia en users)
-- ────────────────────────────────────────────────────────────
CREATE TABLE roles (
  id        TINYINT      UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  nombre    VARCHAR(50)  NOT NULL UNIQUE,
  descripcion VARCHAR(200)
) ENGINE=InnoDB;

INSERT INTO roles (nombre, descripcion) VALUES
  ('admin',   'Administrador del sistema. Acceso total.'),
  ('lider',   'Líder de proyecto. Crea y gestiona sesiones.'),
  ('experto', 'Experto participante en estimaciones Delphi.'),
  ('viewer',  'Solo lectura de resultados.');

-- ────────────────────────────────────────────────────────────
-- TABLA: usuarios
-- ────────────────────────────────────────────────────────────
CREATE TABLE usuarios (
  id           INT          UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  nombre       VARCHAR(100) NOT NULL,
  email        VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol_id       TINYINT      UNSIGNED NOT NULL DEFAULT 2,
  activo       TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_usuarios_rol FOREIGN KEY (rol_id) REFERENCES roles(id)
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- TABLA: proyectos
-- ────────────────────────────────────────────────────────────
CREATE TABLE proyectos (
  id           INT          UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  nombre       VARCHAR(200) NOT NULL,
  descripcion  TEXT,
  cliente      VARCHAR(150),
  estado       ENUM('activo','completado','pausado','cancelado') NOT NULL DEFAULT 'activo',
  creado_por   INT          UNSIGNED NOT NULL,
  creado_en    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_proyectos_usuario FOREIGN KEY (creado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- TABLA: metodos_estimacion
--   Catálogo normalizado de métodos (evita ENUM volátil)
-- ────────────────────────────────────────────────────────────
CREATE TABLE metodos_estimacion (
  id          TINYINT      UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  codigo      VARCHAR(20)  NOT NULL UNIQUE,
  nombre      VARCHAR(100) NOT NULL,
  descripcion TEXT
) ENGINE=InnoDB;

INSERT INTO metodos_estimacion (codigo, nombre, descripcion) VALUES
  ('PERT',   'PERT (Program Evaluation and Review Technique)',
   'Estimación por tres valores: Optimista, Más Probable y Pesimista. Fórmula: E=(O+4M+P)/6'),
  ('DELPHI', 'Wideband Delphi',
   'Estimación grupal iterativa con múltiples rondas de consenso entre expertos.');

-- ────────────────────────────────────────────────────────────
-- TABLA: unidades_medida
--   Catálogo de unidades (LOC, horas, días, puntos historia…)
-- ────────────────────────────────────────────────────────────
CREATE TABLE unidades_medida (
  id      TINYINT     UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  codigo  VARCHAR(20) NOT NULL UNIQUE,
  nombre  VARCHAR(60) NOT NULL
) ENGINE=InnoDB;

INSERT INTO unidades_medida (codigo, nombre) VALUES
  ('LOC',    'Líneas de Código'),
  ('HOURS',  'Horas-Persona'),
  ('DAYS',   'Días-Persona'),
  ('SP',     'Story Points'),
  ('FP',     'Function Points');

-- ────────────────────────────────────────────────────────────
-- TABLA: sesiones_estimacion
--   Una sesión = un proyecto + un método + un conjunto de ítems
-- ────────────────────────────────────────────────────────────
CREATE TABLE sesiones_estimacion (
  id           INT          UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  proyecto_id  INT          UNSIGNED NOT NULL,
  metodo_id    TINYINT      UNSIGNED NOT NULL,
  unidad_id    TINYINT      UNSIGNED NOT NULL DEFAULT 1,
  nombre       VARCHAR(200) NOT NULL,
  descripcion  TEXT,
  estado       ENUM('borrador','en_progreso','completada','archivada') NOT NULL DEFAULT 'borrador',
  creado_por   INT          UNSIGNED NOT NULL,
  creado_en    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completado_en TIMESTAMP   NULL,
  CONSTRAINT fk_sesion_proyecto FOREIGN KEY (proyecto_id)  REFERENCES proyectos(id)           ON DELETE CASCADE,
  CONSTRAINT fk_sesion_metodo   FOREIGN KEY (metodo_id)    REFERENCES metodos_estimacion(id),
  CONSTRAINT fk_sesion_unidad   FOREIGN KEY (unidad_id)    REFERENCES unidades_medida(id),
  CONSTRAINT fk_sesion_usuario  FOREIGN KEY (creado_por)   REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- TABLA: items_trabajo
--   Módulos, funciones o tareas a estimar dentro de una sesión
-- ────────────────────────────────────────────────────────────
CREATE TABLE items_trabajo (
  id           INT          UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  sesion_id    INT          UNSIGNED NOT NULL,
  nombre       VARCHAR(200) NOT NULL,
  descripcion  TEXT,
  complejidad  ENUM('baja','media','alta') NULL,
  orden        SMALLINT     UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_item_sesion FOREIGN KEY (sesion_id) REFERENCES sesiones_estimacion(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- TABLA: estimaciones_pert
--   1:1 con items_trabajo cuando el método es PERT
-- ────────────────────────────────────────────────────────────
CREATE TABLE estimaciones_pert (
  id              INT           UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  item_id         INT           UNSIGNED NOT NULL UNIQUE,
  optimista       DECIMAL(12,2) NOT NULL CHECK (optimista >= 0),
  mas_probable    DECIMAL(12,2) NOT NULL CHECK (mas_probable >= 0),
  pesimista       DECIMAL(12,2) NOT NULL CHECK (pesimista >= 0),
  -- Valores calculados (persistidos para rendimiento y auditoría)
  valor_esperado  DECIMAL(12,4) AS ((optimista + 4 * mas_probable + pesimista) / 6) STORED,
  desv_estandar   DECIMAL(12,4) AS ((pesimista - optimista) / 6) STORED,
  varianza        DECIMAL(12,4) AS (POW((pesimista - optimista) / 6, 2)) STORED,
  creado_en       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pert_item FOREIGN KEY (item_id) REFERENCES items_trabajo(id) ON DELETE CASCADE,
  CONSTRAINT chk_pert_orden CHECK (optimista <= mas_probable AND mas_probable <= pesimista)
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- TABLA: expertos_sesion
--   Expertos asignados a una sesión Delphi
--   (Un usuario puede ser experto en múltiples sesiones)
-- ────────────────────────────────────────────────────────────
CREATE TABLE expertos_sesion (
  id          INT          UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  sesion_id   INT          UNSIGNED NOT NULL,
  usuario_id  INT          UNSIGNED NULL,   -- NULL si es experto externo
  nombre      VARCHAR(100) NOT NULL,
  email       VARCHAR(150),
  especialidad VARCHAR(100),
  CONSTRAINT fk_experto_sesion   FOREIGN KEY (sesion_id)  REFERENCES sesiones_estimacion(id) ON DELETE CASCADE,
  CONSTRAINT fk_experto_usuario  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT uq_experto_sesion   UNIQUE (sesion_id, email)
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- TABLA: rondas_delphi
--   Cada iteración de la sesión Wideband Delphi
-- ────────────────────────────────────────────────────────────
CREATE TABLE rondas_delphi (
  id           INT          UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  sesion_id    INT          UNSIGNED NOT NULL,
  numero_ronda TINYINT      UNSIGNED NOT NULL,
  estado       ENUM('abierta','cerrada') NOT NULL DEFAULT 'abierta',
  notas        TEXT,
  abierta_en   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cerrada_en   TIMESTAMP    NULL,
  CONSTRAINT fk_ronda_sesion   FOREIGN KEY (sesion_id) REFERENCES sesiones_estimacion(id) ON DELETE CASCADE,
  CONSTRAINT uq_ronda_sesion   UNIQUE (sesion_id, numero_ronda)
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- TABLA: estimaciones_delphi
--   Estimación individual de cada experto por ronda y por ítem
-- ────────────────────────────────────────────────────────────
CREATE TABLE estimaciones_delphi (
  id          INT           UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ronda_id    INT           UNSIGNED NOT NULL,
  experto_id  INT           UNSIGNED NOT NULL,
  item_id     INT           UNSIGNED NOT NULL,
  estimacion  DECIMAL(12,2) NOT NULL CHECK (estimacion >= 0),
  comentario  TEXT,
  enviado_en  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_estdelphi_ronda   FOREIGN KEY (ronda_id)   REFERENCES rondas_delphi(id)    ON DELETE CASCADE,
  CONSTRAINT fk_estdelphi_experto FOREIGN KEY (experto_id) REFERENCES expertos_sesion(id)  ON DELETE CASCADE,
  CONSTRAINT fk_estdelphi_item    FOREIGN KEY (item_id)    REFERENCES items_trabajo(id)    ON DELETE CASCADE,
  CONSTRAINT uq_estimacion_delphi UNIQUE (ronda_id, experto_id, item_id)
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- TABLA: consenso_delphi
--   Resultado final acordado por ítem en la sesión Delphi
-- ────────────────────────────────────────────────────────────
CREATE TABLE consenso_delphi (
  id                INT           UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  sesion_id         INT           UNSIGNED NOT NULL,
  item_id           INT           UNSIGNED NOT NULL,
  estimacion_final  DECIMAL(12,2) NOT NULL,
  rondas_necesarias TINYINT       UNSIGNED NOT NULL DEFAULT 1,
  consenso_logrado  TINYINT(1)    NOT NULL DEFAULT 0,
  notas             TEXT,
  creado_en         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_consenso_sesion FOREIGN KEY (sesion_id) REFERENCES sesiones_estimacion(id) ON DELETE CASCADE,
  CONSTRAINT fk_consenso_item   FOREIGN KEY (item_id)   REFERENCES items_trabajo(id)       ON DELETE CASCADE,
  CONSTRAINT uq_consenso        UNIQUE (sesion_id, item_id)
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- TABLA: factores_ajuste
--   Factores de complejidad/riesgo aplicables a los totales
-- ────────────────────────────────────────────────────────────
CREATE TABLE factores_ajuste (
  id          INT           UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  sesion_id   INT           UNSIGNED NOT NULL,
  nombre      VARCHAR(100)  NOT NULL,
  descripcion TEXT,
  valor       DECIMAL(5,3)  NOT NULL DEFAULT 1.000 CHECK (valor > 0),
  CONSTRAINT fk_factor_sesion FOREIGN KEY (sesion_id) REFERENCES sesiones_estimacion(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- VISTA: v_resultados_pert
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_resultados_pert AS
SELECT
  s.id                         AS sesion_id,
  s.nombre                     AS sesion,
  p.nombre                     AS proyecto,
  u.nombre                     AS unidad,
  it.id                        AS item_id,
  it.nombre                    AS item,
  it.complejidad,
  ep.optimista,
  ep.mas_probable,
  ep.pesimista,
  ROUND(ep.valor_esperado, 2)  AS valor_esperado,
  ROUND(ep.desv_estandar, 2)   AS desv_estandar,
  ROUND(ep.varianza, 4)        AS varianza,
  ROUND(ep.valor_esperado - ep.desv_estandar, 2) AS limite_inferior_68,
  ROUND(ep.valor_esperado + ep.desv_estandar, 2) AS limite_superior_68,
  ROUND(ep.valor_esperado - 2 * ep.desv_estandar, 2) AS limite_inferior_95,
  ROUND(ep.valor_esperado + 2 * ep.desv_estandar, 2) AS limite_superior_95
FROM sesiones_estimacion s
JOIN proyectos           p  ON s.proyecto_id = p.id
JOIN unidades_medida     u  ON s.unidad_id   = u.id
JOIN items_trabajo       it ON it.sesion_id  = s.id
JOIN estimaciones_pert   ep ON ep.item_id    = it.id;

-- ────────────────────────────────────────────────────────────
-- VISTA: v_estadisticas_delphi
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_estadisticas_delphi AS
SELECT
  rd.sesion_id,
  rd.id                         AS ronda_id,
  rd.numero_ronda,
  de.item_id,
  it.nombre                     AS item,
  COUNT(de.id)                  AS total_expertos,
  ROUND(AVG(de.estimacion), 2)  AS promedio,
  ROUND(MIN(de.estimacion), 2)  AS minimo,
  ROUND(MAX(de.estimacion), 2)  AS maximo,
  ROUND(STDDEV(de.estimacion), 2) AS desv_estandar,
  ROUND(
    CASE WHEN AVG(de.estimacion) = 0 THEN 0
         ELSE (STDDEV(de.estimacion) / AVG(de.estimacion)) * 100
    END, 2
  )                             AS coef_variacion_pct
FROM rondas_delphi     rd
JOIN estimaciones_delphi de ON de.ronda_id = rd.id
JOIN items_trabajo       it ON it.id        = de.item_id
GROUP BY rd.sesion_id, rd.id, rd.numero_ronda, de.item_id, it.nombre;

-- ────────────────────────────────────────────────────────────
-- DATOS SEMILLA
-- ────────────────────────────────────────────────────────────
INSERT INTO usuarios (nombre, email, password_hash, rol_id) VALUES
  ('Administrador', 'admin@uce.edu.do',
   '$2b$10$rqJ7XuH2z1VVWkIK3H8rHOHsLKZEJmq4FWVuZdN0y/WJKXH.5pHdW', 1),
  ('Demo Líder',    'lider@uce.edu.do',
   '$2b$10$rqJ7XuH2z1VVWkIK3H8rHOHsLKZEJmq4FWVuZdN0y/WJKXH.5pHdW', 2);
-- Contraseña hash corresponde a: Password123!
