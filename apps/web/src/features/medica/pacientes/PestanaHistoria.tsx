import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { ConsultaMedicaDto } from '@akyuam/shared'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { usePaginasCursor } from '../../psicologia/compartido/usePaginasCursor'
import { listarConsultas } from '../api/medica.api'
import DetalleConsulta from '../compartido/DetalleConsulta'
import { CLASE_TARJETA } from '../compartido/estilos'
import { anioDe, fechaCorta } from '../compartido/fechas'
import { clavePersona, primerNombre } from '../compartido/personas'
import { RUTAS_MEDICA } from '../rutas'
import { useContextoFicha } from './contextoFicha'

const CLASE_CHIP = 'whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] font-medium'
const CHIP_ACTIVO = 'border-[#1c1640] bg-[#1c1640] text-white'
const CHIP_INACTIVO = 'border-[#d5dadf] bg-white text-[#374151] hover:bg-[#f8f9fa]'

function TarjetaConsulta({ consulta, abierta, onAlternar }: { consulta: ConsultaMedicaDto; abierta: boolean; onAlternar: () => void }) {
  const esHijo = consulta.persona.ninoId !== null
  const idDetalle = `consulta-${consulta.id}`
  return (
    <article className={`${CLASE_TARJETA} overflow-hidden`}>
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={abierta}
        aria-controls={idDetalle}
        className="grid w-full grid-cols-[84px_minmax(0,1fr)_auto] items-center gap-3.5 px-[18px] py-3.5 text-left hover:bg-[#f8fafb]"
      >
        <span className="flex flex-col gap-px">
          <span className="whitespace-nowrap text-base font-semibold text-[#1c2430]">{fechaCorta(consulta.fecha)}</span>
          <span className="whitespace-nowrap text-xs tabular-nums text-[#5b6573]">
            {anioDe(consulta.fecha)} · {consulta.hora}
          </span>
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-1.5">
            {esHijo && (
              <span className="whitespace-nowrap rounded bg-[#f7f3fc] px-[7px] py-0.5 text-[11.5px] font-semibold text-[#7346a5]">
                {consulta.persona.nombreCompleto} · {consulta.persona.edad} años
              </span>
            )}
            <span className="whitespace-nowrap font-mono text-[11.5px] text-[#9aa4b0]">{consulta.codigoAtencion}</span>
          </span>
          <span className="text-sm font-semibold text-pretty text-[#1c2430]">{consulta.diagnostico}</span>
          {consulta.motivoConsulta && <span className="text-[13px] text-pretty text-[#5b6573]">{consulta.motivoConsulta}</span>}
        </span>
        <span className="whitespace-nowrap text-[13px] font-medium text-[#7346a5]">{abierta ? 'Ocultar' : 'Ver detalle'}</span>
      </button>
      {abierta && (
        <div id={idDetalle} className="border-t border-[#eef0f2] px-[18px] pb-[18px] pt-4">
          <DetalleConsulta consulta={consulta} />
        </div>
      )}
    </article>
  )
}

/** Historia clínica: todas las consultas de la paciente y sus hijos/as, con filtro por persona. */
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

  const hijos = ficha.personas.filter((p) => p.ninoId !== null)
  const usuaria = ficha.personas.find((p) => p.ninoId === null)
  const chips =
    hijos.length > 0
      ? [
          { clave: undefined, etiqueta: 'Todas' },
          { clave: 'usuaria', etiqueta: primerNombre(usuaria?.nombreCompleto ?? ficha.nombreCompleto) },
          ...hijos.map((hijo) => ({ clave: clavePersona(hijo), etiqueta: `${primerNombre(hijo.nombreCompleto)} · ${hijo.edad} años` })),
        ]
      : []

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
      {(chips.length > 0 || ficha.atencionActiva) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Filtrar por persona" className="flex flex-wrap gap-2">
            {chips.map((chip) => {
              const activo = chip.clave === persona
              return (
                <button
                  key={chip.clave ?? 'todas'}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => filtrar(chip.clave)}
                  className={`${CLASE_CHIP} ${activo ? CHIP_ACTIVO : CHIP_INACTIVO}`}
                >
                  {chip.etiqueta}
                </button>
              )
            })}
          </div>
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
          Sin consultas registradas todavía.
        </p>
      ) : (
        <>
          {items.map((consulta) => (
            <TarjetaConsulta key={consulta.id} consulta={consulta} abierta={abiertas.has(consulta.id)} onAlternar={() => alternar(consulta.id)} />
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
