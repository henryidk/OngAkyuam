import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TIPO_ENTRADA_SISTEMA } from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PROCESO_ACTIVO,
  PROCESO_CON_ACCESO,
} from '../compartido/acceso-juridico';
import { TEXTO_NUMERO_JUDICIAL_REGISTRADO } from '../compartido/textos-bitacora';
import type {
  AgendarAudienciaParams,
  AudienciaParaEscritura,
  CambiarResponsableAudienciaParams,
  EscrituraSobreAudiencia,
  FalloEscrituraAudiencia,
  IAudienciasRepository,
  ObservacionesAudienciaParams,
  RegistrarResultadoAudienciaParams,
  ReprogramarAudienciaParams,
  ResultadoEscrituraAudiencia,
} from '../interfaces/audiencias-repository.interface';
import { estadoActualAudiencia } from './mapeo-audiencia';

type Tx = Prisma.TransactionClient;

/** Deshace la transacción con un motivo conocido; nunca sale del repositorio. */
class EscrituraRechazada extends Error {
  constructor(readonly fallo: FalloEscrituraAudiencia) {
    super(fallo);
  }
}

interface OpcionesEscritura {
  procesoId: string;
  usuarioId: string;
  textoBitacora: string;
  /** Agendar y mover la agenda solo en procesos en trámite o suspendidos. */
  exigirProcesoAbierto: boolean;
  numeroJudicial?: string | null;
}

/**
 * Traduce los rechazos de la base a un motivo. Los dos índices únicos se distinguen por sus
 * columnas: el parcial de (responsableId, inicio) es la misma hora ocupada; el de
 * `reprogramadaDesdeId`, que esa audiencia ya tiene su nueva fecha.
 */
function falloDe(error: unknown): FalloEscrituraAudiencia | null {
  if (error instanceof EscrituraRechazada) {
    return error.fallo;
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    const columnas = (error.meta?.target ?? []) as string[];
    if (columnas.includes('reprogramadaDesdeId')) {
      return 'YA_TIENE_NUEVA_FECHA';
    }
    if (columnas.includes('responsableId')) {
      return 'HORA_OCUPADA';
    }
  }
  return null;
}

@Injectable()
export class AudienciasRepository implements IAudienciasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarParaEscritura(
    audienciaId: string,
  ): Promise<AudienciaParaEscritura | null> {
    const audiencia = await this.prisma.audienciaJuridica.findFirst({
      where: { id: audienciaId, proceso: PROCESO_CON_ACCESO },
      select: {
        id: true,
        procesoId: true,
        inicio: true,
        estado: true,
        version: true,
        responsable: { select: { id: true, nombre: true } },
        reprogramadaA: { select: { id: true } },
        proceso: { select: { fase: true, situacion: true } },
      },
    });
    if (!audiencia) {
      return null;
    }
    return {
      id: audiencia.id,
      procesoId: audiencia.procesoId,
      responsable: audiencia.responsable,
      version: audiencia.version,
      ...estadoActualAudiencia(audiencia),
    };
  }

  agendar(
    params: AgendarAudienciaParams,
  ): Promise<ResultadoEscrituraAudiencia> {
    return this.escribir(
      { ...params, exigirProcesoAbierto: true },
      async (tx) => {
        const creada = await tx.audienciaJuridica.create({
          data: {
            procesoId: params.procesoId,
            inicio: params.inicio,
            responsableId: params.responsableId,
            descripcion: params.descripcion,
            reprogramadaDesdeId: params.reprogramadaDesdeId,
            creadoPorId: params.usuarioId,
          },
          select: { id: true },
        });
        return creada.id;
      },
    );
  }

  reprogramar(
    params: ReprogramarAudienciaParams,
  ): Promise<ResultadoEscrituraAudiencia> {
    return this.escribir(
      { ...params, exigirProcesoAbierto: true },
      async (tx) => {
        // Primero se libera la hora actual: el índice parcial solo mira las PROGRAMADAS.
        await this.actualizarAudiencia(tx, params, {
          estado: 'REPROGRAMADA',
          motivo: params.motivo,
        });
        const anterior = await tx.audienciaJuridica.findUniqueOrThrow({
          where: { id: params.audienciaId },
          select: { descripcion: true },
        });
        const nueva = await tx.audienciaJuridica.create({
          data: {
            procesoId: params.procesoId,
            inicio: params.inicio,
            responsableId: params.responsableId,
            descripcion: anterior.descripcion,
            reprogramadaDesdeId: params.audienciaId,
            creadoPorId: params.usuarioId,
          },
          select: { id: true },
        });
        return nueva.id;
      },
    );
  }

  cambiarResponsable(
    params: CambiarResponsableAudienciaParams,
  ): Promise<ResultadoEscrituraAudiencia> {
    return this.escribirSobre(
      params,
      { responsableId: params.responsableId },
      { exigirProcesoAbierto: true },
    );
  }

  registrarResultado(
    params: RegistrarResultadoAudienciaParams,
  ): Promise<ResultadoEscrituraAudiencia> {
    return this.escribirSobre(
      params,
      {
        estado: params.resultado,
        observaciones: params.observaciones,
        motivo: params.motivo,
        resultadoEn: new Date(),
      },
      { numeroJudicial: params.numeroJudicial },
    );
  }

  editarObservaciones(
    params: ObservacionesAudienciaParams,
  ): Promise<ResultadoEscrituraAudiencia> {
    return this.escribirSobre(params, { observaciones: params.observaciones });
  }

  /** Una escritura que solo actualiza la fila de la audiencia, con su versión. */
  private escribirSobre(
    params: EscrituraSobreAudiencia,
    data: Prisma.AudienciaJuridicaUncheckedUpdateManyInput,
    opciones: Partial<
      Pick<OpcionesEscritura, 'exigirProcesoAbierto' | 'numeroJudicial'>
    > = {},
  ): Promise<ResultadoEscrituraAudiencia> {
    return this.escribir(
      { exigirProcesoAbierto: false, ...params, ...opciones },
      async (tx) => {
        await this.actualizarAudiencia(tx, params, data);
        return params.audienciaId;
      },
    );
  }

  /**
   * El esqueleto de toda escritura, en una transacción: bloquea la fila del proceso (y de paso
   * confirma que sigue abierto), aplica el cambio, guarda el No. judicial si viene y anota la
   * bitácora. Bloquear el proceso primero, siempre en el mismo orden, serializa contra una
   * finalización simultánea y evita interbloqueos.
   */
  private async escribir(
    opciones: OpcionesEscritura,
    cambios: (tx: Tx) => Promise<string>,
  ): Promise<ResultadoEscrituraAudiencia> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.marcarActuacion(tx, opciones);
        const audienciaId = await cambios(tx);
        const numeroJudicialAsignado = await this.asignarNumeroJudicial(
          tx,
          opciones.procesoId,
          opciones.numeroJudicial ?? null,
        );
        await this.anotar(tx, opciones, opciones.textoBitacora);
        if (numeroJudicialAsignado) {
          await this.anotar(tx, opciones, TEXTO_NUMERO_JUDICIAL_REGISTRADO);
        }
        return { ok: true, audienciaId, numeroJudicialAsignado };
      });
    } catch (error) {
      const fallo = falloDe(error);
      if (fallo) {
        return { ok: false, fallo };
      }
      throw error;
    }
  }

  private async marcarActuacion(
    tx: Tx,
    opciones: OpcionesEscritura,
  ): Promise<void> {
    const { count } = await tx.procesoJuridico.updateMany({
      where: {
        id: opciones.procesoId,
        ...(opciones.exigirProcesoAbierto && PROCESO_ACTIVO),
      },
      data: { ultimaActuacionEn: new Date() },
    });
    if (count !== 1) {
      throw new EscrituraRechazada('PROCESO_CERRADO');
    }
  }

  /** `UPDATE … WHERE id AND version`: si otra persona la cambió antes, no se pisa. */
  private async actualizarAudiencia(
    tx: Tx,
    params: { audienciaId: string; version: number },
    data: Prisma.AudienciaJuridicaUncheckedUpdateManyInput,
  ): Promise<void> {
    const { count } = await tx.audienciaJuridica.updateMany({
      where: { id: params.audienciaId, version: params.version },
      data: { ...data, version: { increment: 1 } },
    });
    if (count !== 1) {
      throw new EscrituraRechazada('VERSION_DESACTUALIZADA');
    }
  }

  /**
   * Solo llena un No. judicial vacío: uno ya capturado se corrige desde los datos del proceso,
   * nunca se reemplaza de paso. Sube la versión del proceso para que un formulario de datos
   * abierto con el número vacío no lo borre al guardar.
   */
  private async asignarNumeroJudicial(
    tx: Tx,
    procesoId: string,
    numeroJudicial: string | null,
  ): Promise<boolean> {
    if (!numeroJudicial) {
      return false;
    }
    const { count } = await tx.procesoJuridico.updateMany({
      where: { id: procesoId, numeroJudicial: null },
      data: { numeroJudicial, version: { increment: 1 } },
    });
    return count === 1;
  }

  private async anotar(
    tx: Tx,
    opciones: OpcionesEscritura,
    contenido: string,
  ): Promise<void> {
    await tx.notaAvanceProceso.create({
      data: {
        procesoId: opciones.procesoId,
        tipo: TIPO_ENTRADA_SISTEMA,
        esSistema: true,
        contenido,
        registradoPorId: opciones.usuarioId,
      },
    });
  }
}
