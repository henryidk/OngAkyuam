// Errores de dominio que solo se detectan dentro de una transacción. Los repositorios los
// lanzan y cada servicio los traduce a HTTP (`compartido/errores-http.ts`).

/** Ya hay una cita programada o atendida en ese horario. */
export class HorarioOcupadoError extends Error {}

/** Sin atención activa y sin referencia pendiente: no hay qué abrir. */
export class SinReferenciaPendienteError extends Error {}

/** La referencia ya abrió su atención (doble envío o dos pestañas). */
export class ReferenciaYaAtendidaError extends Error {}

/** La atención ya tiene alta. */
export class AtencionNoActivaError extends Error {}

/** La versión leída ya no es la actual. */
export class VersionCambioError extends Error {}

/** La cita ya no admite esa acción (ya registrada, ya reprogramada, ya no programada). */
export class CitaNoDisponibleError extends Error {}

/** Algún documento del lote ya venció o no es de quien guarda la consulta. */
export class LoteVencidoError extends Error {}
