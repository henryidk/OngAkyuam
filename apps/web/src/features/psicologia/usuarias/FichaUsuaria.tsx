import { useCallback, useEffect, useState } from 'react'
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom'
import {
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_TIPO_REGISTRO,
  hoyGT,
  type ExpedienteDetalleArea,
  type FichaUsuariaPsicologiaDto,
  type ReferenciaHistorialPsicologiaDto,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import Button from '../../../components/ui/Button'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import Tabs from '../../../components/ui/Tabs'
import { useToast } from '../../../components/ui/Toast'
import { extraerMensajeError } from '../../../lib/errors'
import { fechaDeInstante, iniciales } from '../../../lib/formato'
import { useRecurso } from '../../../lib/useRecurso'
import { rangoEdadCorto } from '../../trabajo-social/usuarias/filaUsuaria'
import { obtenerExpedienteTs, obtenerFichaUsuaria } from '../api/psicologia.api'
import ModalProgramarCita from '../citas/ModalProgramarCita'
import { useContextoPsicologia } from '../compartido/contexto'
import { useReclamarCaso } from '../hooks/useReclamarCaso'
import { RUTAS_PSICOLOGIA } from '../rutas'
import type { ContextoFicha } from './contextoFicha'

const CLASE_BOTON_PRIMARIO =
  'inline-flex items-center rounded-md bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700'

/** Datos y documentos de Trabajo Social del expediente actual; se piden aparte de la ficha. */
function useExpedienteTs(expedienteId: string | undefined) {
  // Cada respuesta queda marcada con su expediente: al cambiar de usuaria no se muestra la anterior.
  const [resultado, setResultado] = useState<{
    expedienteId: string
    expediente: ExpedienteDetalleArea | null
    error: string | null
  } | null>(null)

  useEffect(() => {
    if (!expedienteId) return
    let cancelado = false
    obtenerExpedienteTs(expedienteId)
      .then((expediente) => {
        if (!cancelado) setResultado({ expedienteId, expediente, error: null })
      })
      .catch((err) => {
        if (!cancelado) setResultado({ expedienteId, expediente: null, error: extraerMensajeError(err) })
      })
    return () => {
      cancelado = true
    }
  }, [expedienteId])

  const vigente = resultado?.expedienteId === expedienteId ? resultado : null
  return { expediente: vigente?.expediente ?? null, error: vigente?.error ?? null }
}

function BadgeRegistro({ ficha, pendiente }: { ficha: FichaUsuariaPsicologiaDto; pendiente: boolean }) {
  if (pendiente) {
    return <span className="rounded-full bg-[#fef3c7] px-2.5 py-0.5 text-xs font-medium text-[#b45309]">Referencia nueva</span>
  }
  const clase = ficha.expediente.enAlbergue ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#f3f4f6] text-[#374151]'
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${clase}`}>
      {ETIQUETAS_TIPO_REGISTRO[ficha.expediente.tipoRegistro]}
    </span>
  )
}

/**
 * Ficha de una usuaria vista desde Psicología: encabezado, aviso de referencia nueva y pestañas.
 * Los datos personales y del caso son de Trabajo Social; Psicología solo los consulta, y solo
 * los que Trabajo Social le autorizó.
 */
export default function FichaUsuaria() {
  const { usuariaId } = useParams<{ usuariaId: string }>()
  const navigate = useNavigate()
  const { mostrar } = useToast()
  const { recargarResumen } = useContextoPsicologia()
  const cargar = useCallback(() => obtenerFichaUsuaria(usuariaId!), [usuariaId])
  const { datos: ficha, error, recargar } = useRecurso(cargar)
  const { expediente: expedienteTs, error: errorExpedienteTs } = useExpedienteTs(ficha?.expediente.id)
  const { reclamandoId, error: errorReclamar, reclamar } = useReclamarCaso()
  const [abriendoProceso, setAbriendoProceso] = useState(false)

  useTituloPagina({
    titulo: ficha?.usuaria.nombreCompleto ?? 'Usuaria',
    migas: [{ etiqueta: 'Usuarias', ruta: RUTAS_PSICOLOGIA.usuarias() }],
  })

  if (error) {
    return <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="esta usuaria" onReintentar={() => void recargar()} />
  }
  if (!ficha) return <Esqueleto />

  const { usuaria, expediente, contadores, procesos, referencias } = ficha
  const pendiente = referencias.find((referencia) => referencia.estado !== 'ATENDIDA')
  const contexto: ContextoFicha = { ficha, expedienteTs, errorExpedienteTs }

  function tomar(referencia: ReferenciaHistorialPsicologiaDto) {
    void reclamar(referencia.referidoId, {
      alTomar: () => {
        recargarResumen()
        mostrar('Caso tomado. Prográmale la primera cita.')
        navigate(RUTAS_PSICOLOGIA.agenda(undefined, referencia.referidoId))
      },
      // Otra psicóloga lo tomó primero: la ficha se vuelve a pedir y, si ya no es accesible, lo dice.
      alPerderlo: () => {
        mostrar('Otra psicóloga ya tomó este caso', 'error')
        recargarResumen()
        void recargar()
      },
    })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="rounded-xl border border-gray-200 bg-white px-6 pt-5">
        <div className="flex flex-wrap items-center gap-4">
          <span
            aria-hidden="true"
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[#eee4f8] text-base font-semibold text-[#5b3985]"
          >
            {iniciales(usuaria.nombreCompleto)}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[22px] font-semibold text-gray-900">{usuaria.nombreCompleto}</h2>
              <BadgeRegistro ficha={ficha} pendiente={Boolean(pendiente)} />
            </div>
            <p className="text-sm text-gray-500 tabular-nums">
              Expediente <strong className="font-semibold text-gray-800">{expediente.numero}</strong> ·{' '}
              {usuaria.edad} años ({rangoEdadCorto(usuaria.edad)})
              {usuaria.dpi && ` · DPI ${usuaria.dpi}`} · {ETIQUETAS_GRUPO_ETNICO[usuaria.grupoEtnico]}
              {usuaria.municipio && ` · ${usuaria.municipio}`}
            </p>
          </div>
          {procesos.length > 0 && (
            <dl className="flex gap-5 text-center">
              {(
                [
                  ['En proceso', contadores.enProceso],
                  ['Cerrados', contadores.cerrados],
                ] as const
              ).map(([etiqueta, valor]) => (
                <div key={etiqueta}>
                  <dd className="text-xl font-semibold tabular-nums text-gray-900">{valor}</dd>
                  <dt className="text-[11px] text-gray-500">{etiqueta}</dt>
                </div>
              ))}
            </dl>
          )}
          {ficha.puedeAbrirProceso && (
            <Button variante="secondary" tamano="md" onClick={() => setAbriendoProceso(true)}>
              Abrir nuevo proceso
            </Button>
          )}
        </div>
        <Tabs
          className="mt-4"
          items={[
            { to: RUTAS_PSICOLOGIA.usuaria(usuaria.id), etiqueta: 'Resumen', fin: true },
            { to: RUTAS_PSICOLOGIA.usuariaProcesos(usuaria.id), etiqueta: `Procesos (${procesos.length})` },
            { to: RUTAS_PSICOLOGIA.usuariaDatos(usuaria.id), etiqueta: 'Datos y caso' },
            { to: RUTAS_PSICOLOGIA.usuariaDocumentos(usuaria.id), etiqueta: 'Documentos de TS' },
            { to: RUTAS_PSICOLOGIA.usuariaReferencias(usuaria.id), etiqueta: `Referencias (${referencias.length})` },
          ]}
        />
      </header>

      {pendiente && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-5 py-4">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold text-gray-900">
              Referencia nueva de Trabajo Social · {fechaDeInstante(pendiente.referidoEn)}
            </p>
            <p className="text-sm text-gray-700">{pendiente.motivo || 'Sin motivo registrado.'}</p>
            <p className="text-xs text-gray-500">
              Referida por {pendiente.referidoPor}
              {pendiente.estado === 'POR_AGENDAR' && ' · Ya tomaste este caso: falta su primera cita.'}
            </p>
            {errorReclamar && (
              <p role="alert" className="text-xs font-medium text-red-700">
                {errorReclamar}
              </p>
            )}
          </div>
          {pendiente.estado === 'SIN_TOMAR' ? (
            <Button tamano="md" cargando={reclamandoId === pendiente.referidoId} onClick={() => tomar(pendiente)}>
              Tomar caso
            </Button>
          ) : (
            <Link to={RUTAS_PSICOLOGIA.agenda(undefined, pendiente.referidoId)} className={CLASE_BOTON_PRIMARIO}>
              Agendar primera cita
            </Link>
          )}
        </div>
      )}

      <Outlet context={contexto} />

      {abriendoProceso && (
        <ModalProgramarCita
          destino={{
            tipo: 'NUEVO',
            usuariaId: usuaria.id,
            usuariaNombreCompleto: usuaria.nombreCompleto,
            expedienteNumero: expediente.numero,
          }}
          fechaInicial={hoyGT()}
          onCerrar={() => setAbriendoProceso(false)}
          onGuardada={(_fecha, mensaje) => {
            setAbriendoProceso(false)
            mostrar(mensaje)
            recargarResumen()
            void recargar()
          }}
        />
      )}
    </div>
  )
}
