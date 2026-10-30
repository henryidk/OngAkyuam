import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  parseLocalGT,
  type AgendarAudienciaInput,
  type AudienciaAgendadaDto,
  type CambiarResponsableAudienciaInput,
  type PersonalAsignado,
  type ReprogramarAudienciaInput,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import { RELOJ, type IReloj } from '../../common/reloj';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { esProcesoActivo, vacioANulo } from '../compartido/acceso-juridico';
import { AccesoJuridicoService } from '../compartido/acceso-juridico.service';
import { AsignacionPersonalService } from '../compartido/asignacion-personal.service';
import {
  MENSAJE_PROCESO_CERRADO_AUDIENCIA,
  MENSAJE_SIN_ACCESO_AUDIENCIA,
} from '../compartido/mensajes';
import { AUDIENCIAS_REPOSITORY } from '../interfaces/audiencias-repository.interface';
import type {
  AudienciaParaEscritura,
  IAudienciasRepository,
} from '../interfaces/audiencias-repository.interface';
import {
  audienciaAgendada,
  exigirAccion,
  exigirAudiencia,
  exigirGuardado,
  exigirHorarioAgenda,
  momento,
} from './reglas-escritura';
import {
  auditarAudiencia,
  auditarNumeroJudicial,
} from './auditoria-audiencias';

/**
 * Mueve la agenda: agendar, reprogramar y cambiar la responsable. No hay cancelación manual: las
 * programadas solo se cancelan solas al finalizar o abandonar el proceso. El choque de
 * horario y la versión los decide la base dentro de la transacción (ver el repositorio).
 */
@Injectable()
export class ProgramacionAudienciasService {
  constructor(
    @Inject(AUDIENCIAS_REPOSITORY)
    private readonly audienciasRepository: IAudienciasRepository,
    private readonly acceso: AccesoJuridicoService,
    private readonly asignacion: AsignacionPersonalService,
    @Inject(RELOJ) private readonly reloj: IReloj,
    private readonly auditService: AuditService,
  ) {}

  async agendar(
    procesoId: string,
    datos: AgendarAudienciaInput,
    contexto: ContextoAuditoria,
  ): Promise<AudienciaAgendadaDto> {
    const proceso = await this.acceso.exigirProceso(procesoId);
    if (!esProcesoActivo(proceso)) {
      throw new ConflictException(MENSAJE_PROCESO_CERRADO_AUDIENCIA);
    }
    if (datos.reprogramadaDesdeId) {
      await this.exigirNuevaFechaPosible(datos.reprogramadaDesdeId, procesoId);
    }
    const inicio = parseLocalGT(datos.fechaHora);
    exigirHorarioAgenda(inicio, this.reloj.ahora());
    const responsable = await this.asignacion.exigirResponsableAudiencia(
      datos.responsableId,
    );

    const guardado = exigirGuardado(
      await this.audienciasRepository.agendar({
        procesoId,
        usuarioId: contexto.usuarioId,
        inicio,
        responsableId: responsable.id,
        descripcion: vacioANulo(datos.descripcion),
        reprogramadaDesdeId: datos.reprogramadaDesdeId,
        numeroJudicial: datos.numeroJudicial,
        textoBitacora: `Audiencia agendada para ${momento(inicio)} · ${responsable.nombre}`,
      }),
    );

    await auditarAudiencia(
      this.auditService,
      contexto,
      'AUDIENCIA_AGENDADA',
      guardado.audienciaId,
      {
        procesoId,
        ...(datos.reprogramadaDesdeId && {
          reprogramadaDesdeId: datos.reprogramadaDesdeId,
        }),
      },
    );
    await auditarNumeroJudicial(
      this.auditService,
      contexto,
      procesoId,
      guardado.numeroJudicialAsignado,
    );
    return audienciaAgendada(guardado.audienciaId, inicio);
  }

  async reprogramar(
    audienciaId: string,
    datos: ReprogramarAudienciaInput,
    contexto: ContextoAuditoria,
  ): Promise<AudienciaAgendadaDto> {
    const ahora = this.reloj.ahora();
    const audiencia = await exigirAudiencia(
      this.audienciasRepository,
      audienciaId,
    );
    exigirAccion('REPROGRAMAR', audiencia, ahora);
    const inicio = parseLocalGT(datos.fechaHora);
    exigirHorarioAgenda(inicio, ahora);
    const responsable = await this.responsableNueva(
      datos.responsableId,
      audiencia,
    );

    const guardado = exigirGuardado(
      await this.audienciasRepository.reprogramar({
        procesoId: audiencia.procesoId,
        audienciaId,
        version: datos.version,
        usuarioId: contexto.usuarioId,
        inicio,
        responsableId: responsable.id,
        motivo: datos.motivo,
        textoBitacora: `Audiencia del ${momento(audiencia.inicio)} reprogramada para ${momento(inicio)} · ${responsable.nombre}`,
      }),
    );

    await auditarAudiencia(
      this.auditService,
      contexto,
      'AUDIENCIA_REPROGRAMADA',
      audienciaId,
      {
        procesoId: audiencia.procesoId,
        nuevaAudienciaId: guardado.audienciaId,
      },
    );
    return audienciaAgendada(guardado.audienciaId, inicio);
  }

  async cambiarResponsable(
    audienciaId: string,
    datos: CambiarResponsableAudienciaInput,
    contexto: ContextoAuditoria,
  ): Promise<void> {
    const audiencia = await exigirAudiencia(
      this.audienciasRepository,
      audienciaId,
    );
    exigirAccion('CAMBIAR_RESPONSABLE', audiencia, this.reloj.ahora());
    if (datos.responsableId === audiencia.responsable.id) {
      return;
    }
    const responsable = await this.asignacion.exigirResponsableAudiencia(
      datos.responsableId,
    );

    exigirGuardado(
      await this.audienciasRepository.cambiarResponsable({
        procesoId: audiencia.procesoId,
        audienciaId,
        version: datos.version,
        usuarioId: contexto.usuarioId,
        responsableId: responsable.id,
        textoBitacora: `Audiencia del ${momento(audiencia.inicio)}: nueva responsable ${responsable.nombre}`,
      }),
    );

    await auditarAudiencia(
      this.auditService,
      contexto,
      'AUDIENCIA_RESPONSABLE',
      audienciaId,
      {
        procesoId: audiencia.procesoId,
        responsableId: responsable.id,
      },
    );
  }

  /**
   * "Agendar nueva fecha" solo desde una cancelada o no realizada del mismo proceso que todavía
   * no tenga su nueva fecha. Una de otro proceso responde como inexistente.
   */
  private async exigirNuevaFechaPosible(
    anteriorId: string,
    procesoId: string,
  ): Promise<void> {
    const anterior = await exigirAudiencia(
      this.audienciasRepository,
      anteriorId,
    );
    if (anterior.procesoId !== procesoId) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_AUDIENCIA);
    }
    exigirAccion('AGENDAR_NUEVA_FECHA', anterior, this.reloj.ahora());
  }

  /**
   * Una responsable que ya dejó de estar activa se acepta solo si no cambia: el formulario la
   * trae precargada y no debe impedir reprogramar. Elegir a otra exige que esté activa.
   */
  private responsableNueva(
    responsableId: string,
    audiencia: AudienciaParaEscritura,
  ): Promise<PersonalAsignado> {
    return responsableId === audiencia.responsable.id
      ? Promise.resolve(audiencia.responsable)
      : this.asignacion.exigirResponsableAudiencia(responsableId);
  }
}
