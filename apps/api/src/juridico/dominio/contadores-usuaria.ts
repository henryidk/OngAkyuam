import type { ContadoresUsuariaJuridico } from '@akyuam/shared';
import { estadoVisible } from './estado-visible';
import type { EstadoProceso } from './maquina-estado-proceso';

/** "En proceso" = lo que Jurídico todavía lleva (en trámite o suspendido); el resto, cerrados. */
export function contarProcesos(
  procesos: EstadoProceso[],
): ContadoresUsuariaJuridico {
  const contadores = { enProceso: 0, cerrados: 0 };
  for (const proceso of procesos) {
    const visible = estadoVisible(proceso);
    if (visible === 'FINALIZADO' || visible === 'ABANDONADO') {
      contadores.cerrados += 1;
    } else {
      contadores.enProceso += 1;
    }
  }
  return contadores;
}
