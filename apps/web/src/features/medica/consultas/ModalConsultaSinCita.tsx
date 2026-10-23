import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../../components/ui/Button'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { usePaginasCursor } from '../../psicologia/compartido/usePaginasCursor'
import { listarPacientes } from '../api/medica.api'
import { CLASE_CAMPO } from '../compartido/estilos'
import ModalMedica from '../compartido/ModalMedica'
import { RUTAS_MEDICA } from '../rutas'

/** Quita tildes y mayúsculas para que "maria" encuentre a "María". */
function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

/**
 * Consulta sin cita: se elige una paciente en atención y se abre el formulario. El filtro por
 * nombre se aplica sobre las pacientes ya cargadas, en memoria: el texto nunca sale del navegador.
 */
export default function ModalConsultaSinCita({ onCerrar }: { onCerrar: () => void }) {
  const navigate = useNavigate()
  const [filtro, setFiltro] = useState('')
  const cargar = useCallback((cursor?: string) => listarPacientes({ estado: 'EN_ATENCION', cursor }), [])
  const { items, error, hayMas, cargarMas, cargandoMas, errorMas, recargar } = usePaginasCursor('en-atencion', cargar)

  const buscado = normalizar(filtro)
  const visibles = items?.filter(
    (paciente) => !buscado || normalizar(paciente.nombreCompleto).includes(buscado) || paciente.expedienteNumero.includes(buscado),
  )

  function elegir(usuariaId: string) {
    navigate(RUTAS_MEDICA.nuevaConsulta({ usuaria: usuariaId, origen: 'consultas' }))
  }

  return (
    <ModalMedica
      titulo="Consulta sin cita"
      subtitulo="Elige a la paciente en atención. Si tiene una cita hoy, regístrala desde Por atender."
      onCerrar={onCerrar}
      pie={
        <Button variante="secondary" tamano="md" onClick={onCerrar}>
          Cancelar
        </Button>
      }
    >
      <input
        type="search"
        value={filtro}
        autoComplete="off"
        aria-label="Filtrar pacientes por nombre o expediente"
        placeholder="Filtrar por nombre o expediente"
        onChange={(evento) => setFiltro(evento.target.value)}
        className={CLASE_CAMPO}
      />
      {error ? (
        <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="las pacientes" onReintentar={() => void recargar()} />
      ) : !visibles ? (
        <Esqueleto filas={3} />
      ) : (
        <div className="flex flex-col gap-2">
          {visibles.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#5b6573]">
              {items?.length === 0 ? 'No hay pacientes en atención.' : 'Ninguna paciente cargada coincide.'}
            </p>
          ) : (
            <ul className="divide-y divide-[#eef0f2] rounded-lg border border-[#e3e6ea]">
              {visibles.map((paciente) => (
                <li key={paciente.usuariaId}>
                  <button
                    type="button"
                    onClick={() => elegir(paciente.usuariaId)}
                    className="flex w-full flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-[#f7f3fc]"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="text-[13.5px] font-medium text-[#1c2430]">{paciente.nombreCompleto}</span>
                      <span className="text-xs text-[#5b6573]">
                        Exp. {paciente.expedienteNumero}
                        {paciente.hijos > 0 ? ` · ${paciente.hijos} ${paciente.hijos === 1 ? 'hijo/a' : 'hijos/as'}` : ''}
                      </span>
                    </span>
                    <span className="text-[13px] font-semibold text-[#7346a5]">Registrar</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {hayMas && (
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                disabled={cargandoMas}
                onClick={() => void cargarMas()}
                className="rounded-md border border-[#d5dadf] bg-white px-3.5 py-1.5 text-[13px] font-medium text-[#1c2430] hover:bg-[#f8f9fa] disabled:opacity-60"
              >
                {cargandoMas ? 'Cargando…' : 'Cargar más pacientes'}
              </button>
              {errorMas && <p className="text-[12.5px] text-[#9b2c20]">{errorMas}</p>}
            </div>
          )}
        </div>
      )}
    </ModalMedica>
  )
}
