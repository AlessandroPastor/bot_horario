import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../api/auth";

export function useSesion() {
  return useQuery({ queryKey: ["sesion"], queryFn: authApi.sesion });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ usuario, contrasena }: { usuario: string; contrasena: string }) =>
      authApi.login(usuario, contrasena),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sesion"] }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sesion"] }),
  });
}
