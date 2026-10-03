import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  fechaColumnaISO,
  tipoDocumentoAplicaARegistro,
  type AreaAtencion,
  type ExpedienteDetalleCaso,
} from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { VIDA_UTIL_DOCUMENTO_PENDIENTE_MS } from '../documentos-pendientes/interfaces/documentos-pendientes-repository.interface';
import {
  DocumentoPendienteNoAplicaError,
  DocumentoPendienteNoDisponibleError,
  DpiUsuariaDuplicadoError,
  UsuariaNoEncontradaError,
} from '../interfaces/expedientes-repository.interface';
import type {
  CrearExpedienteConUsuariaNuevaParams,
  DatosCasoParams,
  ExpedienteCreadoResultado,
  IExpedientesRepository,
} from '../interfaces/expedientes-repository.interface';

type TransaccionPrisma = Prisma.TransactionClient;

interface UsuariaParaResultado {
  id: string;
  nombres: string;
  apellidos: string;
  municipio: string | null;
}

@Injectable()
export class ExpedientesRepository implements IExpedientesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async crearConUsuariaNueva(
    params: CrearExpedienteConUsuariaNuevaParams,
  ): Promise<ExpedienteCreadoResultado> {
    return this.conReintentoPorContador(() =>
      this.prisma.$transaction(async (tx) => {
        const usuaria = await this.crearUsuaria(tx, params.identidadUsuaria);
        return this.crearExpedienteEnTransaccion(tx, usuaria, params.datosCaso);
      }),
    );
  }

  async crearParaUsuariaExistente(
    usuariaId: string,
    datosCaso: DatosCasoParams,
  ): Promise<ExpedienteCreadoResultado> {
    return this.conReintentoPorContador(() =>
      this.prisma.$transaction(async (tx) => {
        const usuaria = await tx.usuaria.findUnique({
          where: { id: usuariaId },
          select: { id: true, nombres: true, apellidos: true, municipio: true },
        });
        if (!usuaria) {
          throw new UsuariaNoEncontradaError();
        }
        return this.crearExpedienteEnTransaccion(tx, usuaria, datosCaso);
      }),
    );
  }

  /** Choque raro en el primer expediente del año: dos creaciones concurrentes intentan insertar
   * el mismo ExpedienteContador.anio a la vez. Con el volumen de este sistema (miles, no miles
   * por segundo) un solo reintento es suficiente. La colisión de DPI ya se intercepta y traduce
   * dentro de `crearUsuaria` antes de llegar aquí, así que cualquier P2002 que sobreviva hasta
   * este punto solo puede venir del contador. */
  private async conReintentoPorContador(
    operacion: () => Promise<ExpedienteCreadoResultado>,
  ): Promise<ExpedienteCreadoResultado> {
    try {
      return await operacion();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return operacion();
      }
      throw error;
    }
  }

  private async crearUsuaria(
    tx: TransaccionPrisma,
    identidad: CrearExpedienteConUsuariaNuevaParams['identidadUsuaria'],
  ): Promise<UsuariaParaResultado> {
    try {
      return await tx.usuaria.create({
        data: {
          nombres: identidad.nombres,
          apellidos: identidad.apellidos,
          dpi: identidad.dpi,
          telefono: identidad.telefono,
          direccion: identidad.direccion,
          fechaNacimiento: new Date(identidad.fechaNacimiento),
          grupoEtnico: identidad.grupoEtnico,
          municipio: identidad.municipio,
          departamentoOtro: identidad.departamentoOtro,
          municipioOtro: identidad.municipioOtro,
          ubicacionGeografica: identidad.ubicacionGeografica,
        },
        select: { id: true, nombres: true, apellidos: true, municipio: true },
      });
    } catch (error) {
      // Última línea de defensa contra una colisión de DPI concurrente: dos búsquedas
      // simultáneas no encuentran resultado y ambas intentan crear con el mismo DPI. La
      // restricción @unique en Usuaria.dpi es quien realmente lo impide; aquí solo se traduce
      // a un error de dominio que el service convierte en 409 genérico (nunca filtra identidad).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        (error.meta?.target as string[] | undefined)?.includes('dpi')
      ) {
        throw new DpiUsuariaDuplicadoError();
      }
      throw error;
    }
  }

  /** Compartida por ambos orígenes de creación (usuaria nueva / usuaria existente) — todo lo que
   * varía de un caso a otro, nunca vuelve a tocar la identidad de la Usuaria. */
  private async crearExpedienteEnTransaccion(
    tx: TransaccionPrisma,
    usuaria: UsuariaParaResultado,
    datosCaso: DatosCasoParams,
  ): Promise<ExpedienteCreadoResultado> {
    // "YYYY-MM-DD" -> año por recorte de string, nunca por aritmética de Date (ver CLAUDE.md).
    const anio = Number(datosCaso.fecha.slice(0, 4));
    const fecha = new Date(datosCaso.fecha);

    const contador = await tx.expedienteContador.upsert({
      where: { anio },
      create: { anio, ultimo: 1 },
      update: { ultimo: { increment: 1 } },
    });
    const numero = `${String(contador.ultimo).padStart(2, '0')}-${anio}`;

    const expediente = await tx.expediente.create({
      data: {
        numero,
        usuariaId: usuaria.id,
        fecha,
        tipoRegistro: datosCaso.tipoRegistro,
        tipologiaDelito: datosCaso.tipologiaDelito,
        fechaIngresoAlbergue: datosCaso.fechaIngresoAlbergue
          ? new Date(datosCaso.fechaIngresoAlbergue)
          : undefined,
        observaciones: datosCaso.observaciones,
        creadoPorId: datosCaso.creadoPorId,
        agresor: datosCaso.agresor ? { create: datosCaso.agresor } : undefined,
        ninos:
          datosCaso.ninos.length > 0
            ? {
                create: datosCaso.ninos.map((nino) => ({
                  nombres: nino.nombres,
                  apellidos: nino.apellidos,
                  fechaNacimiento: new Date(nino.fechaNacimiento),
                  genero: nino.genero,
                })),
              }
            : undefined,
      },
    });

    const documentosAdjuntados = await this.adjuntarDocumentosPendientes(
      tx,
      expediente.id,
      datosCaso,
    );

    return {
      id: expediente.id,
      numero: expediente.numero,
      usuariaId: usuaria.id,
      usuariaNombreCompleto: `${usuaria.nombres} ${usuaria.apellidos}`,
      fecha: datosCaso.fecha,
      municipio: usuaria.municipio,
      tipoRegistro: expediente.tipoRegistro,
      documentosAdjuntados,
    };
  }

  /**
   * Convierte los escaneos ya subidos en el paso "Documentos" en `Documento`s del expediente
   * recién creado, dentro de la misma transacción: o queda el caso con todos sus documentos, o
   * no queda nada. La clave en R2 se conserva tal cual — no se copia ni se mueve el archivo.
   * Sin filas de visibilidad: todo es privado por defecto hasta que trabajo social lo comparta.
   */
  private async adjuntarDocumentosPendientes(
    tx: TransaccionPrisma,
    expedienteId: string,
    datosCaso: DatosCasoParams,
  ): Promise<ExpedienteCreadoResultado['documentosAdjuntados']> {
    const ids = [...new Set(datosCaso.documentosPendientesIds)];
    if (ids.length === 0) {
      return [];
    }

    // Solo los que subió quien registra y que no vencieron: nadie puede adjuntar el escaneo de otra persona.
    const pendientes = await tx.documentoPendiente.findMany({
      where: {
        id: { in: ids },
        subidoPorId: datosCaso.creadoPorId,
        createdAt: {
          gte: new Date(Date.now() - VIDA_UTIL_DOCUMENTO_PENDIENTE_MS),
        },
      },
    });
    const tiposDistintos = new Set(
      pendientes.map((pendiente) => pendiente.tipo),
    );
    if (
      pendientes.length !== ids.length ||
      tiposDistintos.size !== pendientes.length
    ) {
      throw new DocumentoPendienteNoDisponibleError();
    }
    if (
      pendientes.some(
        (pendiente) =>
          !tipoDocumentoAplicaARegistro(pendiente.tipo, datosCaso.tipoRegistro),
      )
    ) {
      throw new DocumentoPendienteNoAplicaError();
    }

    const adjuntados = await tx.documento.createManyAndReturn({
      data: pendientes.map((pendiente) => ({
        expedienteId,
        tipo: pendiente.tipo,
        nombreArchivo: pendiente.nombreArchivo,
        claveR2: pendiente.claveR2,
        mimeType: pendiente.mimeType,
        tamanioBytes: pendiente.tamanioBytes,
        subidoPorId: pendiente.subidoPorId,
      })),
      select: { id: true, tipo: true },
    });
    await tx.documentoPendiente.deleteMany({ where: { id: { in: ids } } });
    return adjuntados;
  }

  async obtenerDetalle(id: string): Promise<ExpedienteDetalleCaso | null> {
    const expediente = await this.prisma.expediente.findUnique({
      where: { id },
      include: {
        agresor: true,
        ninos: true,
        referidos: { select: { area: true } },
      },
    });
    if (!expediente) {
      return null;
    }

    return {
      id: expediente.id,
      numero: expediente.numero,
      fecha: fechaColumnaISO(expediente.fecha),
      tipoRegistro: expediente.tipoRegistro,
      tipologiaDelito: expediente.tipologiaDelito,
      usuariaId: expediente.usuariaId,
      observaciones: expediente.observaciones,
      fechaIngresoAlbergue: expediente.fechaIngresoAlbergue
        ? fechaColumnaISO(expediente.fechaIngresoAlbergue)
        : null,
      fechaEgresoAlbergue: expediente.fechaEgresoAlbergue
        ? fechaColumnaISO(expediente.fechaEgresoAlbergue)
        : null,
      agresor: expediente.agresor
        ? {
            nombres: expediente.agresor.nombres,
            apellidos: expediente.agresor.apellidos,
            telefono: expediente.agresor.telefono,
            direccion: expediente.agresor.direccion,
          }
        : null,
      ninos: expediente.ninos.map((nino) => ({
        nombres: nino.nombres,
        apellidos: nino.apellidos,
        fechaNacimiento: fechaColumnaISO(nino.fechaNacimiento),
        genero: nino.genero === 'MUJER' ? 'M' : 'H',
      })),
      // `referidos.area` solo se otorga a áreas de atención en la práctica — mismo criterio de
      // acotamiento de tipo que `UsuariasRepository.obtenerHub`.
      areasReferidas: expediente.referidos.map(
        (referido) => referido.area as AreaAtencion,
      ),
    };
  }
}
