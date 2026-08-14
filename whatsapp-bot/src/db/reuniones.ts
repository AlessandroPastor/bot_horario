import { db } from "./db.js";
import { crearEvento } from "./eventos.js";
import { listarChatsPorGradoSeccion } from "./perfiles.js";

export interface Reunion {
  id: number;
  titulo: string;
  fecha: string;
  hora: string;
  lugar: string | null;
  /** null = aplica a todos los grados. */
  grado: number | null;
  /** null = aplica a todas las secciones (de ese grado, o de todo el colegio si grado también es null). */
  seccion: string | null;
  avisoPrevioMin: number;
  createdAt: string;
  updatedAt: string;
}

export interface NuevaReunion {
  titulo: string;
  fecha: string;
  hora: string;
  lugar?: string | null;
  grado?: number | null;
  seccion?: string | null;
  avisoPrevioMin?: number;
}

function repartirReunion(reunion: Reunion): number {
  const chats = listarChatsPorGradoSeccion(reunion.grado, reunion.seccion);
  for (const chatId of chats) {
    crearEvento({
      titulo: reunion.titulo,
      descripcion: reunion.lugar ? `Reunión de padres — ${reunion.lugar}` : "Reunión de padres",
      chatId,
      tipo: "puntual",
      fecha: reunion.fecha,
      hora: reunion.hora,
      avisoPrevioMin: reunion.avisoPrevioMin,
      reunionId: reunion.id,
    });
  }
  return chats.length;
}

function quitarRecordatoriosRepartidos(reunionId: number): void {
  db.prepare(`DELETE FROM eventos WHERE reunionId = ?`).run(reunionId);
}

/** Crea la reunión y de inmediato reparte un recordatorio a los chats ya registrados que calcen (grado/sección, o todos). Devuelve la reunión y a cuántos chats se les avisó. */
export function crearReunion(input: NuevaReunion): { reunion: Reunion; avisados: number } {
  const result = db
    .prepare(
      `INSERT INTO reuniones (titulo, fecha, hora, lugar, grado, seccion, avisoPrevioMin)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.titulo,
      input.fecha,
      input.hora,
      input.lugar ?? null,
      input.grado ?? null,
      input.seccion ?? null,
      input.avisoPrevioMin ?? 60,
    );
  const reunion = obtenerReunion(Number(result.lastInsertRowid))!;
  const avisados = repartirReunion(reunion);
  return { reunion, avisados };
}

export function listarReuniones(): Reunion[] {
  return db
    .prepare(`SELECT * FROM reuniones ORDER BY fecha ASC, hora ASC`)
    .all() as unknown as Reunion[];
}

export function obtenerReunion(id: number): Reunion | null {
  const row = db.prepare(`SELECT * FROM reuniones WHERE id = ?`).get(id) as Reunion | undefined;
  return row ?? null;
}

/** Actualiza la reunión y vuelve a repartirla desde cero (borra los recordatorios ya repartidos y crea los nuevos), para no tener que adivinar qué cambió. */
export function actualizarReunion(
  id: number,
  input: NuevaReunion,
): { actualizada: boolean; avisados: number } {
  const result = db
    .prepare(
      `UPDATE reuniones
       SET titulo = ?, fecha = ?, hora = ?, lugar = ?, grado = ?, seccion = ?, avisoPrevioMin = ?, updatedAt = datetime('now')
       WHERE id = ?`,
    )
    .run(
      input.titulo,
      input.fecha,
      input.hora,
      input.lugar ?? null,
      input.grado ?? null,
      input.seccion ?? null,
      input.avisoPrevioMin ?? 60,
      id,
    );
  if (result.changes === 0) return { actualizada: false, avisados: 0 };

  quitarRecordatoriosRepartidos(id);
  const reunion = obtenerReunion(id)!;
  const avisados = repartirReunion(reunion);
  return { actualizada: true, avisados };
}

/** Borra la reunión. Los recordatorios ya repartidos se borran solos (ON DELETE CASCADE en eventos.reunionId). */
export function eliminarReunion(id: number): boolean {
  const result = db.prepare(`DELETE FROM reuniones WHERE id = ?`).run(id);
  return result.changes > 0;
}
