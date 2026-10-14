import { useOutletContext } from 'react-router-dom'
import type { CitaMedicaBreveDto, FichaPacienteMedicaDto } from '@akyuam/shared'
import type { ContextoMedica } from '../compartido/contexto'

/**
 * Lo que `FichaPacienteLayout` comparte con sus pestañas. Incluye el contexto del módulo: un
 * `<Outlet context>` anidado reemplaza al de `MedicaLayout`, así que se reenvía aquí para que
 * `useContextoMedica()` siga funcionando dentro de las pestañas.
 */
export interface ContextoFicha extends ContextoMedica {
  ficha: FichaPacienteMedicaDto
  recargarFicha: () => void
  abrirProgramar: () => void
  abrirInasistencia: (cita: CitaMedicaBreveDto) => void
  abrirAlta: () => void
}

export function useContextoFicha() {
  return useOutletContext<ContextoFicha>()
}
