import type {
  AgendaResumenDia,
  AgendaResumenQuery,
  AgendarCitaPsicologicaInput,
  BuscarExpedientesQuery,
  CasoPorAgendarDto,
  CasoPorReasignarDto,
  CasoPsicologiaTomadoDto,
  CasoReasignadoDto,
  CerrarProcesoPsicologiaInput,
  CitaAgendaDto,
  CitaProgramadaDto,
  CitaPsicologicaDetalle,
  ConsultaRegistradaDto,
  DocumentoCitaDto,
  CitasPaginadas,
  ExpedienteDetalleArea,
  ExpedienteResumenPsicologia,
  ExpedientesPaginados,
  FichaUsuariaPsicologiaDto,
  HistorialCitasQuery,
  HuecoLibreDto,
  IndicadoresPsicologia,
  IndicadoresQuery,
  ListaUsuariasPsicologia,
  ListarProcesosPsicologiaQuery,
  ListarUsuariasPsicologiaQuery,
  MoverCitaPsicologicaInput,
  ProcesoParaAgendarDto,
  ProcesoPsicologiaAbiertoDto,
  ProcesoPsicologiaCerradoDto,
  ProcesoPsicologiaDetalle,
  ProcesosPsicologiaPaginados,
  ProgramarCitaInput,
  RangoFechasQuery,
  ReferenciaBandejaPsicologiaDto,
  RegistroConsultaInput,
  ReprogramarCitaInput,
  ResumenProcesosPsicologia,
  SesionesProcesoPaginadas,
  VisibilidadProcesoPsicologiaDto,
  VisibilidadProcesoPsicologiaInput,
} from '@akyuam/shared'
import { api } from '../../../lib/api'

/** Cliente tipado del módulo de psicología — una función por endpoint, nunca `api.get` suelto en un componente. */

export function obtenerResumenProcesos() {
  return api.get<ResumenProcesosPsicologia>('/psicologia/procesos/resumen').then((res) => res.data)
}

/** Área de atención: casos y procesos abiertos cuya psicóloga ya no tiene la cuenta activa. */
export function listarPorReasignar() {
  return api.get<CasoPorReasignarDto[]>('/psicologia/bandeja/por-reasignar').then((res) => res.data)
}

export function tomarCasoPorReasignar(procesoId: string) {
  return api.post<CasoReasignadoDto>(`/psicologia/bandeja/por-reasignar/${procesoId}/tomar`).then((res) => res.data)
}

/** Área de atención: referencias de Trabajo Social que ninguna psicóloga ha tomado. */
export function listarBandeja() {
  return api.get<ReferenciaBandejaPsicologiaDto[]>('/psicologia/bandeja').then((res) => res.data)
}

export function tomarCaso(referidoId: string) {
  return api.post<CasoPsicologiaTomadoDto>(`/psicologia/bandeja/${referidoId}/tomar`).then((res) => res.data)
}

/** Casos que la psicóloga ya tomó y todavía no tienen primera cita. */
export function listarPorAgendar() {
  return api.get<CasoPorAgendarDto[]>('/psicologia/agenda/por-agendar').then((res) => res.data)
}

/**
 * Programa la primera cita y con ella abre el proceso. `claveIdempotencia` evita que un doble
 * envío (doble clic, reintento de red) abra dos procesos.
 */
export function atenderReferencia(referidoId: string, datos: AgendarCitaPsicologicaInput, claveIdempotencia: string) {
  return api
    .post<ProcesoPsicologiaAbiertoDto>(`/psicologia/bandeja/${referidoId}/atender`, datos, {
      headers: { 'Idempotency-Key': claveIdempotencia },
    })
    .then((res) => res.data)
}

/** Mi agenda en un rango de días de Guatemala (máximo seis semanas). */
export function listarCitasAgenda(query: RangoFechasQuery) {
  return api.get<CitaAgendaDto[]>('/psicologia/agenda/citas', { params: query }).then((res) => res.data)
}

/** Tramos libres de un día dentro del horario habitual: una sugerencia, no un límite. */
export function listarHuecos(fecha: string) {
  return api.get<HuecoLibreDto[]>('/psicologia/agenda/huecos', { params: { fecha } }).then((res) => res.data)
}

/** Mis procesos abiertos, con las personas a quienes se puede citar y su próxima cita. */
export function listarProcesosParaAgendar() {
  return api.get<ProcesoParaAgendarDto[]>('/psicologia/agenda/procesos').then((res) => res.data)
}

export function programarCitaEnProceso(procesoId: string, datos: AgendarCitaPsicologicaInput) {
  return api.post<CitaProgramadaDto>(`/psicologia/procesos/${procesoId}/citas`, datos).then((res) => res.data)
}

export function moverCita(citaId: string, datos: MoverCitaPsicologicaInput) {
  return api.post<CitaProgramadaDto>(`/psicologia/citas/${citaId}/reprogramacion`, datos).then((res) => res.data)
}

export function marcarNoAsistio(citaId: string) {
  return api.post(`/psicologia/citas/${citaId}/no-asistio`).then(() => undefined)
}

/** Mis procesos, por páginas. `filtro` y `q` son opcionales: el servidor aplica "Activos" por defecto. */
export function listarProcesos(query: Partial<ListarProcesosPsicologiaQuery>) {
  return api.get<ProcesosPsicologiaPaginados>('/psicologia/procesos', { params: query }).then((res) => res.data)
}

export function obtenerProceso(procesoId: string) {
  return api.get<ProcesoPsicologiaDetalle>(`/psicologia/procesos/${procesoId}`).then((res) => res.data)
}

/** Sesiones del proceso con sus notas, de la más reciente a la más antigua. */
export function listarSesionesProceso(procesoId: string, cursor?: string) {
  return api
    .get<SesionesProcesoPaginadas>(`/psicologia/procesos/${procesoId}/sesiones`, { params: { cursor } })
    .then((res) => res.data)
}

export function cerrarProceso(procesoId: string, datos: CerrarProcesoPsicologiaInput) {
  return api.post<ProcesoPsicologiaCerradoDto>(`/psicologia/procesos/${procesoId}/cierre`, datos).then((res) => res.data)
}

export function actualizarVisibilidadProceso(procesoId: string, datos: VisibilidadProcesoPsicologiaInput) {
  return api
    .patch<VisibilidadProcesoPsicologiaDto>(`/psicologia/procesos/${procesoId}/visibilidad`, datos)
    .then((res) => res.data)
}

/** URL firmada y de corta duración para descargar el documento adjunto a una sesión. */
export function obtenerUrlDocumentoCita(citaId: string) {
  return api.get<{ url: string }>(`/psicologia/citas/${citaId}/documento/url`).then((res) => res.data.url)
}

/** Usuarias referidas a Psicología. `q` es un nombre, un DPI o un número de expediente. */
export function listarUsuarias(query: Partial<ListarUsuariasPsicologiaQuery>) {
  return api.get<ListaUsuariasPsicologia>('/psicologia/usuarias', { params: query }).then((res) => res.data)
}

export function obtenerFichaUsuaria(usuariaId: string) {
  return api.get<FichaUsuariaPsicologiaDto>(`/psicologia/usuarias/${usuariaId}`).then((res) => res.data)
}

/**
 * Abre un proceso nuevo, con su primera cita, para una usuaria que regresa sin referencia nueva.
 * `claveIdempotencia` evita que un doble envío abra dos procesos.
 */
export function abrirProcesoDesdeFicha(usuariaId: string, datos: AgendarCitaPsicologicaInput, claveIdempotencia: string) {
  return api
    .post<ProcesoPsicologiaAbiertoDto>(`/psicologia/usuarias/${usuariaId}/procesos`, datos, {
      headers: { 'Idempotency-Key': claveIdempotencia },
    })
    .then((res) => res.data)
}

/** Datos y documentos de Trabajo Social del expediente: solo lo que TS autorizó a Psicología. */
export function obtenerExpedienteTs(expedienteId: string) {
  return api.get<ExpedienteDetalleArea>(`/areas/expedientes/${expedienteId}`).then((res) => res.data)
}


export function obtenerResumenAgenda(query: AgendaResumenQuery) {
  return api.get<AgendaResumenDia[]>('/psicologia/agenda/resumen', { params: query }).then((res) => res.data)
}

export function buscarExpedientes(query: BuscarExpedientesQuery) {
  return api.get<ExpedientesPaginados>('/psicologia/expedientes', { params: query }).then((res) => res.data)
}

export function obtenerResumenExpediente(expedienteId: string) {
  return api
    .get<ExpedienteResumenPsicologia>(`/psicologia/expedientes/${expedienteId}/resumen`)
    .then((res) => res.data)
}

export function listarHistorialCitas(expedienteId: string, query: HistorialCitasQuery) {
  return api
    .get<CitasPaginadas>(`/psicologia/expedientes/${expedienteId}/citas`, { params: query })
    .then((res) => res.data)
}

export function programarCita(expedienteId: string, datos: ProgramarCitaInput) {
  return api.post(`/psicologia/expedientes/${expedienteId}/citas`, datos).then((res) => res.data)
}

export function reprogramarCita(citaId: string, datos: ReprogramarCitaInput) {
  return api.post(`/psicologia/citas/${citaId}/reprogramar`, datos).then((res) => res.data)
}

export function obtenerDetalleCita(citaId: string) {
  return api.get<CitaPsicologicaDetalle>(`/psicologia/citas/${citaId}`).then((res) => res.data)
}

export function registrarConsulta(citaId: string, datos: RegistroConsultaInput) {
  return api.put<ConsultaRegistradaDto>(`/psicologia/citas/${citaId}/registro`, datos).then((res) => res.data)
}

/** Sube el Formato General escaneado de la sesión. `onProgreso` recibe el porcentaje enviado. */
export function subirDocumentoCita(citaId: string, archivo: File, onProgreso: (porcentaje: number) => void) {
  const form = new FormData()
  form.append('archivo', archivo)
  return api
    .post<DocumentoCitaDto>(`/psicologia/citas/${citaId}/documento`, form, {
      onUploadProgress: (evento) => onProgreso(evento.total ? Math.round((evento.loaded / evento.total) * 100) : 0),
    })
    .then((res) => res.data)
}

export function obtenerIndicadores(query: IndicadoresQuery) {
  return api.get<IndicadoresPsicologia>('/psicologia/indicadores', { params: query }).then((res) => res.data)
}
