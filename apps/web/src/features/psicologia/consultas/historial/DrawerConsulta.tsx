import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { ETIQUETAS_CLINICA_PSICOLOGIA, formatInstanteGT } from '@akyuam/shared'
import Drawer from '../../../../components/ui/Drawer'
import { ErrorVista, Esqueleto } from '../../../../components/ui/EstadosVista'
import { useRecurso } from '../../../../lib/useRecurso'
import { obtenerConsulta } from '../../api/psicologia.api'
import { notasDe } from '../../compartido/notasSesion'
import BotonVerDocumento from '../../procesos/BotonVerDocumento'
import { RUTAS_PSICOLOGIA } from '../../rutas'

interface DrawerConsultaProps {
  citaId: string
  onCerrar: () => void
}

/**
 * Una sesión del historial con sus notas. Se pide al abrir (el servidor deja constancia de la
 * lectura) y, como el componente se desmonta al cerrar, el texto clínico no queda en memoria.
 */
export default function DrawerConsulta({ citaId, onCerrar }: DrawerConsultaProps) {
  const { datos: sesion, error, recargar } = useRecurso(useCallback(() => obtenerConsulta(citaId), [citaId]))

  const atendida = sesion?.estado === 'ATENDIDA'
  const subtitulo = sesion
    ? [
        formatInstanteGT(sesion.fechaHora),
        atendida && sesion.numero !== null ? `Sesión ${sesion.numero}` : 'No asistió',
        sesion.clinica !== null ? ETIQUETAS_CLINICA_PSICOLOGIA[sesion.clinica] : null,
        `Atendió: ${sesion.atendidoPor}`,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined
  const notas = sesion ? notasDe(sesion) : []

  return (
    <Drawer
      abierto
      titulo={sesion?.persona.nombreCompleto ?? 'Sesión'}
      subtitulo={subtitulo}
      onCerrar={onCerrar}
      pie={
        sesion ? (
          <Link to={RUTAS_PSICOLOGIA.proceso(sesion.procesoId, sesion.citaId)} className="text-sm font-semibold text-brand-700 hover:underline">
            Ver proceso {sesion.procesoCodigo}
          </Link>
        ) : undefined
      }
    >
      {error ? (
        <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="esta sesión" onReintentar={() => void recargar()} />
      ) : !sesion ? (
        <Esqueleto filas={4} />
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">Cada apertura queda registrada.</p>
          {sesion.persona.ninoId !== null && <p className="text-sm text-gray-600">Hijo/a de {sesion.usuariaNombreCompleto}</p>}
          {sesion.documento && (
            <p className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700">
              <FileText aria-hidden="true" className="h-4 w-4 text-gray-400" />
              <span className="flex-1">Hoja de evolución</span>
              <BotonVerDocumento citaId={sesion.citaId} nombreArchivo={sesion.documento.nombreArchivo} />
            </p>
          )}
          {notas.length === 0 ? (
            <p className="text-sm italic text-gray-500">{atendida ? 'Sin notas registradas.' : 'Sin motivo registrado.'}</p>
          ) : (
            <dl className="space-y-3">
              {notas.map((nota) => (
                <div key={nota.titulo}>
                  <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">{nota.titulo}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-sm text-gray-800">{nota.texto}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </Drawer>
  )
}
