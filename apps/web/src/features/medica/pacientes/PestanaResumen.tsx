import { useState, type ReactNode } from 'react'
import {
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_MOTIVO_ALTA_MEDICA,
  formatFechaGT,
  type CitaMedicaBreveDto,
  type FichaPacienteMedicaDto,
} from '@akyuam/shared'
import { Link } from 'react-router-dom'
import { useToast } from '../../../components/ui/Toast'
import { extraerMensajeError } from '../../../lib/errors'
import { cambiarVisibilidad } from '../api/medica.api'
import CodigoAtencion from '../compartido/CodigoAtencion'
import { CLASE_TARJETA } from '../compartido/estilos'
import { fechaDeInstante, fechaLarga } from '../compartido/fechas'
import { primerNombre } from '../compartido/personas'
import SignosVitales from '../compartido/SignosVitales'
import { RUTAS_MEDICA } from '../rutas'
import { useContextoFicha } from './contextoFicha'

const CLASE_BOTON_PRIMARIO =
  'whitespace-nowrap rounded-md bg-[#7346a5] px-3.5 py-[9px] text-[13px] font-semibold text-white hover:bg-[#5b3985]'
const CLASE_BOTON_SECUNDARIO =
  'whitespace-nowrap rounded-md border border-[#d5dadf] bg-white px-3.5 py-2 text-[13px] font-medium text-[#1c2430] hover:bg-[#f8f9fa]'
const CLASE_ENLACE_TARJETA = 'text-[13px] font-medium text-brand-700 hover:underline'

function Tarjeta({ titulo, extremo, children }: { titulo: ReactNode; extremo?: ReactNode; children: ReactNode }) {
  return (
    <section className={`${CLASE_TARJETA} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef0f2] px-5 py-4">
        {typeof titulo === 'string' ? <h2 className="text-[15px] font-semibold text-[#1c2430]">{titulo}</h2> : titulo}
        {extremo}
      </div>
      {children}
    </section>
  )
}

function Enlace({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={CLASE_ENLACE_TARJETA}>
      {children}
    </Link>
  )
}

function textoCita(cita: CitaMedicaBreveDto) {
  return `${fechaLarga(cita.fecha)} · ${cita.hora}`
}

function personaDeCita(cita: CitaMedicaBreveDto) {
  return cita.persona.ninoId ? `Consulta de ${cita.persona.nombreCompleto}` : null
}

/** Tarjeta de la atención activa: hechos clave, acciones y "Dar de alta". */
function TarjetaAtencion({ ficha }: { ficha: FichaPacienteMedicaDto }) {
  const { abrirProgramar, abrirAlta } = useContextoFicha()
  const atencion = ficha.atencionActiva!
  const { ultimaConsulta, proximaCita } = ficha
  const hechos = [
    {
      etiqueta: 'En atención desde',
      valor: formatFechaGT(atencion.fechaInicio),
      detalle: `${atencion.consultas} ${atencion.consultas === 1 ? 'consulta' : 'consultas'} en esta atención`,
      alerta: false,
    },
    {
      etiqueta: 'Última consulta',
      valor: ultimaConsulta ? `${formatFechaGT(ultimaConsulta.fecha)} · ${ultimaConsulta.hora}` : 'Aún sin consultas',
      detalle: ultimaConsulta?.diagnostico ?? '',
      alerta: false,
    },
    {
      etiqueta: 'Próxima consulta',
      valor: proximaCita ? `${formatFechaGT(proximaCita.fecha)} · ${proximaCita.hora}` : 'Sin programar',
      detalle: proximaCita ? (personaDeCita(proximaCita) ?? fechaLarga(proximaCita.fecha)) : 'Programa la siguiente consulta',
      alerta: !proximaCita,
    },
  ]

  return (
    <section className={`${CLASE_TARJETA} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef0f2] px-5 py-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-[15px] font-semibold text-[#1c2430]">Atención médica</h2>
          <CodigoAtencion codigo={atencion.codigo} />
          <span className="rounded-full bg-[#e7f1ea] px-2 py-0.5 text-xs font-semibold text-[#2f6b3f]">En atención</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={abrirProgramar} className={CLASE_BOTON_SECUNDARIO}>
            Programar consulta
          </button>
          {/* Con una consulta sin registrar, el botón principal está en la alerta de arriba. */}
          {!ficha.citaSinRegistrar && (
            <Link to={RUTAS_MEDICA.nuevaConsulta({ usuaria: ficha.usuariaId, origen: 'ficha' })} className={CLASE_BOTON_PRIMARIO}>
              Registrar consulta
            </Link>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-5 px-5 py-[18px]">
        {hechos.map((hecho) => (
          <div key={hecho.etiqueta} className="flex min-w-0 flex-col gap-1">
            <dt className="text-[12.5px] text-[#5b6573]">{hecho.etiqueta}</dt>
            <dd className={`text-[15px] font-semibold tabular-nums ${hecho.alerta ? 'text-[#8a5a14]' : 'text-[#1c2430]'}`}>{hecho.valor}</dd>
            {hecho.detalle && <dd className="text-[13px] text-pretty text-[#5b6573]">{hecho.detalle}</dd>}
          </div>
        ))}
      </dl>
      <div className="flex justify-end border-t border-[#eef0f2] bg-[#fafbfc] px-5 py-2.5">
        <button type="button" onClick={abrirAlta} className="py-1 text-[13px] font-medium text-[#5b6573] hover:text-[#1c2430]">
          Dar de alta y cerrar la atención
        </button>
      </div>
    </section>
  )
}

/** Tarjeta sencilla de los estados sin atención activa (pendiente o de alta). */
function TarjetaSinAtencion({ titulo, texto, accion }: { titulo: string; texto: string; accion: ReactNode }) {
  return (
    <section className={`${CLASE_TARJETA} flex flex-wrap items-center justify-between gap-3 px-5 py-[18px]`}>
      <div className="flex flex-[1_1_300px] flex-col gap-[3px]">
        <h2 className="text-[15px] font-semibold text-[#1c2430]">{titulo}</h2>
        <p className="text-[13.5px] text-pretty text-[#5b6573]">{texto}</p>
      </div>
      {accion}
    </section>
  )
}

/** Interruptor con texto a la izquierda, como en el mockup. */
function Interruptor({
  etiqueta,
  detalle,
  encendido,
  ocupado,
  onCambiar,
}: {
  etiqueta: string
  detalle: string
  encendido: boolean
  ocupado: boolean
  onCambiar: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={encendido}
      disabled={ocupado}
      onClick={onCambiar}
      className="flex items-center justify-between gap-3 text-left text-[#1c2430] disabled:opacity-60"
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{etiqueta}</span>
        <span className="text-[12.5px] text-[#5b6573]">{detalle}</span>
      </span>
      <span aria-hidden="true" className={`relative h-5 w-[34px] flex-none rounded-[10px] transition-colors ${encendido ? 'bg-[#7346a5]' : 'bg-[#d5dadf]'}`}>
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.25)] transition-[left] ${encendido ? 'left-4' : 'left-0.5'}`}
        />
      </span>
    </button>
  )
}

/** Qué ve Jurídico y Psicología de esta atención. Solo existe con una atención activa. */
function TarjetaVisibilidad({ ficha }: { ficha: FichaPacienteMedicaDto }) {
  const { recargarFicha } = useContextoFicha()
  const { mostrar } = useToast()
  const atencion = ficha.atencionActiva
  const [estado, setEstado] = useState(() => ({
    version: atencion?.version ?? 0,
    juridico: atencion?.visibleJuridico ?? false,
    psicologia: atencion?.visiblePsicologia ?? false,
  }))
  const [guardando, setGuardando] = useState(false)

  async function cambiar(area: 'juridico' | 'psicologia') {
    if (!atencion) return
    const valor = !estado[area]
    setGuardando(true)
    try {
      const respuesta = await cambiarVisibilidad(atencion.id, { [area]: valor, version: estado.version })
      setEstado({ version: respuesta.version, juridico: respuesta.visibleJuridico, psicologia: respuesta.visiblePsicologia })
      const nombreArea = area === 'juridico' ? 'Jurídico' : 'Psicología'
      mostrar(valor ? `Compartido con ${nombreArea}` : `Ya no se comparte con ${nombreArea}`)
    } catch (err) {
      mostrar(extraerMensajeError(err), 'error')
      // Si otra persona cambió la atención, se trae la versión vigente.
      recargarFicha()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Tarjeta titulo="Visibilidad">
      <div className="flex flex-col gap-3 px-5 pb-4 pt-3">
        <p className="text-[13px] leading-normal text-pretty text-[#5b6573]">
          Trabajo Social ve la atención, las fechas y los signos vitales. Diagnóstico, plan y receta son solo de Medicina.
        </p>
        {atencion ? (
          <>
            <Interruptor
              etiqueta="Compartir con Jurídico"
              detalle="Fechas de consulta y constancias"
              encendido={estado.juridico}
              ocupado={guardando}
              onCambiar={() => void cambiar('juridico')}
            />
            <Interruptor
              etiqueta="Compartir con Psicología"
              detalle="Fechas de consulta"
              encendido={estado.psicologia}
              ocupado={guardando}
              onCambiar={() => void cambiar('psicologia')}
            />
          </>
        ) : (
          <p className="text-[13px] text-[#9aa4b0]">Se configura cuando hay una atención activa.</p>
        )}
      </div>
    </Tarjeta>
  )
}

/** Pestaña Resumen de la ficha: estado de la atención, signos vitales y lo que dice Trabajo Social. */
export default function PestanaResumen() {
  const { ficha, abrirProgramar, abrirInasistencia } = useContextoFicha()
  const sinRegistrar = ficha.citaSinRegistrar
  const anteriores = ficha.atenciones.filter((atencion) => atencion.estado !== 'ACTIVA')
  const ultimaAlta = anteriores.find((atencion) => atencion.fechaAlta)
  const motivoReferencia = ficha.atencionActiva?.motivoReferencia ?? ficha.pendiente?.motivo ?? null
  const grupoEtnico = ETIQUETAS_GRUPO_ETNICO[ficha.grupoEtnico as keyof typeof ETIQUETAS_GRUPO_ETNICO] ?? ficha.grupoEtnico
  const segunTs = [
    ...(motivoReferencia ? [{ etiqueta: 'Motivo de referencia', valor: motivoReferencia }] : []),
    { etiqueta: 'Teléfono', valor: ficha.telefono ?? '—' },
    { etiqueta: 'Dirección', valor: ficha.direccion ?? '—' },
    { etiqueta: 'Municipio', valor: ficha.municipio ?? '—' },
    { etiqueta: 'Grupo étnico', valor: grupoEtnico },
  ]

  return (
    <div className="flex flex-col gap-4">
      {sinRegistrar && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ecd9b8] bg-[#fbf1de] px-5 py-3.5">
          <div className="flex flex-[1_1_300px] flex-col gap-0.5">
            <span className="text-[14.5px] font-semibold text-[#6b4510]">Consulta sin registrar · {textoCita(sinRegistrar)}</span>
            <span className="text-[13px] text-[#8a5a14]">Ya pasó la hora. Regístrala o marca que no asistió.</span>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => abrirInasistencia(sinRegistrar)} className={CLASE_BOTON_SECUNDARIO}>
              No asistió
            </button>
            <Link to={RUTAS_MEDICA.nuevaConsulta({ cita: sinRegistrar.id, origen: 'ficha' })} className={CLASE_BOTON_PRIMARIO}>
              Registrar consulta
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[2_1_460px] flex-col gap-4">
          {ficha.atencionActiva ? (
            <TarjetaAtencion ficha={ficha} />
          ) : ficha.pendiente ? (
            <TarjetaSinAtencion
              titulo="Pendiente de primera consulta"
              texto="La atención médica se abre al agendar la primera consulta."
              accion={
                <button type="button" onClick={abrirProgramar} className={CLASE_BOTON_PRIMARIO}>
                  Agendar primera consulta
                </button>
              }
            />
          ) : (
            <TarjetaSinAtencion
              titulo="Sin atención activa"
              texto={`${
                ultimaAlta?.fechaAlta
                  ? `Última alta: ${formatFechaGT(ultimaAlta.fechaAlta)}${ultimaAlta.motivoAlta ? ` · ${ETIQUETAS_MOTIVO_ALTA_MEDICA[ultimaAlta.motivoAlta]}` : ''}`
                  : 'Sin atenciones'
              }. Si la paciente regresa, abre una nueva atención; su historia clínica se conserva.`}
              accion={
                <button type="button" onClick={abrirProgramar} className={CLASE_BOTON_SECUNDARIO}>
                  Nueva atención
                </button>
              }
            />
          )}

          {ficha.signosVitales && (
            <Tarjeta
              titulo={
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-[15px] font-semibold text-[#1c2430]">Signos vitales</h2>
                  <span className="text-[12.5px] text-[#5b6573]">
                    Última toma: {formatFechaGT(ficha.signosVitales.fecha)} · {primerNombre(ficha.nombreCompleto)}
                  </span>
                </div>
              }
              extremo={<Enlace to={RUTAS_MEDICA.historia(ficha.usuariaId)}>Ver historia clínica</Enlace>}
            >
              <div className="px-5 pb-[18px] pt-4">
                <SignosVitales signos={ficha.signosVitales.actual} anterior={ficha.signosVitales.anterior} />
              </div>
            </Tarjeta>
          )}

          {anteriores.length > 0 && (
            <Tarjeta titulo="Atenciones anteriores">
              <ul>
                {anteriores.map((atencion) => (
                  <li key={atencion.id} className="flex flex-wrap items-center gap-3 border-b border-[#eef0f2] px-5 py-3.5 last:border-b-0">
                    <CodigoAtencion codigo={atencion.codigo} />
                    <span className="min-w-[180px] flex-1 text-[13.5px] tabular-nums text-[#1c2430]">
                      {formatFechaGT(atencion.fechaInicio)} – {atencion.fechaAlta ? formatFechaGT(atencion.fechaAlta) : 'actual'} ·{' '}
                      {atencion.consultas} {atencion.consultas === 1 ? 'consulta' : 'consultas'}
                      {atencion.motivoAlta && ` · Alta · ${ETIQUETAS_MOTIVO_ALTA_MEDICA[atencion.motivoAlta]}`}
                    </span>
                    <Enlace to={RUTAS_MEDICA.historia(ficha.usuariaId)}>Ver consultas</Enlace>
                  </li>
                ))}
              </ul>
            </Tarjeta>
          )}
        </div>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <Tarjeta titulo="Según Trabajo Social" extremo={<Enlace to={RUTAS_MEDICA.datos(ficha.usuariaId)}>Datos y caso</Enlace>}>
            <dl className="flex flex-col px-5 pb-3.5 pt-1.5">
              {segunTs.map((dato) => (
                <div key={dato.etiqueta} className="flex flex-col gap-[3px] border-b border-[#f2f3f5] py-2.5 last:border-b-0">
                  <dt className="text-[12.5px] text-[#5b6573]">{dato.etiqueta}</dt>
                  <dd className="text-sm leading-[1.45] text-pretty text-[#1c2430]">{dato.valor}</dd>
                </div>
              ))}
            </dl>
            <p className="border-t border-[#f2f3f5] px-5 py-2.5 text-xs text-[#5b6573] tabular-nums">
              Actualizado por Trabajo Social el {fechaDeInstante(ficha.actualizadoPorTsEn)}
            </p>
          </Tarjeta>

          {/* `key`: al cambiar de atención (alta y nueva atención) el estado local arranca de nuevo. */}
          <TarjetaVisibilidad key={ficha.atencionActiva?.id ?? 'sin-atencion'} ficha={ficha} />

          {ficha.psicologia && (
            <Tarjeta
              titulo={
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-[15px] font-semibold text-[#1c2430]">Psicología</h2>
                  <CodigoAtencion codigo={ficha.psicologia.codigo} />
                </div>
              }
            >
              <dl className="flex flex-col px-5 pb-3.5 pt-1.5">
                <div className="flex flex-col gap-[3px] border-b border-[#f2f3f5] py-2.5">
                  <dt className="text-[12.5px] text-[#5b6573]">Etapa del proceso</dt>
                  <dd className="text-sm text-[#1c2430]">{ficha.psicologia.etapa}</dd>
                </div>
                <div className="flex flex-col gap-[3px] border-b border-[#f2f3f5] py-2.5">
                  <dt className="text-[12.5px] text-[#5b6573]">Inicio</dt>
                  <dd className="text-sm tabular-nums text-[#1c2430]">{formatFechaGT(ficha.psicologia.fechaInicio)}</dd>
                </div>
                <div className="flex flex-col gap-[3px] py-2.5">
                  <dt className="text-[12.5px] text-[#5b6573]">Sesiones</dt>
                  <dd className="text-sm tabular-nums text-pretty text-[#1c2430]">
                    {ficha.psicologia.sesiones.length > 0 ? ficha.psicologia.sesiones.map(formatFechaGT).join(' · ') : 'Sin sesiones todavía'}
                  </dd>
                </div>
              </dl>
              <p className="border-t border-[#eef0f2] px-5 py-2.5 text-xs text-[#9aa4b0]">Compartido por Psicología · solo lectura</p>
            </Tarjeta>
          )}
        </div>
      </div>
    </div>
  )
}
