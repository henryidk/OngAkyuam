import type {
  ReporteProcesosJuridico,
  ReporteProcesosJuridicoQuery,
  InicioJuridicoDto,
  CarpetaDto,
  CrearProcesosEnLoteInput,
  DocumentoProcesoDto,
  EditarDatosProcesoInput,
  EntradaBitacoraDto,
  ExpedienteDetalleArea,
  FichaUsuariaJuridicoDto,
  FinalizarProcesoInput,
  BuscarProcesosInput,
  BuscarUsuariasJuridicoInput,
  ListaUsuariasJuridico,
  PersonalDto,
  ProcesoDetalle,
  ProcesosCreadosLote,
  ProcesosPaginados,
  ReferenciaBandejaDto,
  RegistrarAbandonoInput,
  RegistrarActuacionInput,
  RegistroContextoDto,
  ResumenProcesos,
  SuspenderProcesoInput,
  UrlDocumentoProcesoQuery,
} from '@akyuam/shared'
import { api } from '../../../lib/api'

/** Cliente tipado del módulo jurídico — la única capa que conoce axios y las URLs del backend. */

// ---- Inicio ----

export function obtenerInicio() {
  return api.get<InicioJuridicoDto>('/juridico/inicio').then((res) => res.data)
}

// ---- Procesos ----

export function obtenerResumen() {
  return api.get<ResumenProcesos>('/juridico/procesos/resumen').then((res) => res.data)
}

/** POST de solo lectura: el texto buscado puede ser el nombre de una usuaria y no debe ir en la URL. */
export function listarProcesos(datos: BuscarProcesosInput) {
  return api.post<ProcesosPaginados>('/juridico/procesos/busqueda', datos).then((res) => res.data)
}

export function obtenerProceso(procesoId: string) {
  return api.get<ProcesoDetalle>(`/juridico/procesos/${procesoId}`).then((res) => res.data)
}

export function editarDatosProceso(procesoId: string, datos: EditarDatosProcesoInput) {
  return api.patch<void>(`/juridico/procesos/${procesoId}/datos`, datos).then(() => undefined)
}

// ---- Registro en lote ----

export function obtenerContextoRegistro(expedienteId: string) {
  return api
    .get<RegistroContextoDto>(`/juridico/expedientes/${expedienteId}/registro-contexto`)
    .then((res) => res.data)
}

/** `claveIdempotencia` identifica el intento: un doble envío devuelve la misma respuesta, no duplica. */
export function crearProcesosEnLote(expedienteId: string, datos: CrearProcesosEnLoteInput, claveIdempotencia: string) {
  return api
    .post<ProcesosCreadosLote>(`/juridico/expedientes/${expedienteId}/procesos/lote`, datos, {
      headers: { 'Idempotency-Key': claveIdempotencia },
    })
    .then((res) => res.data)
}

// ---- Transiciones (todas responden 204) ----

function transicion(procesoId: string, accion: string, datos: unknown) {
  return api.post<void>(`/juridico/procesos/${procesoId}/${accion}`, datos).then(() => undefined)
}

export function finalizarProceso(procesoId: string, datos: FinalizarProcesoInput) {
  return transicion(procesoId, 'finalizacion', datos)
}

export function suspenderProceso(procesoId: string, datos: SuspenderProcesoInput) {
  return transicion(procesoId, 'suspension', datos)
}

export function registrarAbandono(procesoId: string, datos: RegistrarAbandonoInput) {
  return transicion(procesoId, 'abandono', datos)
}

export function reactivarProceso(procesoId: string, version: number) {
  return transicion(procesoId, 'reactivacion', { version })
}

// ---- Bitácora ----

export function registrarActuacion(procesoId: string, datos: RegistrarActuacionInput) {
  return api.post<EntradaBitacoraDto>(`/juridico/procesos/${procesoId}/bitacora`, datos).then((res) => res.data)
}

interface OpcionesSubidaActuacion {
  tanda: string
  signal: AbortSignal
  onProgreso: (porcentaje: number) => void
}

/** El documento queda en la carpeta "Actuaciones" del proceso y enlazado a la actuación. */
export function subirDocumentoActuacion(
  procesoId: string,
  actuacionId: string,
  archivo: File,
  nombreVisible: string,
  { tanda, signal, onProgreso }: OpcionesSubidaActuacion,
) {
  const form = new FormData()
  form.append('archivo', archivo)
  if (nombreVisible) form.append('nombreVisible', nombreVisible)
  return api
    .post<DocumentoProcesoDto>(`/juridico/procesos/${procesoId}/bitacora/${actuacionId}/documentos`, form, {
      headers: { 'X-Lote-Subida': tanda },
      signal,
      onUploadProgress: (evento) => onProgreso(evento.total ? Math.round((evento.loaded / evento.total) * 100) : 0),
    })
    .then((res) => res.data)
}

// ---- Área de atención ----

export function listarBandeja() {
  return api.get<ReferenciaBandejaDto[]>('/juridico/bandeja').then((res) => res.data)
}

// ---- Usuarias ----

/** POST de solo lectura: el texto buscado es un nombre, DPI o expediente y no debe ir en la URL. */
export function listarUsuarias(datos: BuscarUsuariasJuridicoInput) {
  return api.post<ListaUsuariasJuridico>('/juridico/usuarias/busqueda', datos).then((res) => res.data)
}

export function obtenerFichaUsuaria(usuariaId: string) {
  return api.get<FichaUsuariaJuridicoDto>(`/juridico/usuarias/${usuariaId}`).then((res) => res.data)
}

/** Datos y documentos de Trabajo Social, con la misma política de acceso que las demás áreas. */
export function obtenerExpedienteTs(expedienteId: string) {
  return api.get<ExpedienteDetalleArea>(`/areas/expedientes/${expedienteId}`).then((res) => res.data)
}

export function obtenerUrlDocumentoTs(
  expedienteId: string,
  documentoId: string,
  modo: UrlDocumentoProcesoQuery['modo'],
) {
  return api
    .get<{ url: string }>(`/areas/expedientes/${expedienteId}/documentos/${documentoId}/url`, { params: { modo } })
    .then((res) => res.data.url)
}

// ---- Carpetas y documentos ----

export function crearCarpeta(procesoId: string, nombre: string) {
  return api.post<CarpetaDto>(`/juridico/procesos/${procesoId}/carpetas`, { nombre }).then((res) => res.data)
}

export function renombrarCarpeta(procesoId: string, carpetaId: string, nombre: string) {
  return api.patch<void>(`/juridico/procesos/${procesoId}/carpetas/${carpetaId}`, { nombre }).then(() => undefined)
}

interface OpcionesSubida {
  /** Agrupa los archivos de un mismo envío en una sola entrada de bitácora. */
  tanda: string
  signal: AbortSignal
  onProgreso: (porcentaje: number) => void
}

export function subirDocumento(
  procesoId: string,
  carpetaId: string,
  archivo: File,
  nombreVisible: string,
  { tanda, signal, onProgreso }: OpcionesSubida,
) {
  const form = new FormData()
  form.append('archivo', archivo)
  if (nombreVisible) form.append('nombreVisible', nombreVisible)
  return api
    .post<DocumentoProcesoDto>(`/juridico/procesos/${procesoId}/carpetas/${carpetaId}/documentos`, form, {
      headers: { 'X-Lote-Subida': tanda },
      signal,
      onUploadProgress: (evento) => onProgreso(evento.total ? Math.round((evento.loaded / evento.total) * 100) : 0),
    })
    .then((res) => res.data)
}

export function renombrarDocumento(procesoId: string, documentoId: string, nombreVisible: string) {
  return api
    .patch<DocumentoProcesoDto>(`/juridico/procesos/${procesoId}/documentos/${documentoId}`, { nombreVisible })
    .then((res) => res.data)
}

/** Cambia el archivo del documento por otro: el anterior se borra y el resto se conserva. */
export function reemplazarArchivoDocumento(
  procesoId: string,
  documentoId: string,
  archivo: File,
  onProgreso: (porcentaje: number) => void,
) {
  const form = new FormData()
  form.append('archivo', archivo)
  return api
    .put<DocumentoProcesoDto>(`/juridico/procesos/${procesoId}/documentos/${documentoId}/archivo`, form, {
      onUploadProgress: (evento) => onProgreso(evento.total ? Math.round((evento.loaded / evento.total) * 100) : 0),
    })
    .then((res) => res.data)
}

/** URL firmada de corta duración: se usa al momento y nunca se guarda en estado global. */
export function obtenerUrlDocumento(procesoId: string, documentoId: string, modo: UrlDocumentoProcesoQuery['modo']) {
  return api
    .get<{ url: string }>(`/juridico/procesos/${procesoId}/documentos/${documentoId}/url`, { params: { modo } })
    .then((res) => res.data.url)
}

// ---- Personal del área ----

export function listarPersonalJuridico() {
  return api.get<PersonalDto[]>('/personal', { params: { area: 'JURIDICO' } }).then((res) => res.data)
}

// ---- Reportes ----

const RUTA_REPORTE_PROCESOS = '/juridico/reportes/procesos'

/** Totales, desgloses y las primeras filas del reporte de procesos. */
export function obtenerReporteProcesos(query: ReporteProcesosJuridicoQuery) {
  return api.get<ReporteProcesosJuridico>(RUTA_REPORTE_PROCESOS, { params: query }).then((res) => res.data)
}

/** El Excel completo, como `Blob` en memoria: nunca se guarda una copia en el servidor. */
export function descargarReporteProcesos(query: ReporteProcesosJuridicoQuery) {
  return api
    .get<Blob>(`${RUTA_REPORTE_PROCESOS}.xlsx`, { params: query, responseType: 'blob' })
    .then((res) => res.data)
}
