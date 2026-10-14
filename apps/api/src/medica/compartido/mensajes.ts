// Mensajes uniformes: nunca se distingue "no existe" de "existe pero no está referido a
// Medicina" (sin IDOR).
export const MENSAJE_SIN_ACCESO_EXPEDIENTE =
  'No tiene acceso a este expediente';
export const MENSAJE_SIN_ACCESO_REFERENCIA =
  'No tiene acceso a esta referencia';
export const MENSAJE_SIN_ACCESO_ATENCION = 'No tiene acceso a esta atención';
export const MENSAJE_SIN_ACCESO_CITA = 'No tiene acceso a esta cita';
export const MENSAJE_SIN_ACCESO_CONSULTA = 'No tiene acceso a esta consulta';
export const MENSAJE_SIN_ACCESO_DOCUMENTO = 'No tiene acceso a este documento';
export const MENSAJE_SIN_ACCESO_USUARIA = 'No tiene acceso a esta paciente';

export const MENSAJE_FUERA_DE_HORARIO =
  'Elige un día hábil y una hora del horario de consulta';
export const MENSAJE_HORARIO_PASADO = 'Esa hora ya pasó: elige otra';
export const MENSAJE_HORARIO_OCUPADO = 'Ese horario ya está ocupado';
export const MENSAJE_PERSONA_AJENA =
  'La persona seleccionada no pertenece a este expediente';
export const MENSAJE_SIN_REFERENCIA_PENDIENTE =
  'La paciente no tiene una atención activa ni una referencia pendiente de Trabajo Social';
export const MENSAJE_REFERENCIA_YA_ATENDIDA =
  'Esta referencia ya tiene su primera consulta agendada';
export const MENSAJE_ATENCION_NO_ACTIVA = 'La atención médica ya tiene alta';
export const MENSAJE_CITA_CAMBIO =
  'La cita cambió mientras la veías. Recarga para ver la versión actual';
export const MENSAJE_ATENCION_CAMBIO =
  'La atención cambió mientras la veías. Recarga para ver la versión actual';
export const MENSAJE_INASISTENCIA_NO_PERMITIDA =
  'Solo se registra la inasistencia de una cita que ya empezó y sigue sin registrar';
export const MENSAJE_CITA_NO_REPROGRAMABLE =
  'Solo se reprograma una inasistencia que no tenga ya otra cita';
export const MENSAJE_CITA_NO_REGISTRABLE =
  'Esta cita ya tiene consulta registrada o ya no está programada';
export const MENSAJE_LOTE_VENCIDO =
  'Algunos documentos tardaron demasiado en guardarse y se descartaron. Vuelve a subirlos';
export const MENSAJE_RANGO_DISPONIBILIDAD =
  'La disponibilidad solo se consulta desde hoy';
export const MENSAJE_ARCHIVO_REQUERIDO = 'Debe adjuntar un archivo';

export const MENSAJES_ARCHIVO = {
  VACIO: 'El archivo está vacío',
  TIPO_NO_PERMITIDO: 'Tipo de archivo no permitido. Solo PDF o imágenes',
  CONTENIDO_NO_COINCIDE: 'El contenido del archivo no corresponde a su tipo',
} as const;
