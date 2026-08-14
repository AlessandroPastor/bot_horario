import { useState } from "react";
import {
  ActionIcon,
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { reunionesApi, type DatosReunion } from "../api/reuniones";
import { GRADOS, SECCIONES, type Reunion } from "../api/tipos";

const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;
const HORA_VALIDA = /^([01]\d|2[0-3]):([0-5]\d)$/;

interface ValoresFormulario {
  titulo: string;
  fecha: string;
  hora: string;
  lugar: string;
  grado: string; // "todos" | "1".."5"
  seccion: string; // "todos" | "A".."E"
  avisoPrevioMin: number;
}

const VALORES_INICIALES: ValoresFormulario = {
  titulo: "",
  fecha: "",
  hora: "18:00",
  lugar: "",
  grado: "todos",
  seccion: "todos",
  avisoPrevioMin: 60,
};

function destinoLegible(r: Reunion): string {
  if (r.grado === null) return "Todo el colegio";
  if (r.seccion === null) return `${r.grado}° (todas las secciones)`;
  return `${r.grado}°${r.seccion}`;
}

export function ReunionesPage() {
  const qc = useQueryClient();
  const { data: reuniones, isLoading } = useQuery({ queryKey: ["reuniones"], queryFn: reunionesApi.listar });
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Reunion | null>(null);

  const form = useForm<ValoresFormulario>({
    initialValues: VALORES_INICIALES,
    validate: {
      titulo: (v) => (v.trim() ? null : "Obligatorio"),
      fecha: (v) => (FECHA_VALIDA.test(v) ? null : "Formato AAAA-MM-DD"),
      hora: (v) => (HORA_VALIDA.test(v) ? null : "Formato HH:mm"),
    },
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["reuniones"] });
    qc.invalidateQueries({ queryKey: ["resumen"] });
  }

  const crear = useMutation({
    mutationFn: reunionesApi.crear,
    onSuccess: (res) => {
      invalidar();
      notifications.show({ message: `Reunión creada. Se avisó a ${res.avisados} chat(s).`, color: "green" });
      cerrarModal();
    },
  });

  const actualizar = useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: DatosReunion }) => reunionesApi.actualizar(id, datos),
    onSuccess: (res) => {
      invalidar();
      notifications.show({ message: `Reunión actualizada. Se avisó a ${res.avisados} chat(s).`, color: "green" });
      cerrarModal();
    },
  });

  const eliminar = useMutation({
    mutationFn: reunionesApi.eliminar,
    onSuccess: () => {
      invalidar();
      notifications.show({ message: "Reunión eliminada (y sus recordatorios ya enviados).", color: "green" });
    },
  });

  function abrirNueva() {
    setEditando(null);
    form.setValues(VALORES_INICIALES);
    setModalAbierto(true);
  }

  function abrirEditar(reunion: Reunion) {
    setEditando(reunion);
    form.setValues({
      titulo: reunion.titulo,
      fecha: reunion.fecha,
      hora: reunion.hora,
      lugar: reunion.lugar ?? "",
      grado: reunion.grado === null ? "todos" : String(reunion.grado),
      seccion: reunion.seccion === null ? "todos" : reunion.seccion,
      avisoPrevioMin: reunion.avisoPrevioMin,
    });
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setEditando(null);
  }

  function guardar(valores: ValoresFormulario) {
    const datos: DatosReunion = {
      titulo: valores.titulo.trim(),
      fecha: valores.fecha,
      hora: valores.hora,
      lugar: valores.lugar.trim() || null,
      grado: valores.grado === "todos" ? null : Number(valores.grado),
      seccion: valores.grado === "todos" || valores.seccion === "todos" ? null : valores.seccion,
      avisoPrevioMin: valores.avisoPrevioMin,
    };
    if (editando) actualizar.mutate({ id: editando.id, datos });
    else crear.mutate(datos);
  }

  return (
    <>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Reuniones de padres</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNueva}>
          Nueva reunión
        </Button>
      </Group>

      <Text c="dimmed" size="sm" mb="md">
        Al crear o editar una reunión, se avisa de inmediato (como recordatorio de WhatsApp) a los chats ya
        registrados que calcen con el grado/sección elegidos.
      </Text>

      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Fecha</Table.Th>
            <Table.Th>Título</Table.Th>
            <Table.Th>Lugar</Table.Th>
            <Table.Th>Para</Table.Th>
            <Table.Th>Aviso previo</Table.Th>
            <Table.Th w={100} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {reuniones?.map((r) => (
            <Table.Tr key={r.id}>
              <Table.Td>
                {r.fecha} {r.hora}
              </Table.Td>
              <Table.Td>{r.titulo}</Table.Td>
              <Table.Td>{r.lugar ?? "—"}</Table.Td>
              <Table.Td>{destinoLegible(r)}</Table.Td>
              <Table.Td>{r.avisoPrevioMin} min</Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <ActionIcon variant="subtle" onClick={() => abrirEditar(r)} aria-label="Editar">
                    <IconPencil size={16} />
                  </ActionIcon>
                  <ActionIcon variant="subtle" color="red" onClick={() => eliminar.mutate(r.id)} aria-label="Eliminar">
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {!isLoading && reuniones?.length === 0 && (
        <Text c="dimmed" ta="center" mt="lg">
          No hay reuniones programadas todavía.
        </Text>
      )}

      <Modal opened={modalAbierto} onClose={cerrarModal} title={editando ? "Editar reunión" : "Nueva reunión"}>
        <form onSubmit={form.onSubmit(guardar)}>
          <Stack>
            <TextInput label="Título" required placeholder="Reunión de padres — 1er bimestre" {...form.getInputProps("titulo")} />
            <Group grow>
              <TextInput label="Fecha (AAAA-MM-DD)" required placeholder="2026-09-10" {...form.getInputProps("fecha")} />
              <TextInput label="Hora (HH:mm)" required placeholder="18:00" {...form.getInputProps("hora")} />
            </Group>
            <TextInput label="Lugar (opcional)" placeholder="Auditorio, Aula 302..." {...form.getInputProps("lugar")} />
            <Group grow>
              <Select
                label="Grado"
                data={[{ value: "todos", label: "Todos" }, ...GRADOS.map((g) => ({ value: String(g), label: `${g}°` }))]}
                allowDeselect={false}
                {...form.getInputProps("grado")}
                onChange={(v) => {
                  form.setFieldValue("grado", v ?? "todos");
                  if (v === "todos") form.setFieldValue("seccion", "todos");
                }}
              />
              <Select
                label="Sección"
                data={[{ value: "todos", label: "Todas" }, ...SECCIONES.map((s) => ({ value: s, label: s }))]}
                disabled={form.values.grado === "todos"}
                allowDeselect={false}
                {...form.getInputProps("seccion")}
              />
            </Group>
            <NumberInput label="Minutos de aviso previo" min={0} max={10080} {...form.getInputProps("avisoPrevioMin")} />
            <Button type="submit" loading={crear.isPending || actualizar.isPending}>
              Guardar {editando ? "y re-avisar" : "y avisar"}
            </Button>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
