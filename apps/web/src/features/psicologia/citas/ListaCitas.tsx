import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Search } from 'lucide-react'
import { citasPsicologiaQuerySchema, ETIQUETAS_ESTADO_CITA_PSICOLOGICA, ETIQUETAS_TIPO_CITA_PSICOLOGICA,
  ESTADOS_CITA_PSICOLOGICA, formatInstanteGT, hoyGT, sumarDiasGT, type CitasPsicologiaQuery } from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import Button from '../../../components/ui/Button'
import EmptyState from '../../../components/ui/EmptyState'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { useRecurso } from '../../../lib/useRecurso'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../../juridico/compartido/campos'
import { listarCitasPsicologia } from '../api/psicologia.api'
import { RUTAS_PSICOLOGIA } from '../rutas'

export default function ListaCitas() {
  useTituloPagina({ titulo: 'Citas' })
  const hoy = hoyGT()
  const [desde, setDesde] = useState(`${hoy.slice(0, 4)}-01-01`)
  const [hasta, setHasta] = useState(hoy)
  const [estado, setEstado] = useState('')
  const [soloMios, setSoloMios] = useState(false)
  const [errorFiltro, setErrorFiltro] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<CitasPsicologiaQuery>({ desde, hasta, soloMios: false, pagina: 1 })
  const { datos, error, cargando, recargar } = useRecurso(useCallback(() => listarCitasPsicologia(filtro), [filtro]))
  function aplicar() {
    const resultado = citasPsicologiaQuerySchema.safeParse({ desde, hasta, estado: estado || undefined, soloMios: String(soloMios), pagina: 1 })
    if (!resultado.success) { setErrorFiltro(resultado.error.issues[0]?.message ?? 'Revisa las fechas'); return }
    if (hasta > sumarDiasGT(desde, 366)) { setErrorFiltro('Selecciona un rango de hasta un año'); return }
    setErrorFiltro(null)
    setFiltro(resultado.data)
  }
  return <div className="mx-auto max-w-6xl space-y-5">
    <header><h1 className="text-2xl font-semibold tracking-tight text-gray-900">Citas de Psicología</h1>
      <p className="mt-1 text-sm text-gray-500">Consulta las citas del equipo y abre una para ver su información y el registro de la sesión.</p></header>
    <form onSubmit={e => { e.preventDefault(); aplicar() }} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900">Período de consulta</h2>
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <label className={CLASE_ETIQUETA}>Desde<input required type="date" value={desde} onChange={e => setDesde(e.target.value)} className={CLASE_CAMPO} /></label>
        <label className={CLASE_ETIQUETA}>Hasta<input required type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={CLASE_CAMPO} /></label>
        <label className={CLASE_ETIQUETA}>Estado<select value={estado} onChange={e => setEstado(e.target.value)} className={CLASE_CAMPO}>
          <option value="">Todos los estados</option>{ESTADOS_CITA_PSICOLOGICA.map(e => <option key={e} value={e}>{ETIQUETAS_ESTADO_CITA_PSICOLOGICA[e]}</option>)}</select></label>
        <Button type="submit" tamano="md" cargando={cargando}><Search className="h-4 w-4" aria-hidden />Aplicar filtros</Button>
      </div>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={soloMios} onChange={e => setSoloMios(e.target.checked)} className="h-4 w-4 accent-brand-600" />Solo mis pacientes</label>
      {errorFiltro && <p role="alert" className="text-sm text-red-600">{errorFiltro}</p>}
    </form>
    {error ? <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="las citas" onReintentar={() => void recargar()} /> : !datos ? <Esqueleto /> : <>
      <div className="grid gap-3 sm:grid-cols-3">
        {([['Atendidas', datos.atendidas], ['Primera atención', datos.primerasAtenciones], ['Ausencias', datos.ausencias]] as const).map(([titulo, valor]) => <div key={titulo} className="rounded-xl border border-gray-200 bg-white p-5"><p className="text-sm text-gray-500">{titulo}</p><p className="mt-4 text-3xl font-semibold text-gray-900">{valor}</p></div>)}
      </div>
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4"><h2 className="font-semibold text-gray-900">Detalle del período</h2><p className="mt-1 text-xs text-gray-500">{datos.total} citas · Totales según los filtros aplicados · {filtro.soloMios ? 'Mis pacientes' : 'Todo el equipo'}</p></div>
        {datos.items.length === 0 ? <EmptyState Icono={CalendarClock} titulo="No hay citas en este período" descripcion="Prueba otro rango de fechas o estado." /> : <ul className="divide-y divide-gray-100">
          {datos.items.map(cita => <li key={cita.id}><Link to={RUTAS_PSICOLOGIA.detalleCita(cita.id)} className="grid items-center gap-3 px-5 py-4 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-600 sm:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <span className="text-xs text-gray-600">{formatInstanteGT(cita.fechaHora)}</span>
            <span className="min-w-0"><span className="block text-sm font-semibold text-gray-900">{cita.persona.nombreCompleto}</span><span className="block text-xs text-gray-500">{cita.procesoCodigo}</span>{cita.persona.ninoId && <span className="block text-xs text-gray-500">Hija/o de {cita.usuariaNombreCompleto}</span>}</span>
            <span className="text-xs text-gray-600"><span className="block">{ETIQUETAS_TIPO_CITA_PSICOLOGICA[cita.tipo]} · {cita.profesional?.nombre ?? 'Profesional sin registrar'}</span><span className="mt-1 block text-gray-500">{cita.clinica || 'Clínica sin registrar'}</span></span>
            <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${cita.estado === 'ATENDIDA' ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-700'}`}>{ETIQUETAS_ESTADO_CITA_PSICOLOGICA[cita.estado]}</span>
          </Link></li>)}
        </ul>}
        <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
          <span>Página {datos.pagina} de {Math.max(1, Math.ceil(datos.total / datos.porPagina))}</span><div className="flex gap-2">
            <Button variante="secondary" disabled={cargando || filtro.pagina <= 1} onClick={() => setFiltro(f => ({ ...f, pagina: f.pagina - 1 }))}>Anterior</Button>
            <Button variante="secondary" disabled={cargando || filtro.pagina * datos.porPagina >= datos.total} onClick={() => setFiltro(f => ({ ...f, pagina: f.pagina + 1 }))}>Siguiente</Button>
          </div></div>
      </section>
    </>}
  </div>
}
