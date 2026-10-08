import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type {
  CasoPorAgendarDto,
  CasoPorReasignarDto,
  CasoPsicologiaTomadoDto,
  CasoReasignadoDto,
  ReferenciaBandejaPsicologiaDto,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { eventoAuditoria } from '../compartido/auditoria';
import {
  MENSAJE_CASO_NO_REASIGNABLE,
  MENSAJE_CASO_YA_TOMADO,
} from '../compartido/mensajes';
import { ATENCION_PSICOLOGICA_REPOSITORY } from '../interfaces/atencion-psicologica-repository.interface';
import type { IAtencionPsicologicaRepository } from '../interfaces/atencion-psicologica-repository.interface';
import { BANDEJA_PSICOLOGIA_REPOSITORY } from '../interfaces/bandeja-psicologia-repository.interface';
import type { IBandejaPsicologiaRepository } from '../interfaces/bandeja-psicologia-repository.interface';
import { AccesoPsicologiaService } from '../services/acceso-psicologia.service';

@Injectable()
export class BandejaPsicologiaService {
  constructor(
    @Inject(BANDEJA_PSICOLOGIA_REPOSITORY)
    private readonly bandejaRepository: IBandejaPsicologiaRepository,
    @Inject(ATENCION_PSICOLOGICA_REPOSITORY)
    private readonly atencionRepository: IAtencionPsicologicaRepository,
    private readonly acceso: AccesoPsicologiaService,
    private readonly auditService: AuditService,
  ) {}

  /** Cola del área: la ven todas las psicólogas, porque cualquiera puede tomar un caso. */
  listarSinTomar(): Promise<ReferenciaBandejaPsicologiaDto[]> {
    return this.bandejaRepository.listarSinTomar();
  }

  /** Casos que esta psicóloga tomó y aún no tienen primera cita. */
  listarPorAgendar(psicologaId: string): Promise<CasoPorAgendarDto[]> {
    return this.bandejaRepository.listarPorAgendar(psicologaId);
  }

  /**
   * La primera psicóloga que toma la referencia se vuelve la dueña del caso. Si dos lo
   * intentan a la vez, la base deja pasar a una sola y la otra recibe el 409.
   */
  async tomar(
    referidoId: string,
    contexto: ContextoAuditoria,
  ): Promise<CasoPsicologiaTomadoDto> {
    const referencia = await this.acceso.exigirReferencia(
      referidoId,
      contexto.usuarioId,
    );
    if (referencia.situacion !== 'SIN_TOMAR') {
      throw new ConflictException(MENSAJE_CASO_YA_TOMADO);
    }

    const resultado = await this.atencionRepository.tomarCaso({
      expedienteId: referencia.expedienteId,
      psicologaId: contexto.usuarioId,
    });
    if (resultado === 'YA_TOMADO') {
      throw new ConflictException(MENSAJE_CASO_YA_TOMADO);
    }

    const tomada = await this.acceso.exigirCasoTomado(
      referidoId,
      contexto.usuarioId,
    );
    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'CASO_PSICOLOGIA_TOMADO',
        entidad: 'AtencionPsicologica',
        entidadId: tomada.procesoId,
        detalles: { expedienteId: tomada.expedienteId, referidoId },
      }),
    );

    return { referidoId, procesoId: tomada.procesoId };
  }

  /**
   * Casos y procesos abiertos de psicólogas con la cuenta desactivada. Los ve toda el área,
   * igual que las referencias sin tomar: sin notas ni documentos, solo lo necesario para decidir.
   */
  listarPorReasignar(): Promise<CasoPorReasignarDto[]> {
    return this.bandejaRepository.listarPorReasignar();
  }

  /**
   * Quien lo toma pasa a ser la dueña y hereda el historial, pero no las citas programadas. Si
   * dos lo intentan a la vez gana la primera; la otra recibe el 409, igual que si el proceso no
   * existiera o no estuviera por reasignar: desde afuera no se distingue.
   */
  async tomarPorReasignar(
    procesoId: string,
    contexto: ContextoAuditoria,
  ): Promise<CasoReasignadoDto> {
    const reasignado = await this.bandejaRepository.reasignar({
      procesoId,
      psicologaId: contexto.usuarioId,
    });
    if (!reasignado) {
      throw new ConflictException(MENSAJE_CASO_NO_REASIGNABLE);
    }

    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'PROCESO_PSICOLOGIA_REASIGNADO',
        entidad: 'AtencionPsicologica',
        entidadId: procesoId,
        detalles: {
          expedienteId: reasignado.expedienteId,
          psicologaAnteriorId: reasignado.psicologaAnteriorId,
          citasCanceladas: reasignado.citasCanceladas,
        },
      }),
    );

    return {
      procesoId,
      referidoIdPorAgendar: reasignado.referidoIdPorAgendar,
      citasCanceladas: reasignado.citasCanceladas,
    };
  }
}
