import type {
  AccionProcesoPsicologia,
  EstadoAtencionPsicologica,
  EstadoCitaPsicologica,
} from '@akyuam/shared';

// Reglas de etapa del proceso psicológico. Funciones puras: no leen la base ni el reloj, para
// que servicios, repositorios y pruebas compartan una sola definición.

/** La primera sesión atendida pasa el proceso de Inicio a Seguimiento; después ya no cambia sola. */
export function etapaTrasSesionAtendida(
  etapa: EstadoAtencionPsicologica,
): EstadoAtencionPsicologica {
  return etapa === 'INICIO' ? 'SEGUIMIENTO' : etapa;
}

/** Un proceso cerrado no vuelve a cerrarse ni recibe citas: si la usuaria regresa se abre otro. */
export function estaCerrado(etapa: EstadoAtencionPsicologica): boolean {
  return etapa === 'CIERRE';
}

/**
 * Qué puede hacer la psicóloga dueña sobre el proceso. La visibilidad hacia otras áreas se
 * puede corregir incluso después del cierre; todo lo demás exige un proceso sin cerrar.
 */
export function accionesDisponibles(
  etapa: EstadoAtencionPsicologica,
): AccionProcesoPsicologia[] {
  if (estaCerrado(etapa)) {
    return ['EDITAR_VISIBILIDAD'];
  }
  return ['PROGRAMAR_CITA', 'REGISTRAR_SESION', 'CERRAR', 'EDITAR_VISIBILIDAD'];
}

export interface CitaParaEstadoDerivado {
  estado: EstadoCitaPsicologica;
  fechaHora: Date;
  duracionMinutos: number;
}

/**
 * "Sin registrar" no se guarda: es una cita que sigue programada y cuyo horario ya terminó, es
 * decir, pasó y nadie anotó si la persona asistió.
 */
export function citaSinRegistrar(
  cita: CitaParaEstadoDerivado,
  ahora: Date,
): boolean {
  if (cita.estado !== 'PROGRAMADA') {
    return false;
  }
  const fin = cita.fechaHora.getTime() + cita.duracionMinutos * 60_000;
  return fin <= ahora.getTime();
}
