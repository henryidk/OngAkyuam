import { fechaCalendarioGT } from '@akyuam/shared';
import type { EstadoAudiencia, EstadoVisibleAudiencia } from '@akyuam/shared';

/**
 * Lo que ve el personal. Una PROGRAMADA cambia sola con el reloj (Próxima → Hoy → Pendiente de
 * resultado), por eso se deriva al responder y nunca se guarda. "Hoy" se compara por día de
 * calendario de Guatemala, no de UTC: a las 19:00 de Guatemala UTC ya está en el día siguiente.
 */
export function estadoVisibleAudiencia(
  estado: EstadoAudiencia,
  inicio: Date,
  ahora: Date,
): EstadoVisibleAudiencia {
  if (estado !== 'PROGRAMADA') {
    return estado;
  }
  if (inicio <= ahora) {
    return 'PENDIENTE_RESULTADO';
  }
  return fechaCalendarioGT(inicio) === fechaCalendarioGT(ahora)
    ? 'HOY'
    : 'PROXIMA';
}
