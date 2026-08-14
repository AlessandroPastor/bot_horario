import { api } from "./client";
import type { FechaCivica } from "./tipos";

export interface DatosFecha {
  titulo: string;
  fecha: string;
}

export const calendarioApi = {
  listar: () => api.get<FechaCivica[]>("/calendario-civico"),
  crear: (datos: DatosFecha) => api.post<FechaCivica>("/calendario-civico", datos),
  actualizar: (id: number, datos: DatosFecha) =>
    api.put<FechaCivica>(`/calendario-civico/${id}`, datos),
  eliminar: (id: number) => api.delete<void>(`/calendario-civico/${id}`),
};
