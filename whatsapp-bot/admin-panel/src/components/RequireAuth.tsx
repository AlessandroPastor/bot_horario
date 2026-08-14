import { Center, Loader } from "@mantine/core";
import { Navigate, Outlet } from "react-router-dom";
import { useSesion } from "../hooks/useSesion";

export function RequireAuth() {
  const { data, isLoading } = useSesion();

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (!data?.autenticado) return <Navigate to="/login" replace />;

  return <Outlet />;
}
