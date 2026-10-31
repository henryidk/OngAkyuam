import { Link } from 'react-router-dom'
import {
  CATEGORIA_POR_TIPO_PROCESO,
  ETIQUETAS_CATEGORIA_PROCESO,
  formatFechaLargaGT,
  sumarDiasGT,
  type AudienciaFilaDto,
  type AudienciasInicio,
} from '@akyuam/shared'
import { formatHora12 } from '../compartido/hora12'
import { RUTAS_JURIDICO } from '../rutas'
import { CLASE_FOCO, Seccion, Vacio } from './piezas'

/** "Alimentos", "Familia"…: el nombre completo del tipo de juicio no cabe en una fila de agenda. */
function categoria(audiencia: AudienciaFilaDto): string {
  return ETIQUETAS_CATEGORIA_PROCESO[CATEGORIA_POR_TIPO_PROCESO[audiencia.tipoProceso]]
}

function etiquetaDia(fecha: string, hoy: string): { dia: string; fecha: string | null } {
  if (fecha === hoy) return { dia: 'Hoy', fecha: formatFechaLargaGT(fecha) }
  if (fecha === sumarDiasGT(hoy, 1)) return { dia: 'Mañana', fecha: formatFechaLargaGT(fecha) }
  return { dia: formatFechaLargaGT(fecha), fecha: null }
}

/** Agrupa por día conservando el orden (ya vienen por hora, la más cercana primero). */
function porDia(audiencias: AudienciaFilaDto[]): [string, AudienciaFilaDto[]][] {
  const grupos = new Map<string, AudienciaFilaDto[]>()
  for (const audiencia of audiencias) {
    grupos.set(audiencia.fecha, [...(grupos.get(audiencia.fecha) ?? []), audiencia])
  }
  return [...grupos]
}

function FilaAgenda({ audiencia, esHoy }: { audiencia: AudienciaFilaDto; esHoy: boolean }) {
  return (
    <li>
      <Link
        to={RUTAS_JURIDICO.audienciasProceso(audiencia.procesoId, { audienciaId: audiencia.id })}
        className={`group flex items-center gap-3 px-4 py-2 transition-colors hover:bg-gray-50 ${CLASE_FOCO} focus-visible:ring-inset`}
      >
        <span
          className={`w-[70px] shrink-0 text-[13px] font-semibold tabular-nums ${esHoy ? 'text-brand-700' : 'text-gray-700'}`}
        >
          {formatHora12(audiencia.hora)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-gray-900 group-hover:underline">
            {audiencia.usuaria.nombreCompleto}
          </span>
          <span className="block truncate text-xs text-gray-500">
            {categoria(audiencia)}
            {audiencia.descripcion && ` · ${audiencia.descripcion}`}
            <span className="sm:hidden"> · {audiencia.responsable.nombre}</span>
          </span>
        </span>
        <span className="hidden max-w-[34%] truncate text-right text-xs text-gray-500 sm:block">
          {audiencia.responsable.nombre}
        </span>
      </Link>
    </li>
  )
}

export function ProximasAudiencias({ audiencias, hoy }: { audiencias: AudienciasInicio; hoy: string }) {
  const { agenda } = audiencias
  return (
    <Seccion
      titulo="Próximas audiencias"
      ayuda="Las más cercanas, de todo el equipo."
      total={agenda.total}
      enlace={{ texto: 'Ver audiencias', destino: RUTAS_JURIDICO.audiencias() }}
    >
      {agenda.items.length === 0 ? (
        <Vacio>No hay audiencias programadas.</Vacio>
      ) : (
        porDia(agenda.items).map(([fecha, delDia]) => {
          const { dia, fecha: detalle } = etiquetaDia(fecha, hoy)
          const esHoy = fecha === hoy
          return (
            <div key={fecha} className="border-t border-gray-100">
              <h3
                className={`flex items-baseline gap-2 px-4 pb-0.5 pt-2.5 text-[13px] font-semibold ${esHoy ? 'text-brand-700' : 'text-gray-800'}`}
              >
                {dia}
                {detalle && <span className="font-normal text-gray-500">{detalle}</span>}
              </h3>
              <ul className="pb-1">
                {delDia.map((audiencia) => (
                  <FilaAgenda key={audiencia.id} audiencia={audiencia} esHoy={esHoy} />
                ))}
              </ul>
            </div>
          )
        })
      )}
    </Seccion>
  )
}
