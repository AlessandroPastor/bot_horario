/** Date -> "AAAA-MM-DD" en hora LOCAL (no UTC: toISOString() puede correr el día según el huso horario). */
export function fechaAISO(fecha: Date | null): string {
  if (!fecha) return "";
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

/** "AAAA-MM-DD" -> Date a mediodía local (evita que el datepicker muestre el día anterior por redondeo de zona horaria). */
export function isoAFecha(iso: string): Date | null {
  if (!iso) return null;
  const fecha = new Date(`${iso}T12:00:00`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}
