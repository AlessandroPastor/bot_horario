import { api } from "./client";
import type { Reunion } from "./tipos";

export interface DatosReunion {
  titulo: string;
  fecha: string;
  hora: string;
  lugar?: string | null;
  grado?: number | null;
  seccion?: string | null;
  avisoPrevioMin?: number;
}

export type ReunionConAviso = Reunion & { avisados: number };

export const reunionesApi = {
  listar: () => api.get<Reunion[]>("/reuniones"),
  crear: (datos: DatosReunion) => api.post<ReunionConAviso>("/reuniones", datos),
  actualizar: (id: number, datos: DatosReunion) =>
    api.put<ReunionConAviso>(`/reuniones/${id}`, datos),
  eliminar: (id: number) => api.delete<void>(`/reuniones/${id}`),
};
