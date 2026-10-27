import type {
  ConsultasMedicasPaginaDto,
  ContextoConsultaMedicaDto,
  SignosVitalesDto,
} from '@akyuam/shared';

/** Lo que se guarda de una persona de la visita. */
export interface RegistroPersonaParams {
  ninoId: string | null;
  motivoConsulta: string | null;
  signos: SignosVitalesDto;
  diagnostico: string;
  planTratamiento: string | null;
  recetaLaboratorios: string | null;
  loteDocumentos: string | null;
}

export interface ProximaCitaParams {
  inicio: Date;
  duracionMin: number;
  /** null = la usuaria; un uuid = un hijo/a del expediente (se comprueba en la transacción). */
  personas: (string | null)[];
}

export interface RegistrarConsultaParams {
  atencionId: string;
  citaId: string | null;
  /** Un registro por persona atendida; con cita, exactamente las personas pendientes de la cita. */
  registros: RegistroPersonaParams[];
  /** Con cita, el inicio de la cita; sin cita, el momento de guardar. */
  fechaHora: Date;
  /** Próxima cita, con la duración y las personas que eligió la médica. */
  proxima: ProximaCitaParams | null;
  registradaPorId: string;
  ahora: Date;
}

export interface ConsultaCreada {
  consultaId: string;
  ninoId: string | null;
  personaNombre: string;
  documentosAsociados: number;
}

export interface ConsultaRegistrada {
  /** En el mismo orden que `registros`. */
  consultas: ConsultaCreada[];
  proximaCitaId: string | null;
}

export interface IConsultasMedicasRepository {
  /**
   * Registra la visita en una sola transacción: una consulta por persona, cada una con los
   * documentos de su lote; la cita pasa a atendida y se crea la próxima cita. Con cita, las
   * personas deben ser exactamente las pendientes (si no, no se guarda nada). Lanza `AtencionNoActivaError`, `CitaNoDisponibleError`, `PersonaAjenaError`,
   * `HorarioOcupadoError` o `LoteVencidoError`.
   */
  registrar(params: RegistrarConsultaParams): Promise<ConsultaRegistrada>;
  /** Ficha de solo lectura y personas para el formulario. Sin cita: `cita` es null. */
  contexto(
    atencionId: string,
    cita: {
      id: string;
      inicio: Date;
      duracionMin: number;
      personas: (string | null)[];
    } | null,
  ): Promise<ContextoConsultaMedicaDto | null>;
  /** La atención activa de la usuaria (consulta excepcional sin cita), o null. */
  atencionActivaDeUsuaria(usuariaId: string): Promise<string | null>;
  /**
   * Historia clínica de la usuaria, de la más reciente a la más antigua. `persona`: undefined =
   * todas, null = solo la usuaria, id = ese hijo/a.
   */
  listarPorUsuaria(
    usuariaId: string,
    persona: string | null | undefined,
    cursor: string | undefined,
  ): Promise<ConsultasMedicasPaginaDto>;
}

export const CONSULTAS_MEDICAS_REPOSITORY = Symbol(
  'CONSULTAS_MEDICAS_REPOSITORY',
);
