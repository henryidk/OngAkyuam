import type { Nino, TipoRegistro } from './registroUsuaria.js'

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
  ubicacionGeografica: string
  departamentoOtro: string | null
  municipioOtro: string | null
  usuaria: {
    nombres: string
    apellidos: string
    dpi: string | null
    telefono: string | null
    direccion: string | null
    fechaNacimiento: string
    grupoEtnico: string
    tipologiaDelito: string[]
  }
  // No reutiliza `DatosAgresor` (representación de formulario, "" = sin dato): esta es una
  // vista de solo lectura de lo ya guardado, donde la ausencia se representa como `null`.
  agresor: {
    nombres: string | null
    apellidos: string | null
    telefono: string | null
    direccion: string | null
  } | null
  ninos: Nino[]
}
