// Mensajes uniformes: nunca se distingue "no existe" de "existe pero no tienes acceso" (sin IDOR).
export const MENSAJE_SIN_ACCESO_EXPEDIENTE =
  'No tiene acceso a este expediente';
export const MENSAJE_SIN_ACCESO_PROCESO = 'No tiene acceso a este proceso';
export const MENSAJE_SIN_ACCESO_DOCUMENTO = 'No tiene acceso a este documento';
export const MENSAJE_SIN_ACCESO_CARPETA = 'No tiene acceso a esta carpeta';
export const MENSAJE_SIN_ACCESO_REFERENCIA =
  'No tiene acceso a esta referencia';
export const MENSAJE_SIN_ACCESO_USUARIA = 'No tiene acceso a esta usuaria';
export const MENSAJE_CONFLICTO_VERSION =
  'El proceso cambió mientras lo editabas. Recarga para ver la versión actual';
export const MENSAJE_ACCION_NO_DISPONIBLE =
  'Esta acción no está disponible en el estado actual del proceso';
export const MENSAJE_PERSONAL_INEXISTENTE =
  'La abogada o procuradora seleccionada no existe';
export const MENSAJE_REFERENCIA_NO_PENDIENTE =
  'La referencia ya fue atendida o devuelta';
export const MENSAJE_CARPETA_DUPLICADA = 'Ya existe una carpeta con ese nombre';
export const MENSAJE_SIN_ACCESO_AUDIENCIA = 'No tiene acceso a esta audiencia';
export const MENSAJE_CONFLICTO_VERSION_AUDIENCIA =
  'Otra persona modificó esta audiencia. Recargue para ver la versión actual';
export const MENSAJE_ACCION_AUDIENCIA_NO_DISPONIBLE =
  'Esta acción no está disponible en el estado actual de la audiencia';
export const MENSAJE_HORA_OCUPADA =
  'La responsable ya tiene otra audiencia programada a esa misma hora';
export const MENSAJE_PROCESO_CERRADO_AUDIENCIA =
  'El proceso está finalizado o abandonado: ya no se le agendan audiencias';
export const MENSAJE_YA_TIENE_NUEVA_FECHA =
  'Esa audiencia ya tiene una nueva fecha agendada';
export const MENSAJE_AUDIENCIA_NO_ES_FUTURO =
  'La audiencia se agenda en una fecha y hora futuras';
export const MENSAJE_AUDIENCIA_DEMASIADO_LEJOS =
  'La fecha está a más de 3 años: revise el año';
export const MENSAJE_RESULTADO_ANTES_DE_TIEMPO =
  'El resultado se registra cuando ya llegó la hora de la audiencia';
