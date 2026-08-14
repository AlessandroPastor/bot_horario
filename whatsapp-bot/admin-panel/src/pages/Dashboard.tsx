import { useState } from "react";
import { Badge, Button, Card, Group, Image, Modal, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IconBook2,
  IconCalendarEvent,
  IconMessage,
  IconSchool,
  IconUsers,
  IconUsersGroup,
  type TablerIcon,
} from "@tabler/icons-react";
import { resumenApi } from "../api/auth";
import { whatsappApi } from "../api/whatsapp";

interface TarjetaProps {
  icon: TablerIcon;
  valor: number | string;
  etiqueta: string;
  color: string;
}

function Tarjeta({ icon: Icon, valor, etiqueta, color }: TarjetaProps) {
  return (
    <Card withBorder radius="md" padding="lg">
      <Group justify="space-between">
        <div>
          <Text c="dimmed" size="sm">
            {etiqueta}
          </Text>
          <Text fw={700} size="xl">
            {valor}
          </Text>
        </div>
        <Icon size={32} color={`var(--mantine-color-${color}-6)`} />
      </Group>
    </Card>
  );
}

function ConexionWhatsApp() {
  const qc = useQueryClient();
  const [modalAbierto, setModalAbierto] = useState(false);

  // Se refresca solo cada pocos segundos: así, apenas se desvincula, el QR
  // nuevo aparece sin que el admin tenga que recargar la página a mano.
  const { data: estado } = useQuery({
    queryKey: ["whatsapp-estado"],
    queryFn: whatsappApi.estado,
    refetchInterval: 4000,
  });

  const desvincular = useMutation({
    mutationFn: whatsappApi.desvincular,
    onSuccess: (res) => {
      notifications.show({ message: res.mensaje, color: "yellow" });
      qc.invalidateQueries({ queryKey: ["whatsapp-estado"] });
      setModalAbierto(false);
    },
  });

  return (
    <Card withBorder radius="md" padding="lg" mt="lg">
      <Group justify="space-between" mb={estado?.conectado ? 0 : "md"}>
        <Text fw={600}>Conexión de WhatsApp</Text>
        <Badge color={estado?.conectado ? "green" : "red"} variant="light">
          {estado?.conectado ? "Conectado" : "Desconectado"}
        </Badge>
      </Group>

      {!estado?.conectado && (
        <Stack align="center" mb="md" gap="xs">
          {estado?.tieneQR ? (
            <>
              <Text size="sm" c="dimmed" ta="center">
                Escanea este código desde WhatsApp (Ajustes → Dispositivos vinculados → Vincular un dispositivo):
              </Text>
              {/* cache-busting con Date.now(): si se generó un QR nuevo, que no muestre el viejo desde caché */}
              <Image src={`/api/whatsapp/qr?t=${Date.now()}`} w={220} radius="sm" alt="Código QR de WhatsApp" />
            </>
          ) : (
            <Text size="sm" c="dimmed" ta="center">
              Generando un código QR nuevo... espera unos segundos.
            </Text>
          )}
        </Stack>
      )}

      <Button
        color="red"
        variant="light"
        disabled={!estado?.conectado}
        onClick={() => setModalAbierto(true)}
      >
        Desvincular WhatsApp
      </Button>

      <Modal opened={modalAbierto} onClose={() => setModalAbierto(false)} title="¿Desvincular WhatsApp?">
        <Text size="sm" mb="md">
          Esto cierra la sesión actual y borra los datos guardados de este número en el bot. Vas a necesitar
          escanear un código QR nuevo (con el mismo número u otro) para que el bot vuelva a funcionar.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setModalAbierto(false)}>
            Cancelar
          </Button>
          <Button color="red" loading={desvincular.isPending} onClick={() => desvincular.mutate()}>
            Sí, desvincular
          </Button>
        </Group>
      </Modal>
    </Card>
  );
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["resumen"], queryFn: resumenApi.obtener });

  return (
    <>
      <Title order={2} mb="lg">
        Dashboard
      </Title>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
        <Tarjeta icon={IconUsers} etiqueta="Docentes" valor={isLoading ? "…" : (data?.docentes ?? 0)} color="grape" />
        <Tarjeta icon={IconBook2} etiqueta="Cursos" valor={isLoading ? "…" : (data?.cursos ?? 0)} color="cyan" />
        <Tarjeta
          icon={IconSchool}
          etiqueta="Secciones con horario"
          valor={isLoading ? "…" : `${data?.combosConHorario ?? 0} / ${data?.combosTotales ?? 25}`}
          color="blue"
        />
        <Tarjeta
          icon={IconCalendarEvent}
          etiqueta="Fechas del calendario cívico"
          valor={isLoading ? "…" : (data?.fechasCivicas ?? 0)}
          color="teal"
        />
        <Tarjeta
          icon={IconMessage}
          etiqueta="Chats registrados"
          valor={isLoading ? "…" : (data?.chatsRegistrados ?? 0)}
          color="orange"
        />
        <Tarjeta
          icon={IconUsersGroup}
          etiqueta="Reuniones de padres"
          valor={isLoading ? "…" : (data?.reuniones ?? 0)}
          color="grape"
        />
      </SimpleGrid>

      <ConexionWhatsApp />
    </>
  );
}
