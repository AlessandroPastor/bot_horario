import { db } from "./db.js";

export interface Perfil {
  grado: number;
  seccion: string;
}

export function obtenerPerfil(chatId: string): Perfil | null {
  const row = db
    .prepare(`SELECT grado, seccion FROM perfiles WHERE chatId = ?`)
    .get(chatId) as { grado: number; seccion: string } | undefined;
  return row ? { grado: row.grado, seccion: row.seccion } : null;
}

export function guardarPerfil(chatId: string, grado: number, seccion: string): void {
  db.prepare(
    `INSERT INTO perfiles (chatId, grado, seccion) VALUES (?, ?, ?)
     ON CONFLICT(chatId) DO UPDATE SET grado = excluded.grado, seccion = excluded.seccion`,
  ).run(chatId, grado, seccion);
}
