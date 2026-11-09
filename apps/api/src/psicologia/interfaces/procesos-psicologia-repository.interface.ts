import type {
  EstadoAtencionPsicologica,
  MotivoCierrePsicologia,
} from '@akyuam/shared';
import type {
  ConsultaRegistrada,
  RegistrarConsultaParams,
} from './citas-psicologicas-repository.interface';

export const PROCESOS_PSICOLOGIA_REPOSITORY = Symbol(
  'PROCESOS_PSICOLOGIA_REPOSITORY',
);

export interface AccesoProcesoPsicologia {
  id: string;
  expedienteId: string;
  expedienteNumero: string;
  usuariaId: string;
  consecutivo: number;
  etapa: EstadoAtencionPsicologica;
  version: number;
  /** Persona del proceso: null = la usuaria. Toda cita del proceso es para ella. */
  ninoId: string | null;
}

/** Un proceso que la psicóloga puede leer: cualquiera de un expediente referido a Psicología. */
export interface LecturaProcesoPsicologia {
  id: string;
  expedienteId: string;
  /** `false` = lo lleva o llevó otra psicóloga: se lee, no se gestiona. */
  propio: boolean;
}

/** Persona a la que se abre un proceso, con su cita de primera atención. */
export interface PrimeraCitaPersona {
  /** null = la usuaria. */
  ninoId: string | null;
  fechaHora: Date;
  duracionMinutos: number;
}

/** La referencia sin tomar que se atiende: atenderla es lo que toma el caso. */
interface ReferenciaQueSeAtiende {
  expedienteId: string;
  referidoId: string;
  psicologaId: string;
  usuariaId: string;
}

export interface AbrirProcesoParams extends ReferenciaQueSeAtiende {
  /** Cada una recibe su proceso en el expediente de la referencia; la primera lleva la referencia. */
  personas: PrimeraCitaPersona[];
}

/**
 * "Atender ahora": se toma el caso, se abre el proceso de una persona con su cita de primera
 * atención (a la hora del servidor) y la sesión queda registrada, en la misma transacción.
 */
export interface AbrirYRegistrarParams extends ReferenciaQueSeAtiende {
  persona: PrimeraCitaPersona;
  registro: Omit<RegistrarConsultaParams, 'citaId' | 'psicologaId' | 'ahora'>;
}

export interface ProcesoAbiertoYRegistrado {
  abierto: ProcesoAbierto;
  registrada: ConsultaRegistrada;
}

/** La usuaria tiene algún expediente referido a Psicología: toda el área puede ver su ficha. */
export interface AccesoUsuariaPsicologia {
  usuariaId: string;
}

/**
 * Dónde nacería el proceso de una persona abierto desde la ficha: el expediente del hijo/a, o
 * el más reciente de la usuaria que el área ya tomó. `PERSONA_AJENA`: el hijo/a no es de esta
 * usuaria. `SIN_TOMAR`: no hay expediente tomado (la referencia se atiende desde la bandeja).
 */
export type ExpedienteParaAbrir =
  { id: string; numero: string } | 'PERSONA_AJENA' | 'SIN_TOMAR';

export interface AbrirProcesoNuevoParams {
  usuariaId: string;
  psicologaId: string;
  /** Cada persona con el expediente (ya tomado) en el que se le abre el proceso. */
  personas: (PrimeraCitaPersona & { expedienteId: string })[];
}

export interface ProcesoAbierto {
  procesoId: string;
  ninoId: string | null;
  /** Consecutivo del proceso dentro de los de su persona. */
  consecutivo: number;
  /** Número del hijo/a dentro del expediente; null = el proceso es de la usuaria. */
  ninoConsecutivo: number | null;
  citaId: string;
}

export interface CerrarProcesoParams {
  procesoId: string;
  version: number;
  motivo: MotivoCierrePsicologia;
  resumen: string | null;
  cerradoPorId: string;
}

export interface ProcesoCerrado {
  version: number;
  citasCanceladas: number;
}

export interface ActualizarVisibilidadParams {
  procesoId: string;
  version: number;
  visibleJuridico: boolean;
  visibleMedica: boolean;
  actualizadoPorId: string;
}

// Carreras que solo se pueden detectar dentro de la transacción; el servicio las traduce a HTTP.

/** El caso ya no es de esta psicóloga o se cerró entre la validación y el guardado. */
export class ProcesoNoDisponibleError extends Error {}
/** Otra psicóloga tomó el caso entre la validación y el guardado. */
export class CasoYaTomadoError extends Error {}
/** La persona ya tiene otro proceso abierto, en este o en otro de los expedientes de la usuaria. */
export class OtroProcesoActivoError extends Error {}
/** La usuaria tiene una referencia sin tomar: se atiende desde el Área de atención. */
export class ReferenciaPendienteError extends Error {}

export interface IProcesosPsicologiaRepository {
  /**
   * Único punto de verificación "¿esta psicóloga gestiona este proceso?" (es su responsable).
   * `null` tanto si no existe como si es de otra — sin distinción posible desde afuera (sin IDOR).
   */
  buscarAccesoProceso(
    procesoId: string,
    psicologaId: string,
  ): Promise<AccesoProcesoPsicologia | null>;
  /**
   * Único punto de verificación "¿esta psicóloga puede leer este proceso?": es de un expediente
   * referido a Psicología. `null` en cualquier otro caso. No sirve para autorizar escrituras.
   */
  buscarLecturaProceso(
    procesoId: string,
    psicologaId: string,
  ): Promise<LecturaProcesoPsicologia | null>;
  /**
   * Único punto de verificación "¿esta psicóloga puede ver a esta usuaria?": tiene un expediente
   * referido a Psicología. `null` tanto si la usuaria no existe como si no fue referida.
   */
  buscarAccesoUsuaria(
    usuariaId: string,
  ): Promise<AccesoUsuariaPsicologia | null>;
  /** Ver `ExpedienteParaAbrir`. Se usa tras `exigirAccesoUsuaria`. */
  buscarExpedienteParaAbrir(
    usuariaId: string,
    ninoId: string | null,
  ): Promise<ExpedienteParaAbrir>;
  ninoPerteneceAExpediente(
    ninoId: string,
    expedienteId: string,
  ): Promise<boolean>;
  /**
   * Toma el caso de una referencia y abre el proceso de cada persona elegida, con su cita de
   * primera atención, todo o nada. Con el expediente bloqueado revalida que siga sin tomar
   * (`CasoYaTomadoError`) y que ninguna persona tenga otro proceso abierto.
   */
  abrir(params: AbrirProcesoParams): Promise<ProcesoAbierto[]>;
  /**
   * Como `abrir` para una sola persona, y además registra la sesión de esa primera cita: todo
   * o nada. Las mismas revalidaciones dentro de la transacción.
   */
  abrirYRegistrar(
    params: AbrirYRegistrarParams,
  ): Promise<ProcesoAbiertoYRegistrado>;
  /**
   * Abre desde la ficha el proceso de cada persona en un expediente que el área ya tomó, junto
   * con su cita de primera atención, todo o nada; quien lo abre queda como responsable.
   * Revalida dentro de la transacción que el expediente siga tomado y que ninguna persona tenga
   * nada abierto (ni, si es la usuaria, una referencia pendiente).
   */
  abrirNuevo(params: AbrirProcesoNuevoParams): Promise<ProcesoAbierto[]>;
  /**
   * Cierra el proceso y cancela sus citas programadas a futuro, todo o nada. `null` si la
   * versión ya no es la actual o el proceso ya estaba cerrado: no se escribió nada.
   */
  cerrar(params: CerrarProcesoParams): Promise<ProcesoCerrado | null>;
  /** Devuelve la versión nueva, o `null` si la enviada ya no era la actual. */
  actualizarVisibilidad(
    params: ActualizarVisibilidadParams,
  ): Promise<number | null>;
}
