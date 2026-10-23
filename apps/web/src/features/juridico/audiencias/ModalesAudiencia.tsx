import { useToast } from '../../../components/ui/Toast'
import { casoDesdeAudiencia, type ModalAudiencia, type PropsModalAudiencia } from './caso'
import ModalDocumentosAudiencia from './ModalDocumentosAudiencia'
import ModalObservacionesAudiencia from './ModalObservacionesAudiencia'
import ModalProgramarAudiencia from './ModalProgramarAudiencia'
import ModalResponsableAudiencia from './ModalResponsableAudiencia'
import ModalResultadoAudiencia from './ModalResultadoAudiencia'

interface ModalesAudienciaProps {
  modal: ModalAudiencia | null
  /** Abre otro modal (encadenado) o cierra con `null`. */
  onCambiar: (modal: ModalAudiencia | null) => void
  /** Algo cambió: la pantalla vuelve a pedir sus datos (y el resumen del menú). */
  onCambios: () => void
}

/**
 * Un solo lugar que decide qué modal de audiencia se pinta. Lo usan la sección Audiencias, el
 * detalle del proceso y Procesos, así todos agendan y registran igual.
 */
export default function ModalesAudiencia({ modal, onCambiar, onCambios }: ModalesAudienciaProps) {
  const { mostrar } = useToast()
  if (!modal) return null

  const cerrar = () => onCambiar(null)
  const onHecho = (mensaje: string, siguiente?: ModalAudiencia) => {
    mostrar(mensaje)
    onCambios()
    onCambiar(siguiente ?? null)
  }
  const onConflicto = () => {
    onCambios()
    cerrar()
  }

  if (modal.tipo === 'AGENDAR') {
    return <ModalProgramarAudiencia caso={modal.caso} onCerrar={cerrar} onHecho={onHecho} onConflicto={onConflicto} />
  }

  const { audiencia } = modal
  if (modal.tipo === 'REPROGRAMAR' || modal.tipo === 'AGENDAR_NUEVA_FECHA') {
    return (
      <ModalProgramarAudiencia
        // La clave separa "Resultado → Agendar nueva fecha" del modal anterior: estado limpio.
        key={`${modal.tipo}-${audiencia.id}`}
        caso={casoDesdeAudiencia(audiencia)}
        anterior={{ modo: modal.tipo === 'REPROGRAMAR' ? 'REPROGRAMAR' : 'NUEVA_FECHA', audiencia }}
        onCerrar={cerrar}
        onHecho={onHecho}
        onConflicto={onConflicto}
      />
    )
  }

  const props: PropsModalAudiencia = { audiencia, onCerrar: cerrar, onHecho, onConflicto }
  switch (modal.tipo) {
    case 'CAMBIAR_RESPONSABLE':
      return <ModalResponsableAudiencia {...props} />
    case 'REGISTRAR_RESULTADO':
      return <ModalResultadoAudiencia {...props} />
    case 'EDITAR_OBSERVACIONES':
      return <ModalObservacionesAudiencia {...props} />
    case 'ADJUNTAR_DOCUMENTO':
      return <ModalDocumentosAudiencia audiencia={audiencia} onCerrar={cerrar} onHecho={onHecho} />
  }
}
