import { api } from "./client";
import type { Curso, ResultadoGeneracion } from "./tipos";

export interface DatosCurso {
  grado: number;
  nombre: string;
  docenteId?: number | null;
  vecesPorSemana?: number;
  avisoPrevioMin?: number;
}

export const cursosApi = {
  listar: (grado?: number) => {
    const query = grado !== undefined ? `?grado=${grado}` : "";
    return api.get<Curso[]>(`/cursos${query}`);
  },
  crear: (datos: DatosCurso) => api.post<Curso>("/cursos", datos),
  actualizar: (id: number, datos: DatosCurso) => api.put<Curso>(`/cursos/${id}`, datos),
  eliminar: (id: number) => api.delete<void>(`/cursos/${id}`),
  generarHorario: (grado: number) =>
    api.post<ResultadoGeneracion>("/cursos/generar-horario", { grado }),
};
