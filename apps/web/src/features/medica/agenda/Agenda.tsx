import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import {
  hoyGT,
  lunesDeSemanaGT,
  sumarDiasGT,
  type CitaAgendaMedicaDto,
  type CitaMedicaProgramadaDto,
  type ProgramablesMedicaQuery,
  textoCodigo,
} from '@akyuam/shared'
import AvisoAgenda from '../../../components/AvisoAgenda'
import { useTituloPagina } from '../../../components/TituloPagina'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { useToast } from '../../../components/ui/Toast'
import { useRecurso } from '../../../lib/useRecurso'
import { listarPorRegistrar, obtenerDia, obtenerSemana } from '../api/medica.api'
import { useContextoMedica } from '../compartido/contexto'
import EncabezadoPagina from '../compartido/EncabezadoPagina'
import { diaHabil, diaSemanaCorto, fechaLarga, fechaLargaEnFrase, numeroDia, textoSemana } from '../compartido/fechas'
import { useRecargaNovedades } from '../compartido/useRecargaNovedades'
import FilaCita from './FilaCita'
import ModalInasistencia, { type ResultadoInasistencia } from '../compartido/ModalInasistencia'
import ModalProgramar from '../compartido/ModalProgramar'
import { RUTAS_MEDICA } from '../rutas'
import PendientesAgenda from './PendientesAgenda'
import PrimeraConsultaReservada from './PrimeraConsultaReservada'

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/

/**
 * Agenda de consultas: la semana (lunes a viernes) con el día abierto y, a la derecha, la tarjeta
 * "Sin próxima consulta" que lleva a su lista. Aquí se programa, se registra la consulta o la
 * inasistencia y se reprograma; `?agendar=` abre la primera consulta de una referencia. Las
 * consultas de días anteriores sin registrar no se ven en la semana actual: un aviso arriba lleva
 * a Consultas › Por registrar. El día vive en la URL (`?dia=`) para que
 * "Ver en agenda", recargar y volver de registrar una consulta caigan ahí.
 */
export default function Agenda() {
  useTituloPagina({ titulo: 'Agenda' })
  const [params, setParams] = useSearchParams()
  const { mostrar } = useToast()
  const { contadores, recargarContadores } = useContextoMedica()

  const parametroDia = params.get('dia')
  const dia = parametroDia && FORMATO_FECHA.test(parametroDia) ? parametroDia : diaHabil(hoyGT())
  const lunes = lunesDeSemanaGT(dia)
  const hoy = hoyGT()
  // Se programa solo de lunes a viernes; en fin de semana la agenda abre en el lunes y lo avisa.
  const hoyEsFinDeSemana = diaHabil(hoy) !== hoy

  const semana = useRecurso(useCallback(() => obtenerSemana(lunes), [lunes]))
  const agendaDia = useRecurso(useCallback(() => obtenerDia(dia), [dia]))
  const porRegistrar = useRecurso(listarPorRegistrar)
  const recargarSemana = semana.recargar
  const recargarDia = agendaDia.recargar
  const recargarPorRegistrar = porRegistrar.recargar

  const recargarTodo = useCallback(() => {
    void recargarSemana()
    void recargarDia()
    void recargarPorRegistrar()
  }, [recargarSemana, recargarDia, recargarPorRegistrar])
  useRecargaNovedades(recargarTodo)

  // `?agendar=<referidoId>` llega del Área de atención con la referencia ya reservada. Vive en la
  // URL mientras se agenda: recargar la página la vuelve a reservar y abre el mismo modal.
  const agendar = params.get('agendar')
  const [programar, setProgramar] = useState<ProgramablesMedicaQuery | null>(null)
  const [reprogramar, setReprogramar] = useState<CitaAgendaMedicaDto | null>(null)
  const [inasistencia, setInasistencia] = useState<CitaAgendaMedicaDto | null>(null)

  const irADia = useCallback(
    (nuevo: string) => {
      setParams(
        (actuales) => {
          const siguientes = new URLSearchParams(actuales)
          siguientes.set('dia', nuevo)
          return siguientes
        },
        { replace: true },
      )
    },
    [setParams],
  )

  function trasProgramar(cita: CitaMedicaProgramadaDto) {
    setProgramar(null)
    const cuando = `${fechaLargaEnFrase(cita.fecha)}, ${cita.hora}`
    mostrar(
      cita.atencionAbierta ? `${textoCodigo('Atención', cita.codigoAtencion)} abierta · Consulta programada: ${cuando}` : `Consulta programada: ${cuando}`,
    )
    // Recargar siempre: si el día nuevo cae en la misma semana, la tira no se vuelve a pedir sola.
    recargarTodo()
    recargarContadores()
    // Al día de la cita; si era una primera consulta del Área de atención, deja de abrirse.
    setParams(
      (actuales) => {
        const siguientes = new URLSearchParams(actuales)
        siguientes.set('dia', cita.fecha)
        siguientes.delete('agendar')
        return siguientes
      },
      { replace: true },
    )
  }

  function trasReprogramar({ mensaje, nuevaFecha }: ResultadoInasistencia) {
    setReprogramar(null)
    setInasistencia(null)
    mostrar(mensaje, 'success', nuevaFecha ? { etiqueta: 'Ver en agenda', onClick: () => irADia(nuevaFecha) } : undefined)
    recargarTodo()
    recargarContadores()
  }

  const citas = agendaDia.datos?.citas ?? []
  const atendidas = citas.filter((cita) => cita.estadoVista === 'ATENDIDA').length
  const pendientesDia = citas.filter((cita) => ['PROGRAMADA', 'EN_CURSO', 'SIN_REGISTRAR'].includes(cita.estadoVista)).length
  const atrasadas = porRegistrar.datos?.totalAtrasadas ?? 0
  const titulo = dia === hoy ? `Hoy, ${fechaLargaEnFrase(dia)}` : fechaLarga(dia)
  const resumen = !agendaDia.datos
    ? ' '
    : citas.length > 0
      ? `${citas.length} ${citas.length === 1 ? 'consulta' : 'consultas'} · ${atendidas} ${atendidas === 1 ? 'atendida' : 'atendidas'} · ${pendientesDia} por atender`
      : 'Sin consultas programadas'

  return (
    <div className="mx-auto max-w-[1180px] space-y-4">
      <EncabezadoPagina
        eyebrow="Agenda de consultas"
        titulo={titulo}
        descripcion={resumen}
        extremo={
          <>
            <div className="flex items-center overflow-hidden rounded-md border border-borde-fuerte bg-white">
              <button
                type="button"
                aria-label="Semana anterior"
                aria-keyshortcuts="ArrowLeft"
                data-atajo="anterior"
                onClick={() => irADia(sumarDiasGT(dia, -7))}
                className="px-3 py-2 text-texto hover:bg-superficie"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => irADia(diaHabil(hoy))}
                className="whitespace-nowrap border-x border-borde px-3 py-2 text-[13px] font-medium text-texto hover:bg-superficie"
              >
                Hoy
              </button>
              <button
                type="button"
                aria-label="Semana siguiente"
                aria-keyshortcuts="ArrowRight"
                data-atajo="siguiente"
                onClick={() => irADia(sumarDiasGT(dia, 7))}
                className="px-3 py-2 text-texto hover:bg-superficie"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <span className="whitespace-nowrap text-[13.5px] font-medium text-texto">{textoSemana(lunes)}</span>
            <button
              type="button"
              onClick={() => setProgramar({})}
              aria-keyshortcuts="N"
              data-atajo="nuevo"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-brand-600 px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Programar consulta
            </button>
          </>
        }
      />

      <AvisoAgenda
        sinRegistrar={{
          total: atrasadas,
          texto: atrasadas === 1 ? 'Consulta de días anteriores sin registrar' : 'Consultas de días anteriores sin registrar',
          to: RUTAS_MEDICA.consultas(),
        }}
        noLaboral={
          hoyEsFinDeSemana && dia === diaHabil(hoy) ? (
            <>
              Hoy es {fechaLargaEnFrase(hoy)} y la agenda es de lunes a viernes: se muestra el {fechaLargaEnFrase(dia)}. Si
              atiendes hoy, regístralo en{' '}
              <Link to={RUTAS_MEDICA.consultas()} className="font-medium text-brand-600 underline underline-offset-2">
                Consultas › Consulta sin cita
              </Link>
              .
            </>
          ) : null
        }
      />

      <TiraSemana lunes={lunes} dia={dia} hoy={hoy} semana={semana.datos?.dias ?? null} onElegir={irADia} />

      {agendaDia.error ? (
        <ErrorVista
          mensaje={agendaDia.error.mensaje}
          sinPermiso={agendaDia.error.sinPermiso}
          recurso="la agenda"
          onReintentar={() => void agendaDia.recargar()}
        />
      ) : !agendaDia.datos ? (
        <Esqueleto filas={4} />
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section aria-label={`Consultas del ${fechaLarga(dia).toLowerCase()}`} className="min-w-0 overflow-hidden rounded-lg border border-borde bg-white">
            {citas.length === 0 ? (
              <p className="p-12 text-center text-sm text-texto-suave">No hay consultas este día.</p>
            ) : (
              citas.map((cita) => (
                <FilaCita
                  key={cita.id}
                  cita={cita}
                  onReprogramar={() => setReprogramar(cita)}
                  onNoAsistio={() => setInasistencia(cita)}
                  onIrA={irADia}
                />
              ))
            )}
          </section>
          <PendientesAgenda sinProxima={contadores?.sinProxima ?? null} />
        </div>
      )}

      {agendar && (
        <PrimeraConsultaReservada
          key={agendar}
          referidoId={agendar}
          fechaPreferida={dia >= hoy ? dia : null}
          onProgramada={trasProgramar}
        />
      )}
      {programar && (
        <ModalProgramar
          preseleccion={programar}
          // Se propone el día que se está viendo en la agenda (si no ya pasó).
          fechaPreferida={dia >= hoy ? dia : null}
          onCerrar={() => setProgramar(null)}
          onProgramada={trasProgramar}
        />
      )}
      {reprogramar && (
        <ModalInasistencia
          cita={{ ...reprogramar, referencia: reprogramar.codigoAtencion }}
          modo={reprogramar.estado === 'NO_ASISTIO' ? 'reprogramar' : 'mover'}
          onCerrar={() => setReprogramar(null)}
          onListo={trasReprogramar}
        />
      )}
      {inasistencia && (
        <ModalInasistencia
          cita={{ ...inasistencia, referencia: inasistencia.codigoAtencion }}
          modo="inasistencia"
          onCerrar={() => setInasistencia(null)}
          onListo={trasReprogramar}
        />
      )}
    </div>
  )
}

interface TiraSemanaProps {
  lunes: string
  dia: string
  hoy: string
  semana: { fecha: string; total: number; conSinRegistrar: boolean }[] | null
  onElegir: (fecha: string) => void
}

/** Lunes a viernes; el día abierto en morado, hoy con fondo suave y un punto ámbar si hay citas sin registrar. */
function TiraSemana({ lunes, dia, hoy, semana, onElegir }: TiraSemanaProps) {
  const fechas = [0, 1, 2, 3, 4].map((desplazamiento) => sumarDiasGT(lunes, desplazamiento))
  return (
    <div className="grid grid-cols-5 gap-1.5 rounded-lg border border-borde bg-white p-1.5">
      {fechas.map((fecha) => {
        const info = semana?.find((uno) => uno.fecha === fecha)
        const elegido = fecha === dia
        const fondo = elegido ? 'bg-brand-600 text-white' : fecha === hoy ? 'bg-seleccion text-texto hover:bg-brand-100' : 'text-texto hover:bg-superficie'
        let cuenta = '—'
        if (info && info.total > 0) cuenta = `${info.total} ${info.total === 1 ? 'consulta' : 'consultas'}`
        return (
          <button
            key={fecha}
            type="button"
            aria-pressed={elegido}
            aria-label={`${fechaLarga(fecha)}: ${cuenta === '—' ? 'sin consultas' : cuenta}${info?.conSinRegistrar ? ', con consultas sin registrar' : ''}`}
            onClick={() => onElegir(fecha)}
            className={`flex flex-col items-center gap-0.5 rounded-md px-1 py-2 ${fondo}`}
          >
            <span className="text-[11.5px] font-medium opacity-80">{diaSemanaCorto(fecha)}</span>
            <span className="text-[17px] font-semibold">{numeroDia(fecha)}</span>
            <span className="flex items-center gap-1 whitespace-nowrap text-[11px] opacity-85">
              {semana ? cuenta : ' '}
              {info?.conSinRegistrar && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-estado-pendiente-marca" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
