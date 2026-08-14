import { useState } from "react";
import {
  ActionIcon,
  Button,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconCopy, IconPlus, IconX } from "@tabler/icons-react";
import { docentesApi } from "../api/docentes";
import { plantillaApi, type DatosClase } from "../api/plantillaHorario";
import { DIAS_SEMANA, GRADOS, SECCIONES, type ClasePlantilla, type DiaSemana } from "../api/tipos";

const HORA_VALIDA = /^([01]\d|2[0-3]):([0-5]\d)$/;
// Los mismos 6 bloques que ya usa el generador automático (ver Cursos): se
// muestran siempre como fila, aunque estén vacíos, para poder agregar ahí
// con un clic. Cualquier otra hora que ya exista en los datos (agregada a
// mano) también aparece — la grilla nunca oculta nada real.
const HORAS_ESTANDAR = ["08:00", "08:45", "09:30", "10:30", "11:15", "12:00"];
const DIAS_LABORALES: DiaSemana[] = ["lun", "mar", "mie", "jue", "vie"];

interface ValoresFormulario {
  titulo: string;
  hora: string;
  dias: DiaSemana[];
  docenteId: string | null;
  avisoPrevioMin: number;
}

export function HorariosPage() {
  const qc = useQueryClient();
  const [grado, setGrado] = useState(1);
  const [seccion, setSeccion] = useState("A");

  const { data: clases, isLoading } = useQuery({
    queryKey: ["plantilla", grado, seccion],
    queryFn: () => plantillaApi.listar(grado, seccion),
  });
  // Filtrado por el grado seleccionado: el desplegable del formulario de
  // "nueva/editar clase" solo tiene sentido mostrando los docentes de ESTE
  // grado (cada uno dicta uno solo — ver página Docentes).
  const { data: docentes } = useQuery({
    queryKey: ["docentes", grado],
    queryFn: () => docentesApi.listar(grado),
  });

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<ClasePlantilla | null>(null);
  const [modalClonarAbierto, setModalClonarAbierto] = useState(false);

  const form = useForm<ValoresFormulario>({
    initialValues: { titulo: "", hora: "08:00", dias: [], docenteId: null, avisoPrevioMin: 5 },
    validate: {
      titulo: (v) => (v.trim() ? null : "Obligatorio"),
      hora: (v) => (HORA_VALIDA.test(v) ? null : "Formato HH:mm"),
      dias: (v) => (v.length > 0 ? null : "Elige al menos un día"),
    },
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["plantilla"] });
    qc.invalidateQueries({ queryKey: ["resumen"] });
  }

  const crear = useMutation({
    mutationFn: (datos: DatosClase) => plantillaApi.crear(datos),
    onSuccess: () => {
      invalidar();
      notifications.show({ message: "Clase creada.", color: "green" });
      cerrarModal();
    },
  });
  const actualizar = useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: DatosClase }) => plantillaApi.actualizar(id, datos),
    onSuccess: () => {
      invalidar();
      notifications.show({ message: "Clase actualizada.", color: "green" });
      cerrarModal();
    },
  });
  const eliminar = useMutation({
    mutationFn: plantillaApi.eliminar,
    onSuccess: () => {
      invalidar();
      notifications.show({ message: "Clase eliminada.", color: "green" });
    },
  });
  const clonar = useMutation({
    mutationFn: ({ origenGrado, origenSeccion }: { origenGrado: number; origenSeccion: string }) =>
      plantillaApi.clonar({ grado: origenGrado, seccion: origenSeccion }, { grado, seccion }),
    onSuccess: (res) => {
      invalidar();
      notifications.show({ message: `Se copiaron ${res.creadas} clases.`, color: "green" });
      setModalClonarAbierto(false);
    },
  });

  function abrirNueva(horaPrefill?: string, diaPrefill?: DiaSemana) {
    setEditando(null);
    form.setValues({
      titulo: "",
      hora: horaPrefill ?? "08:00",
      dias: diaPrefill ? [diaPrefill] : [],
      docenteId: null,
      avisoPrevioMin: 5,
    });
    setModalAbierto(true);
  }

  function abrirEditar(clase: ClasePlantilla) {
    setEditando(clase);
    form.setValues({
      titulo: clase.titulo,
      hora: clase.hora,
      dias: clase.dias,
      docenteId: clase.docenteId ? String(clase.docenteId) : null,
      avisoPrevioMin: clase.avisoPrevioMin,
    });
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setEditando(null);
  }

  function guardar(valores: ValoresFormulario) {
    const datos: DatosClase = {
      grado,
      seccion,
      titulo: valores.titulo.trim(),
      hora: valores.hora,
      dias: valores.dias,
      docenteId: valores.docenteId ? Number(valores.docenteId) : null,
      avisoPrevioMin: valores.avisoPrevioMin,
    };
    if (editando) actualizar.mutate({ id: editando.id, datos });
    else crear.mutate(datos);
  }

  const opcionesDocentes = (docentes ?? []).map((d) => ({ value: String(d.id), label: d.nombre }));
  const nombreDocente = (id: number | null) => docentes?.find((d) => d.id === id)?.nombre ?? "—";

  // Grilla dinámica: filas = horas (las 6 estándar + cualquier otra que ya
  // exista en los datos), columnas = días laborales siempre + fin de semana
  // solo si hay algo cargado ahí. Una clase con varios días ocupa una celda
  // por cada uno.
  const diasConContenido = new Set((clases ?? []).flatMap((c) => c.dias));
  const diasGrilla = DIAS_SEMANA.filter(
    (d) => DIAS_LABORALES.includes(d.valor) || diasConContenido.has(d.valor),
  );
  const horasGrilla = Array.from(
    new Set([...HORAS_ESTANDAR, ...(clases ?? []).map((c) => c.hora)]),
  ).sort();
  const celdas = new Map<string, ClasePlantilla[]>();
  for (const c of clases ?? []) {
    for (const dia of c.dias) {
      const key = `${c.hora}|${dia}`;
      const arr = celdas.get(key) ?? [];
      arr.push(c);
      celdas.set(key, arr);
    }
  }

  return (
    <>
      <Title order={2} mb="lg">
        Horarios por grado y sección
      </Title>

      <Group mb="md" align="flex-end">
        <Select
          label="Grado"
          data={GRADOS.map((g) => ({ value: String(g), label: `${g}°` }))}
          value={String(grado)}
          onChange={(v) => v && setGrado(Number(v))}
          w={100}
          allowDeselect={false}
        />
        <Select
          label="Sección"
          data={SECCIONES.map((s) => ({ value: s, label: s }))}
          value={seccion}
          onChange={(v) => v && setSeccion(v)}
          w={100}
          allowDeselect={false}
        />
        <Button leftSection={<IconPlus size={16} />} onClick={() => abrirNueva()}>
          Nueva clase
        </Button>
        <Button variant="light" leftSection={<IconCopy size={16} />} onClick={() => setModalClonarAbierto(true)}>
          Clonar desde otra sección
        </Button>
      </Group>

      <Table withTableBorder withColumnBorders style={{ tableLayout: "fixed" }}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={72}>Hora</Table.Th>
            {diasGrilla.map((d) => (
              <Table.Th key={d.valor} ta="center">
                {d.etiqueta}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {horasGrilla.map((hora) => (
            <Table.Tr key={hora}>
              <Table.Td fw={600} c="dimmed" style={{ verticalAlign: "top" }}>
                {hora}
              </Table.Td>
              {diasGrilla.map((d) => {
                const items = celdas.get(`${hora}|${d.valor}`) ?? [];
                return (
                  <Table.Td key={d.valor} p={4} style={{ verticalAlign: "top" }}>
                    {items.length === 0 ? (
                      <UnstyledButton
                        onClick={() => abrirNueva(hora, d.valor)}
                        aria-label={`Agregar clase ${hora} ${d.etiqueta}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "100%",
                          minHeight: 52,
                          borderRadius: "var(--mantine-radius-sm)",
                          color: "var(--mantine-color-dimmed)",
                        }}
                      >
                        <IconPlus size={14} />
                      </UnstyledButton>
                    ) : (
                      <Stack gap={4}>
                        {items.map((c) => (
                          <Tooltip
                            key={c.id}
                            label={`${c.titulo} — ${nombreDocente(c.docenteId)} — aviso ${c.avisoPrevioMin} min antes`}
                            multiline
                            w={220}
                          >
                            <Paper
                              withBorder
                              radius="sm"
                              p={6}
                              pos="relative"
                              onClick={() => abrirEditar(c)}
                              style={{ cursor: "pointer" }}
                            >
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                color="red"
                                aria-label="Eliminar"
                                pos="absolute"
                                top={2}
                                right={2}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  eliminar.mutate(c.id);
                                }}
                              >
                                <IconX size={10} />
                              </ActionIcon>
                              <Text size="xs" fw={600} pr={14} lineClamp={2}>
                                {c.titulo}
                              </Text>
                              <Text size="xs" c="dimmed" lineClamp={1}>
                                {nombreDocente(c.docenteId)}
                              </Text>
                            </Paper>
                          </Tooltip>
                        ))}
                      </Stack>
                    )}
                  </Table.Td>
                );
              })}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {!isLoading && clases?.length === 0 && (
        <Text c="dimmed" ta="center" mt="lg">
          {grado}°{seccion} todavía no tiene clases. Haz clic en cualquier casillero para agregar una, o clónalas
          desde otra sección.
        </Text>
      )}

      <Modal
        opened={modalAbierto}
        onClose={cerrarModal}
        title={editando ? `Editar clase (${grado}°${seccion})` : `Nueva clase (${grado}°${seccion})`}
      >
        <form onSubmit={form.onSubmit(guardar)}>
          <Stack>
            <TextInput label="Materia" required {...form.getInputProps("titulo")} />
            <TextInput label="Hora (HH:mm)" required placeholder="08:00" {...form.getInputProps("hora")} />
            <Checkbox.Group label="Días" {...form.getInputProps("dias")}>
              <Group mt="xs">
                {DIAS_SEMANA.map((d) => (
                  <Checkbox key={d.valor} value={d.valor} label={d.etiqueta} />
                ))}
              </Group>
            </Checkbox.Group>
            <Select
              label="Docente (opcional)"
              data={opcionesDocentes}
              clearable
              {...form.getInputProps("docenteId")}
            />
            <NumberInput label="Minutos de aviso previo" min={0} max={180} {...form.getInputProps("avisoPrevioMin")} />
            <Button type="submit" loading={crear.isPending || actualizar.isPending}>
              Guardar
            </Button>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={modalClonarAbierto}
        onClose={() => setModalClonarAbierto(false)}
        title={`Clonar hacia ${grado}°${seccion}`}
      >
        <ClonarForm
          destinoActual={{ grado, seccion }}
          loading={clonar.isPending}
          onClonar={(origenGrado, origenSeccion) => clonar.mutate({ origenGrado, origenSeccion })}
        />
      </Modal>
    </>
  );
}

interface ClonarFormProps {
  destinoActual: { grado: number; seccion: string };
  loading: boolean;
  onClonar: (grado: number, seccion: string) => void;
}

function ClonarForm({ destinoActual, loading, onClonar }: ClonarFormProps) {
  const [origenGrado, setOrigenGrado] = useState(1);
  const [origenSeccion, setOrigenSeccion] = useState("A");
  const mismoCombo = origenGrado === destinoActual.grado && origenSeccion === destinoActual.seccion;

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Copia todas las clases de otra sección hacia {destinoActual.grado}°{destinoActual.seccion}. No borra lo que
        ya tenga.
      </Text>
      <Group>
        <Select
          label="Grado origen"
          data={GRADOS.map((g) => ({ value: String(g), label: `${g}°` }))}
          value={String(origenGrado)}
          onChange={(v) => v && setOrigenGrado(Number(v))}
          w={100}
          allowDeselect={false}
        />
        <Select
          label="Sección origen"
          data={SECCIONES.map((s) => ({ value: s, label: s }))}
          value={origenSeccion}
          onChange={(v) => v && setOrigenSeccion(v)}
          w={100}
          allowDeselect={false}
        />
      </Group>
      {mismoCombo && (
        <Text c="red" size="sm">
          Elige una sección distinta a la actual.
        </Text>
      )}
      <Button disabled={mismoCombo} loading={loading} onClick={() => onClonar(origenGrado, origenSeccion)}>
        Clonar
      </Button>
    </Stack>
  );
}
