import type {
  AgendarAudienciaInput,
  AsignarNumeroJudicialInput,
  AudienciaAgendadaDto,
  AudienciaDetalleDto,
  AudienciasPaginadas,
  CambiarResponsableAudienciaInput,
  CancelarAudienciaInput,
  DisponibilidadAudienciasDto,
  DisponibilidadAudienciasQuery,
  DocumentoProcesoDto,
  ListarAudienciasQuery,
  ObservacionesAudienciaInput,
  RegistrarResultadoAudienciaInput,
  ReprogramarAudienciaInput,
} from '@akyuam/shared'
import { api } from '../../../lib/api'

/** Cliente tipado de las audiencias de Jurídico (y del No. judicial, que se captura junto a ellas). */

// ---- Consultas ----

export function listarAudiencias(query: Partial<ListarAudienciasQuery>) {
  return api.get<AudienciasPaginadas>('/juridico/audiencias', { params: query }).then((res) => res.data)
}

/** Lo que ya tiene la responsable ese día, para avisar antes de chocar con otra audiencia. */
export function obtenerDisponibilidad(query: DisponibilidadAudienciasQuery) {
  return api
    .get<DisponibilidadAudienciasDto>('/juridico/audiencias/disponibilidad', { params: query })
    .then((res) => res.data)
}

export function listarAudienciasProceso(procesoId: string) {
  return api.get<AudienciaDetalleDto[]>(`/juridico/procesos/${procesoId}/audiencias`).then((res) => res.data)
}

// ---- Escrituras ----

export function agendarAudiencia(procesoId: string, datos: AgendarAudienciaInput) {
  return api
    .post<AudienciaAgendadaDto>(`/juridico/procesos/${procesoId}/audiencias`, datos)
    .then((res) => res.data)
}

export function reprogramarAudiencia(audienciaId: string, datos: ReprogramarAudienciaInput) {
  return api
    .post<AudienciaAgendadaDto>(`/juridico/audiencias/${audienciaId}/reprogramacion`, datos)
    .then((res) => res.data)
}

export function cancelarAudiencia(audienciaId: string, datos: CancelarAudienciaInput) {
  return api.post<void>(`/juridico/audiencias/${audienciaId}/cancelacion`, datos).then(() => undefined)
}

export function cambiarResponsableAudiencia(audienciaId: string, datos: CambiarResponsableAudienciaInput) {
  return api.patch<void>(`/juridico/audiencias/${audienciaId}/responsable`, datos).then(() => undefined)
}

export function registrarResultadoAudiencia(audienciaId: string, datos: RegistrarResultadoAudienciaInput) {
  return api.post<void>(`/juridico/audiencias/${audienciaId}/resultado`, datos).then(() => undefined)
}

export function editarObservacionesAudiencia(audienciaId: string, datos: ObservacionesAudienciaInput) {
  return api.patch<void>(`/juridico/audiencias/${audienciaId}/observaciones`, datos).then(() => undefined)
}

interface OpcionesSubidaAudiencia {
  /** Agrupa los archivos de un mismo envío en una sola entrada de bitácora. */
  tanda: string
  signal: AbortSignal
  onProgreso: (porcentaje: number) => void
}

/** Va a la carpeta "Audiencias" del proceso, enlazado a esta audiencia. */
export function subirDocumentoAudiencia(
  audienciaId: string,
  archivo: File,
  nombreVisible: string,
  { tanda, signal, onProgreso }: OpcionesSubidaAudiencia,
) {
  const form = new FormData()
  form.append('archivo', archivo)
  if (nombreVisible) form.append('nombreVisible', nombreVisible)
  return api
    .post<DocumentoProcesoDto>(`/juridico/audiencias/${audienciaId}/documentos`, form, {
      headers: { 'X-Lote-Subida': tanda },
      signal,
      onUploadProgress: (evento) => onProgreso(evento.total ? Math.round((evento.loaded / evento.total) * 100) : 0),
    })
    .then((res) => res.data)
}

/** 409 `NUMERO_JUDICIAL_REPETIDO` si otro proceso ya lo usa: se reenvía con la confirmación. */
export function asignarNumeroJudicial(procesoId: string, datos: AsignarNumeroJudicialInput) {
  return api.patch<void>(`/juridico/procesos/${procesoId}/numero-judicial`, datos).then(() => undefined)
}
