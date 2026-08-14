import { useState } from "react";
import {
  ActionIcon,
  Alert,
  Button,
  Group,
  List,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconAlertTriangle, IconPencil, IconPlus, IconTrash, IconWand } from "@tabler/icons-react";
import { cursosApi, type DatosCurso } from "../api/cursos";
import { docentesApi } from "../api/docentes";
import { GRADOS, type Curso } from "../api/tipos";

interface ValoresFormulario {
  nombre: string;
  docenteId: string | null;
  vecesPorSemana: number;
  avisoPrevioMin: number;
}

const VALORES_INICIALES: ValoresFormulario = {
  nombre: "",
  docenteId: null,
  vecesPorSemana: 2,
  avisoPrevioMin: 5,
};

export function CursosPage() {
  const qc = useQueryClient();
  const [grado, setGrado] = useState(1);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Curso | null>(null);
  const [avisosGeneracion, setAvisosGeneracion] = useState<string[] | null>(null);

  const { data: cursos, isLoading } = useQuery({
    queryKey: ["cursos", grado],
    queryFn: () => cursosApi.listar(grado),
  });
  // Filtrado por el grado seleccionado acá: con 55 docentes en el colegio,
  // elegir de un desplegable con todos sería impracticable — como cada
  // docente ya dicta un solo grado (ver página Docentes), acá solo tiene
  // sentido mostrar los suyos.
  const { data: docentes } = useQuery({
    queryKey: ["docentes", grado],
    queryFn: () => docentesApi.listar(grado),
  });

  const form = useForm<ValoresFormulario>({
    initialValues: VALORES_INICIALES,
    validate: {
      nombre: (v) => (v.trim() ? null : "Obligatorio"),
    },
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["cursos"] });
    qc.invalidateQueries({ queryKey: ["plantilla"] });
    qc.invalidateQueries({ queryKey: ["resumen"] });
  }

  const crear = useMutation({
    mutationFn: (datos: DatosCurso) => cursosApi.crear(datos),
    onSuccess: () => {
      invalidar();
      notifications.show({ message: "Curso creado.", color: "green" });
      cerrarModal();
    },
  });
  const actualizar = useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: DatosCurso }) => cursosApi.actualizar(id, datos),
    onSuccess: () => {
      invalidar();
      notifications.show({ message: "Curso actualizado.", color: "green" });
      cerrarModal();
    },
  });
  const eliminar = useMutation({
    mutationFn: cursosApi.eliminar,
    onSuccess: () => {
      invalidar();
      notifications.show({ message: "Curso eliminado.", color: "green" });
    },
  });
  const generar = useMutation({
    mutationFn: () => cursosApi.generarHorario(grado),
    onSuccess: (res) => {
      invalidar();
      setAvisosGeneracion(res.avisos);
      notifications.show({
        message:
          res.avisos.length === 0
            ? `Horario de ${grado}° generado sin choques (${res.filasCreadas} bloques en las 5 secciones).`
            : `Horario de ${grado}° generado con ${res.avisos.length} aviso(s) de cupo — revisa el detalle.`,
        color: res.avisos.length === 0 ? "green" : "yellow",
      });
    },
  });

  function abrirNuevo() {
    setEditando(null);
    form.setValues(VALORES_INICIALES);
    setModalAbierto(true);
  }

  function abrirEditar(curso: Curso) {
    setEditando(curso);
    form.setValues({
      nombre: curso.nombre,
      docenteId: curso.docenteId ? String(curso.docenteId) : null,
      vecesPorSemana: curso.vecesPorSemana,
      avisoPrevioMin: curso.avisoPrevioMin,
    });
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setEditando(null);
  }

  function guardar(valores: ValoresFormulario) {
    const datos: DatosCurso = {
      grado,
      nombre: valores.nombre.trim(),
      docenteId: valores.docenteId ? Number(valores.docenteId) : null,
      vecesPorSemana: valores.vecesPorSemana,
      avisoPrevioMin: valores.avisoPrevioMin,
    };
    if (editando) actualizar.mutate({ id: editando.id, datos });
    else crear.mutate(datos);
  }

  const opcionesDocentes = (docentes ?? []).map((d) => ({ value: String(d.id), label: d.nombre }));
  const nombreDocente = (id: number | null) => docentes?.find((d) => d.id === id)?.nombre ?? "— (sin asignar)";

  // Regla fija: solo se puede generar si ya hay docentes Y cursos para este grado.
  const sinDocentes = !docentes || docentes.length === 0;
  const sinCursos = !cursos || cursos.length === 0;
  const motivoBloqueo = sinDocentes
    ? "Primero crea al menos un docente (pestaña Docentes)."
    : sinCursos
      ? `Primero agrega al menos un curso para ${grado}°.`
      : null;

  return (
    <>
      <Title order={2} mb="lg">
        Cursos por grado
      </Title>

      <Text c="dimmed" size="sm" mb="md">
        Primero define acá los cursos de cada grado (con su docente y cuántas veces por semana se dictan). El mismo
        docente dicta las 5 secciones (A-E) de su grado, en horarios distintos. Cuando termines de definir los
        cursos de un grado, usa <b>Generar horario</b> para armar automáticamente el horario de sus 5 secciones —
        podrás revisar y ajustar el resultado en la pestaña "Horarios".
      </Text>

      <Group mb="md" align="flex-end">
        <Select
          label="Grado"
          data={GRADOS.map((g) => ({ value: String(g), label: `${g}°` }))}
          value={String(grado)}
          onChange={(v) => {
            if (v) setGrado(Number(v));
            setAvisosGeneracion(null);
          }}
          w={100}
          allowDeselect={false}
        />
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNuevo}>
          Nuevo curso
        </Button>
        <Tooltip label={motivoBloqueo} disabled={!motivoBloqueo}>
          <Button
            variant="light"
            color="grape"
            leftSection={<IconWand size={16} />}
            loading={generar.isPending}
            disabled={motivoBloqueo !== null}
            onClick={() => generar.mutate()}
          >
            Generar horario para {grado}°
          </Button>
        </Tooltip>
      </Group>

      {avisosGeneracion && avisosGeneracion.length > 0 && (
        <Alert
          color="yellow"
          icon={<IconAlertTriangle size={16} />}
          title="Algunos cursos no cupieron completos"
          mb="md"
          withCloseButton
          onClose={() => setAvisosGeneracion(null)}
        >
          <List size="sm">
            {avisosGeneracion.map((a, i) => (
              <List.Item key={i}>{a}</List.Item>
            ))}
          </List>
        </Alert>
      )}

      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Curso</Table.Th>
            <Table.Th>Docente</Table.Th>
            <Table.Th>Veces / semana</Table.Th>
            <Table.Th>Aviso previo</Table.Th>
            <Table.Th w={100} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {cursos?.map((c) => (
            <Table.Tr key={c.id}>
              <Table.Td>{c.nombre}</Table.Td>
              <Table.Td>{nombreDocente(c.docenteId)}</Table.Td>
              <Table.Td>{c.vecesPorSemana}</Table.Td>
              <Table.Td>{c.avisoPrevioMin} min</Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <ActionIcon variant="subtle" onClick={() => abrirEditar(c)} aria-label="Editar">
                    <IconPencil size={16} />
                  </ActionIcon>
                  <ActionIcon variant="subtle" color="red" onClick={() => eliminar.mutate(c.id)} aria-label="Eliminar">
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {!isLoading && cursos?.length === 0 && (
        <Text c="dimmed" ta="center" mt="lg">
          {grado}° todavía no tiene cursos. Agrega el primero para poder generar su horario.
        </Text>
      )}

      <Modal
        opened={modalAbierto}
        onClose={cerrarModal}
        title={editando ? `Editar curso (${grado}°)` : `Nuevo curso (${grado}°)`}
      >
        <form onSubmit={form.onSubmit(guardar)}>
          <Stack>
            <TextInput label="Nombre del curso" required placeholder="Matemática" {...form.getInputProps("nombre")} />
            <Select
              label="Docente (dicta las 5 secciones)"
              placeholder="Sin asignar"
              data={opcionesDocentes}
              clearable
              {...form.getInputProps("docenteId")}
            />
            <NumberInput
              label="Veces por semana"
              min={1}
              max={5}
              {...form.getInputProps("vecesPorSemana")}
            />
            <NumberInput label="Minutos de aviso previo" min={0} max={180} {...form.getInputProps("avisoPrevioMin")} />
            <Button type="submit" loading={crear.isPending || actualizar.isPending}>
              Guardar
            </Button>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
