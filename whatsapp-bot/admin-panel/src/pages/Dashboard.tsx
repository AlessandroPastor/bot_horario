import { Card, Group, SimpleGrid, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
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
    </>
  );
}
