import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  MENSAJE_SIN_ACCESO_CITA,
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
import { CITAS_PSICOLOGICAS_REPOSITORY } from '../interfaces/citas-psicologicas-repository.interface';
import type {
  AccesoCitaPsicologica,
  ICitasPsicologicasRepository,
  LecturaCitaPsicologica,
} from '../interfaces/citas-psicologicas-repository.interface';

/**
 * Cadena anti-IDOR del módulo de psicología — existe una sola vez aquí y la comparten todos
 * los demás servicios del módulo (§7.1 del plan), en vez de reimplementarla cada uno. Tres
 * niveles (planpsicologiaequipo.md): LEER es de toda el área (`exigirLectura*`,
 * `exigirAccesoUsuaria`); GESTIONAR un proceso es de su responsable (`exigirAccesoProceso`,
 * `exigirAccesoCita`); REGISTRAR una sesión es de quien la atendió (`exigirAutoriaCita`).
 */
@Injectable()
export class AccesoPsicologiaService {
  constructor(
    @Inject(CITAS_PSICOLOGICAS_REPOSITORY)
    private readonly citasRepository: ICitasPsicologicasRepository,
    @Inject(BANDEJA_PSICOLOGIA_REPOSITORY)
    private readonly bandejaRepository: IBandejaPsicologiaRepository,
    @Inject(PROCESOS_PSICOLOGIA_REPOSITORY)
    private readonly procesosRepository: IProcesosPsicologiaRepository,
  ) {}

  /** El proceso existe y esta psicóloga es su responsable; si no, el mismo 403 en ambos casos. */
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
   * El proceso se puede LEER: es de un expediente referido a Psicología, lo lleve quien lo
   * lleve. Nunca autoriza una escritura: para eso está `exigirAccesoProceso`.
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
   * La usuaria tiene algún expediente referido a Psicología. Si no, el mismo 403 que si no
   * existiera. Solo autoriza leer su ficha; abrir un proceso se revalida aparte.
   */
  async exigirAccesoUsuaria(
    usuariaId: string,
  ): Promise<AccesoUsuariaPsicologia> {
    const acceso = await this.procesosRepository.buscarAccesoUsuaria(usuariaId);
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

  /**
   * La cita es de un proceso del que esta psicóloga es responsable: puede moverla. `mensaje`
   * solo cambia cuando ya se sabe que puede leer la cita, así que no revela nada (sin IDOR).
   */
  async exigirAccesoCita(
    citaId: string,
    psicologaId: string,
    mensaje: string = MENSAJE_SIN_ACCESO_CITA,
  ): Promise<AccesoCitaPsicologica> {
    const acceso = await this.citasRepository.buscarAccesoCita(
      citaId,
      psicologaId,
    );
    if (!acceso) {
      throw new ForbiddenException(mensaje);
    }
    return acceso;
  }

  /**
   * Esta psicóloga atendió la cita y el proceso sigue abierto: puede registrar o corregir la
   * sesión y subir su documento, aunque el proceso lo lleve otra.
   */
  async exigirAutoriaCita(
    citaId: string,
    psicologaId: string,
  ): Promise<AccesoCitaPsicologica> {
    const acceso = await this.citasRepository.buscarAutoriaCita(
      citaId,
      psicologaId,
    );
    if (!acceso) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_CITA);
    }
    return acceso;
  }

  /** Como `exigirLecturaProceso`, para una cita y lo que cuelga de ella (el documento de la sesión). */
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
}
