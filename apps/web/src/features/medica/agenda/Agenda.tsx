import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import {
  hoyGT,
  lunesDeSemanaGT,
  sumarDiasGT,
  type CitaAgendaMedicaDto,
  type CitaMedicaProgramadaDto,
  type ProgramablesMedicaQuery,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { useToast } from '../../../components/ui/Toast'
import { useRecurso } from '../../../lib/useRecurso'
import { obtenerDia, obtenerSemana } from '../api/medica.api'
import { useContextoMedica } from '../compartido/contexto'
import EncabezadoPagina from '../compartido/EncabezadoPagina'
import { diaHabil, diaSemanaCorto, fechaLarga, fechaLargaEnFrase, numeroDia, textoSemana } from '../compartido/fechas'
import { useRecargaNovedades } from '../compartido/useRecargaNovedades'
import FilaCita from './FilaCita'
import ModalInasistencia, { type ResultadoInasistencia } from '../compartido/ModalInasistencia'
import ModalProgramar from '../compartido/ModalProgramar'
import PanelesAgenda from './PanelesAgenda'

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/

interface InasistenciaAbierta {
  cita: CitaAgendaMedicaDto
  modo: 'inasistencia' | 'reprogramar'
}

/**
 * Agenda de consultas: la semana (lunes a viernes) con el día abierto y, a la derecha, lo que
 * pide acción (referencias por agendar, citas pasadas sin registrar, pacientes sin próxima
 * consulta). El día vive en la URL (`?dia=`) para que "Ver en agenda" y recargar caigan ahí.
 */
export default function Agenda() {
  useTituloPagina({ titulo: 'Agenda' })
  const [params, setParams] = useSearchParams()
  const { mostrar } = useToast()
  const { recargarContadores } = useContextoMedica()

  const parametroDia = params.get('dia')
  const dia = parametroDia && FORMATO_FECHA.test(parametroDia) ? parametroDia : diaHabil(hoyGT())
  const lunes = lunesDeSemanaGT(dia)
  const hoy = hoyGT()

  const semana = useRecurso(useCallback(() => obtenerSemana(lunes), [lunes]))
  const agendaDia = useRecurso(useCallback(() => obtenerDia(dia), [dia]))
  const recargarSemana = semana.recargar
  const recargarDia = agendaDia.recargar

  const recargarTodo = useCallback(() => {
    void recargarSemana()
    void recargarDia()
  }, [recargarSemana, recargarDia])
  useRecargaNovedades(recargarTodo)

  // `?agendar=<referidoId>` llega desde el Área de atención (otra ruta: la Agenda se monta de
  // nuevo): abre el modal con esa paciente y se quita de la URL para que volver atrás o recargar
  // no lo reabra.
  const agendar = params.get('agendar')
  const [programar, setProgramar] = useState<ProgramablesMedicaQuery | null>(() => (agendar ? { referidoId: agendar } : null))
  const [inasistencia, setInasistencia] = useState<InasistenciaAbierta | null>(null)
  const [referidoResaltado, setReferidoResaltado] = useState<string | null>(agendar)

  useEffect(() => {
    if (!agendar) return
    setParams(
      (actuales) => {
        const siguientes = new URLSearchParams(actuales)
        siguientes.delete('agendar')
        return siguientes
      },
      { replace: true },
    )
  }, [agendar, setParams])

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
    setReferidoResaltado(null)
    const cuando = `${fechaLargaEnFrase(cita.fecha)}, ${cita.hora}`
    mostrar(
      cita.atencionAbierta ? `Atención ${cita.codigoAtencion} abierta · Consulta programada: ${cuando}` : `Consulta programada: ${cuando}`,
    )
    // Recargar siempre: si el día nuevo cae en la misma semana, la tira no se vuelve a pedir sola.
    recargarTodo()
    if (cita.fecha !== dia) irADia(cita.fecha)
    recargarContadores()
  }

  function trasInasistencia({ mensaje, nuevaFecha }: ResultadoInasistencia) {
    setInasistencia(null)
    mostrar(mensaje, 'success', nuevaFecha ? { etiqueta: 'Ver en agenda', onClick: () => irADia(nuevaFecha) } : undefined)
    recargarTodo()
    recargarContadores()
  }

  const citas = agendaDia.datos?.citas ?? []
  const atendidas = citas.filter((cita) => cita.estadoVista === 'ATENDIDA').length
  const porAtender = citas.filter((cita) => ['PROGRAMADA', 'EN_CURSO', 'SIN_REGISTRAR'].includes(cita.estadoVista)).length
  const titulo = dia === hoy ? `Hoy, ${fechaLargaEnFrase(dia)}` : fechaLarga(dia)
  const resumen = !agendaDia.datos
    ? ' '
    : citas.length > 0
      ? `${citas.length} ${citas.length === 1 ? 'consulta' : 'consultas'} · ${atendidas} ${atendidas === 1 ? 'atendida' : 'atendidas'} · ${porAtender} por atender`
      : 'Sin consultas programadas'

  return (
    <div className="mx-auto max-w-[1180px] space-y-4">
      <EncabezadoPagina
        eyebrow="Agenda de consultas"
        titulo={titulo}
        descripcion={resumen}
        extremo={
          <>
            <div className="flex items-center overflow-hidden rounded-md border border-[#d5dadf] bg-white">
              <button
                type="button"
                aria-label="Semana anterior"
                onClick={() => irADia(sumarDiasGT(dia, -7))}
                className="px-3 py-2 text-[#1c2430] hover:bg-[#f8f9fa]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => irADia(diaHabil(hoy))}
                className="whitespace-nowrap border-x border-[#e3e6ea] px-3 py-2 text-[13px] font-medium text-[#1c2430] hover:bg-[#f8f9fa]"
              >
                Hoy
              </button>
              <button
                type="button"
                aria-label="Semana siguiente"
                onClick={() => irADia(sumarDiasGT(dia, 7))}
                className="px-3 py-2 text-[#1c2430] hover:bg-[#f8f9fa]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <span className="whitespace-nowrap text-[13.5px] font-medium text-[#1c2430]">{textoSemana(lunes)}</span>
            <button
              type="button"
              onClick={() => setProgramar({})}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-[#7346a5] px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#5b3985]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Programar consulta
            </button>
          </>
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
        <div className="flex flex-wrap items-start gap-5">
          <div className="min-w-0 flex-[999_1_460px] overflow-hidden rounded-lg border border-[#e3e6ea] bg-white">
            {citas.length === 0 ? (
              <p className="p-12 text-center text-sm text-[#5b6573]">No hay consultas este día.</p>
            ) : (
              citas.map((cita) => (
                <FilaCita
                  key={cita.id}
                  cita={cita}
                  onNoAsistio={() => setInasistencia({ cita, modo: 'inasistencia' })}
                  onReprogramar={() => setInasistencia({ cita, modo: 'reprogramar' })}
                  onIrA={irADia}
                />
              ))
            )}
          </div>
          <PanelesAgenda
            pendientes={agendaDia.datos.pendientes}
            sinRegistrar={agendaDia.datos.sinRegistrar}
            sinProxima={agendaDia.datos.sinProxima}
            referidoResaltado={referidoResaltado}
            onAgendarPendiente={(referidoId) => setProgramar({ referidoId })}
            onAgendarPaciente={(usuariaId) => setProgramar({ usuariaId })}
            onNoAsistio={(cita) => setInasistencia({ cita, modo: 'inasistencia' })}
          />
        </div>
      )}

      {programar && <ModalProgramar preseleccion={programar} onCerrar={() => setProgramar(null)} onProgramada={trasProgramar} />}
      {inasistencia && (
        <ModalInasistencia
          cita={{ ...inasistencia.cita, referencia: inasistencia.cita.codigoAtencion }}
          modo={inasistencia.modo}
          onCerrar={() => setInasistencia(null)}
          onListo={trasInasistencia}
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
    <div className="grid grid-cols-5 gap-1.5 rounded-lg border border-[#e3e6ea] bg-white p-1.5">
      {fechas.map((fecha) => {
        const info = semana?.find((uno) => uno.fecha === fecha)
        const elegido = fecha === dia
        const fondo = elegido ? 'bg-[#7346a5] text-white' : fecha === hoy ? 'bg-[#f2ecfa] text-[#1c2430] hover:bg-[#eadff7]' : 'text-[#1c2430] hover:bg-[#f8f9fa]'
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
              {info?.conSinRegistrar && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#d08a1f]" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
