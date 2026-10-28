import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { ConsultaHistoriaMedicaDto, PersonaAtendidaDto } from '@akyuam/shared'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { usePaginasCursor } from '../../psicologia/compartido/usePaginasCursor'
import { listarConsultas } from '../api/medica.api'
import DetalleConsulta from '../compartido/DetalleConsulta'
import { CLASE_TARJETA, CLASES_TONO } from '../compartido/estilos'
import { anioDe, fechaLarga } from '../compartido/fechas'
import { clavePersona, iniciales, listaPrimerosNombres, primerNombre } from '../compartido/personas'
import { RUTAS_MEDICA } from '../rutas'
import { useContextoFicha } from './contextoFicha'

const CLASE_CHIP = 'flex items-center gap-1.5 whitespace-nowrap rounded-full border py-1 pl-1 pr-3 text-[13px] font-medium'
const CHIP_ACTIVO = 'border-[#1c1640] bg-[#1c1640] text-white'
const CHIP_INACTIVO = 'border-[#d5dadf] bg-white text-[#374151] hover:bg-[#f8f9fa]'

/** Consultas seguidas de una misma visita (la lista llega ordenada de la más reciente a la más antigua). */
interface Visita {
  clave: string
  consultas: ConsultaHistoriaMedicaDto[]
}

function agruparPorVisita(consultas: ConsultaHistoriaMedicaDto[]): Visita[] {
  const visitas: Visita[] = []
  for (const consulta of consultas) {
    const ultima = visitas.at(-1)
    if (ultima?.clave === consulta.visita.clave) ultima.consultas.push(consulta)
    else visitas.push({ clave: consulta.visita.clave, consultas: [consulta] })
  }
  return visitas
}

/** La usuaria primero y luego los hijos/as en el orden del expediente. */
function ordenarPorExpediente(consultas: ConsultaHistoriaMedicaDto[], personas: PersonaAtendidaDto[]) {
  const posicion = (ninoId: string | null) => {
    const indice = personas.findIndex((persona) => persona.ninoId === ninoId)
    return indice === -1 ? personas.length : indice
  }
  return [...consultas].sort((a, b) => posicion(a.persona.ninoId) - posicion(b.persona.ninoId))
}

/**
 * Lo que se dice de la visita junto a la fecha: con quién más vino la persona filtrada y, si la
 * usuaria no se atendió, que solo acompañó. `null` si no hay nada que agregar.
 */
function acompanantes(visita: ConsultaHistoriaMedicaDto['visita'], filtrada: string | null | undefined, nombreDe: (ninoId: string | null) => string | null) {
  const partes: string[] = []
  if (filtrada !== undefined) {
    const otros = visita.personas
      .filter((ninoId) => ninoId !== filtrada)
      .map(nombreDe)
      .filter((nombre): nombre is string => nombre !== null)
    if (otros.length > 0) partes.push(`Con ${listaPrimerosNombres(otros)}`)
  }
  const usuaria = nombreDe(null)
  if (!visita.personas.includes(null) && filtrada !== null && usuaria) {
    partes.push(`${partes.length > 0 ? 'acompañó' : 'Acompañó'} ${primerNombre(usuaria)}`)
  }
  return partes.length > 0 ? partes.join(' · ') : null
}

function Avatar({ nombre, tamano = 'h-8 w-8 text-[11.5px]' }: { nombre: string; tamano?: string }) {
  return (
    <span aria-hidden="true" className={`flex flex-none items-center justify-center rounded-full bg-[#f2ecfa] font-semibold text-[#5b3985] ${tamano}`}>
      {iniciales(nombre)}
    </span>
  )
}

function FilaConsulta({ consulta, conPersona, abierta, onAlternar }: { consulta: ConsultaHistoriaMedicaDto; conPersona: boolean; abierta: boolean; onAlternar: () => void }) {
  const { persona } = consulta
  const idDetalle = `consulta-${consulta.id}`
  return (
    <li className="border-t border-[#eef0f2] first:border-t-0">
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={abierta}
        aria-controls={idDetalle}
        className="flex w-full items-start gap-3 px-[18px] py-3 text-left hover:bg-[#f8fafb]"
      >
        {conPersona && <Avatar nombre={persona.nombreCompleto} />}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          {conPersona && (
            <span className="text-[13px] text-[#5b6573]">
              <span className="font-semibold text-[#1c2430]">{primerNombre(persona.nombreCompleto)}</span>
              {persona.ninoId === null ? ' · Usuaria' : ` · ${persona.edad} años`}
            </span>
          )}
          <span className="text-sm text-pretty text-[#1c2430]">
            <span className="font-medium text-[#5b6573]">Dx: </span>
            <span className="font-semibold">{consulta.diagnostico}</span>
          </span>
          {consulta.motivoConsulta && <span className="line-clamp-2 text-[13px] text-pretty text-[#5b6573]">{consulta.motivoConsulta}</span>}
        </span>
        <span className="flex flex-none flex-col items-end gap-1">
          <span className="whitespace-nowrap text-[13px] font-medium text-[#7346a5]">{abierta ? 'Ocultar' : 'Ver detalle'}</span>
          {consulta.documentos.length > 0 && (
            <span className="whitespace-nowrap text-[12px] text-[#5b6573]">
              {consulta.documentos.length} {consulta.documentos.length === 1 ? 'documento' : 'documentos'}
            </span>
          )}
        </span>
      </button>
      {abierta && (
        <div id={idDetalle} className="border-t border-dashed border-[#eef0f2] bg-[#fcfcfd] px-[18px] pb-[18px] pt-4">
          <DetalleConsulta consulta={consulta} />
        </div>
      )}
    </li>
  )
}

function TarjetaVisita({
  visita,
  filtrada,
  personas,
  nombreDe,
  abiertas,
  onAlternar,
}: {
  visita: Visita
  filtrada: string | null | undefined
  personas: PersonaAtendidaDto[]
  nombreDe: (ninoId: string | null) => string | null
  abiertas: Set<string>
  onAlternar: (id: string) => void
}) {
  const [primera] = visita.consultas
  const { fecha, hora, codigoAtencion } = primera
  const datos = primera.visita
  const detalle = acompanantes(datos, filtrada, nombreDe)
  return (
    <article className={`${CLASE_TARJETA} overflow-hidden`}>
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-[#eef0f2] bg-[#fafbfc] px-[18px] py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-[14.5px] font-semibold text-[#1c2430]">
            {fechaLarga(fecha)} de {anioDe(fecha)}
          </h3>
          <span className="text-[12.5px] tabular-nums text-[#5b6573]">
            {datos.horaFin ? `${hora} – ${datos.horaFin}` : `${hora} · sin cita`}
            {detalle && ` · ${detalle}`}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {datos.primera && <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${CLASES_TONO.purple}`}>Primera consulta</span>}
          <span className="whitespace-nowrap font-mono text-[11.5px] text-[#9aa4b0]">{codigoAtencion}</span>
        </div>
      </header>
      <ul>
        {ordenarPorExpediente(visita.consultas, personas).map((consulta) => (
          <FilaConsulta
            key={consulta.id}
            consulta={consulta}
            conPersona={filtrada === undefined}
            abierta={abiertas.has(consulta.id)}
            onAlternar={() => onAlternar(consulta.id)}
          />
        ))}
      </ul>
    </article>
  )
}

/**
 * Historia clínica agrupada por visita: cada tarjeta es un día de consulta con una fila por
 * persona atendida. El filtro por persona muestra la historia continua de la usuaria o de un hijo/a.
 */
export default function PestanaHistoria() {
  const { ficha } = useContextoFicha()
  const [params, setParams] = useSearchParams()
  const persona = params.get('persona') ?? undefined
  // La consulta que llega en la URL (p. ej. recién registrada) se abre desplegada.
  const [abiertas, setAbiertas] = useState<Set<string>>(() => new Set(params.get('consulta') ? [params.get('consulta')!] : []))

  const { usuariaId, totalConsultas } = ficha
  // `totalConsultas` en las dependencias: si la ficha se recarga con una consulta nueva, la lista también.
  const cargar = useCallback(
    (cursor?: string) => listarConsultas(usuariaId, { persona, cursor }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [usuariaId, persona, totalConsultas],
  )
  const { items, error, hayMas, cargarMas, cargandoMas, errorMas, recargar } = usePaginasCursor(
    `${usuariaId}:${persona ?? 'todas'}:${totalConsultas}`,
    cargar,
  )

  const hayHijos = ficha.personas.some((p) => p.ninoId !== null)
  const filtrada = persona === undefined ? undefined : persona === 'usuaria' ? null : persona
  const nombreDe = (ninoId: string | null) => {
    const conocida =
      ficha.personas.find((p) => p.ninoId === ninoId) ?? items?.find((consulta) => consulta.persona.ninoId === ninoId)?.persona
    return conocida?.nombreCompleto ?? (ninoId === null ? ficha.nombreCompleto : null)
  }
  const nombreFiltrada = filtrada !== undefined ? nombreDe(filtrada) : null

  function filtrar(clave: string | undefined) {
    setParams(
      (actuales) => {
        const nuevos = new URLSearchParams(actuales)
        if (clave) nuevos.set('persona', clave)
        else nuevos.delete('persona')
        nuevos.delete('consulta')
        return nuevos
      },
      { replace: true },
    )
  }

  function alternar(id: string) {
    setAbiertas((actuales) => {
      const nuevas = new Set(actuales)
      if (nuevas.has(id)) nuevas.delete(id)
      else nuevas.add(id)
      return nuevas
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {(hayHijos || ficha.atencionActiva) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {hayHijos ? (
            <div role="group" aria-label="Ver la historia de" className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-[#5b6573]">Ver:</span>
              <button
                type="button"
                aria-pressed={persona === undefined}
                onClick={() => filtrar(undefined)}
                className={`${CLASE_CHIP} pl-3 ${persona === undefined ? CHIP_ACTIVO : CHIP_INACTIVO}`}
              >
                Todas
              </button>
              {ficha.personas.map((p) => {
                const clave = clavePersona(p)
                const activo = clave === persona
                return (
                  <button
                    key={clave}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => filtrar(clave)}
                    className={`${CLASE_CHIP} ${activo ? CHIP_ACTIVO : CHIP_INACTIVO}`}
                  >
                    <Avatar nombre={p.nombreCompleto} tamano="h-6 w-6 text-[10px]" />
                    {primerNombre(p.nombreCompleto)}
                    {p.ninoId !== null && <span className={activo ? 'text-white/70' : 'text-[#9aa4b0]'}>{p.edad} años</span>}
                  </button>
                )
              })}
            </div>
          ) : (
            <span />
          )}
          {ficha.atencionActiva && (
            <Link
              to={RUTAS_MEDICA.nuevaConsulta({ usuaria: ficha.usuariaId, origen: 'ficha' })}
              className="whitespace-nowrap rounded-md bg-[#7346a5] px-3.5 py-[9px] text-[13px] font-semibold text-white hover:bg-[#5b3985]"
            >
              Registrar consulta
            </Link>
          )}
        </div>
      )}

      {error ? (
        <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="la historia clínica" onReintentar={() => void recargar()} />
      ) : !items ? (
        <Esqueleto filas={3} />
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#d5dadf] bg-white p-8 text-center text-sm text-[#5b6573]">
          {nombreFiltrada ? `${primerNombre(nombreFiltrada)} aún no tiene consultas registradas.` : 'Sin consultas registradas todavía.'}
        </p>
      ) : (
        <>
          {nombreFiltrada && (
            <p className="text-[13px] text-[#5b6573]">
              Historia clínica de <span className="font-semibold text-[#1c2430]">{nombreFiltrada}</span>
            </p>
          )}
          {agruparPorVisita(items).map((visita) => (
            <TarjetaVisita
              key={visita.clave}
              visita={visita}
              filtrada={filtrada}
              personas={ficha.personas}
              nombreDe={nombreDe}
              abiertas={abiertas}
              onAlternar={alternar}
            />
          ))}
          {hayMas && (
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                disabled={cargandoMas}
                onClick={() => void cargarMas()}
                className="rounded-md border border-[#d5dadf] bg-white px-4 py-2 text-[13px] font-medium text-[#1c2430] hover:bg-[#f8f9fa] disabled:opacity-60"
              >
                {cargandoMas ? 'Cargando…' : 'Cargar consultas más antiguas'}
              </button>
              {errorMas && <p className="text-[12.5px] text-[#9b2c20]">{errorMas}</p>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
