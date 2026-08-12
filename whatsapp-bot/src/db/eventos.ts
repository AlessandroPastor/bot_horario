import { db } from "./db.js";

export type DiaSemana = "lun" | "mar" | "mie" | "jue" | "vie" | "sab" | "dom";
export type TipoEvento = "recurrente_LV" | "recurrente_semanal" | "puntual";

export const DIAS_LV: DiaSemana[] = ["lun", "mar", "mie", "jue", "vie"];

export interface Evento {
  id: number;
  titulo: string;
  descripcion: string | null;
  chatId: string;
  tipo: TipoEvento;
  dias: DiaSemana[] | null;
  fecha: string | null;
  hora: string;
  avisoPrevioMin: number;
  activo: boolean;
  ultimoEnvio: string | null;
  createdAt: string;
}

interface EventoRow {
  id: number;
  titulo: string;
  descripcion: string | null;
  chatId: string;
  tipo: TipoEvento;
  dias: string | null;
  fecha: string | null;
  hora: string;
  avisoPrevioMin: number;
  activo: number;
  ultimoEnvio: string | null;
  createdAt: string;
}

function rowToEvento(row: EventoRow): Evento {
  return {
    ...row,
    dias: row.dias ? (JSON.parse(row.dias) as DiaSemana[]) : null,
    activo: row.activo === 1,
  };
}

export interface NuevoEvento {
  titulo: string;
  descripcion?: string | null;
  chatId: string;
  tipo: TipoEvento;
  dias?: DiaSemana[] | null;
  fecha?: string | null;
  hora: string;
  avisoPrevioMin?: number;
}

export function crearEvento(input: NuevoEvento): Evento {
  const stmt = db.prepare(`
    INSERT INTO eventos (titulo, descripcion, chatId, tipo, dias, fecha, hora, avisoPrevioMin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    input.titulo,
    input.descripcion ?? null,
    input.chatId,
    input.tipo,
    input.dias ? JSON.stringify(input.dias) : null,
    input.fecha ?? null,
    input.hora,
    input.avisoPrevioMin ?? 0,
  );
  return obtenerEvento(Number(result.lastInsertRowid), input.chatId)!;
}

export function listarEventos(
  chatId: string,
  opts: { soloActivos?: boolean } = {},
): Evento[] {
  const query = opts.soloActivos
    ? `SELECT * FROM eventos WHERE chatId = ? AND activo = 1 ORDER BY hora ASC`
    : `SELECT * FROM eventos WHERE chatId = ? ORDER BY hora ASC`;
  const rows = db.prepare(query).all(chatId) as unknown as EventoRow[];
  return rows.map(rowToEvento);
}

export function listarTodosActivos(): Evento[] {
  const rows = db
    .prepare(`SELECT * FROM eventos WHERE activo = 1`)
    .all() as unknown as EventoRow[];
  return rows.map(rowToEvento);
}

export function obtenerEvento(id: number, chatId: string): Evento | null {
  const row = db
    .prepare(`SELECT * FROM eventos WHERE id = ? AND chatId = ?`)
    .get(id, chatId) as unknown as EventoRow | undefined;
  return row ? rowToEvento(row) : null;
}

export function eliminarEvento(id: number, chatId: string): boolean {
  const result = db
    .prepare(`DELETE FROM eventos WHERE id = ? AND chatId = ?`)
    .run(id, chatId);
  return result.changes > 0;
}

export function pausarEvento(id: number, chatId: string): boolean {
  const result = db
    .prepare(`UPDATE eventos SET activo = 0 WHERE id = ? AND chatId = ?`)
    .run(id, chatId);
  return result.changes > 0;
}

export function reactivarEvento(id: number, chatId: string): boolean {
  const result = db
    .prepare(`UPDATE eventos SET activo = 1 WHERE id = ? AND chatId = ?`)
    .run(id, chatId);
  return result.changes > 0;
}

export function marcarEnviadoHoy(id: number, fechaISO: string): void {
  db.prepare(`UPDATE eventos SET ultimoEnvio = ? WHERE id = ?`).run(
    fechaISO,
    id,
  );
  db.prepare(
    `UPDATE eventos SET activo = 0 WHERE id = ? AND tipo = 'puntual'`,
  ).run(id);
}
