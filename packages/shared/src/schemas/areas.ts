import type { Nino, TipoRegistro } from './registroUsuaria.js'
import type { TipoDocumento } from './documentos.js'

/**
 * Forma de un expediente tal como lo ve un área de atención (jurídica/médica/psicológica)
 * a la que trabajo social se lo refirió — ver GET /areas/expedientes.
 */
export interface ExpedienteResumenArea {
  id: string
  numero: string
  fecha: string
  municipio: string | null
  tipoRegistro: TipoRegistro
  usuariaNombreCompleto: string
}

/** Detalle completo — ver GET /areas/expedientes/:id. */
export interface ExpedienteDetalleArea extends ExpedienteResumenArea {
  usuaria: {
    nombres: string
    apellidos: string
    dpi: string | null
    telefono: string | null
    direccion: string | null
    fechaNacimiento: string
    grupoEtnico: string
    ubicacionGeografica: string | null
    departamentoOtro: string | null
    municipioOtro: string | null
  }
  /**
   * Agresor, tipología y observaciones del caso. `null` cuando Trabajo Social no autorizó a esta
   * área a verlos (`ReferidoArea.puedeVerDatosCaso = false`); Jurídico los recibe siempre.
   */
  datosCaso: DatosCasoArea | null
  ninos: Nino[]
  documentos: DocumentoVisibleArea[]
}

export interface DatosCasoArea {
  tipologiaDelito: string[]
  observaciones: string | null
  // No reutiliza `DatosAgresor` (representación de formulario, "" = sin dato): esta es una
  // vista de solo lectura de lo ya guardado, donde la ausencia se representa como `null`.
  agresor: {
    nombres: string | null
    apellidos: string | null
    telefono: string | null
    direccion: string | null
  } | null
}

/**
 * Documento subido por trabajo social y visible para esta área — trabajo social otorgó
 * visibilidad explícita (`DocumentoVisibilidadArea`), no todo documento del expediente.
 * Nunca incluye `claveR2`: la descarga real va por URL firmada
 * (GET /areas/expedientes/:id/documentos/:documentoId/url), nunca por acceso directo.
 */
export interface DocumentoVisibleArea {
  id: string
  tipo: TipoDocumento
  nombreArchivo: string
  tamanioBytes: number
  createdAt: string
}
