import { api } from "./client";

export interface EstadoWhatsApp {
  conectado: boolean;
  tieneQR: boolean;
}

export interface ResultadoDesvincular {
  ok: boolean;
  mensaje: string;
}

export const whatsappApi = {
  estado: () => api.get<EstadoWhatsApp>("/whatsapp/estado"),
  desvincular: () => api.post<ResultadoDesvincular>("/whatsapp/desvincular"),
};
