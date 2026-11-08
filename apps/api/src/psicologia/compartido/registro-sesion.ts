import { parseLocalGT, type RegistroConsultaInput } from '@akyuam/shared';
import type { RegistrarConsultaParams } from '../interfaces/citas-psicologicas-repository.interface';

/** "" (campo opcional sin llenar) -> null para la base de datos, mismo criterio que juridico.service.ts. */
function vacioANulo(valor: string): string | null {
  return valor === '' ? null : valor;
}

/** Lo que se escribe en la sesión. Mismo criterio con y sin cita previa. */
export function camposDelRegistro(
  datos: RegistroConsultaInput,
): Omit<
  RegistrarConsultaParams,
  'citaId' | 'psicologaId' | 'proximaCita' | 'ahora'
> {
  return {
    estado: datos.estado,
    temas: vacioANulo(datos.temas),
    intervencion: vacioANulo(datos.intervencion),
    diagnostico: vacioANulo(datos.diagnostico),
    acuerdos: vacioANulo(datos.acuerdos),
    observaciones: vacioANulo(datos.observaciones),
    motivoNoAsistencia: vacioANulo(datos.motivoNoAsistencia),
    // La clínica es de la sesión que ocurrió: con inasistencia o cancelación no aplica.
    clinica: datos.estado === 'ATENDIDA' ? datos.clinica : null,
    enfoqueTerapeutico: vacioANulo(datos.enfoqueTerapeutico),
    atencionBrindada: vacioANulo(datos.atencionBrindada),
  };
}

/** La próxima cita de "¿Qué sigue?". */
export function proximaCitaDelRegistro(datos: RegistroConsultaInput): {
  cita: { fechaHora: Date; duracionMinutos: number };
  confirmarTraslape: boolean;
} | null {
  const { siguiente } = datos;
  if (siguiente?.tipo !== 'PROGRAMAR') {
    return null;
  }
  return {
    cita: {
      fechaHora: parseLocalGT(siguiente.fechaHora),
      duracionMinutos: siguiente.duracionMinutos,
    },
    confirmarTraslape: siguiente.confirmarTraslape ?? false,
  };
}
