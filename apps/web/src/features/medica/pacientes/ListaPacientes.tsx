import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  BUSQUEDA_PACIENTES_MEDICA_MAX,
  BUSQUEDA_PACIENTES_MEDICA_MIN,
  ETIQUETAS_FILTRO_PACIENTES_MEDICA,
  FILTROS_PACIENTES_MEDICA,
  PAGINA_MAX_PACIENTES_MEDICA,
  PAGINA_PACIENTES_MEDICA,
  formatFechaGT,
  type FiltroPacientesMedica,
  type PacienteMedicaFilaDto,
  type PacientesMedicaPaginaDto,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import { ErrorVista } from '../../../components/ui/EstadosVista'
import TablaDatos, { type ColumnaTabla } from '../../../components/ui/TablaDatos'
import { usePaginaConFilas, usePaginaUrl } from '../../../lib/usePaginaUrl'
import { useRecurso } from '../../../lib/useRecurso'
import { listarPacientes } from '../api/medica.api'
import Chip from '../compartido/Chip'
import EncabezadoPagina from '../compartido/EncabezadoPagina'
import { TONO_SITUACION } from '../compartido/estilos'
import { fechaCorta } from '../compartido/fechas'
import { useRecargaNovedades } from '../compartido/useRecargaNovedades'
import { useContextoMedica } from '../compartido/contexto'
import { RUTAS_MEDICA, VISTA_SIN_PROXIMA } from '../rutas'
import ListaSinProxima from './ListaSinProxima'

const ESPERA_BUSQUEDA_MS = 300

function esFiltro(valor: string | null): valor is FiltroPacientesMedica {
  return (FILTROS_PACIENTES_MEDICA as readonly string[]).includes(valor ?? '')
}

function Proxima({ paciente }: { paciente: PacienteMedicaFilaDto }) {
  if (paciente.proximaCita) {
    return (
      <span className="whitespace-nowrap text-[13px] font-medium text-texto">
        {fechaCorta(paciente.proximaCita.fecha)} · {paciente.proximaCita.hora}
      </span>
    )
  }
  return paciente.situacion === 'EN_ATENCION' ? (
    <span className="whitespace-nowrap text-[13px] font-medium text-estado-pendiente">Sin programar</span>
  ) : (
    <span className="text-[13px] font-medium text-texto-sutil">—</span>
  )
}

/**
 * Pacientes: toda usuaria que Trabajo Social refirió a Medicina, con filtro por situación y
 * búsqueda. El chip "Sin próxima consulta" (`?vista=sin-proxima`) cambia a esa lista, por páginas.
 */
export default function ListaPacientes() {
  useTituloPagina({ titulo: 'Pacientes' })
  const [params, setParams] = useSearchParams()
  const { contadores } = useContextoMedica()
  const sinProxima = params.get('vista') === VISTA_SIN_PROXIMA
  const estadoParam = params.get('estado')
  const estado = !sinProxima && esFiltro(estadoParam) ? estadoParam : undefined
  // El texto buscado (puede ser un nombre o un DPI) vive solo en el estado de la pantalla, nunca
  // en la URL: así no queda en el historial del navegador ni en los logs de acceso.
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')
  const [conteos, setConteos] = useState<PacientesMedicaPaginaDto['conteos'] | null>(null)

  // La búsqueda se aplica después de una pausa al escribir, no en cada tecla.
  useEffect(() => {
    const limpio = texto.trim()
    if (limpio === q) return
    const espera = setTimeout(() => setQ(limpio), ESPERA_BUSQUEDA_MS)
    return () => clearTimeout(espera)
  }, [texto, q])

  // Con menos de 2 letras no se filtra: se pide la lista completa.
  const busqueda = q.length >= BUSQUEDA_PACIENTES_MEDICA_MIN ? q : undefined

  function filtrar(nuevo: FiltroPacientesMedica | undefined) {
    // Elegir una situación deja la lista "Sin próxima consulta" y sus parámetros (grupo, página).
    setParams(nuevo ? new URLSearchParams({ estado: nuevo }) : new URLSearchParams(), { replace: true })
  }

  function verSinProxima() {
    setParams(new URLSearchParams({ vista: VISTA_SIN_PROXIMA }), { replace: true })
  }

  const chips: { clave: FiltroPacientesMedica | undefined; etiqueta: string; total: number | undefined }[] = [
    { clave: undefined, etiqueta: 'Todas', total: conteos?.TODAS },
    ...FILTROS_PACIENTES_MEDICA.map((filtro) => ({
      clave: filtro,
      etiqueta: ETIQUETAS_FILTRO_PACIENTES_MEDICA[filtro],
      total: conteos?.[filtro],
    })),
  ]
  const claseChip = (activo: boolean) =>
    `flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] font-medium ${
      activo ? 'border-brand-950 bg-brand-950 text-white' : 'border-borde-fuerte bg-white text-texto-cuerpo hover:bg-superficie'
    }`

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
            const activo = !sinProxima && chip.clave === estado
            return (
              <button
                key={chip.clave ?? 'todas'}
                type="button"
                aria-pressed={activo}
                onClick={() => filtrar(chip.clave)}
                className={claseChip(activo)}
              >
                {chip.etiqueta}
                {chip.total !== undefined && <span className="tabular-nums opacity-70">{chip.total}</span>}
              </button>
            )
          })}
          <button type="button" aria-pressed={sinProxima} onClick={verSinProxima} className={claseChip(sinProxima)}>
            Sin próxima consulta
            {contadores && <span className="tabular-nums opacity-70">{contadores.sinProxima}</span>}
          </button>
        </div>
        <input
          type="search"
          value={texto}
          maxLength={BUSQUEDA_PACIENTES_MEDICA_MAX}
          onChange={(evento) => setTexto(evento.target.value)}
          placeholder="Buscar por nombre, DPI o expediente"
          aria-label="Buscar por nombre, DPI o expediente"
          className="w-[360px] max-w-full rounded-md border border-borde-fuerte bg-white px-3 py-[9px] text-[13.5px] text-texto focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {sinProxima ? (
        <ListaSinProxima busqueda={busqueda} />
      ) : (
        <ListadoGeneral estado={estado} busqueda={busqueda} onConteos={setConteos} />
      )}
    </div>
  )
}

interface ListadoGeneralProps {
  estado: FiltroPacientesMedica | undefined
  busqueda: string | undefined
  onConteos: (conteos: PacientesMedicaPaginaDto['conteos']) => void
}

const COLUMNAS_PACIENTES: ColumnaTabla<PacienteMedicaFilaDto>[] = [
  {
    clave: 'paciente',
    encabezado: 'Paciente',
    rol: 'titulo',
    celda: (paciente) => {
      const detalle = [
        `Exp. ${paciente.expedienteNumero}`,
        paciente.dpi && `DPI ${paciente.dpi}`,
        paciente.hijos > 0 && `${paciente.hijos} ${paciente.hijos === 1 ? 'hijo/a' : 'hijos/as'}`,
      ]
        .filter(Boolean)
        .join(' · ')
      return (
        <div className="flex min-w-0 flex-col gap-px">
          <Link
            to={RUTAS_MEDICA.paciente(paciente.usuariaId)}
            className="font-medium text-texto hover:text-brand-700 hover:underline hover:underline-offset-2"
          >
            {paciente.nombreCompleto}
          </Link>
          <span className="text-xs tabular-nums text-texto-suave">{detalle}</span>
        </div>
      )
    },
  },
  { clave: 'edad', encabezado: 'Edad', className: 'tabular-nums', celda: (paciente) => paciente.edad },
  {
    clave: 'estado',
    encabezado: 'Estado',
    celda: (paciente) => (
      <Chip tono={TONO_SITUACION[paciente.situacion]}>{ETIQUETAS_FILTRO_PACIENTES_MEDICA[paciente.situacion]}</Chip>
    ),
  },
  { clave: 'consultas', encabezado: 'Consultas', className: 'tabular-nums', celda: (paciente) => paciente.consultas },
  {
    clave: 'ultima',
    encabezado: 'Última',
    className: 'whitespace-nowrap text-[13px] text-texto-suave',
    celda: (paciente) => (paciente.ultimaConsulta ? formatFechaGT(paciente.ultimaConsulta) : '—'),
  },
  { clave: 'proxima', encabezado: 'Próxima', celda: (paciente) => <Proxima paciente={paciente} /> },
]

/** La tabla de todas las pacientes (o de una situación), por páginas numeradas. */
function ListadoGeneral({ estado, busqueda, onConteos }: ListadoGeneralProps) {
  const { pagina, irAPagina } = usePaginaUrl(PAGINA_MAX_PACIENTES_MEDICA, busqueda)
  const lista = useRecurso(
    useCallback(async () => {
      const respuesta = await listarPacientes({ estado, q: busqueda, pagina })
      onConteos(respuesta.conteos)
      return respuesta
    }, [estado, busqueda, pagina, onConteos]),
  )
  const { recargar } = lista
  useRecargaNovedades(recargar)
  usePaginaConFilas(lista.datos, irAPagina)
  const datos = lista.datos

  if (lista.error) {
    return (
      <ErrorVista mensaje={lista.error.mensaje} sinPermiso={lista.error.sinPermiso} recurso="las pacientes" onReintentar={() => void recargar()} />
    )
  }
  return (
    <TablaDatos
      titulo="Pacientes"
      columnas={COLUMNAS_PACIENTES}
      filas={datos?.items ?? null}
      claveFila={(paciente) => paciente.usuariaId}
      vacio={
        busqueda
          ? 'Ninguna paciente coincide. Prueba con el DPI o el número de expediente.'
          : 'No hay pacientes en esta situación.'
      }
      paginacion={
        datos
          ? {
              pagina: datos.pagina,
              porPagina: datos.porPagina,
              total: datos.total,
              totalNavegable: Math.min(datos.total, PAGINA_MAX_PACIENTES_MEDICA * PAGINA_PACIENTES_MEDICA),
              onCambiar: irAPagina,
            }
          : undefined
      }
    />
  )
}
