import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  DIAS_ALERTA_INACTIVIDAD,
  ETIQUETAS_CAMPO_IDENTIDAD_USUARIA,
  ETIQUETAS_FASE,
  ETIQUETAS_TIPO_DOCUMENTO,
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  diasDesdeGT,
  formatFechaLargaGT,
  formatInstanteGT,
  horaActualGT,
  hoyGT,
  type InicioJuridicoDto,
  type NovedadTsDto,
  type ProcesoResumen,
  type ProcesosPorTipoDto,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import { useAuthStore } from '../../../store/auth.store'
import { obtenerInicio } from '../api/juridico.api'
import { useContextoJuridico } from '../compartido/contexto'
import { ErrorVista, Esqueleto } from '../compartido/EstadosVista'
import { textoAlerta } from '../compartido/formato'
import { useRecurso } from '../compartido/useRecurso'
import { RUTAS_JURIDICO } from '../rutas'

const CLASE_TARJETA = 'rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]'
const CLASE_ENLACE = 'text-[13px] font-medium text-brand-700 hover:underline'
const CLASE_FILA = 'flex items-center gap-3 border-t border-gray-100 px-4 py-3'
const CLASE_AMBAR = 'text-[#8a5a14]'

/** Tipos que se listan con su barra; el resto se suma en "Otros tipos". */
const TIPOS_VISIBLES = 6

function saludo(): string {
  const hora = horaActualGT()
  if (hora < 12) return 'Buenos días'
  if (hora < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function plural(total: number, singular: string, varios: string): string {
  return `${total} ${total === 1 ? singular : varios}`
}

/** "hoy", "ayer" o "hace N días": lo que lleva esperando una referencia. */
function textoEspera(instanteIso: string): string {
  const dias = diasDesdeGT(instanteIso)
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'ayer'
  return `hace ${dias} días`
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
    case 'DATOS':
      return `TS actualizó ${textoCampos(novedad.campos)} de ${quien}.`
    case 'DOCUMENTO': {
      const version = novedad.documento.version > 1 ? ` (v${novedad.documento.version})` : ''
      return `TS subió «${ETIQUETAS_TIPO_DOCUMENTO[novedad.documento.tipo]}»${version} al expediente ${novedad.expedienteNumero}.`
    }
  }
}

interface IndicadorProps {
  etiqueta: string
  valor: number
  detalle: string
  destino: string
  /** Hay algo pendiente detrás del número: se pinta en ámbar. */
  alerta?: boolean
}

function Indicador({ etiqueta, valor, detalle, destino, alerta = false }: IndicadorProps) {
  return (
    <Link to={destino} className="group bg-white px-5 py-4 hover:bg-gray-50">
      <p className="text-[13px] text-gray-600">{etiqueta}</p>
      <p className={`mt-1 text-[30px] font-semibold leading-none tabular-nums ${alerta ? CLASE_AMBAR : 'text-gray-900'}`}>
        {valor}
      </p>
      <p className="mt-2 text-[12.5px] text-gray-500 group-hover:text-gray-700">{detalle}</p>
    </Link>
  )
}

function Indicadores({ inicio }: { inicio: InicioJuridicoDto }) {
  const { referenciasNuevas, requierenAtencion, misProcesos, cargaActual, movimientoAnio, anio } = inicio
  const masAntigua = referenciasNuevas.items[0]

  let detalleCarga = 'Todos los procesos activos del área'
  if (misProcesos) detalleCarga = misProcesos.total === 0 ? 'Ninguno a tu cargo' : `${misProcesos.total} a tu cargo`

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 lg:grid-cols-4">
      <Indicador
        etiqueta="Referencias por atender"
        valor={referenciasNuevas.total}
        detalle={masAntigua ? `La más antigua llegó ${textoEspera(masAntigua.referidoEn)}` : 'Nada en espera'}
        destino={RUTAS_JURIDICO.bandeja()}
        alerta={referenciasNuevas.total > 0}
      />
      <Indicador
        etiqueta="Procesos en trámite"
        valor={cargaActual.enTramite}
        detalle={detalleCarga}
        destino={RUTAS_JURIDICO.procesos()}
      />
      <Indicador
        etiqueta={`Sin avances en ${DIAS_ALERTA_INACTIVIDAD} días`}
        valor={requierenAtencion.total}
        detalle={requierenAtencion.total === 0 ? 'Todos tienen movimiento reciente' : 'En trámite, sin movimiento'}
        destino={RUTAS_JURIDICO.procesos()}
        alerta={requierenAtencion.total > 0}
      />
      <Indicador
        etiqueta={`Finalizados en ${anio}`}
        valor={movimientoAnio.finalizados}
        detalle={`${plural(movimientoAnio.abiertos, 'abierto', 'abiertos')} en el año`}
        destino={RUTAS_JURIDICO.reportes()}
      />
    </div>
  )
}

interface SeccionProps {
  titulo: string
  ayuda?: string
  enlace?: { texto: string; destino: string }
  children: ReactNode
}

function Seccion({ titulo, ayuda, enlace, children }: SeccionProps) {
  return (
    <section className={`${CLASE_TARJETA} overflow-hidden`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{titulo}</h2>
          {ayuda && <p className="mt-0.5 text-xs text-gray-500">{ayuda}</p>}
        </div>
        {enlace && (
          <Link to={enlace.destino} className={CLASE_ENLACE}>
            {enlace.texto}
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

function Vacio({ children }: { children: ReactNode }) {
  return <p className="border-t border-gray-100 px-4 py-3.5 text-[13px] text-gray-500">{children}</p>
}

function ReferenciasPorAtender({ referencias }: { referencias: InicioJuridicoDto['referenciasNuevas'] }) {
  const restantes = referencias.total - referencias.items.length
  return (
    <Seccion
      titulo="Referencias por atender"
      ayuda="Las envió Trabajo Social y todavía no tienen proceso. La que más lleva esperando va primero."
      enlace={
        restantes > 0 ? { texto: `Ver las ${referencias.total}`, destino: RUTAS_JURIDICO.bandeja() } : undefined
      }
    >
      {referencias.items.length === 0 && <Vacio>No hay referencias en espera.</Vacio>}
      {referencias.items.map((referencia) => (
        <div key={referencia.referidoId} className={CLASE_FILA}>
          <div className="min-w-0 flex-1">
            <Link
              to={RUTAS_JURIDICO.usuaria(referencia.usuaria.id)}
              className="block truncate text-sm font-medium text-gray-900 hover:underline"
            >
              {referencia.usuaria.nombreCompleto}
            </Link>
            <p className="mt-0.5 text-xs text-gray-500">
              Exp. <span className="tabular-nums">{referencia.expedienteNumero}</span> · llegó{' '}
              {textoEspera(referencia.referidoEn)}
            </p>
          </div>
          <Link
            to={RUTAS_JURIDICO.registrar({ expedienteId: referencia.expedienteId, referidoId: referencia.referidoId })}
            className="whitespace-nowrap rounded-md border border-gray-300 bg-white px-3 py-1.5 text-[13px] font-medium text-brand-700 hover:bg-brand-50"
          >
            Atender caso
          </Link>
        </div>
      ))}
    </Seccion>
  )
}

function FilaProcesoInicio({ proceso, detalle }: { proceso: ProcesoResumen; detalle: ReactNode }) {
  return (
    <Link to={RUTAS_JURIDICO.proceso(proceso.id)} className={`${CLASE_FILA} hover:bg-gray-50`}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{proceso.usuaria.nombreCompleto}</p>
        <p className="mt-0.5 truncate text-xs text-gray-500">
          <span className="font-mono">{proceso.codigo}</span> · {ETIQUETAS_TIPO_PROCESO_JURIDICO[proceso.tipo]}
        </p>
      </div>
      {detalle}
    </Link>
  )
}

function SinMovimiento({ cola }: { cola: InicioJuridicoDto['requierenAtencion'] }) {
  const restantes = cola.total - cola.items.length
  return (
    <Seccion
      titulo="Procesos sin movimiento"
      ayuda={`En trámite y sin ningún avance en ${DIAS_ALERTA_INACTIVIDAD} días o más. El más olvidado va primero.`}
    >
      {cola.items.map((proceso) => (
        <FilaProcesoInicio
          key={proceso.id}
          proceso={proceso}
          detalle={<span className={`whitespace-nowrap text-xs font-medium ${CLASE_AMBAR}`}>{textoAlerta(proceso)}</span>}
        />
      ))}
      {restantes > 0 && <Vacio>Y {plural(restantes, 'proceso más', 'procesos más')} en la misma situación.</Vacio>}
    </Seccion>
  )
}

function MisProcesos({ cola }: { cola: NonNullable<InicioJuridicoDto['misProcesos']> }) {
  return (
    <Seccion
      titulo="Mis procesos en trámite"
      ayuda="Donde figuras como abogada o procuradora. El de avance más reciente va primero."
      enlace={
        cola.total > cola.items.length
          ? { texto: `Ver los ${cola.total}`, destino: RUTAS_JURIDICO.procesos({ mios: true }) }
          : undefined
      }
    >
      {cola.items.length === 0 && <Vacio>No tienes procesos en trámite asignados.</Vacio>}
      {cola.items.map((proceso) => (
        <FilaProcesoInicio
          key={proceso.id}
          proceso={proceso}
          detalle={<span className="whitespace-nowrap text-xs text-gray-500">{ETIQUETAS_FASE[proceso.fase]}</span>}
        />
      ))}
    </Seccion>
  )
}

interface FilaTipo {
  clave: string
  etiqueta: string
  total: number
}

/** Los tipos más cargados con su barra; la cola larga del catálogo se suma en una sola fila. */
function filasPorTipo(porTipo: ProcesosPorTipoDto[]): FilaTipo[] {
  const filas: FilaTipo[] = porTipo.slice(0, TIPOS_VISIBLES).map(({ tipo, total }) => ({
    clave: tipo,
    etiqueta: ETIQUETAS_TIPO_PROCESO_JURIDICO[tipo],
    total,
  }))
  const otros = porTipo.slice(TIPOS_VISIBLES)
  if (otros.length > 0) {
    filas.push({
      clave: 'OTROS',
      etiqueta: `Otros ${otros.length} tipos`,
      total: otros.reduce((suma, { total }) => suma + total, 0),
    })
  }
  return filas
}

function CargaPorTipo({ inicio }: { inicio: InicioJuridicoDto }) {
  const { cargaActual, enTramitePorTipo } = inicio
  const filas = filasPorTipo(enTramitePorTipo)
  const maximo = Math.max(0, ...filas.map((fila) => fila.total))
  const detenidos = [
    cargaActual.suspendidos > 0 && plural(cargaActual.suspendidos, 'suspendido', 'suspendidos'),
    cargaActual.abandonados > 0 && plural(cargaActual.abandonados, 'abandonado', 'abandonados'),
  ].filter(Boolean)

  return (
    <Seccion titulo="En qué se está trabajando" ayuda="Procesos en trámite según su tipo.">
      {filas.length === 0 ? (
        <Vacio>No hay procesos en trámite.</Vacio>
      ) : (
        <ul className="space-y-3 border-t border-gray-100 px-4 py-4">
          {filas.map((fila) => (
            <li key={fila.clave}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="truncate text-gray-700" title={fila.etiqueta}>
                  {fila.etiqueta}
                </span>
                <span className="font-medium tabular-nums text-gray-900">{fila.total}</span>
              </div>
              <span className="mt-1.5 block h-1.5 rounded-full bg-gray-100" aria-hidden="true">
                <span
                  className="block h-1.5 rounded-full bg-brand-500"
                  style={{ width: `${(fila.total / maximo) * 100}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
      {detenidos.length > 0 && (
        <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
          Además, sin finalizar: {detenidos.join(' y ')}.
        </p>
      )}
    </Seccion>
  )
}

function NovedadesTs({ novedades }: { novedades: NovedadTsDto[] }) {
  return (
    <Seccion titulo="Novedades de Trabajo Social" ayuda="Datos o documentos que cambiaron en expedientes que ya atiendes.">
      {novedades.length === 0 ? (
        <Vacio>Sin cambios recientes.</Vacio>
      ) : (
        <ul>
          {novedades.map((novedad) => (
            <li key={novedad.id}>
              <Link to={RUTAS_JURIDICO.usuaria(novedad.usuaria.id)} className="block border-t border-gray-100 px-4 py-3 hover:bg-gray-50">
                <p className="text-[13px] text-gray-800 [text-wrap:pretty]">{textoNovedad(novedad)}</p>
                <p className="mt-0.5 text-xs text-gray-500 tabular-nums">{formatInstanteGT(novedad.createdAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Seccion>
  )
}

/** Pantalla de entrada de Jurídico: cuánto hay pendiente y por dónde empezar, sin recorrer las listas. */
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
    <div className="mx-auto max-w-[1240px] space-y-5">
      <div>
        <p className="text-[22px] font-semibold tracking-tight text-gray-900">
          {saludo()}
          {nombre && `, ${nombre}`}
        </p>
        <p className="mt-1 text-sm text-gray-500">{formatFechaLargaGT(hoyGT())}</p>
      </div>

      {error && !inicio ? (
        <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="el inicio" onReintentar={() => void recargar()} />
      ) : !inicio ? (
        <Esqueleto />
      ) : (
        <>
          <Indicadores inicio={inicio} />
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="space-y-5">
              <ReferenciasPorAtender referencias={inicio.referenciasNuevas} />
              {inicio.requierenAtencion.total > 0 && <SinMovimiento cola={inicio.requierenAtencion} />}
              {inicio.misProcesos && <MisProcesos cola={inicio.misProcesos} />}
            </div>
            <div className="space-y-5">
              <CargaPorTipo inicio={inicio} />
              <NovedadesTs novedades={inicio.novedadesTs} />
            </div>
          </div>
          {!inicio.misProcesos && (
            <p className="text-[13px] text-gray-500">
              Tu cuenta no está vinculada a una ficha de personal de Jurídico, por eso no aparece la lista de tus
              procesos. Administración puede enlazarla.
            </p>
          )}
        </>
      )}
    </div>
  )
}
