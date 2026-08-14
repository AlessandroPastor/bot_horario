import { useState } from "react";
import { Button, Center, Group, Paper, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { IconSchool } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useLogin } from "../hooks/useSesion";

export function LoginPage() {
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const login = useLogin();
  const navigate = useNavigate();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    login.mutate(
      { usuario, contrasena },
      {
        onSuccess: () => navigate("/"),
        onError: (err) =>
          setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión."),
      },
    );
  }

  return (
    <Center h="100vh" bg="var(--mantine-color-gray-0)">
      <Paper withBorder shadow="md" p="xl" radius="md" w={360}>
        <Stack gap="md">
          <div>
            <Group gap="xs">
              <IconSchool size={26} />
              <Title order={2}>Panel Ceneciano</Title>
            </Group>
            <Text c="dimmed" size="sm">
              Colegio Nacional de Cabanillas — administración
            </Text>
          </div>
          <form onSubmit={enviar}>
            <Stack gap="sm">
              <TextInput
                label="Usuario"
                value={usuario}
                onChange={(e) => setUsuario(e.currentTarget.value)}
                required
                autoFocus
              />
              <PasswordInput
                label="Contraseña"
                value={contrasena}
                onChange={(e) => setContrasena(e.currentTarget.value)}
                required
              />
              {error && (
                <Text c="red" size="sm">
                  {error}
                </Text>
              )}
              <Button type="submit" loading={login.isPending} fullWidth mt="sm">
                Entrar
              </Button>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Center>
  );
}
