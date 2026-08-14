import { useState } from "react";
import { ActionIcon, Button, Group, Modal, Select, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { docentesApi, type DatosDocente } from "../api/docentes";
import { GRADOS, type Docente } from "../api/tipos";

interface ValoresFormulario {
  nombre: string;
  materia: string;
  contacto: string;
  grado: string; // valor del Select, se convierte a número al guardar
}

const VALORES_INICIALES: ValoresFormulario = { nombre: "", materia: "", contacto: "", grado: "" };

export function DocentesPage() {
  const qc = useQueryClient();
  const [filtroGrado, setFiltroGrado] = useState<string | null>(null);
  const { data: docentes, isLoading } = useQuery({
    queryKey: ["docentes", filtroGrado],
    queryFn: () => docentesApi.listar(filtroGrado ? Number(filtroGrado) : undefined),
  });
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Docente | null>(null);

  const form = useForm<ValoresFormulario>({
    initialValues: VALORES_INICIALES,
    validate: {
      nombre: (v) => (v.trim() ? null : "Obligatorio"),
      grado: (v) => (v ? null : "Elige el grado que dicta"),
    },
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["docentes"] });
    qc.invalidateQueries({ queryKey: ["plantilla"] });
    qc.invalidateQueries({ queryKey: ["cursos"] });
  }

  const crear = useMutation({
    mutationFn: docentesApi.crear,
    onSuccess: () => {
      invalidar();
      notifications.show({ message: "Docente creado.", color: "green" });
      cerrarModal();
    },
  });

  const actualizar = useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: DatosDocente }) => docentesApi.actualizar(id, datos),
    onSuccess: () => {
      invalidar();
      notifications.show({ message: "Docente actualizado.", color: "green" });
      cerrarModal();
    },
  });

  const eliminar = useMutation({
    mutationFn: docentesApi.eliminar,
    onSuccess: () => {
      invalidar();
      notifications.show({ message: "Docente eliminado.", color: "green" });
    },
  });

  function abrirNuevo() {
    setEditando(null);
    form.setValues(VALORES_INICIALES);
    setModalAbierto(true);
  }

  function abrirEditar(docente: Docente) {
    setEditando(docente);
    form.setValues({
      nombre: docente.nombre,
      materia: docente.materia ?? "",
      contacto: docente.contacto ?? "",
      grado: docente.grado ? String(docente.grado) : "",
    });
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setEditando(null);
  }

  function guardar(valores: ValoresFormulario) {
    const datos: DatosDocente = {
      nombre: valores.nombre.trim(),
      materia: valores.materia.trim() || null,
      contacto: valores.contacto.trim() || null,
      grado: Number(valores.grado),
    };
    if (editando) actualizar.mutate({ id: editando.id, datos });
    else crear.mutate(datos);
  }

  return (
    <>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Docentes</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNuevo}>
          Nuevo docente
        </Button>
      </Group>

      <Group mb="md">
        <Select
          label="Filtrar por grado"
          placeholder="Todos"
          data={GRADOS.map((g) => ({ value: String(g), label: `${g}°` }))}
          value={filtroGrado}
          onChange={setFiltroGrado}
          clearable
          w={140}
        />
      </Group>

      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nombre</Table.Th>
            <Table.Th>Grado</Table.Th>
            <Table.Th>Materia</Table.Th>
            <Table.Th>Contacto</Table.Th>
            <Table.Th w={100} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {docentes?.map((d) => (
            <Table.Tr key={d.id}>
              <Table.Td>{d.nombre}</Table.Td>
              <Table.Td>{d.grado ? `${d.grado}°` : "— (sin asignar)"}</Table.Td>
              <Table.Td>{d.materia ?? "—"}</Table.Td>
              <Table.Td>{d.contacto ?? "—"}</Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <ActionIcon variant="subtle" onClick={() => abrirEditar(d)} aria-label="Editar">
                    <IconPencil size={16} />
                  </ActionIcon>
                  <ActionIcon variant="subtle" color="red" onClick={() => eliminar.mutate(d.id)} aria-label="Eliminar">
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {!isLoading && docentes?.length === 0 && (
        <Text c="dimmed" ta="center" mt="lg">
          {filtroGrado ? `Ningún docente asignado a ${filtroGrado}°.` : "Todavía no hay docentes registrados."}
        </Text>
      )}

      <Modal opened={modalAbierto} onClose={cerrarModal} title={editando ? "Editar docente" : "Nuevo docente"}>
        <form onSubmit={form.onSubmit(guardar)}>
          <Stack>
            <TextInput label="Nombre" required {...form.getInputProps("nombre")} />
            <Select
              label="Grado que dicta"
              required
              placeholder="Elige un grado"
              data={GRADOS.map((g) => ({ value: String(g), label: `${g}°` }))}
              allowDeselect={false}
              {...form.getInputProps("grado")}
            />
            <TextInput label="Materia / área" {...form.getInputProps("materia")} />
            <TextInput label="Contacto (opcional)" {...form.getInputProps("contacto")} />
            <Button type="submit" loading={crear.isPending || actualizar.isPending}>
              Guardar
            </Button>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
