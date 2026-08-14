import { db } from "./db.js";

export interface FechaCivica {
  id: number;
  titulo: string;
  fecha: string;
  createdAt: string;
  updatedAt: string;
}

export interface NuevaFechaCivica {
  titulo: string;
  fecha: string;
}

export function crearFechaCivica(input: NuevaFechaCivica): FechaCivica {
  const result = db
    .prepare(`INSERT INTO calendario_civico (titulo, fecha) VALUES (?, ?)`)
    .run(input.titulo, input.fecha);
  return obtenerFechaCivica(Number(result.lastInsertRowid))!;
}

export function listarCalendarioCivico(): FechaCivica[] {
  return db
    .prepare(`SELECT * FROM calendario_civico ORDER BY fecha ASC`)
    .all() as unknown as FechaCivica[];
}

export function obtenerFechaCivica(id: number): FechaCivica | null {
  const row = db.prepare(`SELECT * FROM calendario_civico WHERE id = ?`).get(id) as
    | FechaCivica
    | undefined;
  return row ?? null;
}

export function actualizarFechaCivica(id: number, input: NuevaFechaCivica): boolean {
  const result = db
    .prepare(
      `UPDATE calendario_civico SET titulo = ?, fecha = ?, updatedAt = datetime('now') WHERE id = ?`,
    )
    .run(input.titulo, input.fecha, id);
  return result.changes > 0;
}

export function eliminarFechaCivica(id: number): boolean {
  const result = db.prepare(`DELETE FROM calendario_civico WHERE id = ?`).run(id);
  return result.changes > 0;
}
