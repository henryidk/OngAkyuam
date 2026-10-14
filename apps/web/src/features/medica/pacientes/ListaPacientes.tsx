import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  BUSQUEDA_PACIENTES_MEDICA_MAX,
  BUSQUEDA_PACIENTES_MEDICA_MIN,
  ETIQUETAS_FILTRO_PACIENTES_MEDICA,
  FILTROS_PACIENTES_MEDICA,
  formatFechaGT,
  type FiltroPacientesMedica,
  type PacienteMedicaFilaDto,
  type PacientesMedicaPaginaDto,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { usePaginasCursor } from '../../psicologia/compartido/usePaginasCursor'
import { listarPacientes } from '../api/medica.api'
import Chip from '../compartido/Chip'
import EncabezadoPagina from '../compartido/EncabezadoPagina'
import { CLASE_TARJETA, TONO_SITUACION } from '../compartido/estilos'
import { fechaCorta } from '../compartido/fechas'
import { useRecargaNovedades } from '../compartido/useRecargaNovedades'
import { RUTAS_MEDICA } from '../rutas'

const COLUMNAS =
  'grid grid-cols-[minmax(80px,.6fr)_minmax(200px,2fr)_minmax(60px,.5fr)_minmax(110px,.9fr)_minmax(80px,.6fr)_minmax(110px,1fr)_minmax(110px,1fr)] gap-3'

const ESPERA_BUSQUEDA_MS = 300

function esFiltro(valor: string | null): valor is FiltroPacientesMedica {
  return (FILTROS_PACIENTES_MEDICA as readonly string[]).includes(valor ?? '')
}

function Proxima({ paciente }: { paciente: PacienteMedicaFilaDto }) {
  if (paciente.proximaCita) {
    return (
      <span className="whitespace-nowrap text-[13px] font-medium text-[#1c2430]">
        {fechaCorta(paciente.proximaCita.fecha)} · {paciente.proximaCita.hora}
      </span>
    )
  }
  return paciente.situacion === 'EN_ATENCION' ? (
    <span className="whitespace-nowrap text-[13px] font-medium text-[#8a5a14]">Sin programar</span>
  ) : (
    <span className="text-[13px] font-medium text-[#9aa4b0]">—</span>
  )
}

function FilaPaciente({ paciente }: { paciente: PacienteMedicaFilaDto }) {
  const detalle = [paciente.dpi && `DPI ${paciente.dpi}`, paciente.hijos > 0 && `${paciente.hijos} ${paciente.hijos === 1 ? 'hijo/a' : 'hijos/as'}`]
    .filter(Boolean)
    .join(' · ')
  return (
    <li>
      <Link
        to={RUTAS_MEDICA.paciente(paciente.usuariaId)}
        className={`${COLUMNAS} items-center border-t border-[#eef0f2] px-4 py-3 text-[13.5px] text-[#1c2430] hover:bg-[#f8fafb]`}
      >
        <span className="whitespace-nowrap font-medium tabular-nums text-[#5b3985]">{paciente.expedienteNumero}</span>
        <span className="flex min-w-0 flex-col gap-px">
          <span className="font-medium">{paciente.nombreCompleto}</span>
          {detalle && <span className="text-xs tabular-nums text-[#5b6573]">{detalle}</span>}
        </span>
        <span className="whitespace-nowrap tabular-nums">{paciente.edad}</span>
        <span className="justify-self-start">
          <Chip tono={TONO_SITUACION[paciente.situacion]}>{ETIQUETAS_FILTRO_PACIENTES_MEDICA[paciente.situacion]}</Chip>
        </span>
        <span className="tabular-nums">{paciente.consultas}</span>
        <span className="whitespace-nowrap text-[13px] text-[#5b6573]">
          {paciente.ultimaConsulta ? formatFechaGT(paciente.ultimaConsulta) : '—'}
        </span>
        <Proxima paciente={paciente} />
      </Link>
    </li>
  )
}

/** Pacientes: toda usuaria que Trabajo Social refirió a Medicina, con filtro por situación y búsqueda. */
export default function ListaPacientes() {
  useTituloPagina({ titulo: 'Pacientes' })
  const [params, setParams] = useSearchParams()
  const estadoParam = params.get('estado')
  const estado = esFiltro(estadoParam) ? estadoParam : undefined
  const q = params.get('q') ?? ''
  const [texto, setTexto] = useState(q)
  const [conteos, setConteos] = useState<PacientesMedicaPaginaDto['conteos'] | null>(null)

  // La búsqueda viaja a la URL después de una pausa al escribir, no en cada tecla.
  useEffect(() => {
    const limpio = texto.trim()
    if (limpio === q) return
    const espera = setTimeout(() => {
      setParams(
        (actuales) => {
          const nuevos = new URLSearchParams(actuales)
          if (limpio) nuevos.set('q', limpio)
          else nuevos.delete('q')
          return nuevos
        },
        { replace: true },
      )
    }, ESPERA_BUSQUEDA_MS)
    return () => clearTimeout(espera)
  }, [texto, q, setParams])

  // Con menos de 2 letras no se filtra: se pide la lista completa.
  const busqueda = q.length >= BUSQUEDA_PACIENTES_MEDICA_MIN ? q : undefined
  const cargar = useCallback(
    async (cursor?: string) => {
      const pagina = await listarPacientes({ estado, q: busqueda, cursor })
      // Los totales de los filtros vienen con la primera página.
      if (!cursor) setConteos(pagina.conteos)
      return pagina
    },
    [estado, busqueda],
  )
  const { items, error, hayMas, cargarMas, cargandoMas, errorMas, recargar } = usePaginasCursor(
    `${estado ?? 'todas'}:${busqueda ?? ''}`,
    cargar,
  )
  useRecargaNovedades(recargar)

  function filtrar(nuevo: FiltroPacientesMedica | undefined) {
    setParams(
      (actuales) => {
        const nuevos = new URLSearchParams(actuales)
        if (nuevo) nuevos.set('estado', nuevo)
        else nuevos.delete('estado')
        return nuevos
      },
      { replace: true },
    )
  }

  const chips: { clave: FiltroPacientesMedica | undefined; etiqueta: string; total: number | undefined }[] = [
    { clave: undefined, etiqueta: 'Todas', total: conteos?.TODAS },
    ...FILTROS_PACIENTES_MEDICA.map((filtro) => ({
      clave: filtro,
      etiqueta: ETIQUETAS_FILTRO_PACIENTES_MEDICA[filtro],
      total: conteos?.[filtro],
    })),
  ]

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-4">
      <EncabezadoPagina
        eyebrow="Consulta"
        titulo="Pacientes"
        descripcion="Usuarias que Trabajo Social refirió a Medicina. Abre una para ver su historia clínica, antecedentes, documentos y las fechas de cada consulta."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filtrar por situación" className="flex flex-wrap gap-2">
          {chips.map((chip) => {
            const activo = chip.clave === estado
            return (
              <button
                key={chip.clave ?? 'todas'}
                type="button"
                aria-pressed={activo}
                onClick={() => filtrar(chip.clave)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] font-medium ${
                  activo ? 'border-[#1c1640] bg-[#1c1640] text-white' : 'border-[#d5dadf] bg-white text-[#374151] hover:bg-[#f8f9fa]'
                }`}
              >
                {chip.etiqueta}
                {chip.total !== undefined && <span className="tabular-nums opacity-70">{chip.total}</span>}
              </button>
            )
          })}
        </div>
        <input
          type="search"
          value={texto}
          maxLength={BUSQUEDA_PACIENTES_MEDICA_MAX}
          onChange={(evento) => setTexto(evento.target.value)}
          placeholder="Buscar por nombre, DPI o expediente"
          aria-label="Buscar por nombre, DPI o expediente"
          className="w-[360px] max-w-full rounded-md border border-[#d5dadf] bg-white px-3 py-[9px] text-[13.5px] text-[#1c2430] focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {error ? (
        <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="las pacientes" onReintentar={() => void recargar()} />
      ) : (
        <section className={`${CLASE_TARJETA} overflow-x-auto`}>
          <div className="min-w-[860px]">
            <div
              aria-hidden="true"
              className={`${COLUMNAS} bg-[#f8f9fa] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[.06em] text-[#5b6573]`}
            >
              <span>Expediente</span>
              <span>Paciente</span>
              <span>Edad</span>
              <span>Situación</span>
              <span>Consultas</span>
              <span>Última</span>
              <span>Próxima</span>
            </div>
            {!items ? (
              <div className="p-4">
                <Esqueleto filas={5} />
              </div>
            ) : items.length === 0 ? (
              <p className="p-9 text-center text-sm text-[#5b6573]">Ninguna paciente coincide. Prueba con el DPI o el número de expediente.</p>
            ) : (
              <ul aria-label="Pacientes">
                {items.map((paciente) => (
                  <FilaPaciente key={paciente.usuariaId} paciente={paciente} />
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {hayMas && (
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            disabled={cargandoMas}
            onClick={() => void cargarMas()}
            className="rounded-md border border-[#d5dadf] bg-white px-4 py-2 text-[13px] font-medium text-[#1c2430] hover:bg-[#f8f9fa] disabled:opacity-60"
          >
            {cargandoMas ? 'Cargando…' : 'Cargar más'}
          </button>
          {errorMas && <p className="text-[12.5px] text-[#9b2c20]">{errorMas}</p>}
        </div>
      )}
    </div>
  )
}
