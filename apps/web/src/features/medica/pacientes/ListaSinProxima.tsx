import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ETIQUETAS_GRUPO_SIN_PROXIMA_MEDICA,
  ETIQUETAS_MOTIVO_ALTA_MEDICA,
  GRUPOS_SIN_PROXIMA_MEDICA,
  PAGINA_MAX_SIN_PROXIMA_MEDICA,
  PAGINA_SIN_PROXIMA_MEDICA,
  anioActualGT,
  diasDesdeFechaGT,
  formatFechaGT,
  type CitaMedicaProgramadaDto,
  type GrupoSinProximaMedica,
  type MotivoAltaMedica,
  type SinProximaConsultaDto,
  textoCodigo,
} from '@akyuam/shared'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import Paginacion from '../../../components/ui/Paginacion'
import { useToast } from '../../../components/ui/Toast'
import { useRecurso } from '../../../lib/useRecurso'
import { listarSinProxima } from '../api/medica.api'
import ModalAlta from '../atenciones/ModalAlta'
import CodigoAtencion from '../compartido/CodigoAtencion'
import { useContextoMedica } from '../compartido/contexto'
import { CLASE_TARJETA } from '../compartido/estilos'
import { anioDe, fechaCorta, fechaLargaEnFrase } from '../compartido/fechas'
import ModalProgramar from '../compartido/ModalProgramar'
import { useRecargaNovedades } from '../compartido/useRecargaNovedades'
import { RUTAS_MEDICA } from '../rutas'

const BOTON_AGENDAR =
  'whitespace-nowrap rounded-md border border-brand-600 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-brand-600 hover:bg-brand-50'
const BOTON_ALTA =
  'whitespace-nowrap rounded-md border border-borde-fuerte bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-texto hover:bg-superficie'

/** Qué significa cada grupo, debajo de los chips, para no tener que adivinarlo. */
const AYUDA_GRUPO: Record<GrupoSinProximaMedica | 'TODAS', string> = {
  TODAS: 'Pacientes en atención sin cita programada, de la más reciente a la más antigua: la más reciente es la que todavía se recupera con una llamada.',
  NO_ASISTIO: 'Faltaron a su última cita y nadie les dio otra fecha.',
  SIN_FECHA: 'Se atendieron, pero no se agendó la siguiente consulta.',
  SIN_VENIR:
    'Llevan más de 2 meses sin venir. ¿Siguen en atención? Agéndalas o dales de alta, para que la lista no crezca con pacientes que ya no vienen.',
}

function esGrupo(valor: string | null): valor is GrupoSinProximaMedica {
  return (GRUPOS_SIN_PROXIMA_MEDICA as readonly string[]).includes(valor ?? '')
}

function leerPagina(valor: string | null): number {
  const numero = Number(valor)
  return Number.isInteger(numero) && numero >= 1 && numero <= PAGINA_MAX_SIN_PROXIMA_MEDICA ? numero : 1
}

/** "hoy", "ayer", "hace 5 días", "hace 3 semanas", "hace 4 meses", "hace más de un año". */
function haceCuanto(fecha: string): string {
  const dias = diasDesdeFechaGT(fecha)
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 14) return `hace ${dias} días`
  if (dias < 60) return `hace ${Math.floor(dias / 7)} semanas`
  if (dias < 365) return `hace ${Math.floor(dias / 30)} meses`
  return dias < 730 ? 'hace más de un año' : `hace más de ${Math.floor(dias / 365)} años`
}

/** "30 oct" en el año en curso; "30/10/2025" si es de otro año. */
function fechaBreve(fecha: string): string {
  return anioDe(fecha) === anioActualGT() ? fechaCorta(fecha) : formatFechaGT(fecha)
}

interface ListaSinProximaProps {
  /** Texto ya depurado del buscador de Pacientes (2+ letras) o undefined. Nunca va en la URL. */
  busqueda: string | undefined
}

/**
 * Pacientes › Sin próxima consulta: las que siguen en atención y no tienen cita, por páginas,
 * agrupadas por lo que pasó. El número de la tarjeta de la Agenda es el "Todas" de aquí.
 */
export default function ListaSinProxima({ busqueda }: ListaSinProximaProps) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { mostrar } = useToast()
  const { recargarContadores } = useContextoMedica()
  const grupoParam = params.get('grupo')
  const grupo = esGrupo(grupoParam) ? grupoParam : undefined
  const pagina = leerPagina(params.get('pagina'))

  const [programar, setProgramar] = useState<SinProximaConsultaDto | null>(null)
  const [alta, setAlta] = useState<SinProximaConsultaDto | null>(null)

  const cambiarParams = useCallback(
    (cambios: Record<string, string | undefined>) => {
      setParams(
        (actuales) => {
          const nuevos = new URLSearchParams(actuales)
          for (const [clave, valor] of Object.entries(cambios)) {
            if (valor) nuevos.set(clave, valor)
            else nuevos.delete(clave)
          }
          return nuevos
        },
        { replace: true },
      )
    },
    [setParams],
  )

  // Una búsqueda nueva empieza en la primera página (la primera vez no: se respeta la URL).
  const busquedaAnterior = useRef(busqueda)
  useEffect(() => {
    if (busquedaAnterior.current === busqueda) return
    busquedaAnterior.current = busqueda
    cambiarParams({ pagina: undefined })
  }, [busqueda, cambiarParams])

  const lista = useRecurso(useCallback(() => listarSinProxima({ q: busqueda, grupo, pagina }), [busqueda, grupo, pagina]))
  const { recargar } = lista
  useRecargaNovedades(recargar)

  // Si se agendó o dio de alta a la última de la última página, se vuelve a la que sí tiene filas.
  const datosActuales = lista.datos
  useEffect(() => {
    if (!datosActuales || datosActuales.items.length > 0 || datosActuales.pagina <= 1) return
    const ultima = Math.max(1, Math.ceil(datosActuales.total / datosActuales.porPagina))
    cambiarParams({ pagina: ultima > 1 ? String(ultima) : undefined })
  }, [datosActuales, cambiarParams])

  function trasCambio() {
    void recargar()
    recargarContadores()
  }

  function trasProgramar(cita: CitaMedicaProgramadaDto) {
    setProgramar(null)
    mostrar(`Consulta programada: ${fechaLargaEnFrase(cita.fecha)}, ${cita.hora}`, 'success', {
      etiqueta: 'Ver en agenda',
      onClick: () => navigate(RUTAS_MEDICA.agenda(cita.fecha)),
    })
    trasCambio()
  }

  function trasAlta(paciente: SinProximaConsultaDto, motivo: MotivoAltaMedica) {
    setAlta(null)
    mostrar(`${paciente.usuariaNombreCompleto} · ${textoCodigo('Atención', paciente.codigoAtencion)} cerrada · ${ETIQUETAS_MOTIVO_ALTA_MEDICA[motivo]}`)
    trasCambio()
  }

  const datos = lista.datos
  const chips: { clave: GrupoSinProximaMedica | undefined; etiqueta: string; total: number | undefined }[] = [
    { clave: undefined, etiqueta: 'Todas', total: datos?.conteos.TODAS },
    ...GRUPOS_SIN_PROXIMA_MEDICA.map((clave) => ({
      clave,
      etiqueta: ETIQUETAS_GRUPO_SIN_PROXIMA_MEDICA[clave],
      total: datos?.conteos[clave],
    })),
  ]
  const desde = datos ? (datos.pagina - 1) * datos.porPagina + 1 : 0
  const hasta = datos ? desde + datos.items.length - 1 : 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <div role="group" aria-label="Filtrar por lo que pasó" className="flex flex-wrap gap-1.5">
          {chips.map((chip) => {
            const activo = chip.clave === grupo
            return (
              <button
                key={chip.clave ?? 'todas'}
                type="button"
                aria-pressed={activo}
                onClick={() => cambiarParams({ grupo: chip.clave, pagina: undefined })}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1 text-[12.5px] font-medium ${
                  activo ? 'border-seleccion-borde bg-seleccion text-brand-700' : 'border-borde bg-white text-texto-cuerpo hover:bg-superficie'
                }`}
              >
                {chip.etiqueta}
                {chip.total !== undefined && <span className="tabular-nums opacity-75">{chip.total}</span>}
              </button>
            )
          })}
        </div>
        <p className="max-w-[75ch] text-[12.5px] text-texto-suave">{AYUDA_GRUPO[grupo ?? 'TODAS']}</p>
      </div>

      {lista.error ? (
        <ErrorVista mensaje={lista.error.mensaje} sinPermiso={lista.error.sinPermiso} recurso="las pacientes" onReintentar={() => void recargar()} />
      ) : (
        <section className={`${CLASE_TARJETA} overflow-x-auto`}>
          {!datos ? (
            <div className="p-4">
              <Esqueleto filas={5} />
            </div>
          ) : datos.items.length === 0 ? (
            <p className="p-9 text-center text-sm text-texto-suave">
              {busqueda
                ? 'Ninguna paciente sin próxima consulta coincide con la búsqueda.'
                : grupo
                  ? 'Ninguna paciente en este grupo.'
                  : 'Todas las pacientes en atención tienen fecha.'}
            </p>
          ) : (
            <table className="w-full min-w-[760px] text-left text-[13.5px] text-texto">
              <caption className="sr-only">Pacientes sin próxima consulta</caption>
              <thead className="bg-superficie text-[11px] font-semibold uppercase tracking-[.06em] text-texto-suave">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Paciente
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Qué pasó
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Atendió
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {datos.items.map((paciente) => (
                  <tr key={paciente.atencionId} className="border-t border-borde-suave align-middle">
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <Link
                          to={RUTAS_MEDICA.paciente(paciente.usuariaId)}
                          className="font-medium text-texto hover:text-brand-700 hover:underline hover:underline-offset-2"
                        >
                          {paciente.usuariaNombreCompleto}
                        </Link>
                        <CodigoAtencion codigo={paciente.codigoAtencion} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <span>
                          {paciente.motivo === 'NO_ASISTIO' ? 'Faltó' : 'Última consulta'}{' '}
                          <span className="whitespace-nowrap">{haceCuanto(paciente.desde)}</span>
                        </span>
                        <span className="text-xs tabular-nums text-texto-suave">{fechaBreve(paciente.desde)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-texto-cuerpo">{paciente.atendioPor ?? <span className="text-texto-sutil">—</span>}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setProgramar(paciente)}
                          aria-label={`Agendar consulta a ${paciente.usuariaNombreCompleto}`}
                          className={BOTON_AGENDAR}
                        >
                          Agendar
                        </button>
                        {paciente.grupo === 'SIN_VENIR' && (
                          <button
                            type="button"
                            onClick={() => setAlta(paciente)}
                            aria-label={`Dar de alta a ${paciente.usuariaNombreCompleto}`}
                            className={BOTON_ALTA}
                          >
                            Dar de alta
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {datos && datos.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12.5px] tabular-nums text-texto-suave">
            {datos.items.length > 0 ? `Mostrando ${desde}–${hasta} de ${datos.total}` : `${datos.total} en total`}
          </p>
          <Paginacion
            etiqueta="Páginas de pacientes sin próxima consulta"
            pagina={datos.pagina}
            pageSize={datos.porPagina}
            total={Math.min(datos.total, PAGINA_MAX_SIN_PROXIMA_MEDICA * PAGINA_SIN_PROXIMA_MEDICA)}
            onCambiar={(nueva) => cambiarParams({ pagina: nueva > 1 ? String(nueva) : undefined })}
          />
        </div>
      )}

      {programar && (
        <ModalProgramar preseleccion={{ usuariaId: programar.usuariaId }} onCerrar={() => setProgramar(null)} onProgramada={trasProgramar} />
      )}
      {alta && (
        <ModalAlta
          atencion={{ id: alta.atencionId, codigo: alta.codigoAtencion, version: alta.atencionVersion }}
          paciente={alta.usuariaNombreCompleto}
          motivoInicial="DEJO_DE_ASISTIR"
          onCerrar={() => setAlta(null)}
          onListo={(motivo) => trasAlta(alta, motivo)}
        />
      )}
    </div>
  )
}
