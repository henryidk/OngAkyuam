import { useCallback, useState } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import {
  ETIQUETAS_FILTRO_PACIENTES_MEDICA,
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_MOTIVO_ALTA_MEDICA,
  type CitaMedicaBreveDto,
  type CitaMedicaProgramadaDto,
  type ProgramablesMedicaQuery,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import Tabs from '../../../components/ui/Tabs'
import { useToast } from '../../../components/ui/Toast'
import { iniciales } from '../../../lib/formato'
import { useRecurso } from '../../../lib/useRecurso'
import { rangoEdadCorto } from '../../trabajo-social/usuarias/filaUsuaria'
import ModalInasistencia, { type ResultadoInasistencia } from '../agenda/ModalInasistencia'
import ModalProgramar from '../agenda/ModalProgramar'
import { obtenerFicha } from '../api/medica.api'
import ModalAlta from '../atenciones/ModalAlta'
import Chip from '../compartido/Chip'
import { useContextoMedica } from '../compartido/contexto'
import { TONO_SITUACION } from '../compartido/estilos'
import { fechaLargaEnFrase } from '../compartido/fechas'
import { useRecargaNovedades } from '../compartido/useRecargaNovedades'
import { RUTAS_MEDICA } from '../rutas'
import type { ContextoFicha } from './contextoFicha'

/**
 * Ficha de una paciente en Medicina: encabezado, pestañas (Resumen, Historia clínica, Documentos
 * médicos, Datos y caso) y los modales que se abren desde cualquiera de ellas.
 */
export default function FichaPacienteLayout() {
  const { usuariaId } = useParams<{ usuariaId: string }>()
  const contextoMedica = useContextoMedica()
  const { recargarContadores } = contextoMedica
  const { mostrar } = useToast()
  const cargar = useCallback(() => obtenerFicha(usuariaId!), [usuariaId])
  const { datos: ficha, error, recargar } = useRecurso(cargar)
  const recargarFicha = useCallback(() => void recargar(), [recargar])
  useRecargaNovedades(recargarFicha)

  const [programar, setProgramar] = useState<ProgramablesMedicaQuery | null>(null)
  const [inasistencia, setInasistencia] = useState<CitaMedicaBreveDto | null>(null)
  const [alta, setAlta] = useState(false)

  useTituloPagina({
    titulo: ficha?.nombreCompleto ?? 'Paciente',
    migas: [{ etiqueta: 'Pacientes', ruta: RUTAS_MEDICA.pacientes() }],
  })

  if (error) {
    return <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="esta paciente" onReintentar={() => void recargar()} />
  }
  if (!ficha) return <Esqueleto filas={5} />

  function trasCambio() {
    recargarFicha()
    recargarContadores()
  }

  function trasProgramar(cita: CitaMedicaProgramadaDto) {
    setProgramar(null)
    const cuando = `${fechaLargaEnFrase(cita.fecha)}, ${cita.hora}`
    mostrar(
      cita.atencionAbierta ? `Atención ${cita.codigoAtencion} abierta · Consulta programada: ${cuando}` : `Consulta programada: ${cuando}`,
    )
    trasCambio()
  }

  function trasInasistencia({ mensaje }: ResultadoInasistencia) {
    setInasistencia(null)
    mostrar(mensaje)
    trasCambio()
  }

  const contexto: ContextoFicha = {
    ...contextoMedica,
    ficha,
    recargarFicha,
    // Con una referencia pendiente se agenda esa (abre la atención); si no, una consulta de la paciente.
    abrirProgramar: () => setProgramar(ficha.pendiente ? { referidoId: ficha.pendiente.referidoId } : { usuariaId: ficha.usuariaId }),
    abrirInasistencia: setInasistencia,
    abrirAlta: () => setAlta(true),
  }
  const grupoEtnico = ETIQUETAS_GRUPO_ETNICO[ficha.grupoEtnico as keyof typeof ETIQUETAS_GRUPO_ETNICO] ?? ficha.grupoEtnico
  const datosEncabezado = [
    `${ficha.edad} años (${rangoEdadCorto(ficha.edad)})`,
    ficha.dpi && `DPI ${ficha.dpi}`,
    grupoEtnico,
    ficha.municipio,
  ].filter(Boolean)

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-4">
      <header className="flex flex-col gap-4 rounded-xl border border-[#e3e6ea] bg-white px-6 pt-5">
        <div className="flex flex-wrap items-center gap-4">
          <span
            aria-hidden="true"
            className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full bg-[#eee4f8] text-base font-semibold text-[#5b3985]"
          >
            {iniciales(ficha.nombreCompleto)}
          </span>
          <div className="flex min-w-[260px] flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-semibold text-[#1c2430]">{ficha.nombreCompleto}</h1>
              <Chip tono={TONO_SITUACION[ficha.situacion]}>{ETIQUETAS_FILTRO_PACIENTES_MEDICA[ficha.situacion]}</Chip>
            </div>
            <p className="text-sm tabular-nums text-[#5b6573] [text-wrap:pretty]">
              Expediente <strong className="font-semibold text-[#1c2430]">{ficha.expedienteNumero}</strong> ·{' '}
              {datosEncabezado.join(' · ')}
            </p>
          </div>
        </div>
        <Tabs
          items={[
            { to: RUTAS_MEDICA.paciente(ficha.usuariaId), etiqueta: 'Resumen', fin: true },
            { to: RUTAS_MEDICA.historia(ficha.usuariaId), etiqueta: `Historia clínica (${ficha.totalConsultas})` },
            { to: RUTAS_MEDICA.documentos(ficha.usuariaId), etiqueta: `Documentos médicos (${ficha.totalDocumentos})` },
            { to: RUTAS_MEDICA.datos(ficha.usuariaId), etiqueta: 'Datos y caso' },
          ]}
        />
      </header>

      <Outlet context={contexto} />

      {programar && <ModalProgramar preseleccion={programar} onCerrar={() => setProgramar(null)} onProgramada={trasProgramar} />}
      {inasistencia && (
        <ModalInasistencia
          cita={{
            ...inasistencia,
            usuariaNombreCompleto: ficha.nombreCompleto,
            referencia: ficha.atencionActiva?.codigo ?? ficha.expedienteNumero,
          }}
          modo="inasistencia"
          onCerrar={() => setInasistencia(null)}
          onListo={trasInasistencia}
        />
      )}
      {alta && ficha.atencionActiva && (
        <ModalAlta
          atencion={ficha.atencionActiva}
          onCerrar={() => setAlta(false)}
          onListo={(motivo, citasCanceladas) => {
            setAlta(false)
            mostrar(
              `Atención cerrada · ${ETIQUETAS_MOTIVO_ALTA_MEDICA[motivo]}${
                citasCanceladas > 0 ? ` · ${citasCanceladas} ${citasCanceladas === 1 ? 'consulta cancelada' : 'consultas canceladas'}` : ''
              }`,
            )
            trasCambio()
          }}
        />
      )}
    </div>
  )
}
