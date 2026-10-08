import type {
  AgendaCita,
  CitaPsicologicaDetalle,
  CitaResumen,
  EstadoCitaPsicologica,
  ModalidadCita,
  TipoCitaPsicologica,
} from '@akyuam/shared';
import type { PaginaConCursorRepo } from './atencion-psicologica-repository.interface';

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

export interface CrearCitaParams {
  atencionId: string;
  fechaHora: Date;
  modalidad: ModalidadCita;
  lugar: string | null;
  motivo: string;
  tipo: TipoCitaPsicologica;
  duracionMinutos: number;
  atendidoPorId: string;
}

export interface ActualizarCitaParams {
  citaId: string;
  estado: EstadoCitaPsicologica;
  observaciones: string | null;
  acuerdos: string | null;
}

export interface RangoFechas {
  desde: Date;
  hasta: Date;
}

export interface ListarAgendaParams extends RangoFechas {
  /**
   * Sin rol de coordinación en este alcance (§12 del plan, decisión confirmada): la agenda
   * siempre es "la mía", nunca la del área completa — se filtra por dueña igual que el resto
   * del guard de acceso.
   */
  psicologaId: string;
}

export interface BuscarSolapamientoParams {
  psicologaId: string;
  fechaHora: Date;
  duracionMinutos: number;
  /** Excluye la propia cita al revisar traslape de una reprogramación. */
  excluirCitaId?: string;
}

/** Lo mínimo de la cita origen que necesita `reprogramar` — tipo/duración se heredan, no se repiten en `reprogramarCitaSchema`. */
export interface DatosCitaOrigen {
  atencionId: string;
  tipo: TipoCitaPsicologica;
  duracionMinutos: number;
  estado: EstadoCitaPsicologica;
}

export interface ReprogramarCitaParams {
  citaAnteriorId: string;
  atencionId: string;
  tipo: TipoCitaPsicologica;
  duracionMinutos: number;
  fechaHora: Date;
  modalidad: ModalidadCita;
  lugar: string | null;
  motivo: string;
  atendidoPorId: string;
}

export interface RegistrarConsultaParams {
  citaId: string;
  /** `undefined` cuando se guarda como borrador — el estado de la cita no cambia (§5.4 del plan). */
  estado: EstadoCitaPsicologica | undefined;
  temas: string | null;
  intervencion: string | null;
  recomendaciones: string | null;
  acuerdos: string | null;
  observaciones: string | null;
  motivoNoAsistencia: string | null;
  borrador: boolean;
}

/** Fila mínima para agregados por rango — usada tanto por `/agenda/resumen` (mes) como por indicadores (año); el corte de mes/día en GT se calcula en el servicio, nunca aquí (§7.5 del plan). */
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

export interface ListarHistorialParams {
  atencionId: string;
  estado?: EstadoCitaPsicologica;
  cursor?: string;
  limite: number;
}

/**
 * CRUD de citas + búsqueda de acceso (§7.2 del plan). El documento de la consulta vive en
 * `IDocumentosCitaRepository` y los agregados/reportes en `IIndicadoresPsicologiaRepository`
 * — cada interfaz expone solo lo que su servicio consumidor necesita (ISP).
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
  crear(params: CrearCitaParams): Promise<CitaResumen>;
  actualizar(params: ActualizarCitaParams): Promise<CitaResumen>;
  listarAgenda(params: ListarAgendaParams): Promise<AgendaCita[]>;
  /** Citas PROGRAMADA de esta psicóloga cuyo intervalo se solapa con el propuesto (§7.5: aviso, no bloqueo duro). */
  buscarCitasSolapadas(
    params: BuscarSolapamientoParams,
  ): Promise<CitaResumen[]>;
  /** `null` si la cita no existe — no valida acceso, se usa siempre después de `exigirAccesoCita`. */
  obtenerDatosParaReprogramar(citaId: string): Promise<DatosCitaOrigen | null>;
  /** Transaccional: crea la cita nueva y marca la anterior REPROGRAMADA, o nada. */
  reprogramar(params: ReprogramarCitaParams): Promise<CitaResumen>;
  registrarConsulta(params: RegistrarConsultaParams): Promise<CitaResumen>;
  /**
   * Filas crudas de citas de esta psicóloga dentro de un rango acotado — alimenta tanto
   * `/agenda/resumen` (rango de un mes) como los agregados de `/indicadores` (rango de un
   * año). Nunca agrupa por día/mes aquí: eso lo hace el servicio con `timezone.ts` (§7.5).
   */
  listarCitasEnRango(
    params: ListarCitasEnRangoParams,
  ): Promise<CitaParaAgregado[]>;
  /** Historial paginado por cursor de una atención puntual (§5.3/§7.5 del plan). */
  listarHistorial(
    params: ListarHistorialParams,
  ): Promise<PaginaConCursorRepo<CitaResumen>>;
  /** Permalink de una cita — `null` solo si desaparece entre el guard de acceso y esta lectura. */
  obtenerDetalle(citaId: string): Promise<CitaPsicologicaDetalle | null>;
}
