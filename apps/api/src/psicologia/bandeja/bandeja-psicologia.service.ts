import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type {
  CasoPorReasignarDto,
  CasoReasignadoDto,
  ExpedientePreviaTomaDto,
  MotivoReservaCaso,
  ReferenciaBandejaPsicologiaDto,
  ReferenciaParaAgendarDto,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { PersonalQueReserva } from '../../common/reservas-caso';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { eventoAuditoria } from '../compartido/auditoria';
import {
  MENSAJE_CASO_NO_REASIGNABLE,
  MENSAJE_CASO_YA_TOMADO,
  MENSAJE_SIN_ACCESO_REFERENCIA,
} from '../compartido/mensajes';
import { ReservasPsicologia } from '../compartido/reservas';
import { BANDEJA_PSICOLOGIA_REPOSITORY } from '../interfaces/bandeja-psicologia-repository.interface';
import type { IBandejaPsicologiaRepository } from '../interfaces/bandeja-psicologia-repository.interface';
import { AccesoPsicologiaService } from '../services/acceso-psicologia.service';

@Injectable()
export class BandejaPsicologiaService {
  constructor(
    @Inject(BANDEJA_PSICOLOGIA_REPOSITORY)
    private readonly bandejaRepository: IBandejaPsicologiaRepository,
    private readonly acceso: AccesoPsicologiaService,
    private readonly reservas: ReservasPsicologia,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Cola del área: la ven todas las psicólogas, porque cualquiera puede tomar un caso. Cada
   * tarjeta dice si alguien la está agendando o atendiendo ahora.
   */
  async listarSinTomar(
    usuarioId: string,
  ): Promise<ReferenciaBandejaPsicologiaDto[]> {
    const referencias = await this.bandejaRepository.listarSinTomar();
    const reservas = await this.reservas.vigentes(
      referencias.map((referencia) => referencia.referidoId),
      usuarioId,
    );
    return referencias.map((referencia, i) => ({
      ...referencia,
      reserva: reservas[i],
    }));
  }

  /**
   * Aparta la referencia mientras esta psicóloga agenda su primera cita o la atiende ahora; la
   * misma llamada la renueva. Si otra la tiene, 409 con su nombre.
   */
  async reservar(
    referidoId: string,
    motivo: MotivoReservaCaso,
    personal: PersonalQueReserva,
  ): Promise<void> {
    await this.acceso.exigirReferenciaSinTomar(referidoId);
    await this.reservas.reservar(referidoId, personal, motivo);
  }

  /** Suelta la reserva propia; si es de otra persona o ya venció, no pasa nada. */
  liberar(referidoId: string, usuarioId: string): Promise<void> {
    return this.reservas.liberar(referidoId, usuarioId);
  }

  /** A quién se le puede agendar la primera cita de una referencia que sigue sin tomar. */
  async obtenerParaAgendar(
    referidoId: string,
  ): Promise<ReferenciaParaAgendarDto> {
    await this.acceso.exigirReferenciaSinTomar(referidoId);
    const referencia =
      await this.bandejaRepository.buscarParaAgendar(referidoId);
    if (!referencia) {
      throw new ConflictException(MENSAJE_CASO_YA_TOMADO);
    }
    return referencia;
  }

  /**
   * Lo que se ve de un expediente antes de tomar el caso: sin agresor, dirección, teléfono ni
   * ubicación. Si otra psicóloga ya lo tomó, el mismo 403 que si la referencia no existiera.
   */
  async obtenerPreviaToma(
    referidoId: string,
    contexto: ContextoAuditoria,
  ): Promise<ExpedientePreviaTomaDto> {
    const referencia = await this.acceso.exigirReferencia(referidoId);
    const previa =
      referencia.situacion === 'TOMADA'
        ? null
        : await this.bandejaRepository.obtenerPreviaToma(referidoId);
    if (!previa) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_REFERENCIA);
    }

    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'EXPEDIENTE_PREVIA_CONSULTADA',
        entidad: 'Expediente',
        entidadId: referencia.expedienteId,
        detalles: { referidoId },
      }),
    );
    return previa;
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
      citasCanceladas: reasignado.citasCanceladas,
    };
  }
}
