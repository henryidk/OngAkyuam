import type {
  ConsultasMedicasPaginaDto,
  ContextoConsultaMedicaDto,
  SignosVitalesDto,
} from '@akyuam/shared';

export interface RegistrarConsultaParams {
  atencionId: string;
  citaId: string | null;
  ninoId: string | null;
  /** Con cita, el inicio de la cita; sin cita, el momento de guardar. */
  fechaHora: Date;
  motivoConsulta: string | null;
  signos: SignosVitalesDto;
  diagnostico: string;
  planTratamiento: string | null;
  recetaLaboratorios: string | null;
  proxima: Date | null;
  loteDocumentos: string | null;
  registradaPorId: string;
  ahora: Date;
}

export interface ConsultaRegistrada {
  consultaId: string;
  personaNombre: string;
  proximaCitaId: string | null;
  documentosAsociados: number;
}

export interface IConsultasMedicasRepository {
  /**
   * Registra la consulta en una sola transacción: la cita pasa a atendida, se crea la próxima
   * cita y los documentos del lote pasan a la consulta. Lanza `AtencionNoActivaError`,
   * `CitaNoDisponibleError`, `HorarioOcupadoError` o `LoteVencidoError`.
   */
  registrar(params: RegistrarConsultaParams): Promise<ConsultaRegistrada>;
  /** Ficha de solo lectura y personas para el formulario. Sin cita: `cita` es null. */
  contexto(
    atencionId: string,
    cita: { id: string; inicio: Date; ninoId: string | null } | null,
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
