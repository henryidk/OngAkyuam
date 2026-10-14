import { useCallback } from 'react'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { usePaginasCursor } from '../../psicologia/compartido/usePaginasCursor'
import { listarConsultas } from '../api/medica.api'
import CodigoAtencion from '../compartido/CodigoAtencion'
import DetalleConsulta from '../compartido/DetalleConsulta'
import { CLASE_TARJETA } from '../compartido/estilos'
import { anioDe, fechaLarga } from '../compartido/fechas'

interface ConsultasAnterioresProps {
  usuariaId: string
  /** "usuaria" o el id del hijo/a: solo se ven las consultas de la persona que se atiende. */
  persona: string
  nombre: string
}

/** Pestaña "Consultas anteriores" del formulario: el historial de esa persona, completo y de solo lectura. */
export default function ConsultasAnteriores({ usuariaId, persona, nombre }: ConsultasAnterioresProps) {
  const cargar = useCallback((cursor?: string) => listarConsultas(usuariaId, { persona, cursor }), [usuariaId, persona])
  const { items, error, hayMas, cargarMas, cargandoMas, errorMas, recargar } = usePaginasCursor(`${usuariaId}:${persona}`, cargar)

  if (error) {
    return (
      <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="las consultas anteriores" onReintentar={() => void recargar()} />
    )
  }
  if (!items) return <Esqueleto filas={3} />
  if (items.length === 0) {
    return <p className={`${CLASE_TARJETA} p-10 text-center text-sm text-[#5b6573]`}>Es la primera consulta de {nombre}.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((consulta) => (
        <article key={consulta.id} className={`${CLASE_TARJETA} flex flex-col gap-3.5 px-5 py-[18px]`}>
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[14.5px] font-semibold text-[#1c2430]">
              {fechaLarga(consulta.fecha)} de {anioDe(consulta.fecha)}
            </h3>
            <span className="text-[12.5px] text-[#5b6573]">
              {consulta.hora} · atención <CodigoAtencion codigo={consulta.codigoAtencion} />
            </span>
          </header>
          <DetalleConsulta consulta={consulta} />
        </article>
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
    </div>
  )
}
