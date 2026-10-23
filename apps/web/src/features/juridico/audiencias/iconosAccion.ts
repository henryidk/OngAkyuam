import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  MessageSquareText,
  Paperclip,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import type { AccionAudiencia } from '@akyuam/shared'

/** Un icono por acción: el mismo en la tarjeta de la audiencia y en el menú de la tabla. */
export const ICONOS_ACCION_AUDIENCIA: Record<AccionAudiencia, LucideIcon> = {
  REGISTRAR_RESULTADO: CheckCircle2,
  AGENDAR_NUEVA_FECHA: CalendarPlus,
  REPROGRAMAR: CalendarClock,
  CAMBIAR_RESPONSABLE: UserRound,
  EDITAR_OBSERVACIONES: MessageSquareText,
  ADJUNTAR_DOCUMENTO: Paperclip,
}
