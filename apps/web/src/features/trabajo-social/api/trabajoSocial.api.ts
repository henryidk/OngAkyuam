import type {
  ActualizarAccesoInput,
  AreaAtencion,
  BandejaTs,
  CrearExpedienteInput,
  DatosCaso,
  DocumentosCaso,
  DocumentoSubido,
  EventoBitacora,
  ExpedienteCreado,
  ExpedienteDetalleCaso,
  ListarUsuariasQuery,
  ListaUsuariasTs,
  MatrizAccesos,
  ProfesionalArea,
  ReferidoCreado,
  ReferirInput,
  TipoDocumentoTrabajoSocial,
  UsuariaExpedienteHub,
  UsuariaResumenBusqueda,
  VersionDocumento,
} from '@akyuam/shared'
import { api } from '../../../lib/api'

/** Cliente tipado del módulo de Trabajo Social — una función por endpoint, nunca `api.get` suelto en un componente. */

function rutaDocumentos(expedienteId: string) {
  return `/trabajo-social/expedientes/${expedienteId}/documentos`
}

export function listarDocumentosCaso(expedienteId: string) {
  return api.get<DocumentosCaso>(rutaDocumentos(expedienteId)).then((res) => res.data)
}

/** La visibilidad por área no se decide al subir: se define al referir (plan §5.3). */
export function subirDocumentoCaso(expedienteId: string, tipo: TipoDocumentoTrabajoSocial, archivo: File) {
  const formData = new FormData()
  formData.append('archivo', archivo)
  formData.append('tipo', tipo)
  formData.append('areasVisibles', JSON.stringify([]))
  return api.post<DocumentoSubido>(rutaDocumentos(expedienteId), formData).then((res) => res.data)
}

export function subirVersionDocumento(expedienteId: string, documentoId: string, archivo: File) {
  const formData = new FormData()
  formData.append('archivo', archivo)
  return api
    .post<DocumentoSubido>(`${rutaDocumentos(expedienteId)}/${documentoId}/versiones`, formData)
    .then((res) => res.data)
}

export function listarVersionesDocumento(expedienteId: string, documentoId: string) {
  return api
    .get<VersionDocumento[]>(`${rutaDocumentos(expedienteId)}/${documentoId}/versiones`)
    .then((res) => res.data)
}

/** URL firmada de corta duración: `inline` para la vista previa, si no, descarga. */
export function obtenerUrlDocumento(expedienteId: string, documentoId: string, inline: boolean) {
  return api
    .get<{ url: string }>(`${rutaDocumentos(expedienteId)}/${documentoId}/url`, { params: { inline } })
    .then((res) => res.data.url)
}

export function referirCaso(expedienteId: string, datos: ReferirInput) {
  return api
    .post<ReferidoCreado>(`/trabajo-social/expedientes/${expedienteId}/referidos`, datos)
    .then((res) => res.data)
}

/** Usuarios activos del área, para el select "Profesional que atenderá" del modal Referir. */
export function listarProfesionales(area: AreaAtencion) {
  return api
    .get<ProfesionalArea[]>('/trabajo-social/profesionales', { params: { area } })
    .then((res) => res.data)
}

export function obtenerMatrizAccesos(expedienteId: string) {
  return api.get<MatrizAccesos>(`/trabajo-social/expedientes/${expedienteId}/accesos`).then((res) => res.data)
}

/** Guarda un solo cambio de la matriz y devuelve la matriz ya recalculada por el backend. */
export function actualizarAccesoArea(expedienteId: string, area: AreaAtencion, cambios: ActualizarAccesoInput) {
  return api
    .put<MatrizAccesos>(`/trabajo-social/expedientes/${expedienteId}/accesos/${area}`, cambios)
    .then((res) => res.data)
}

/** Registro de una usuaria nueva junto con su primer caso. */
export function crearExpedienteConUsuaria(datos: CrearExpedienteInput) {
  return api.post<ExpedienteCreado>('/trabajo-social/expedientes', datos).then((res) => res.data)
}

/** Caso nuevo para una usuaria ya registrada — nunca vuelve a enviar su identidad. */
export function crearCasoParaUsuaria(usuariaId: string, datosCaso: DatosCaso) {
  return api
    .post<ExpedienteCreado>(`/trabajo-social/usuarias/${usuariaId}/expedientes`, datosCaso)
    .then((res) => res.data)
}

/** Lista de Usuarias: filtro por estado, búsqueda (nombre, DPI o número) y página. */
export function listarUsuarias(query: Partial<ListarUsuariasQuery>) {
  return api.get<ListaUsuariasTs>('/trabajo-social/usuarias', { params: query }).then((res) => res.data)
}

export function obtenerDetalleExpediente(expedienteId: string) {
  return api.get<ExpedienteDetalleCaso>(`/trabajo-social/expedientes/${expedienteId}`).then((res) => res.data)
}

export function obtenerUsuaria(usuariaId: string) {
  return api.get<UsuariaExpedienteHub>(`/trabajo-social/usuarias/${usuariaId}`).then((res) => res.data)
}

/** Botón "Verificar" del DPI en el wizard: mismo endpoint que el buscador. */
export function buscarUsuariaPorDpi(dpi: string) {
  return api
    .get<UsuariaResumenBusqueda[]>('/trabajo-social/usuarias/buscar', { params: { dpi } })
    .then((res) => res.data)
}

/** Inicio de Trabajo Social: colas, recientes, novedades y resumen del mes en una sola llamada. */
export function obtenerBandeja() {
  return api.get<BandejaTs>('/trabajo-social/bandeja').then((res) => res.data)
}

/** Bitácora de la usuaria: lo que pasó en todos sus casos, del más reciente al más antiguo. */
export function obtenerBitacora(usuariaId: string) {
  return api.get<EventoBitacora[]>(`/trabajo-social/usuarias/${usuariaId}/bitacora`).then((res) => res.data)
}
