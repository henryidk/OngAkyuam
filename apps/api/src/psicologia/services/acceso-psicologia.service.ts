import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  MENSAJE_SIN_ACCESO_CITA,
  MENSAJE_SIN_ACCESO_EXPEDIENTE,
  MENSAJE_SIN_ACCESO_PROCESO,
  MENSAJE_SIN_ACCESO_REFERENCIA,
  MENSAJE_SIN_ACCESO_USUARIA,
  MENSAJE_TOMAR_PRIMERO,
} from '../compartido/mensajes';
import { BANDEJA_PSICOLOGIA_REPOSITORY } from '../interfaces/bandeja-psicologia-repository.interface';
import type {
  IBandejaPsicologiaRepository,
  ReferenciaPsicologia,
} from '../interfaces/bandeja-psicologia-repository.interface';
import { PROCESOS_PSICOLOGIA_REPOSITORY } from '../interfaces/procesos-psicologia-repository.interface';
import type {
  AccesoProcesoPsicologia,
  AccesoUsuariaPsicologia,
  IProcesosPsicologiaRepository,
  LecturaProcesoPsicologia,
} from '../interfaces/procesos-psicologia-repository.interface';
import { ATENCION_PSICOLOGICA_REPOSITORY } from '../interfaces/atencion-psicologica-repository.interface';
import type { IAtencionPsicologicaRepository } from '../interfaces/atencion-psicologica-repository.interface';
import { CITAS_PSICOLOGICAS_REPOSITORY } from '../interfaces/citas-psicologicas-repository.interface';
import type {
  AccesoCitaPsicologica,
  ICitasPsicologicasRepository,
  LecturaCitaPsicologica,
} from '../interfaces/citas-psicologicas-repository.interface';

/**
 * Cadena anti-IDOR del módulo de psicología — existe una sola vez aquí y la comparten todos
 * los demás servicios del módulo (§7.1 del plan), en vez de reimplementarla cada uno.
 */
@Injectable()
export class AccesoPsicologiaService {
  constructor(
    @Inject(ATENCION_PSICOLOGICA_REPOSITORY)
    private readonly atencionRepository: IAtencionPsicologicaRepository,
    @Inject(CITAS_PSICOLOGICAS_REPOSITORY)
    private readonly citasRepository: ICitasPsicologicasRepository,
    @Inject(BANDEJA_PSICOLOGIA_REPOSITORY)
    private readonly bandejaRepository: IBandejaPsicologiaRepository,
    @Inject(PROCESOS_PSICOLOGIA_REPOSITORY)
    private readonly procesosRepository: IProcesosPsicologiaRepository,
  ) {}

  /** El proceso existe y es de esta psicóloga; si no, el mismo 403 en ambos casos. */
  async exigirAccesoProceso(
    procesoId: string,
    psicologaId: string,
  ): Promise<AccesoProcesoPsicologia> {
    const acceso = await this.procesosRepository.buscarAccesoProceso(
      procesoId,
      psicologaId,
    );
    if (!acceso) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_PROCESO);
    }
    return acceso;
  }

  /**
   * El proceso se puede LEER: es de esta psicóloga, o es el ya cerrado de una colega con una
   * usuaria que ella también atiende o atendió. Nunca autoriza una escritura: para eso está
   * `exigirAccesoProceso`.
   */
  async exigirLecturaProceso(
    procesoId: string,
    psicologaId: string,
  ): Promise<LecturaProcesoPsicologia> {
    const lectura = await this.procesosRepository.buscarLecturaProceso(
      procesoId,
      psicologaId,
    );
    if (!lectura) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_PROCESO);
    }
    return lectura;
  }

  /**
   * La usuaria tiene una referencia sin tomar o un proceso de esta psicóloga. Si solo la atiende
   * otra psicóloga, el mismo 403 que si no existiera.
   */
  async exigirAccesoUsuaria(
    usuariaId: string,
    psicologaId: string,
  ): Promise<AccesoUsuariaPsicologia> {
    const acceso = await this.procesosRepository.buscarAccesoUsuaria(
      usuariaId,
      psicologaId,
    );
    if (!acceso) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_USUARIA);
    }
    return acceso;
  }

  /**
   * La referencia existe y es de Psicología. No exige dueña: la bandeja sin tomar la ve toda
   * el área, así que saber que una referencia existe no revela nada que la cola no muestre ya.
   */
  async exigirReferencia(
    referidoId: string,
    psicologaId: string,
  ): Promise<ReferenciaPsicologia> {
    const referencia = await this.bandejaRepository.buscarReferencia(
      referidoId,
      psicologaId,
    );
    if (!referencia) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_REFERENCIA);
    }
    return referencia;
  }

  /** La referencia ya es un caso de esta psicóloga con su proceso sin cerrar. */
  async exigirCasoTomado(
    referidoId: string,
    psicologaId: string,
  ): Promise<ReferenciaPsicologia & { procesoId: string }> {
    const referencia = await this.exigirReferencia(referidoId, psicologaId);
    if (referencia.situacion === 'SIN_TOMAR') {
      throw new ConflictException(MENSAJE_TOMAR_PRIMERO);
    }
    if (referencia.situacion !== 'MIA' || referencia.procesoId === null) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_REFERENCIA);
    }
    return { ...referencia, procesoId: referencia.procesoId };
  }

  async exigirAccesoExpediente(
    expedienteId: string,
    psicologaId: string,
  ): Promise<void> {
    const expediente = await this.atencionRepository.buscarExpedienteConAcceso(
      expedienteId,
      psicologaId,
    );
    if (!expediente) {
      // Mismo mensaje/código sin importar el motivo real: expediente inexistente, no referido
      // a PSICOLOGIA, referido pero aún sin tomar, o tomado por otra psicóloga — los cuatro
      // casos son indistinguibles desde afuera (§7.4 del plan, anti-enumeración).
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_EXPEDIENTE);
    }
  }

  async exigirAccesoCita(
    citaId: string,
    psicologaId: string,
  ): Promise<AccesoCitaPsicologica> {
    const acceso = await this.citasRepository.buscarAccesoCita(
      citaId,
      psicologaId,
    );
    if (!acceso) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_CITA);
    }
    return acceso;
  }

  /** Como `exigirLecturaProceso`, para lo que cuelga de una cita (el documento de la sesión). */
  async exigirLecturaCita(
    citaId: string,
    psicologaId: string,
  ): Promise<LecturaCitaPsicologica> {
    const lectura = await this.citasRepository.buscarLecturaCita(
      citaId,
      psicologaId,
    );
    if (!lectura) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_CITA);
    }
    return lectura;
  }

  /**
   * Usado solo por `tomarCaso` — el referido a PSICOLOGIA debe existir, pero la reclamación es
   * precisamente lo que esa acción establece, así que aquí no se exige todavía tener
   * `psicologaAsignadaId` asignado (a diferencia de `exigirAccesoExpediente`).
   */
  async exigirReferidoPsicologia(expedienteId: string): Promise<void> {
    const existe =
      await this.atencionRepository.existeReferidoPsicologia(expedienteId);
    if (!existe) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_EXPEDIENTE);
    }
  }
}
