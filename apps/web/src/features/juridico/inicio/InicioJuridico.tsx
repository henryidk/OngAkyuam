import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ETIQUETAS_CAMPO_IDENTIDAD_USUARIA,
  ETIQUETAS_FASE,
  ETIQUETAS_TIPO_DOCUMENTO,
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  formatFechaLargaGT,
  formatInstanteGT,
  horaActualGT,
  hoyGT,
  type InicioJuridicoDto,
  type NovedadTsDto,
  type ProcesoResumen,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import { useAuthStore } from '../../../store/auth.store'
import { obtenerInicio } from '../api/juridico.api'
import { useContextoJuridico } from '../compartido/contexto'
import EtiquetaEstado from '../compartido/EtiquetaEstado'
import { ErrorVista, Esqueleto } from '../compartido/EstadosVista'
import { fechaDeInstante, fechaDeReferencia, textoAlerta } from '../compartido/formato'
import { useRecurso } from '../compartido/useRecurso'
import { RUTAS_JURIDICO } from '../rutas'

const CLASE_TARJETA = 'rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]'
const CLASE_ENLACE = 'text-[13px] font-medium text-brand-700 hover:underline'
const CLASE_FILA_BOTON =
  'flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left last:border-b-0 hover:bg-gray-50'

function saludo(): string {
  const hora = horaActualGT()
  if (hora < 12) return 'Buenos días'
  if (hora < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function plural(total: number, singular: string, varios: string): string {
  return `${total} ${total === 1 ? singular : varios}`
}

function textoResumenAnio({ anio, resumenAnio }: InicioJuridicoDto): string {
  return `${anio}: ${plural(resumenAnio.total, 'proceso', 'procesos')} · ${resumenAnio.enTramite} en trámite · ${plural(
    resumenAnio.finalizados,
    'finalizado',
    'finalizados',
  )}`
}

/** "nombres, DPI y teléfono": solo los campos conocidos, sin repetir ("municipio" sale de dos). */
function textoCampos(campos: string[]): string {
  const etiquetas = [
    ...new Set(
      campos.flatMap((campo) =>
        campo in ETIQUETAS_CAMPO_IDENTIDAD_USUARIA
          ? [ETIQUETAS_CAMPO_IDENTIDAD_USUARIA[campo as keyof typeof ETIQUETAS_CAMPO_IDENTIDAD_USUARIA]]
          : [],
      ),
    ),
  ]
  if (etiquetas.length === 0) return 'los datos'
  if (etiquetas.length === 1) return etiquetas[0]
  return `${etiquetas.slice(0, -1).join(', ')} y ${etiquetas[etiquetas.length - 1]}`
}

function textoNovedad(novedad: NovedadTsDto): string {
  const quien = `${novedad.usuaria.nombreCompleto} (${novedad.expedienteNumero})`
  switch (novedad.tipo) {
    case 'REFERENCIA':
      return `Nueva referencia: ${quien}.`
    case 'DATOS':
      return `TS actualizó ${textoCampos(novedad.campos)} de ${quien}.`
    case 'DOCUMENTO': {
      const version = novedad.documento.version > 1 ? ` (v${novedad.documento.version})` : ''
      return `TS subió «${ETIQUETAS_TIPO_DOCUMENTO[novedad.documento.tipo]}»${version} al expediente ${novedad.expedienteNumero}.`
    }
  }
}

interface ColaProps {
  titulo: string
  descripcion: string
  colorPunto: string
  claseInsignia: string
  total: number | null
  children: ReactNode
  pie?: ReactNode
}

function Cola({ titulo, descripcion, colorPunto, claseInsignia, total, children, pie }: ColaProps) {
  return (
    <section className={`${CLASE_TARJETA} flex flex-col`}>
      <div className="border-b border-gray-100 px-4 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: colorPunto }} />
          <h2 className="text-sm font-semibold text-gray-900">{titulo}</h2>
          {total !== null && (
            <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${claseInsignia}`}>{total}</span>
          )}
        </div>
        <p className="ml-4 mt-1 text-xs text-gray-500">{descripcion}</p>
      </div>
      <div className="flex-1">{children}</div>
      {pie && <div className="border-t border-gray-100 px-4 py-2.5">{pie}</div>}
    </section>
  )
}

function Vacio({ children }: { children: ReactNode }) {
  return <p className="p-4 text-[13px] text-gray-400">{children}</p>
}

function FilaColaProceso({ proceso, detalle }: { proceso: ProcesoResumen; detalle: ReactNode }) {
  return (
    <Link to={RUTAS_JURIDICO.proceso(proceso.id)} className={CLASE_FILA_BOTON}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-800">{proceso.usuaria.nombreCompleto}</p>
        <p className="mt-0.5 truncate text-xs text-gray-500">
          <span className="font-mono">{proceso.codigo}</span> · {ETIQUETAS_TIPO_PROCESO_JURIDICO[proceso.tipo]}
        </p>
      </div>
      {detalle}
    </Link>
  )
}

function Colas({ inicio }: { inicio: InicioJuridicoDto }) {
  const { referenciasNuevas, requierenAtencion, misProcesos } = inicio
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
      <Cola
        titulo="Referencias nuevas"
        descripcion="Referidas por Trabajo Social, sin procesos abiertos."
        colorPunto="#d97706"
        claseInsignia="bg-[#fef3c7] text-[#b45309]"
        total={referenciasNuevas.total}
        pie={
          referenciasNuevas.total > referenciasNuevas.items.length && (
            <Link to={RUTAS_JURIDICO.bandeja()} className={CLASE_ENLACE}>
              Ver todas las referencias
            </Link>
          )
        }
      >
        {referenciasNuevas.items.length === 0 && <Vacio>No hay referencias nuevas.</Vacio>}
        {referenciasNuevas.items.map((referencia) => (
          <div key={referencia.referidoId} className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0">
            <Link to={RUTAS_JURIDICO.bandeja()} className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-800 hover:underline">{referencia.usuaria.nombreCompleto}</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Exp. {referencia.expedienteNumero} · {fechaDeInstante(referencia.referidoEn)}
              </p>
            </Link>
            <Link
              to={RUTAS_JURIDICO.registrar({ expedienteId: referencia.expedienteId, referidoId: referencia.referidoId })}
              className="rounded-md border border-[#c7a8e5] bg-white px-2.5 py-1.5 text-xs font-medium text-[#5b3985] hover:bg-[#f7f3fc]"
            >
              Atender
            </Link>
          </div>
        ))}
      </Cola>

      <Cola
        titulo="Requieren atención"
        descripcion="En trámite y sin actuación en 60 días o más."
        colorPunto="#8a5a14"
        claseInsignia="bg-[#f6ecdc] text-[#8a5a14]"
        total={requierenAtencion.total}
        pie={
          requierenAtencion.total > requierenAtencion.items.length && (
            <Link to={RUTAS_JURIDICO.procesos()} className={CLASE_ENLACE}>
              Ver todos los procesos
            </Link>
          )
        }
      >
        {requierenAtencion.items.length === 0 && <Vacio>Todos los procesos tienen actuaciones recientes.</Vacio>}
        {requierenAtencion.items.map((proceso) => (
          <FilaColaProceso
            key={proceso.id}
            proceso={proceso}
            detalle={<span className="whitespace-nowrap text-xs font-medium text-[#8a5a14]">{textoAlerta(proceso)}</span>}
          />
        ))}
      </Cola>

      <Cola
        titulo="Mis procesos en trámite"
        descripcion="Asignados a ti como abogada o procuradora."
        colorPunto="#7346a5"
        claseInsignia="bg-[#eee4f8] text-[#5b3985]"
        total={misProcesos?.total ?? null}
        pie={
          misProcesos && (
            <Link to={RUTAS_JURIDICO.procesos({ mios: true })} className={CLASE_ENLACE}>
              Ver todos mis procesos
            </Link>
          )
        }
      >
        {!misProcesos ? (
          <Vacio>
            Tu cuenta no está vinculada a una ficha de personal de Jurídico. Pide a Administración que la enlace para ver
            aquí tus procesos.
          </Vacio>
        ) : misProcesos.items.length === 0 ? (
          <Vacio>No tienes procesos en trámite asignados.</Vacio>
        ) : (
          misProcesos.items.map((proceso) => (
            <FilaColaProceso
              key={proceso.id}
              proceso={proceso}
              detalle={<span className="whitespace-nowrap text-xs text-gray-500">{ETIQUETAS_FASE[proceso.fase]}</span>}
            />
          ))
        )}
      </Cola>
    </div>
  )
}

const COLUMNAS_ACTIVIDAD = ['No. interno', 'Usuaria', 'Última actuación', 'Estado']

function ActividadReciente({ procesos }: { procesos: ProcesoResumen[] }) {
  const navigate = useNavigate()
  return (
    <section className={`${CLASE_TARJETA} overflow-hidden`}>
      <div className="flex items-center justify-between p-4">
        <h2 className="text-sm font-semibold text-gray-900">Actividad reciente en procesos</h2>
        <Link to={RUTAS_JURIDICO.procesos()} className={CLASE_ENLACE}>
          Ver todos los procesos
        </Link>
      </div>
      {procesos.length === 0 ? (
        <Vacio>Todavía no hay procesos abiertos.</Vacio>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                {COLUMNAS_ACTIVIDAD.map((columna) => (
                  <th key={columna} scope="col" className="px-4 py-2.5 font-medium">
                    {columna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {procesos.map((proceso) => {
                const destino = RUTAS_JURIDICO.proceso(proceso.id)
                return (
                  // Toda la fila abre el detalle; el enlace del código es el que recibe el foco del teclado.
                  <tr key={proceso.id} onClick={() => navigate(destino)} className="cursor-pointer border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        to={destino}
                        onClick={(evento) => evento.stopPropagation()}
                        className="font-mono text-[13px] font-medium text-brand-700 hover:underline"
                      >
                        {proceso.codigo}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-800">{proceso.usuaria.nombreCompleto}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{ETIQUETAS_TIPO_PROCESO_JURIDICO[proceso.tipo]}</p>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-600 tabular-nums">{fechaDeReferencia(proceso)}</td>
                    <td className="px-4 py-3">
                      <EtiquetaEstado estado={proceso.estadoVisible} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function NovedadesTs({ novedades }: { novedades: NovedadTsDto[] }) {
  return (
    <section className={`${CLASE_TARJETA} p-4`}>
      <h2 className="text-sm font-semibold text-gray-900">Novedades de Trabajo Social</h2>
      <p className="mb-3 mt-1 text-xs text-gray-500">Cambios en expedientes de usuarias que atiendes.</p>
      {novedades.length === 0 ? (
        <p className="text-[13px] text-gray-400">Sin novedades por ahora.</p>
      ) : (
        <ul className="space-y-3.5">
          {novedades.map((novedad) => (
            <li key={novedad.id} className="flex gap-2.5">
              <span
                aria-hidden="true"
                className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#f7f3fc] text-[11px] font-semibold text-[#5b3985]"
              >
                TS
              </span>
              <div className="min-w-0">
                <p className="text-[13px] text-gray-800 [text-wrap:pretty]">{textoNovedad(novedad)}</p>
                <p className="mt-0.5 text-xs text-gray-400 tabular-nums">{formatInstanteGT(novedad.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Pantalla de entrada de Jurídico: lo que pide atención hoy, sin tener que recorrer las listas. */
export default function InicioJuridico() {
  useTituloPagina({ titulo: 'Inicio' })
  const nombre = useAuthStore((estado) => estado.usuario?.nombreCompleto.split(/\s+/)[0] ?? '')
  const { versionNovedades } = useContextoJuridico()

  const cargar = useCallback(() => obtenerInicio(), [])
  const { datos: inicio, error, recargar } = useRecurso(cargar)

  // Un aviso del socket vuelve a pedir el Inicio sin desmontar lo que ya se ve.
  const versionVista = useRef(versionNovedades)
  useEffect(() => {
    if (versionVista.current === versionNovedades) return
    versionVista.current = versionNovedades
    void recargar()
  }, [versionNovedades, recargar])

  return (
    <div className="mx-auto max-w-[1240px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[22px] font-semibold tracking-tight text-gray-900">
            {saludo()}
            {nombre && `, ${nombre}`}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {formatFechaLargaGT(hoyGT())} · esto es lo que requiere tu atención hoy.
          </p>
        </div>
        {inicio && <p className="text-[13px] text-gray-500 tabular-nums">{textoResumenAnio(inicio)}</p>}
      </div>

      {error && !inicio ? (
        <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="el inicio" onReintentar={() => void recargar()} />
      ) : !inicio ? (
        <Esqueleto />
      ) : (
        <>
          <Colas inicio={inicio} />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <ActividadReciente procesos={inicio.actividadReciente} />
            <NovedadesTs novedades={inicio.novedadesTs} />
          </div>
        </>
      )}
    </div>
  )
}
