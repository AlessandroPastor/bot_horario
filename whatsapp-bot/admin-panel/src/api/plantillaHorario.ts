import { api } from "./client";
import type { ClasePlantilla, DiaSemana } from "./tipos";

export interface DatosClase {
  grado: number;
  seccion: string;
  titulo: string;
  hora: string;
  dias: DiaSemana[];
  docenteId?: number | null;
  avisoPrevioMin?: number;
}

export const plantillaApi = {
  listar: (grado?: number, seccion?: string) => {
    const params = new URLSearchParams();
    if (grado !== undefined) params.set("grado", String(grado));
    if (seccion !== undefined) params.set("seccion", seccion);
    const query = params.toString();
    return api.get<ClasePlantilla[]>(`/plantilla-horario${query ? `?${query}` : ""}`);
  },
  crear: (datos: DatosClase) => api.post<ClasePlantilla>("/plantilla-horario", datos),
  actualizar: (id: number, datos: DatosClase) =>
    api.put<ClasePlantilla>(`/plantilla-horario/${id}`, datos),
  eliminar: (id: number) => api.delete<void>(`/plantilla-horario/${id}`),
  clonar: (
    origen: { grado: number; seccion: string },
    destino: { grado: number; seccion: string },
  ) => api.post<{ creadas: number }>("/plantilla-horario/clonar", { origen, destino }),
};
