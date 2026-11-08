import { Link } from 'react-router-dom'
import {
  CATEGORIA_POR_TIPO_PROCESO,
  ETIQUETAS_CATEGORIA_PROCESO,
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  formatFechaGT,
  type FaseProcesoJuridico,
  type AccionProceso,
  type ProcesoDetalle,
} from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import Tabs from '../../../components/ui/Tabs'
import MenuAcciones, { type OpcionMenu } from '../../../components/ui/MenuAcciones'
import BarraAvance from '../compartido/BarraAvance'
import ChipSeguimiento from '../compartido/ChipSeguimiento'
import EtiquetaEstado from '../compartido/EtiquetaEstado'
import { RUTAS_JURIDICO } from '../rutas'
import { textoDiaRelativo } from './formatoBitacora'

interface CabeceraProcesoProps {
  proceso: ProcesoDetalle
  /** `null` si el proceso ya está cerrado y no admite audiencias. */
  onAgendar: (() => void) | null
  onActuacion: () => void
  onFinalizar: () => void
  onSuspender: () => void
  onAbandonar: () => void
}

/** Qué significa cada fase para este proceso: cuándo empezó, cómo va y si ya terminó. */
function detallesFases(proceso: ProcesoDetalle): Record<FaseProcesoJuridico, string> {
  const ultimoAvance = `Último avance ${textoDiaRelativo(proceso.ultimaActuacionEn)}`
  const cierre = proceso.fechaCierre ? `El ${formatFechaGT(proceso.fechaCierre)}` : 'Pendiente'
  return {
    INICIADO: `El ${formatFechaGT(proceso.fechaInicio)}`,
    EN_PROCESO: proceso.fase === 'INICIADO' ? 'Pendiente' : proceso.fase === 'EN_PROCESO' ? ultimoAvance : 'Completada',
    FINALIZADO: cierre,
  }
}

/** Cerrar o pausar va en el menú: es poco frecuente y no debe competir con el trabajo diario. */
function opcionesCierre(
  acciones: AccionProceso[],
  { onFinalizar, onSuspender, onAbandonar }: Pick<CabeceraProcesoProps, 'onFinalizar' | 'onSuspender' | 'onAbandonar'>,
): OpcionMenu[] {
  const opciones: (OpcionMenu & { accion: AccionProceso })[] = [
    {
      accion: 'FINALIZAR',
      clave: 'finalizar',
      etiqueta: 'Finalizar proceso',
      detalle: 'Convenio, sentencia, desistimiento u otra forma',
      onElegir: onFinalizar,
    },
    {
      accion: 'SUSPENDER',
      clave: 'suspender',
      etiqueta: 'Suspender temporalmente',
      detalle: 'Queda en pausa y puede retomarse',
      onElegir: onSuspender,
    },
    {
      accion: 'ABANDONAR',
      clave: 'abandonar',
      etiqueta: 'Registrar abandono del caso',
      detalle: 'La usuaria dejó de dar seguimiento',
      tono: 'aviso',
      onElegir: onAbandonar,
    },
  ]
  // Solo lo que la máquina de estados del backend permite ahora (`accionesDisponibles`).
  return opciones.filter((opcion) => acciones.includes(opcion.accion))
}

export default function CabeceraProceso({
  proceso,
  onAgendar,
  onActuacion,
  ...cierre
}: CabeceraProcesoProps) {
  const documentos = proceso.carpetas.reduce((total, carpeta) => total + carpeta.documentos.length, 0)
  const actuaciones = proceso.totalActuaciones
  const menu = opcionesCierre(proceso.accionesDisponibles, cierre)

  // El No. interno ya es el título de la página y los datos (No. judicial, fechas) viven en el panel
  // lateral: la cabecera solo dice qué proceso es, de quién, en qué punto va y qué se puede hacer.
  return (
    <header className="rounded-xl border border-gray-200 bg-white px-4 pt-6 shadow-[0_1px_2px_rgba(16,24,40,.04)] sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 basis-[280px]">
          <div className="flex flex-wrap items-center gap-2">
            <EtiquetaEstado estado={proceso.estadoVisible} />
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              {ETIQUETAS_CATEGORIA_PROCESO[CATEGORIA_POR_TIPO_PROCESO[proceso.tipo]]}
            </span>
            {proceso.esSeguimiento && <ChipSeguimiento anio={proceso.anioExpediente} />}
          </div>
          <h2 className="mt-2.5 text-[22px] leading-tight font-semibold tracking-tight text-balance text-gray-900">
            {ETIQUETAS_TIPO_PROCESO_JURIDICO[proceso.tipo]}
          </h2>
          <p className="mt-1.5 text-sm text-gray-600">
            <Link to={RUTAS_JURIDICO.usuaria(proceso.usuaria.id)} className="font-medium text-brand-700 hover:underline">
              {proceso.usuaria.nombreCompleto}
            </Link>{' '}
            · Expediente <span className="tabular-nums">{proceso.expedienteNumero}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onAgendar && (
            <Button variante="secondary" tamano="md" onClick={onAgendar}>
              {/* En pantallas angostas basta "Agendar": así las tres acciones caben en una fila. */}
              <span className="sm:hidden">Agendar</span>
              <span className="hidden sm:inline">Agendar audiencia</span>
            </Button>
          )}
          <Button tamano="md" onClick={onActuacion}>
            Registrar avance
          </Button>
          {menu.length > 0 && <MenuAcciones opciones={menu} etiqueta="Más acciones del proceso" boton="borde" />}
        </div>
      </div>

      {/* El avance tiene su propia franja: separado de la identidad del proceso y con aire para leerse. */}
      <div className="-mx-4 mt-5 border-t border-gray-100 px-4 py-5 sm:-mx-6 sm:px-6">
        <BarraAvance fase={proceso.fase} estado={proceso.estadoVisible} detalles={detallesFases(proceso)} />
      </div>

      <Tabs
        className="-mx-4 border-t border-gray-100 px-2 sm:-mx-6 sm:px-3"
        items={[
          { to: RUTAS_JURIDICO.proceso(proceso.id), etiqueta: 'Bitácora', conteo: actuaciones, fin: true },
          { to: RUTAS_JURIDICO.audienciasProceso(proceso.id), etiqueta: 'Audiencias' },
          { to: RUTAS_JURIDICO.documentosProceso(proceso.id), etiqueta: 'Documentos', conteo: documentos },
        ]}
      />
    </header>
  )
}
