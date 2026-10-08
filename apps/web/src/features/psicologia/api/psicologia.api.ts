import type {
  AgendaCita,
  AgendaResumenDia,
  AgendaResumenQuery,
  AgendarCitaPsicologicaInput,
  BuscarExpedientesQuery,
  CasoPorAgendarDto,
  CasoPsicologiaTomadoDto,
  CitaPsicologicaDetalle,
  CitasPaginadas,
  ExpedienteResumenPsicologia,
  ExpedientesPaginados,
  HistorialCitasQuery,
  IndicadoresPsicologia,
  IndicadoresQuery,
  ProcesoPsicologiaAbiertoDto,
  ProgramarCitaInput,
  RangoFechasQuery,
  ReferenciaBandejaPsicologiaDto,
  RegistroConsultaInput,
  ReprogramarCitaInput,
  ResumenProcesosPsicologia,
  TableroPsicologia,
} from '@akyuam/shared'
import { api } from '../../../lib/api'

/** Cliente tipado del módulo de psicología — una función por endpoint, nunca `api.get` suelto en un componente. */

export function obtenerTablero() {
  return api.get<TableroPsicologia>('/psicologia/tablero').then((res) => res.data)
}

export function obtenerResumenProcesos() {
  return api.get<ResumenProcesosPsicologia>('/psicologia/procesos/resumen').then((res) => res.data)
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

export function listarAgenda(query: RangoFechasQuery) {
  return api.get<AgendaCita[]>('/psicologia/agenda', { params: query }).then((res) => res.data)
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
  return api
    .put<CitaPsicologicaDetalle>(`/psicologia/citas/${citaId}/registro`, datos)
    .then((res) => res.data)
}

export function obtenerIndicadores(query: IndicadoresQuery) {
  return api.get<IndicadoresPsicologia>('/psicologia/indicadores', { params: query }).then((res) => res.data)
}
