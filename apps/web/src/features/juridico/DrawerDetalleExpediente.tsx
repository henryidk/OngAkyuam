import Drawer from '../../components/ui/Drawer'
import ContenidoDetalleExpediente from '../area-atencion/ContenidoDetalleExpediente'

interface DrawerDetalleExpedienteProps {
  expedienteId: string | null
  onCerrar: () => void
}

/** "Ver datos de la usuaria" — consulta larga de solo lectura, por eso drawer y no modal. */
export default function DrawerDetalleExpediente({ expedienteId, onCerrar }: DrawerDetalleExpedienteProps) {
  return (
    <Drawer abierto={expedienteId !== null} titulo="Datos de la usuaria" onCerrar={onCerrar}>
      {expedienteId && <ContenidoDetalleExpediente key={expedienteId} expedienteId={expedienteId} />}
    </Drawer>
  )
}
