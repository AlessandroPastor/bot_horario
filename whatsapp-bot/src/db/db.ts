import path from "node:path";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

const DATA_DIR = path.resolve("data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, "bot.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    chatId TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('recurrente_LV', 'recurrente_semanal', 'puntual')),
    dias TEXT,
    fecha TEXT,
    hora TEXT NOT NULL,
    avisoPrevioMin INTEGER NOT NULL DEFAULT 0,
    activo INTEGER NOT NULL DEFAULT 1,
    ultimoEnvio TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_eventos_chat ON eventos(chatId);

  CREATE TABLE IF NOT EXISTS perfiles (
    chatId TEXT PRIMARY KEY,
    grado INTEGER NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Marca aparte (no se infiere de los eventos) de qué chats ya recibieron
  -- el calendario cívico de ejemplo, para no confundirlo con que el chat
  -- simplemente tenga otros eventos puntuales propios (creados internamente).
  CREATE TABLE IF NOT EXISTS calendario_sembrado (
    chatId TEXT PRIMARY KEY,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Panel de administrador: docentes, plantilla de horario (currículo por
  -- grado+sección, editable) y calendario cívico (editable). Todo aditivo,
  -- no toca eventos/perfiles/calendario_sembrado.
  CREATE TABLE IF NOT EXISTS docentes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    materia TEXT,
    contacto TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Sin CHECK de rango en grado/seccion a propósito: así las pruebas
  -- automatizadas pueden usar un combo "centinela" fuera de rango
  -- (grado=99, seccion="Z") sin arriesgar tocar el currículo real (1-5,
  -- A-E). La validación de rango vive en la capa de rutas de la API.
  CREATE TABLE IF NOT EXISTS plantilla_horario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grado INTEGER NOT NULL,
    seccion TEXT NOT NULL,
    titulo TEXT NOT NULL,
    hora TEXT NOT NULL,
    dias TEXT NOT NULL,
    docenteId INTEGER REFERENCES docentes(id) ON DELETE SET NULL,
    avisoPrevioMin INTEGER NOT NULL DEFAULT 5,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_plantilla_grado_seccion ON plantilla_horario(grado, seccion);

  CREATE TABLE IF NOT EXISTS calendario_civico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    fecha TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Evita re-sembrar cientos de filas si el admin las borra a propósito:
  -- se siembra la plantilla/calendario por defecto una sola vez en la vida
  -- de la base, no "si está vacía" (que resembraría tras un borrado real).
  CREATE TABLE IF NOT EXISTS semilla_estado (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    horarioSembrado INTEGER NOT NULL DEFAULT 0,
    calendarioSembrado INTEGER NOT NULL DEFAULT 0
  );
  INSERT OR IGNORE INTO semilla_estado (id) VALUES (1);

  -- Reuniones de padres de familia: grado/seccion NULL = aplica a "todos".
  -- Al crear una reunión se reparte (fan-out) como recordatorio puntual a
  -- los chats ya registrados que calcen con ese grado/sección (ver
  -- db/reuniones.ts) — a diferencia de la plantilla de horario, esto SÍ
  -- llega de inmediato a quien ya estaba registrado, porque es un aviso
  -- puntual, no un currículo.
  CREATE TABLE IF NOT EXISTS reuniones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    fecha TEXT NOT NULL,
    hora TEXT NOT NULL,
    lugar TEXT,
    grado INTEGER,
    seccion TEXT,
    avisoPrevioMin INTEGER NOT NULL DEFAULT 60,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Catálogo de cursos: se define UNA vez por grado (no por sección), cada
  -- uno con su docente (el mismo profesor dicta las 5 secciones A-E, en
  -- horarios distintos). "Generar horario" (ver db/plantillaHorario.ts)
  -- lee este catálogo y arma las filas de plantilla_horario de las 5
  -- secciones del grado automáticamente, evitando que el mismo docente
  -- quede en dos secciones a la misma hora.
  CREATE TABLE IF NOT EXISTS cursos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grado INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    docenteId INTEGER REFERENCES docentes(id) ON DELETE SET NULL,
    vecesPorSemana INTEGER NOT NULL DEFAULT 2,
    avisoPrevioMin INTEGER NOT NULL DEFAULT 5,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_cursos_grado ON cursos(grado);
`);

// Se activa después de crear las tablas (no antes: si se activara antes de
// que existan, no cambia nada en SQLite, pero conceptualmente el orden
// correcto es "esquema listo, luego se exige integridad").
db.exec(`PRAGMA foreign_keys = ON;`);

try {
  // Columna agregada después: en una base ya existente (creada antes de que
  // el perfil incluyera sección), CREATE TABLE IF NOT EXISTS no la agrega
  // sola, así que se intenta aparte y se ignora el error si ya existe.
  db.exec(`ALTER TABLE perfiles ADD COLUMN seccion TEXT NOT NULL DEFAULT 'A'`);
} catch {
  // la columna ya existe, no hay nada que hacer
}

try {
  // Enlaza cada recordatorio repartido (fan-out) con la reunión que lo
  // originó. ON DELETE CASCADE a propósito: si se borra la reunión, ya no
  // tiene sentido que los padres sigan recibiendo el aviso de algo cancelado.
  db.exec(`ALTER TABLE eventos ADD COLUMN reunionId INTEGER REFERENCES reuniones(id) ON DELETE CASCADE`);
} catch {
  // la columna ya existe, no hay nada que hacer
}

try {
  // Grado que dicta el docente (1-5) — histórico, reemplazado por `grados`
  // (ver abajo) porque un docente puede dictar cursos en varios grados a la
  // vez, no solo uno. Se deja la columna vieja sin usar (aditivo, nunca se
  // borran columnas) en vez de migrarla con ALTER TABLE ... DROP COLUMN.
  db.exec(`ALTER TABLE docentes ADD COLUMN grado INTEGER`);
} catch {
  // la columna ya existe, no hay nada que hacer
}

try {
  // Lista de grados que dicta el docente, en JSON (ej. "[1,3,5]") — mismo
  // patrón que `eventos.dias`/`plantilla_horario.dias`. Default '[]' para
  // que una base ya existente no rompa al leer antes del backfill. La
  // validación de "al menos un grado, cada uno 1-5" vive en la ruta de la
  // API; acá no hay CHECK a propósito, igual que el resto de las tablas.
  db.exec(`ALTER TABLE docentes ADD COLUMN grados TEXT NOT NULL DEFAULT '[]'`);
} catch {
  // la columna ya existe, no hay nada que hacer
}
