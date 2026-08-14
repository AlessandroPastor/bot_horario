import { api } from "./client";
import type { Resumen } from "./tipos";

export const authApi = {
  login: (usuario: string, contrasena: string) =>
    api.post<{ autenticado: boolean }>("/admin/login", { usuario, contrasena }),
  logout: () => api.post<{ autenticado: boolean }>("/admin/logout"),
  sesion: () => api.get<{ autenticado: boolean }>("/admin/session"),
};

export const resumenApi = {
  obtener: () => api.get<Resumen>("/resumen"),
};
