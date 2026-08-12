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
`);

try {
  // Columna agregada después: en una base ya existente (creada antes de que
  // el perfil incluyera sección), CREATE TABLE IF NOT EXISTS no la agrega
  // sola, así que se intenta aparte y se ignora el error si ya existe.
  db.exec(`ALTER TABLE perfiles ADD COLUMN seccion TEXT NOT NULL DEFAULT 'A'`);
} catch {
  // la columna ya existe, no hay nada que hacer
}
