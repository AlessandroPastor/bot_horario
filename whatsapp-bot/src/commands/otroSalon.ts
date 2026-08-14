import type { DiaSemana } from "../db/eventos.js";
import { obtenerDocente } from "../db/docentes.js";
import { listarPlantilla } from "../db/plantillaHorario.js";
import { aulaDe, SECCIONES, type Seccion } from "../db/seed.js";

// Sin acentos, en minúsculas — mismo criterio que intencion.ts, para
// reconocer "salón"/"salon", "sección"/"seccion", etc. indistintamente.
const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");
function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(DIACRITICOS, "");
}

const TRIGGER_OTRO_SALON = /\botr[oa]\s+(salon|seccion|grado|curso)\b/;

/** Cualquier chat (registrado o no) puede preguntar por el horario de OTRO salón, sin tocar su propio perfil. */
export function esConsultaOtroSalon(textoCrudo: string): boolean {
  return TRIGGER_OTRO_SALON.test(normalizar(textoCrudo));
}

type Paso = "grado" | "seccion";
interface EstadoConsulta {
  paso: Paso;
  grado?: number;
}

const enProgreso = new Map<string, EstadoConsulta>();

export function estaConsultandoOtroSalon(chatId: string): boolean {
  return enProgreso.has(chatId);
}

const PIE = "\n\nEscribe *cancelar* en cualquier momento para salir.";

export function iniciarConsultaOtroSalon(chatId: string): string {
  enProgreso.set(chatId, { paso: "grado" });
  return (
    "🔍 Vamos a ver el horario de otro salón (esto no cambia tu propio registro).\n" +
    "¿De qué grado? Responde un número del 1 al 5." +
    PIE
  );
}

export function continuarConsultaOtroSalon(chatId: string, textoCrudo: string): string {
  const texto = textoCrudo.trim();
  const estado = enProgreso.get(chatId);
  if (!estado) return 'Escribe "otro salón" para empezar.';

  if (texto.toLowerCase() === "cancelar") {
    enProgreso.delete(chatId);
    return "Listo, cancelé la consulta.";
  }

  if (estado.paso === "grado") {
    const grado = Number(texto);
    if (!Number.isInteger(grado) || grado < 1 || grado > 5) {
      return "Grado inválido 🤔 Responde solo un número del 1 al 5." + PIE;
    }
    estado.grado = grado;
    estado.paso = "seccion";
    enProgreso.set(chatId, estado);
    return "¿Y de qué sección? Responde una letra: A, B, C, D o E." + PIE;
  }

  // estado.paso === "seccion"
  const seccion = texto.toUpperCase();
  if (!SECCIONES.includes(seccion as Seccion)) {
    return "Sección inválida 🤔 Responde solo una letra: A, B, C, D o E." + PIE;
  }

  const grado = estado.grado!;
  enProgreso.delete(chatId);
  return formatearHorarioSalon(grado, seccion);
}

const DIAS_ORDEN: DiaSemana[] = ["lun", "mar", "mie", "jue", "vie"];
const NOMBRES_DIA: Record<DiaSemana, string> = {
  lun: "Lunes",
  mar: "Martes",
  mie: "Miércoles",
  jue: "Jueves",
  vie: "Viernes",
  sab: "Sábado",
  dom: "Domingo",
};

function formatearHorarioSalon(grado: number, seccion: string): string {
  const clases = listarPlantilla(grado, seccion);
  if (clases.length === 0) {
    return `${grado}°${seccion} todavía no tiene un horario cargado.`;
  }

  const bloques: string[] = [];
  for (const dia of DIAS_ORDEN) {
    const delDia = clases.filter((c) => c.dias.includes(dia));
    if (delDia.length === 0) continue;
    const lineas = delDia
      .sort((a, b) => a.hora.localeCompare(b.hora))
      .map((c) => {
        const docente = c.docenteId ? obtenerDocente(c.docenteId) : null;
        return `  • ${c.hora} — ${c.titulo}${docente ? ` (Prof. ${docente.nombre})` : ""}`;
      });
    bloques.push(`*${NOMBRES_DIA[dia]}*\n${lineas.join("\n")}`);
  }

  return `📚 *Horario de ${grado}°${seccion}* (Aula ${aulaDe(grado, seccion)})\n\n${bloques.join("\n\n")}`;
}
