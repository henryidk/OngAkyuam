import { Link } from 'react-router-dom'
import { formatInstanteGT, type FilaProcesoPsicologia } from '@akyuam/shared'
import type { ColumnaTabla } from '../../../components/ui/TablaDatos'
import { fechaDeInstante } from '../../../lib/formato'
import CodigoProceso from '../compartido/CodigoProceso'
import EtiquetaEtapa from '../compartido/EtiquetaEtapa'
import { RUTAS_PSICOLOGIA } from '../rutas'

function ProximaCita({ proceso }: { proceso: FilaProcesoPsicologia }) {
  if (proceso.fechaCierre) return <span className="text-texto-suave">Cerrado {fechaDeInstante(proceso.fechaCierre)}</span>
  // Con una sesión pasada sin registrar lo pendiente es registrarla: "Sin próxima cita" queda solo
  // para lo que cuenta su filtro (PS1).
  if (!proceso.proximaCita && proceso.sesionPorRegistrar) {
    return <span className="font-medium text-estado-pendiente">Sesión por registrar</span>
  }
  if (!proceso.proximaCita) return <span className="font-medium text-estado-pendiente">Sin próxima cita</span>
  return <span className="text-texto">{formatInstanteGT(proceso.proximaCita.fechaHora)}</span>
}

const PERSONA: ColumnaTabla<FilaProcesoPsicologia> = {
  clave: 'persona',
  encabezado: 'Persona',
  rol: 'titulo',
  // Un hijo/a dice de quién es, para no confundirlo con una usuaria.
  celda: (proceso) => (
    <div className="flex flex-col gap-0.5">
      <Link
        to={RUTAS_PSICOLOGIA.proceso(proceso.id)}
        className="font-medium text-texto hover:text-brand-700 hover:underline hover:underline-offset-2"
      >
        {proceso.persona.nombreCompleto}
      </Link>
      {proceso.persona.ninoId !== null && (
        <span className="text-xs text-texto-suave">Hijo/a de {proceso.usuariaNombreCompleto}</span>
      )}
      {/* El código ya lleva el número de expediente (133-2026.01): repetirlo solo estorba. */}
      <CodigoProceso codigo={proceso.codigo} className="text-texto-suave" />
    </div>
  ),
}

const ATIENDE: ColumnaTabla<FilaProcesoPsicologia> = {
  clave: 'atiende',
  encabezado: 'Atiende',
  className: 'text-texto-cuerpo',
  celda: (proceso) => (proceso.propio ? <span className="font-medium">Tú</span> : proceso.psicologa),
}

const RESTO: ColumnaTabla<FilaProcesoPsicologia>[] = [
  { clave: 'etapa', encabezado: 'Etapa', celda: (proceso) => <EtiquetaEtapa etapa={proceso.etapa} /> },
  {
    clave: 'sesiones',
    encabezado: 'Sesiones',
    className: 'tabular-nums',
    celda: (proceso) => proceso.sesionesAtendidas,
  },
  {
    clave: 'ultima',
    encabezado: 'Última sesión',
    className: 'whitespace-nowrap tabular-nums text-texto-cuerpo',
    celda: (proceso) => (proceso.ultimaSesion ? fechaDeInstante(proceso.ultimaSesion.fechaHora) : '—'),
  },
  {
    clave: 'proxima',
    encabezado: 'Próxima cita',
    className: 'whitespace-nowrap tabular-nums',
    celda: (proceso) => <ProximaCita proceso={proceso} />,
  },
]

/** Columnas de Procesos. "Atiende" solo en la vista del equipo: en "Míos" siempre eres tú. */
export function columnasProcesos(conResponsable: boolean): ColumnaTabla<FilaProcesoPsicologia>[] {
  return conResponsable ? [PERSONA, ATIENDE, ...RESTO] : [PERSONA, ...RESTO]
}
