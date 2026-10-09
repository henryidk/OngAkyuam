import type {
  CitaPsicologicaDetalle,
  CitaResumen,
  EstadoCitaPsicologica,
  TipoCitaPsicologica,
} from '@akyuam/shared';

export const CITAS_PSICOLOGICAS_REPOSITORY = Symbol(
  'CITAS_PSICOLOGICAS_REPOSITORY',
);

export interface AccesoCitaPsicologica {
  id: string;
  atencionId: string;
  expedienteId: string;
}

/** Una cita que la psicóloga puede leer: de un proceso suyo o del cerrado de una colega. */
export interface LecturaCitaPsicologica extends AccesoCitaPsicologica {
  /** `false` = la cita es de un proceso que llevó otra psicóloga. */
  propia: boolean;
}

export interface BuscarSolapamientoParams {
  psicologaId: string;
  fechaHora: Date;
  duracionMinutos: number;
  /** Excluye la propia cita al revisar traslape de una reprogramación. */
  excluirCitaId?: string;
}

export interface RegistrarConsultaParams {
  citaId: string;
  psicologaId: string;
  /** `undefined` cuando se guarda como borrador — el estado de la cita no cambia (§5.4 del plan). */
  estado: EstadoCitaPsicologica | undefined;
  temas: string | null;
  intervencion: string | null;
  recomendaciones: string | null;
  acuerdos: string | null;
  observaciones: string | null;
  motivoNoAsistencia: string | null;
  borrador: boolean;
  /** "¿Qué sigue?": la próxima cita que nace junto con el registro, para la misma persona. */
  proximaCita: { fechaHora: Date; duracionMinutos: number } | null;
}

export interface ConsultaRegistrada {
  cita: CitaResumen;
  /** Era la primera sesión atendida: el proceso pasó de Inicio a Seguimiento. */
  pasoASeguimiento: boolean;
  proximaCitaId: string | null;
}

/** Fila mínima para los agregados de indicadores; el corte de mes en GT se calcula en el servicio, nunca aquí. */
export interface CitaParaAgregado {
  fechaHora: Date;
  estado: EstadoCitaPsicologica;
  tipo: TipoCitaPsicologica;
  usuariaId: string;
  municipio: string | null;
}

export interface ListarCitasEnRangoParams {
  psicologaId: string;
  desde: Date;
  hasta: Date;
}

/**
 * Búsqueda de acceso, registro y lectura de una cita. El documento de la sesión vive en
 * `IDocumentosCitaRepository`; programar y mover citas, en los repositorios de agenda y procesos.
 */
export interface ICitasPsicologicasRepository {
  /**
   * Único punto de verificación "¿esta cita pertenece a una atención tomada por esta
   * psicóloga?" — se reusa antes de cada operación sobre una cita ya existente. `null` tanto
   * si la cita no existe como si existe pero no tiene acceso (expediente no referido, caso sin
   * tomar, o tomado por otra) — sin distinción posible desde afuera (sin IDOR).
   */
  buscarAccesoCita(
    citaId: string,
    psicologaId: string,
  ): Promise<AccesoCitaPsicologica | null>;
  /**
   * Como `buscarAccesoCita`, pero también vale la cita de un proceso cerrado de una colega que
   * esta psicóloga puede leer. Solo para lecturas (descargar el documento de la sesión).
   */
  buscarLecturaCita(
    citaId: string,
    psicologaId: string,
  ): Promise<LecturaCitaPsicologica | null>;
  /** Citas PROGRAMADA de esta psicóloga cuyo intervalo se solapa con el propuesto (§7.5: aviso, no bloqueo duro). */
  buscarCitasSolapadas(
    params: BuscarSolapamientoParams,
  ): Promise<CitaResumen[]>;
  /**
   * Guarda el registro de la sesión y, en la misma transacción, lo que se deriva de él: el paso
   * a Seguimiento con la primera sesión atendida y la próxima cita. `null` si el proceso ya se
   * cerró o cambió de dueña, o si la cita fue reprogramada: no se escribió nada. Se usa tras
   * `exigirAccesoCita`.
   */
  registrarConsulta(
    params: RegistrarConsultaParams,
  ): Promise<ConsultaRegistrada | null>;
  /**
   * Filas crudas de citas de esta psicóloga dentro de un rango acotado: alimenta los agregados
   * de `/indicadores` (un año). Nunca agrupa por mes aquí: eso lo hace el servicio con
   * `timezone.ts`.
   */
  listarCitasEnRango(
    params: ListarCitasEnRangoParams,
  ): Promise<CitaParaAgregado[]>;
  /** Permalink de una cita — `null` solo si desaparece entre el guard de acceso y esta lectura. */
  obtenerDetalle(citaId: string): Promise<CitaPsicologicaDetalle | null>;
}
