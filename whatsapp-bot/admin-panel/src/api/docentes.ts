import { api } from "./client";
import type { Docente } from "./tipos";

export interface DatosDocente {
  nombre: string;
  materia?: string | null;
  contacto?: string | null;
  grado: number | null;
}

export const docentesApi = {
  listar: (grado?: number) => {
    const query = grado !== undefined ? `?grado=${grado}` : "";
    return api.get<Docente[]>(`/docentes${query}`);
  },
  crear: (datos: DatosDocente) => api.post<Docente>("/docentes", datos),
  actualizar: (id: number, datos: DatosDocente) => api.put<Docente>(`/docentes/${id}`, datos),
  eliminar: (id: number) => api.delete<void>(`/docentes/${id}`),
};
