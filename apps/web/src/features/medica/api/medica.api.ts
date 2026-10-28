import type {
  AltaAtencionMedicaInput,
  AltaAtencionMedicaRegistradaDto,
  BuscarHistorialConsultasMedicaInput,
  BuscarPacientesProgramablesMedicaInput,
  CitaMedicaProgramadaDto,
  ConsultaMedicaDto,
  ConsultaMedicaRegistradaDto,
  ConsultasMedicasPaginaDto,
  ConsultasPacienteMedicaQuery,
  ContadoresMedicaDto,
  ContextoConsultaMedicaDto,
  ContextoConsultaMedicaQuery,
  DiaAgendaMedicaDto,
  DisponibilidadDiaDto,
  DocumentoMedicoDto,
  DocumentoMedicoSubidoDto,
  ExpedienteDetalleArea,
  FichaPacienteMedicaDto,
  HistorialConsultasMedicaPaginaDto,
  IndicadoresMedica,
  InasistenciaCitaMedicaInput,
  InasistenciaRegistradaDto,
  ListarPacientesMedicaQuery,
  PacienteBuscadaMedicaDto,
  PacienteProgramableDto,
  PacientesMedicaPaginaDto,
  PorAtenderMedicaDto,
  ProgramablesMedicaQuery,
  ProgramarCitaMedicaInput,
  ReferenciaBandejaMedicaDto,
  RegistrarConsultaMedicaInput,
  ReprogramarCitaMedicaInput,
  SemanaAgendaMedicaDto,
  UrlDocumentoMedicoQuery,
  VisibilidadAtencionMedicaDto,
  VisibilidadAtencionMedicaInput,
} from '@akyuam/shared'
import { api } from '../../../lib/api'

/** Cliente tipado del módulo de medicina — una función por endpoint, nunca `api.get` suelto en un componente. */

export function obtenerContadores() {
  return api.get<ContadoresMedicaDto>('/medica/contadores').then((res) => res.data)
}

/** Área de atención: referencias de Trabajo Social pendientes de primera consulta. */
export function listarBandeja() {
  return api.get<ReferenciaBandejaMedicaDto[]>('/medica/bandeja').then((res) => res.data)
}

/** Lo que Trabajo Social compartió del expediente (datos, caso, hijos y documentos visibles). */
export function obtenerExpediente(expedienteId: string) {
  return api.get<ExpedienteDetalleArea>(`/areas/expedientes/${expedienteId}`).then((res) => res.data)
}

// ---- Agenda ----

export function obtenerSemana(semana: string) {
  return api.get<SemanaAgendaMedicaDto>('/medica/agenda', { params: { semana } }).then((res) => res.data)
}

export function obtenerDia(fecha: string) {
  return api.get<DiaAgendaMedicaDto>('/medica/agenda/dia', { params: { fecha } }).then((res) => res.data)
}

/** Horas de inicio en las que cabe una cita de `duracion` minutos (todos sus bloques libres). */
/** Horas libres de cada día hábil desde `desde` hasta el límite de agenda (un mes). */
export function obtenerDisponibilidad(desde: string, duracion: number) {
  return api
    .get<DisponibilidadDiaDto[]>('/medica/agenda/disponibilidad', { params: { desde, duracion } })
    .then((res) => res.data)
}

/** Detalle para programar (motivo, personas, atención) de una paciente ya elegida. */
export function listarProgramables(query: ProgramablesMedicaQuery = {}) {
  return api.get<PacienteProgramableDto[]>('/medica/agenda/programables', { params: query }).then((res) => res.data)
}

/**
 * Buscador de pacientes de los modales: pocas coincidencias con datos ligeros. Es POST porque `q`
 * puede ser el nombre de una sobreviviente; sin `q` devuelve las sugerencias por agendar.
 */
export function buscarPacientesProgramables(datos: BuscarPacientesProgramablesMedicaInput) {
  return api
    .post<PacienteBuscadaMedicaDto[]>('/medica/agenda/programables/busqueda', datos)
    .then((res) => res.data)
}

// ---- Citas ----

/**
 * Programa una cita; sin atención activa, la abre. `claveIdempotencia` evita que un doble envío
 * (doble clic, reintento de red) abra dos atenciones.
 */
export function programarCita(datos: ProgramarCitaMedicaInput, claveIdempotencia: string) {
  return api
    .post<CitaMedicaProgramadaDto>('/medica/citas', datos, { headers: { 'Idempotency-Key': claveIdempotencia } })
    .then((res) => res.data)
}

export function registrarInasistencia(citaId: string, datos: InasistenciaCitaMedicaInput) {
  return api.post<InasistenciaRegistradaDto>(`/medica/citas/${citaId}/inasistencia`, datos).then((res) => res.data)
}

export function reprogramarCita(citaId: string, datos: ReprogramarCitaMedicaInput) {
  return api.post<CitaMedicaProgramadaDto>(`/medica/citas/${citaId}/reprogramacion`, datos).then((res) => res.data)
}

// ---- Consultas ----

export function obtenerContextoConsulta(query: ContextoConsultaMedicaQuery) {
  return api.get<ContextoConsultaMedicaDto>('/medica/consultas/contexto', { params: query }).then((res) => res.data)
}

/** Citas de hoy pendientes y las atrasadas sin registrar. */
export function listarPorAtender() {
  return api.get<PorAtenderMedicaDto>('/medica/consultas/por-atender').then((res) => res.data)
}

/**
 * Historial de consultas: solo metadatos. Es POST porque `q` puede ser el nombre de una
 * sobreviviente y en el cuerpo no queda en logs ni en el historial del navegador.
 */
export function buscarHistorialConsultas(datos: BuscarHistorialConsultasMedicaInput) {
  return api
    .post<HistorialConsultasMedicaPaginaDto>('/medica/consultas/historial/busqueda', datos)
    .then((res) => res.data)
}

/** Contenido clínico completo de una consulta; el backend deja constancia de la lectura. */
export function obtenerConsulta(consultaId: string) {
  return api.get<ConsultaMedicaDto>(`/medica/consultas/${consultaId}`).then((res) => res.data)
}

export function registrarConsulta(datos: RegistrarConsultaMedicaInput, claveIdempotencia: string) {
  return api
    .post<ConsultaMedicaRegistradaDto>('/medica/consultas', datos, { headers: { 'Idempotency-Key': claveIdempotencia } })
    .then((res) => res.data)
}

// ---- Documentos ----

interface OpcionesSubida {
  signal: AbortSignal
  onProgreso: (porcentaje: number) => void
}

/** Documento de una consulta que todavía no se guarda: queda en el `lote` hasta registrarla. */
export function subirDocumentoPendiente(
  archivo: File,
  campos: { lote: string; atencionId: string; nombreVisible: string },
  { signal, onProgreso }: OpcionesSubida,
) {
  const form = new FormData()
  form.append('archivo', archivo)
  form.append('lote', campos.lote)
  form.append('atencionId', campos.atencionId)
  if (campos.nombreVisible) form.append('nombreVisible', campos.nombreVisible)
  return api
    .post<DocumentoMedicoSubidoDto>('/medica/documentos/pendientes', form, {
      signal,
      onUploadProgress: (evento) => onProgreso(evento.total ? Math.round((evento.loaded / evento.total) * 100) : 0),
    })
    .then((res) => res.data)
}

export function eliminarPendiente(documentoId: string) {
  return api.delete<void>(`/medica/documentos/pendientes/${documentoId}`).then(() => undefined)
}

/** URL firmada de corta duración: se usa al momento y nunca se guarda en estado global. */
export function obtenerUrlDocumento(documentoId: string, modo: UrlDocumentoMedicoQuery['modo']) {
  return api
    .get<{ url: string }>(`/medica/documentos/${documentoId}/url`, { params: { modo } })
    .then((res) => res.data.url)
}

// ---- Atenciones ----

export function darDeAlta(atencionId: string, datos: AltaAtencionMedicaInput) {
  return api
    .post<AltaAtencionMedicaRegistradaDto>(`/medica/atenciones/${atencionId}/alta`, datos)
    .then((res) => res.data)
}

export function cambiarVisibilidad(atencionId: string, datos: VisibilidadAtencionMedicaInput) {
  return api
    .patch<VisibilidadAtencionMedicaDto>(`/medica/atenciones/${atencionId}/visibilidad`, datos)
    .then((res) => res.data)
}

// ---- Pacientes ----

export function listarPacientes(query: Partial<ListarPacientesMedicaQuery>) {
  return api.get<PacientesMedicaPaginaDto>('/medica/pacientes', { params: query }).then((res) => res.data)
}

export function obtenerFicha(usuariaId: string) {
  return api.get<FichaPacienteMedicaDto>(`/medica/pacientes/${usuariaId}`).then((res) => res.data)
}

export function listarConsultas(usuariaId: string, query: ConsultasPacienteMedicaQuery = {}) {
  return api
    .get<ConsultasMedicasPaginaDto>(`/medica/pacientes/${usuariaId}/consultas`, { params: query })
    .then((res) => res.data)
}

export function listarDocumentos(usuariaId: string) {
  return api.get<DocumentoMedicoDto[]>(`/medica/pacientes/${usuariaId}/documentos`).then((res) => res.data)
}

// ---- Reportes ----

export function obtenerReportes(anio: number) {
  return api.get<IndicadoresMedica>('/medica/reportes', { params: { anio } }).then((res) => res.data)
}

/** El Excel de agregados, como `Blob` en memoria: nunca se guarda una copia en el servidor. */
export function descargarReportes(anio: number) {
  return api.get<Blob>('/medica/reportes/excel', { params: { anio }, responseType: 'blob' }).then((res) => res.data)
}
