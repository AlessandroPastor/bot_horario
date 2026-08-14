export interface Docente {
  id: number;
  nombre: string;
  materia: string | null;
  contacto: string | null;
  /** Grado que dicta (1-5). null solo en docentes creados antes de este campo. */
  grado: number | null;
  createdAt: string;
}

export type DiaSemana = "lun" | "mar" | "mie" | "jue" | "vie" | "sab" | "dom";

export const DIAS_SEMANA: { valor: DiaSemana; etiqueta: string }[] = [
  { valor: "lun", etiqueta: "Lun" },
  { valor: "mar", etiqueta: "Mar" },
  { valor: "mie", etiqueta: "Mié" },
  { valor: "jue", etiqueta: "Jue" },
  { valor: "vie", etiqueta: "Vie" },
  { valor: "sab", etiqueta: "Sáb" },
  { valor: "dom", etiqueta: "Dom" },
];

export const GRADOS = [1, 2, 3, 4, 5] as const;
export const SECCIONES = ["A", "B", "C", "D", "E"] as const;

export interface ClasePlantilla {
  id: number;
  grado: number;
  seccion: string;
  titulo: string;
  hora: string;
  dias: DiaSemana[];
  docenteId: number | null;
  avisoPrevioMin: number;
  createdAt: string;
  updatedAt: string;
}

export interface FechaCivica {
  id: number;
  titulo: string;
  fecha: string;
  createdAt: string;
  updatedAt: string;
}

export interface Reunion {
  id: number;
  titulo: string;
  fecha: string;
  hora: string;
  lugar: string | null;
  /** null = todos los grados */
  grado: number | null;
  /** null = todas las secciones */
  seccion: string | null;
  avisoPrevioMin: number;
  createdAt: string;
  updatedAt: string;
}

export interface Curso {
  id: number;
  grado: number;
  nombre: string;
  /** El mismo docente dicta este curso en las 5 secciones (A-E), en horarios distintos. */
  docenteId: number | null;
  vecesPorSemana: number;
  avisoPrevioMin: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResultadoGeneracion {
  filasCreadas: number;
  /** Cursos que no cupieron completos por falta de cupo (choque de horario/docente). Vacío = todo cupo perfecto. */
  avisos: string[];
}

export interface Resumen {
  docentes: number;
  cursos: number;
  clasesPlantilla: number;
  combosConHorario: number;
  combosTotales: number;
  fechasCivicas: number;
  chatsRegistrados: number;
  reuniones: number;
}
