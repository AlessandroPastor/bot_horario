import { useState } from "react";
import { ActionIcon, Button, Group, Modal, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { calendarioApi, type DatosFecha } from "../api/calendarioCivico";
import type { FechaCivica } from "../api/tipos";
import { fechaAISO, isoAFecha } from "../utils/fecha";

export function CalendarioPage() {
  const qc = useQueryClient();
  const { data: fechas, isLoading } = useQuery({ queryKey: ["calendario"], queryFn: calendarioApi.listar });
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<FechaCivica | null>(null);

  const form = useForm<DatosFecha>({
    initialValues: { titulo: "", fecha: "" },
    validate: {
      titulo: (v) => (v.trim() ? null : "Obligatorio"),
      fecha: (v) => (v ? null : "Elige una fecha"),
    },
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["calendario"] });
    qc.invalidateQueries({ queryKey: ["resumen"] });
  }

  const crear = useMutation({
    mutationFn: calendarioApi.crear,
    onSuccess: () => {
      invalidar();
      notifications.show({ message: "Fecha creada.", color: "green" });
      cerrarModal();
    },
  });

  const actualizar = useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: DatosFecha }) => calendarioApi.actualizar(id, datos),
    onSuccess: () => {
      invalidar();
      notifications.show({ message: "Fecha actualizada.", color: "green" });
      cerrarModal();
    },
  });

  const eliminar = useMutation({
    mutationFn: calendarioApi.eliminar,
    onSuccess: () => {
      invalidar();
      notifications.show({ message: "Fecha eliminada.", color: "green" });
    },
  });

  function abrirNueva() {
    setEditando(null);
    form.setValues({ titulo: "", fecha: "" });
    setModalAbierto(true);
  }

  function abrirEditar(fecha: FechaCivica) {
    setEditando(fecha);
    form.setValues({ titulo: fecha.titulo, fecha: fecha.fecha });
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setEditando(null);
  }

  function guardar(valores: DatosFecha) {
    if (editando) actualizar.mutate({ id: editando.id, datos: valores });
    else crear.mutate(valores);
  }

  return (
    <>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Calendario cívico</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNueva}>
          Nueva fecha
        </Button>
      </Group>

      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Fecha</Table.Th>
            <Table.Th>Título</Table.Th>
            <Table.Th w={100} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {fechas?.map((f) => (
            <Table.Tr key={f.id}>
              <Table.Td>{f.fecha}</Table.Td>
              <Table.Td>{f.titulo}</Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <ActionIcon variant="subtle" onClick={() => abrirEditar(f)} aria-label="Editar">
                    <IconPencil size={16} />
                  </ActionIcon>
                  <ActionIcon variant="subtle" color="red" onClick={() => eliminar.mutate(f.id)} aria-label="Eliminar">
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {!isLoading && fechas?.length === 0 && (
        <Text c="dimmed" ta="center" mt="lg">
          No hay fechas en el calendario cívico todavía.
        </Text>
      )}

      <Modal opened={modalAbierto} onClose={cerrarModal} title={editando ? "Editar fecha" : "Nueva fecha"}>
        <form onSubmit={form.onSubmit(guardar)}>
          <Stack>
            <TextInput label="Título" required {...form.getInputProps("titulo")} />
            <DateInput
              label="Fecha"
              required
              placeholder="Elige una fecha"
              valueFormat="D [de] MMMM [de] YYYY"
              clearable
              value={isoAFecha(form.values.fecha)}
              onChange={(v) => form.setFieldValue("fecha", fechaAISO(v))}
              error={form.errors.fecha}
            />
            <Button type="submit" loading={crear.isPending || actualizar.isPending}>
              Guardar
            </Button>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
