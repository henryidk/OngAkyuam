import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OtroProcesoActivoError,
  ProcesoNoDisponibleError,
  ProcesoYaAbiertoError,
  ReferenciaPendienteError,
} from '../interfaces/procesos-psicologia-repository.interface';
import type {
  AbrirProcesoNuevoParams,
  AbrirProcesoParams,
  AbrirYRegistrarParams,
  AccesoProcesoPsicologia,
  AccesoUsuariaPsicologia,
  ActualizarVisibilidadParams,
  CerrarProcesoParams,
  ExpedienteParaAbrir,
  IProcesosPsicologiaRepository,
  LecturaProcesoPsicologia,
  PrimeraCitaPersona,
  ProcesoAbierto,
  ProcesoAbiertoYRegistrado,
  ProcesoCerrado,
} from '../interfaces/procesos-psicologia-repository.interface';
import {
  EXPEDIENTE_DE_PSICOLOGIA,
  EXPEDIENTE_SIN_TOMAR,
  EXPEDIENTE_TOMADO,
  PROCESO_LEGIBLE,
  procesoAbiertoDePersona,
  procesoGestionable,
} from './acceso-expediente';
import { guardarRegistroEnTx } from './registro-sesion-tx';
import {
  SERIALIZABLE,
  conReintentos,
  siguienteConsecutivoProceso,
} from './transaccion-psicologia';

/**
 * Número del hijo/a dentro del expediente, o null si el proceso es de la usuaria. Si el hijo/a
 * no es del expediente, el caso no está disponible (el servicio ya lo validó antes).
 */
async function consecutivoDeNino(
  tx: Prisma.TransactionClient,
  ninoId: string | null,
  expedienteId: string,
): Promise<number | null> {
  if (ninoId === null) {
    return null;
  }
  const nino = await tx.nino.findFirst({
    where: { id: ninoId, expedienteId },
    select: { consecutivo: true },
  });
  if (!nino) {
    throw new ProcesoNoDisponibleError();
  }
  return nino.consecutivo;
}

/** Quién abre y a quién: una persona del expediente de la usuaria, con su primera cita. */
type PersonaParaAbrir = PrimeraCitaPersona & {
  usuariaId: string;
  psicologaId: string;
};

/** Lo abierto, con su expediente: las demás personas de una referencia se abren en el mismo. */
type ProcesoAbiertoEn = ProcesoAbierto & { expedienteId: string };

function sinExpediente(abierto: ProcesoAbiertoEn): ProcesoAbierto {
  return {
    procesoId: abierto.procesoId,
    ninoId: abierto.ninoId,
    consecutivo: abierto.consecutivo,
    ninoConsecutivo: abierto.ninoConsecutivo,
    citaId: abierto.citaId,
  };
}

async function crearPrimeraCita(
  tx: Prisma.TransactionClient,
  atencionId: string,
  persona: PersonaParaAbrir,
): Promise<string> {
  const cita = await tx.citaPsicologica.create({
    data: {
      atencionId,
      fechaHora: persona.fechaHora,
      duracionMinutos: persona.duracionMinutos,
      tipo: 'PRIMERA_ATENCION',
      ninoId: persona.ninoId,
      atendidoPorId: persona.psicologaId,
    },
    select: { id: true },
  });
  return cita.id;
}

@Injectable()
export class ProcesosPsicologiaRepository implements IProcesosPsicologiaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarAccesoProceso(
    procesoId: string,
    psicologaId: string,
  ): Promise<AccesoProcesoPsicologia | null> {
    const proceso = await this.prisma.atencionPsicologica.findFirst({
      where: { id: procesoId, ...procesoGestionable(psicologaId) },
      select: {
        id: true,
        expedienteId: true,
        ninoId: true,
        consecutivo: true,
        estado: true,
        version: true,
        expediente: { select: { numero: true, usuariaId: true } },
      },
    });
    if (!proceso) {
      return null;
    }
    return {
      id: proceso.id,
      expedienteId: proceso.expedienteId,
      expedienteNumero: proceso.expediente.numero,
      usuariaId: proceso.expediente.usuariaId,
      consecutivo: proceso.consecutivo,
      etapa: proceso.estado,
      version: proceso.version,
      ninoId: proceso.ninoId,
    };
  }

  async buscarLecturaProceso(
    procesoId: string,
    psicologaId: string,
  ): Promise<LecturaProcesoPsicologia | null> {
    const proceso = await this.prisma.atencionPsicologica.findFirst({
      where: { id: procesoId, ...PROCESO_LEGIBLE },
      select: { id: true, expedienteId: true, psicologaAsignadaId: true },
    });
    if (!proceso) {
      return null;
    }
    return {
      id: proceso.id,
      expedienteId: proceso.expedienteId,
      propio: proceso.psicologaAsignadaId === psicologaId,
    };
  }

  async buscarAccesoUsuaria(
    usuariaId: string,
  ): Promise<AccesoUsuariaPsicologia | null> {
    const usuaria = await this.prisma.usuaria.findFirst({
      where: { id: usuariaId, expedientes: { some: EXPEDIENTE_DE_PSICOLOGIA } },
      select: { id: true },
    });
    return usuaria ? { usuariaId: usuaria.id } : null;
  }

  async buscarExpedienteParaAbrir(
    usuariaId: string,
    ninoId: string | null,
  ): Promise<ExpedienteParaAbrir> {
    if (ninoId === null) {
      const expediente = await this.prisma.expediente.findFirst({
        where: { usuariaId, ...EXPEDIENTE_TOMADO },
        select: { id: true, numero: true },
        orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
      });
      return expediente ?? 'SIN_TOMAR';
    }

    const nino = await this.prisma.nino.findFirst({
      where: { id: ninoId, expediente: { usuariaId } },
      select: { expediente: { select: { id: true, numero: true } } },
    });
    if (!nino) {
      return 'PERSONA_AJENA';
    }
    const tomado = await this.prisma.expediente.findFirst({
      where: { id: nino.expediente.id, ...EXPEDIENTE_TOMADO },
      select: { id: true },
    });
    return tomado ? nino.expediente : 'SIN_TOMAR';
  }

  async ninoPerteneceAExpediente(
    ninoId: string,
    expedienteId: string,
  ): Promise<boolean> {
    const nino = await this.prisma.nino.findFirst({
      where: { id: ninoId, expedienteId },
      select: { id: true },
    });
    return nino !== null;
  }

  async abrir(params: AbrirProcesoParams): Promise<ProcesoAbierto[]> {
    const [primera, ...resto] = params.personas;
    if (!primera) {
      return [];
    }
    const persona = {
      usuariaId: params.usuariaId,
      psicologaId: params.psicologaId,
    };
    return conReintentos(() =>
      this.prisma.$transaction(async (tx) => {
        const delCaso = await this.abrirDelCaso(tx, {
          ...persona,
          ...primera,
          procesoId: params.procesoId,
        });
        const abiertos = [delCaso];
        for (const otra of resto) {
          abiertos.push(
            await this.abrirNuevoEn(tx, {
              ...persona,
              ...otra,
              expedienteId: delCaso.expedienteId,
            }),
          );
        }
        return abiertos.map(sinExpediente);
      }, SERIALIZABLE),
    );
  }

  async abrirYRegistrar(
    params: AbrirYRegistrarParams,
  ): Promise<ProcesoAbiertoYRegistrado> {
    return conReintentos(() =>
      this.prisma.$transaction(async (tx) => {
        const abierto = await this.abrirDelCaso(tx, {
          ...params.persona,
          procesoId: params.procesoId,
          usuariaId: params.usuariaId,
          psicologaId: params.psicologaId,
        });
        const registrada = await guardarRegistroEnTx(tx, {
          ...params.registro,
          citaId: abierto.citaId,
          psicologaId: params.psicologaId,
          atencionId: abierto.procesoId,
          ninoId: abierto.ninoId,
        });
        // La cita se acaba de crear en esta transacción: no registrarla sería un error del código.
        if (!registrada) {
          throw new ProcesoNoDisponibleError();
        }
        return { abierto: sinExpediente(abierto), registrada };
      }, SERIALIZABLE),
    );
  }

  async abrirNuevo(params: AbrirProcesoNuevoParams): Promise<ProcesoAbierto[]> {
    return conReintentos(() =>
      this.prisma.$transaction(async (tx) => {
        const abiertos: ProcesoAbierto[] = [];
        for (const persona of params.personas) {
          abiertos.push(
            sinExpediente(
              await this.abrirNuevoEn(tx, {
                ...persona,
                usuariaId: params.usuariaId,
                psicologaId: params.psicologaId,
              }),
            ),
          );
        }
        return abiertos;
      }, SERIALIZABLE),
    );
  }

  /** Proceso nuevo de una persona en un expediente ya tomado, dentro de la transacción. */
  private async abrirNuevoEn(
    tx: Prisma.TransactionClient,
    params: PersonaParaAbrir & { expedienteId: string },
  ): Promise<ProcesoAbiertoEn> {
    const expediente = await tx.expediente.findFirst({
      where: {
        id: params.expedienteId,
        usuariaId: params.usuariaId,
        ...EXPEDIENTE_TOMADO,
      },
      select: { id: true },
    });
    if (!expediente) {
      throw new ProcesoNoDisponibleError();
    }
    const ninoConsecutivo = await consecutivoDeNino(
      tx,
      params.ninoId,
      expediente.id,
    );

    // Sin fecha de inicio es un caso tomado que espera su primera cita: se atiende ese.
    const sinCerrar = await tx.atencionPsicologica.findFirst({
      where: procesoAbiertoDePersona(params),
      select: { fechaInicio: true },
      orderBy: { fechaInicio: { sort: 'desc', nulls: 'last' } },
    });
    if (sinCerrar) {
      throw sinCerrar.fechaInicio
        ? new OtroProcesoActivoError()
        : new ReferenciaPendienteError();
    }
    // Una referencia nueva de la usuaria se atiende desde la bandeja, no desde la ficha.
    if (params.ninoId === null) {
      const referenciaSinTomar = await tx.referidoArea.findFirst({
        where: {
          area: 'PSICOLOGIA',
          expediente: {
            usuariaId: params.usuariaId,
            ...EXPEDIENTE_SIN_TOMAR,
          },
        },
        select: { id: true },
      });
      if (referenciaSinTomar) {
        throw new ReferenciaPendienteError();
      }
    }

    const ahora = new Date();
    const proceso = await tx.atencionPsicologica.create({
      data: {
        expedienteId: expediente.id,
        ninoId: params.ninoId,
        consecutivo: await siguienteConsecutivoProceso(
          tx,
          expediente.id,
          params.ninoId,
        ),
        estado: 'INICIO',
        psicologaAsignadaId: params.psicologaId,
        tomadaEn: ahora,
        fechaInicio: ahora,
        actualizadoPorId: params.psicologaId,
      },
      select: { id: true, consecutivo: true },
    });
    await tx.cambioEstadoAtencion.create({
      data: {
        atencionId: proceso.id,
        estadoAnterior: null,
        estadoNuevo: 'INICIO',
        registradoPorId: params.psicologaId,
      },
    });
    const citaId = await crearPrimeraCita(tx, proceso.id, params);

    return {
      procesoId: proceso.id,
      ninoId: params.ninoId,
      consecutivo: proceso.consecutivo,
      ninoConsecutivo,
      citaId,
      expedienteId: expediente.id,
    };
  }

  /** El proceso del caso tomado pasa a ser de la persona y recibe su primera cita. */
  private async abrirDelCaso(
    tx: Prisma.TransactionClient,
    params: PersonaParaAbrir & { procesoId: string },
  ): Promise<ProcesoAbiertoEn> {
    const proceso = await tx.atencionPsicologica.findFirst({
      where: {
        id: params.procesoId,
        psicologaAsignadaId: params.psicologaId,
        estado: { not: 'CIERRE' },
      },
      select: {
        id: true,
        expedienteId: true,
        consecutivo: true,
        estado: true,
        _count: { select: { citas: true } },
      },
    });
    if (!proceso) {
      throw new ProcesoNoDisponibleError();
    }
    if (proceso._count.citas > 0) {
      throw new ProcesoYaAbiertoError();
    }
    const ninoConsecutivo = await consecutivoDeNino(
      tx,
      params.ninoId,
      proceso.expedienteId,
    );

    // "Un solo proceso abierto por persona" cruza expedientes. Para un hijo/a la base lo
    // respalda (`AtencionPsicologica_activa_hijo_uq`); para la usuaria no hay índice que lo
    // cubra, así que se comprueba aquí, serializable, para las dos.
    const otroAbierto = await tx.atencionPsicologica.findFirst({
      where: {
        id: { not: proceso.id },
        fechaInicio: { not: null },
        ...procesoAbiertoDePersona(params),
      },
      select: { id: true },
    });
    if (otroAbierto) {
      throw new OtroProcesoActivoError();
    }

    // La persona se fija antes de la primera cita (la base lo exige). El caso se tomó en el
    // lugar de la usuaria; si es para un hijo/a, toma el siguiente número de los suyos.
    const consecutivo =
      params.ninoId === null
        ? proceso.consecutivo
        : await siguienteConsecutivoProceso(
            tx,
            proceso.expedienteId,
            params.ninoId,
          );
    await tx.atencionPsicologica.update({
      where: { id: proceso.id },
      data: {
        ninoId: params.ninoId,
        consecutivo,
        fechaInicio: new Date(),
        actualizadoPorId: params.psicologaId,
        version: { increment: 1 },
      },
    });
    await tx.cambioEstadoAtencion.create({
      data: {
        atencionId: proceso.id,
        estadoAnterior: null,
        estadoNuevo: proceso.estado,
        registradoPorId: params.psicologaId,
      },
    });
    const citaId = await crearPrimeraCita(tx, proceso.id, params);

    return {
      procesoId: proceso.id,
      ninoId: params.ninoId,
      consecutivo,
      ninoConsecutivo,
      citaId,
      expedienteId: proceso.expedienteId,
    };
  }

  async cerrar(params: CerrarProcesoParams): Promise<ProcesoCerrado | null> {
    return this.prisma.$transaction(async (tx) => {
      const anterior = await tx.atencionPsicologica.findUnique({
        where: { id: params.procesoId },
        select: { estado: true },
      });
      const ahora = new Date();

      // La versión y el estado van en el WHERE: si otra pestaña ya cambió el proceso, esta
      // sentencia no afecta ninguna fila y no se cancela ni registra nada.
      const cerrados = await tx.atencionPsicologica.updateMany({
        where: {
          id: params.procesoId,
          version: params.version,
          estado: { not: 'CIERRE' },
        },
        data: {
          estado: 'CIERRE',
          fechaCierre: ahora,
          motivoCierreCatalogo: params.motivo,
          resumenCierre: params.resumen,
          actualizadoPorId: params.cerradoPorId,
          version: { increment: 1 },
        },
      });
      if (cerrados.count === 0 || !anterior) {
        return null;
      }

      const canceladas = await tx.citaPsicologica.updateMany({
        where: {
          atencionId: params.procesoId,
          estado: 'PROGRAMADA',
          fechaHora: { gte: ahora },
        },
        data: { estado: 'CANCELADA' },
      });
      // Sin el texto del resumen: el hito solo marca la transición; el motivo vive en el proceso.
      await tx.cambioEstadoAtencion.create({
        data: {
          atencionId: params.procesoId,
          estadoAnterior: anterior.estado,
          estadoNuevo: 'CIERRE',
          registradoPorId: params.cerradoPorId,
        },
      });

      return {
        version: params.version + 1,
        citasCanceladas: canceladas.count,
      };
    });
  }

  async actualizarVisibilidad(
    params: ActualizarVisibilidadParams,
  ): Promise<number | null> {
    const actualizados = await this.prisma.atencionPsicologica.updateMany({
      where: { id: params.procesoId, version: params.version },
      data: {
        visibleJuridico: params.visibleJuridico,
        visibleMedica: params.visibleMedica,
        actualizadoPorId: params.actualizadoPorId,
        version: { increment: 1 },
      },
    });
    return actualizados.count === 1 ? params.version + 1 : null;
  }
}
