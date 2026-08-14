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

/** Cuántos chats se registraron (tienen grado+sección guardados). Para el dashboard del panel de admin. */
export function contarPerfilesRegistrados(): number {
  const row = db.prepare(`SELECT COUNT(*) as n FROM perfiles`).get() as { n: number };
  return row.n;
}

/**
 * Chats registrados que calzan con el grado/sección dado. `grado`/`seccion`
 * en null significa "todos" (ej. para repartir una reunión a todo el
 * colegio, o a todas las secciones de un grado).
 */
export function listarChatsPorGradoSeccion(grado: number | null, seccion: string | null): string[] {
  let query = `SELECT chatId FROM perfiles WHERE 1 = 1`;
  const params: (number | string)[] = [];
  if (grado !== null) {
    query += ` AND grado = ?`;
    params.push(grado);
  }
  if (seccion !== null) {
    query += ` AND seccion = ?`;
    params.push(seccion);
  }
  const rows = db.prepare(query).all(...params) as unknown as { chatId: string }[];
  return rows.map((r) => r.chatId);
}
