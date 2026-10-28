import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { formatFechaGT, type ConsultaHistorialMedicaDto } from '@akyuam/shared'
import Drawer from '../../../../components/ui/Drawer'
import { ErrorVista, Esqueleto } from '../../../../components/ui/EstadosVista'
import { useRecurso } from '../../../../lib/useRecurso'
import { obtenerConsulta } from '../../api/medica.api'
import DetalleConsulta from '../../compartido/DetalleConsulta'
import { CLASE_ENLACE } from '../../compartido/estilos'
import { RUTAS_MEDICA } from '../../rutas'

interface DrawerConsultaProps {
  consultaId: string
  /** La fila de la lista, si está cargada: da el nombre y el enlace a la historia clínica. */
  fila: ConsultaHistorialMedicaDto | undefined
  onCerrar: () => void
}

/**
 * Detalle de una consulta del historial. Se pide al abrir (el backend deja constancia de la
 * lectura) y, como el componente se desmonta al cerrar, el contenido clínico no queda en memoria.
 */
export default function DrawerConsulta({ consultaId, fila, onCerrar }: DrawerConsultaProps) {
  const { datos: consulta, error, recargar } = useRecurso(useCallback(() => obtenerConsulta(consultaId), [consultaId]))

  const titulo = fila?.usuariaNombreCompleto ?? consulta?.persona.nombreCompleto ?? 'Consulta'
  const subtitulo = consulta
    ? [
        `${formatFechaGT(consulta.fecha)} · ${consulta.hora}`,
        consulta.persona.ninoId ? `Consulta de ${consulta.persona.nombreCompleto}` : null,
        consulta.codigoAtencion,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined

  return (
    <Drawer
      abierto
      titulo={titulo}
      subtitulo={subtitulo}
      onCerrar={onCerrar}
      pie={
        fila ? (
          <Link to={RUTAS_MEDICA.historia(fila.usuariaId, undefined, consultaId)} className={CLASE_ENLACE}>
            Ver en historia clínica
          </Link>
        ) : undefined
      }
    >
      {error ? (
        <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="esta consulta" onReintentar={() => void recargar()} />
      ) : !consulta ? (
        <Esqueleto filas={4} />
      ) : (
        <DetalleConsulta consulta={consulta} />
      )}
    </Drawer>
  )
}
