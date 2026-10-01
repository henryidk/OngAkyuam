import type { ContadoresUsuariaJuridico } from '@akyuam/shared';
import { estadoVisible } from './estado-visible';
import type { EstadoProceso } from './maquina-estado-proceso';

/** "Activos" = lo que Jurídico todavía lleva: en trámite o suspendido. */
export function contarProcesos(
  procesos: EstadoProceso[],
): ContadoresUsuariaJuridico {
  const contadores = { activos: 0, finalizados: 0, abandonados: 0 };
  for (const proceso of procesos) {
    const visible = estadoVisible(proceso);
    if (visible === 'FINALIZADO') contadores.finalizados += 1;
    else if (visible === 'ABANDONADO') contadores.abandonados += 1;
    else contadores.activos += 1;
  }
  return contadores;
}
