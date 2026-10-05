import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type {
  CrearProcesosEnLoteInput,
  ErrorDuplicadosLote,
  ProcesosCreadosLote,
  RegistroContextoDto,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { RedisService } from '../../redis/redis.service';
import { vacioANulo } from '../compartido/acceso-juridico';
import { AccesoJuridicoService } from '../compartido/acceso-juridico.service';
import { AsignacionPersonalService } from '../compartido/asignacion-personal.service';
import { eventoAuditoria } from '../compartido/auditoria';
import {
  MENSAJE_PERSONAL_INEXISTENTE,
  MENSAJE_REFERENCIA_NO_PENDIENTE,
  MENSAJE_SIN_ACCESO_EXPEDIENTE,
  MENSAJE_SIN_ACCESO_REFERENCIA,
} from '../compartido/mensajes';
import { PROCESOS_REPOSITORY } from '../interfaces/procesos-repository.interface';
import type {
  ExpedienteAccesoJuridico,
  IProcesosRepository,
} from '../interfaces/procesos-repository.interface';
import { REFERENCIAS_REPOSITORY } from '../interfaces/referencias-repository.interface';
import type { IReferenciasRepository } from '../interfaces/referencias-repository.interface';
import {
  PersonalInexistenteError,
  REGISTRO_PROCESOS_REPOSITORY,
  ReferenciaNoPendienteError,
} from '../interfaces/registro-procesos-repository.interface';
import type {
  IRegistroProcesosRepository,
  ProcesoNuevo,
} from '../interfaces/registro-procesos-repository.interface';
import { USUARIAS_JURIDICO_REPOSITORY } from '../interfaces/usuarias-repository.interface';
import type { IUsuariasJuridicoRepository } from '../interfaces/usuarias-repository.interface';

/** Cuánto se recuerda la respuesta de un lote para no crearlo dos veces por un doble envío. */
const TTL_IDEMPOTENCIA_SEGUNDOS = 600;
const FORMATO_CLAVE_IDEMPOTENCIA = /^[A-Za-z0-9-]{8,64}$/;

@Injectable()
export class RegistroProcesosService {
  constructor(
    @Inject(REGISTRO_PROCESOS_REPOSITORY)
    private readonly registroRepository: IRegistroProcesosRepository,
    @Inject(PROCESOS_REPOSITORY)
    private readonly procesosRepository: IProcesosRepository,
    @Inject(REFERENCIAS_REPOSITORY)
    private readonly referenciasRepository: IReferenciasRepository,
    @Inject(USUARIAS_JURIDICO_REPOSITORY)
    private readonly usuariasRepository: IUsuariasJuridicoRepository,
    private readonly acceso: AccesoJuridicoService,
    private readonly asignacion: AsignacionPersonalService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
  ) {}

  async obtenerContexto(expedienteId: string): Promise<RegistroContextoDto> {
    const expediente = await this.acceso.exigirExpediente(expedienteId);

    const [ficha, referencia, activosPorTipo, procesosVinculables, historial] =
      await Promise.all([
        this.usuariasRepository.obtenerFicha(expediente.usuariaId),
        this.referenciasRepository.buscarPendientePorExpediente(expedienteId),
        this.registroRepository.buscarActivosPorTipo(expediente.usuariaId),
        this.registroRepository.listarVinculables(expediente.usuariaId),
        this.procesosRepository.listarPorUsuaria(expediente.usuariaId),
      ]);
    if (!ficha) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_EXPEDIENTE);
    }

    const { id, nombreCompleto, dpi } = ficha.usuaria;
    return {
      expediente: { id: expediente.id, numero: expediente.numero },
      usuaria: { id, nombreCompleto, dpi },
      referencia,
      sugeridos: referencia?.procesosSugeridos ?? [],
      activosPorTipo,
      procesosVinculables,
      historial,
    };
  }

  async crearLote(
    expedienteId: string,
    datos: CrearProcesosEnLoteInput,
    contexto: ContextoAuditoria,
    claveIdempotencia?: string,
  ): Promise<ProcesosCreadosLote> {
    const expediente = await this.acceso.exigirExpediente(expedienteId);

    const claveRedis = this.claveIdempotencia(
      claveIdempotencia,
      contexto.usuarioId,
      expedienteId,
    );
    if (claveRedis) {
      const guardada = await this.redisService.get(claveRedis);
      if (guardada) {
        return JSON.parse(guardada) as ProcesosCreadosLote;
      }
    }

    this.validarReferencia(datos.referidoId, expediente);
    const procesos = datos.procesos.map((proceso): ProcesoNuevo => ({
      tipo: proceso.tipo,
      abogadaId: vacioANulo(proceso.abogadaId),
      procuradoraId: vacioANulo(proceso.procuradoraId),
      fechaInicio: proceso.fechaInicio,
      procesoOrigenId: proceso.procesoOrigenId,
    }));
    await this.validarPersonal(procesos);
    await this.validarVinculos(procesos, expediente.usuariaId);
    if (!datos.confirmaDuplicados) {
      await this.rechazarDuplicados(procesos, expediente.usuariaId);
    }

    const creados = await this.guardar({
      expediente,
      referidoId: datos.referidoId,
      procesos,
      creadoPorId: contexto.usuarioId,
    });

    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'PROCESOS_JURIDICOS_CREADOS_LOTE',
        entidad: 'Expediente',
        entidadId: expedienteId,
        detalles: {
          expedienteId,
          tipos: procesos.map((proceso) => proceso.tipo),
          cantidad: procesos.length,
        },
      }),
    );

    const respuesta = { procesos: creados, usuariaId: expediente.usuariaId };
    if (claveRedis) {
      await this.redisService.set(
        claveRedis,
        JSON.stringify(respuesta),
        TTL_IDEMPOTENCIA_SEGUNDOS,
      );
    }
    return respuesta;
  }

  /** La clave es de quien la envió y de ese expediente: no sirve para leer lotes ajenos. */
  private claveIdempotencia(
    clave: string | undefined,
    usuarioId: string,
    expedienteId: string,
  ): string | null {
    if (clave === undefined) {
      return null;
    }
    if (!FORMATO_CLAVE_IDEMPOTENCIA.test(clave)) {
      throw new BadRequestException('Idempotency-Key inválida');
    }
    return `juridico:lote:${usuarioId}:${expedienteId}:${clave}`;
  }

  private validarReferencia(
    referidoId: string | null,
    expediente: ExpedienteAccesoJuridico,
  ): void {
    if (!referidoId) {
      return;
    }
    if (referidoId !== expediente.referidoId) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_REFERENCIA);
    }
    if (!expediente.referenciaPendiente) {
      throw new ConflictException(MENSAJE_REFERENCIA_NO_PENDIENTE);
    }
  }

  private async validarPersonal(procesos: ProcesoNuevo[]): Promise<void> {
    for (const proceso of procesos) {
      await this.asignacion.validar(proceso.abogadaId, proceso.procuradoraId);
    }
  }

  /** Un proceso solo se vincula con otro de la misma usuaria que Jurídico pueda ver. */
  private async validarVinculos(
    procesos: ProcesoNuevo[],
    usuariaId: string,
  ): Promise<void> {
    if (procesos.every((proceso) => proceso.procesoOrigenId === null)) {
      return;
    }
    const vinculables =
      await this.registroRepository.listarVinculables(usuariaId);
    const permitidos = new Set(vinculables.map((proceso) => proceso.id));
    const invalido = procesos.some(
      (proceso) =>
        proceso.procesoOrigenId !== null &&
        !permitidos.has(proceso.procesoOrigenId),
    );
    if (invalido) {
      throw new BadRequestException(
        'El proceso anterior seleccionado no pertenece a esta usuaria',
      );
    }
  }

  private async rechazarDuplicados(
    procesos: ProcesoNuevo[],
    usuariaId: string,
  ): Promise<void> {
    const duplicados = await this.registroRepository.buscarActivosPorTipo(
      usuariaId,
      procesos.map((proceso) => proceso.tipo),
    );
    if (duplicados.length === 0) {
      return;
    }
    const cuerpo: ErrorDuplicadosLote = {
      codigo: 'DUPLICADOS_ACTIVOS',
      message: 'La usuaria ya tiene procesos activos de este tipo',
      detalle: { duplicados },
    };
    throw new ConflictException(cuerpo);
  }

  private async guardar(params: {
    expediente: ExpedienteAccesoJuridico;
    referidoId: string | null;
    procesos: ProcesoNuevo[];
    creadoPorId: string;
  }) {
    try {
      return await this.registroRepository.crearLote({
        expedienteId: params.expediente.id,
        numeroExpediente: params.expediente.numero,
        referidoId: params.referidoId,
        procesos: params.procesos,
        creadoPorId: params.creadoPorId,
      });
    } catch (error) {
      // Carreras entre la validación y el guardado, traducidas a HTTP en un solo lugar.
      if (error instanceof ReferenciaNoPendienteError) {
        throw new ConflictException(MENSAJE_REFERENCIA_NO_PENDIENTE);
      }
      if (error instanceof PersonalInexistenteError) {
        throw new BadRequestException(MENSAJE_PERSONAL_INEXISTENTE);
      }
      throw error;
    }
  }
}
