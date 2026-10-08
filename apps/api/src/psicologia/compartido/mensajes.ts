// Mensajes uniformes: nunca se distingue "no existe" de "existe pero no es tuyo" (sin IDOR).
export const MENSAJE_SIN_ACCESO_EXPEDIENTE =
  'No tiene acceso a este expediente';
export const MENSAJE_SIN_ACCESO_CITA = 'No tiene acceso a esta cita';
export const MENSAJE_SIN_ACCESO_PROCESO = 'No tiene acceso a este proceso';
export const MENSAJE_SIN_ACCESO_REFERENCIA =
  'No tiene acceso a esta referencia';
export const MENSAJE_SIN_ACCESO_USUARIA = 'No tiene acceso a esta usuaria';
export const MENSAJE_CASO_YA_TOMADO =
  'Este caso ya fue tomado por otra profesional';
export const MENSAJE_CASO_NO_REASIGNABLE =
  'Este caso ya no está disponible: otra profesional lo tomó o volvió con su psicóloga';
export const MENSAJE_TOMAR_PRIMERO =
  'Tome el caso antes de agendar la primera cita';
export const MENSAJE_PROCESO_YA_ABIERTO =
  'Este caso ya tiene agendada su primera cita';
export const MENSAJE_OTRO_PROCESO_ACTIVO =
  'La usuaria ya tiene un proceso psicológico activo';
export const MENSAJE_PROCESO_CERRADO = 'El proceso ya está cerrado';
export const MENSAJE_CONFLICTO_VERSION =
  'El proceso cambió mientras lo editabas. Recarga para ver la versión actual';
export const MENSAJE_PERSONA_AJENA =
  'La persona seleccionada no pertenece a este expediente';
export const MENSAJE_TRASLAPE = 'Ya existe una cita programada en ese horario';
/** `codigo` del 409 de traslape: el frontend lo reconoce para ofrecer "programar de todos modos". */
export const CODIGO_TRASLAPE_CITA = 'TRASLAPE_CITA';
export const MENSAJE_REFERENCIA_PENDIENTE =
  'La usuaria tiene una referencia pendiente: atiéndala desde el Área de atención o la Agenda';
export const MENSAJE_CITA_NO_MARCABLE =
  'La cita ya fue registrada o todavía no ha ocurrido';
export const MENSAJE_RANGO_AGENDA_INVALIDO =
  'El rango de fechas de la agenda no es válido';
export const MENSAJE_CITA_NO_REPROGRAMABLE =
  'Solo se puede reprogramar una cita que siga programada';
