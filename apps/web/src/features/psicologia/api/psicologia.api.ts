import type {
  AbrirProcesosPsicologiaInput,
  AgendarCitaPsicologicaInput,
  BuscarHistorialConsultasPsicologiaInput,
  CasoPorAgendarDto,
  CasoPorReasignarDto,
  CasoPsicologiaTomadoDto,
  CasoReasignadoDto,
  CerrarProcesoPsicologiaInput,
  CitaAgendaDto,
  CitaProgramadaDto,
  CitaPsicologicaDetalle,
  DetalleConsultaPsicologiaDto,
  ConsultaRegistradaDto,
  DisponibilidadDiaDto,
  DocumentoCitaDto,
  ExpedienteDetalleArea,
  FichaUsuariaPsicologiaDto,
  HistorialConsultasPsicologiaPaginado,
  HuecoLibreDto,
  IndicadoresPsicologia,
  ExportarPsicologiaQuery,
  IndicadoresQuery,
  PersonasAtendidasPsicologia,
  PersonasAtendidasPsicologiaQuery,
  ListaUsuariasPsicologia,
  ListarProcesosPsicologiaQuery,
  ListarUsuariasPsicologiaQuery,
  MarcarNoAsistioPsicologiaInput,
  MoverCitaPsicologicaInput,
  NoAsistioPsicologiaDto,
  ProcesoParaAgendarDto,
  ProcesosPsicologiaAbiertosDto,
  ProcesoPsicologiaCerradoDto,
  ProcesoPsicologiaDetalle,
  ProcesosPsicologiaPaginados,
  RangoFechasQuery,
  ReferenciaBandejaPsicologiaDto,
  RegistroConsultaInput,
  SesionSinCitaInput,
  AtenderAhoraInput,
  ResumenProcesosPsicologia,
  SesionesProcesoPaginadas,
  SesionPorRegistrarDto,
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

/** Un caso tomado por agendar; 409 si ya tiene primera cita. */
export function obtenerCasoPorAgendar(referidoId: string) {
  return api.get<CasoPorAgendarDto>(`/psicologia/agenda/por-agendar/${referidoId}`).then((res) => res.data)
}

/**
 * "Atender ahora": registra la sesión de una persona del caso tomado y con ella abre su proceso,
 * todo o nada. La fecha y la hora las pone el servidor.
 */
export function atenderAhora(referidoId: string, datos: AtenderAhoraInput, claveIdempotencia: string) {
  return api
    .post<ConsultaRegistradaDto>(`/psicologia/bandeja/${referidoId}/atender-ahora`, datos, {
      headers: { 'Idempotency-Key': claveIdempotencia },
    })
    .then((res) => res.data)
}

/**
 * Programa la primera cita de cada persona elegida y con ella abre su proceso, todo o nada.
 * `claveIdempotencia` evita que un doble envío (doble clic, reintento de red) los abra dos veces.
 */
export function atenderReferencia(referidoId: string, datos: AbrirProcesosPsicologiaInput, claveIdempotencia: string) {
  return api
    .post<ProcesosPsicologiaAbiertosDto>(`/psicologia/bandeja/${referidoId}/atender`, datos, {
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

/**
 * Horas de inicio libres de cada día hábil desde `desde` (unas semanas adelante) para una cita de
 * `duracion` minutos, según mi propia agenda. Una sugerencia, no un límite.
 */
export function obtenerDisponibilidad(desde: string, duracion: number) {
  return api
    .get<DisponibilidadDiaDto[]>('/psicologia/agenda/disponibilidad', { params: { desde, duracion } })
    .then((res) => res.data)
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

/** Con `reprogramar`, la cita nueva nace en el mismo paso (todo o nada). */
export function marcarNoAsistio(citaId: string, datos: MarcarNoAsistioPsicologiaInput) {
  return api.post<NoAsistioPsicologiaDto>(`/psicologia/citas/${citaId}/no-asistio`, datos).then((res) => res.data)
}

/**
 * Procesos por páginas: los míos o, con `de: 'EQUIPO'`, los de toda el área. `filtro`, `de` y `q`
 * son opcionales: el servidor aplica "Activos" y "Míos" por defecto.
 */
export function listarProcesos(query: Partial<ListarProcesosPsicologiaQuery>) {
  return api.post<ProcesosPsicologiaPaginados>('/psicologia/procesos/busqueda', query).then((res) => res.data)
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
  return api.post<ListaUsuariasPsicologia>('/psicologia/usuarias/busqueda', query).then((res) => res.data)
}

export function obtenerFichaUsuaria(usuariaId: string) {
  return api.get<FichaUsuariaPsicologiaDto>(`/psicologia/usuarias/${usuariaId}`).then((res) => res.data)
}

/**
 * Abre desde la ficha un proceso nuevo, con su primera cita, para cada persona elegida (la usuaria
 * que regresa y/o sus hijos/as), todo o nada. `claveIdempotencia` evita abrirlos dos veces.
 */
export function abrirProcesoDesdeFicha(usuariaId: string, datos: AbrirProcesosPsicologiaInput, claveIdempotencia: string) {
  return api
    .post<ProcesosPsicologiaAbiertosDto>(`/psicologia/usuarias/${usuariaId}/procesos`, datos, {
      headers: { 'Idempotency-Key': claveIdempotencia },
    })
    .then((res) => res.data)
}

/** Datos y documentos de Trabajo Social del expediente: solo lo que TS autorizó a Psicología. */
export function obtenerExpedienteTs(expedienteId: string) {
  return api.get<ExpedienteDetalleArea>(`/areas/expedientes/${expedienteId}`).then((res) => res.data)
}


/** Consultas › Por registrar: mis sesiones que ya empezaron y siguen sin registrar. */
export function listarSesionesPorRegistrar() {
  return api.get<SesionPorRegistrarDto[]>('/psicologia/consultas/por-registrar').then((res) => res.data)
}

/**
 * Consultas › Historial: solo metadatos. Es POST porque `q` puede ser el nombre de una
 * sobreviviente y en el cuerpo no queda en logs ni en el historial del navegador.
 */
export function buscarHistorialConsultas(datos: BuscarHistorialConsultasPsicologiaInput) {
  return api
    .post<HistorialConsultasPsicologiaPaginado>('/psicologia/consultas/historial/busqueda', datos)
    .then((res) => res.data)
}

/** Una sesión del historial con sus notas. El servidor deja constancia de cada apertura. */
export function obtenerConsulta(citaId: string) {
  return api.get<DetalleConsultaPsicologiaDto>(`/psicologia/consultas/${citaId}`).then((res) => res.data)
}

export function obtenerDetalleCita(citaId: string) {
  return api.get<CitaPsicologicaDetalle>(`/psicologia/citas/${citaId}`).then((res) => res.data)
}

export function registrarConsulta(citaId: string, datos: RegistroConsultaInput) {
  return api.put<ConsultaRegistradaDto>(`/psicologia/citas/${citaId}/registro`, datos).then((res) => res.data)
}

/**
 * Registra una sesión sin cita: la cita nace aquí, ya registrada, con la hora del servidor.
 * `claveIdempotencia` evita que un reintento cree dos sesiones.
 */
export function registrarSesionSinCita(procesoId: string, datos: SesionSinCitaInput, claveIdempotencia: string) {
  return api
    .post<ConsultaRegistradaDto>(`/psicologia/procesos/${procesoId}/sesiones-sin-cita`, datos, {
      headers: { 'Idempotency-Key': claveIdempotencia },
    })
    .then((res) => res.data)
}

/** Sube la Hoja de evolución escaneada de la sesión. `onProgreso` recibe el porcentaje enviado. */
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

/** Las filas del Excel en pantalla, de 25 en 25. Solo ids, fechas y catálogos en la URL. */
export function listarPersonasAtendidas(query: PersonasAtendidasPsicologiaQuery) {
  return api
    .get<PersonasAtendidasPsicologia>('/psicologia/indicadores/personas', { params: query })
    .then((res) => res.data)
}

/** El Excel de personas atendidas, como `Blob` en memoria: nunca se guarda una copia en el servidor. */
export function descargarIndicadores(query: ExportarPsicologiaQuery) {
  return api
    .get<Blob>('/psicologia/indicadores.xlsx', { params: query, responseType: 'blob' })
    .then((res) => res.data)
}
