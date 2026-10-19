import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  PAGINA_CONSULTAS_MEDICA,
  fechaCalendarioGT,
  fechaColumnaISO,
  horaGT,
} from '@akyuam/shared';
import type {
  ConsultaMedicaDto,
  ConsultasMedicasPaginaDto,
  ContextoConsultaMedicaDto,
  PersonaConsultaMedicaDto,
} from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SELECT_PERSONA,
  edad,
  nombreCompleto,
  personaAtendida,
} from '../../psicologia/repositories/personas';
import { etiquetaAtencion } from '@akyuam/shared';
import type {
  ConsultaRegistrada,
  IConsultasMedicasRepository,
  RegistrarConsultaParams,
} from '../interfaces/consultas-medicas-repository.interface';
import {
  AtencionNoActivaError,
  CitaNoDisponibleError,
  LoteVencidoError,
} from '../interfaces/errores-medica';
import { EXPEDIENTE_REFERIDO_A_MEDICA } from './acceso-medica.repository';
import { crearCitaEnTx } from './crear-cita';
import {
  SELECT_SIGNOS,
  codificarCursor,
  decodificarCursor,
  procedencia,
  signosDeFila,
} from './mapeo';
import { SERIALIZABLE, conReintentos } from './transaccion';

const SELECT_CONSULTA = {
  id: true,
  atencionId: true,
  citaId: true,
  fechaHora: true,
  motivoConsulta: true,
  diagnostico: true,
  planTratamiento: true,
  recetaLaboratorios: true,
  ...SELECT_SIGNOS,
  nino: { select: { id: true, ...SELECT_PERSONA } },
  atencion: {
    select: {
      consecutivo: true,
      expediente: {
        select: { numero: true, usuaria: { select: SELECT_PERSONA } },
      },
    },
  },
  documentos: {
    select: {
      id: true,
      tipo: true,
      nombreVisible: true,
      nombreArchivo: true,
      mimeType: true,
      tamanioBytes: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.ConsultaMedicaSelect;

type FilaConsulta = Prisma.ConsultaMedicaGetPayload<{
  select: typeof SELECT_CONSULTA;
}>;

function aConsultaDto(fila: FilaConsulta): ConsultaMedicaDto {
  const persona = personaAtendida(fila.atencion.expediente.usuaria, fila.nino);
  const fecha = fechaCalendarioGT(fila.fechaHora);
  return {
    id: fila.id,
    atencionId: fila.atencionId,
    codigoAtencion: etiquetaAtencion(
      fila.atencion.expediente.numero,
      fila.atencion.consecutivo,
    ),
    citaId: fila.citaId,
    fechaHora: fila.fechaHora.toISOString(),
    fecha,
    hora: horaGT(fila.fechaHora),
    persona,
    motivoConsulta: fila.motivoConsulta,
    diagnostico: fila.diagnostico,
    planTratamiento: fila.planTratamiento,
    recetaLaboratorios: fila.recetaLaboratorios,
    signos: signosDeFila(fila),
    documentos: fila.documentos.map((documento) => ({
      ...documento,
      consultaId: fila.id,
      createdAt: documento.createdAt.toISOString(),
      fechaConsulta: fecha,
      personaNombre: persona.nombreCompleto,
    })),
  };
}

@Injectable()
export class ConsultasMedicasRepository implements IConsultasMedicasRepository {
  constructor(private readonly prisma: PrismaService) {}

  registrar(params: RegistrarConsultaParams): Promise<ConsultaRegistrada> {
    return conReintentos(() =>
      this.prisma.$transaction(async (tx) => {
        const atencion = await tx.atencionMedica.findUnique({
          where: { id: params.atencionId },
          select: { estado: true },
        });
        if (atencion?.estado !== 'ACTIVA') {
          throw new AtencionNoActivaError();
        }
        if (params.citaId !== null) {
          await this.marcarAtendida(tx, params.citaId, params.atencionId);
        }

        const consulta = await tx.consultaMedica.create({
          data: {
            atencionId: params.atencionId,
            citaId: params.citaId,
            ninoId: params.ninoId,
            fechaHora: params.fechaHora,
            motivoConsulta: params.motivoConsulta,
            ...params.signos,
            diagnostico: params.diagnostico,
            planTratamiento: params.planTratamiento,
            recetaLaboratorios: params.recetaLaboratorios,
            registradaPorId: params.registradaPorId,
          },
          select: {
            id: true,
            nino: { select: { nombres: true, apellidos: true } },
            atencion: {
              select: {
                expediente: {
                  select: {
                    usuaria: { select: { nombres: true, apellidos: true } },
                  },
                },
              },
            },
          },
        });

        const proximaCitaId = params.proxima
          ? await crearCitaEnTx(tx, {
              atencionId: params.atencionId,
              ninoId: params.ninoId,
              inicio: params.proxima,
              creadoPorId: params.registradaPorId,
            })
          : null;
        const documentosAsociados = params.loteDocumentos
          ? await this.asociarLote(tx, params, consulta.id)
          : 0;

        return {
          consultaId: consulta.id,
          personaNombre: nombreCompleto(
            consulta.nino ?? consulta.atencion.expediente.usuaria,
          ),
          proximaCitaId,
          documentosAsociados,
        };
      }, SERIALIZABLE),
    );
  }

  async contexto(
    atencionId: string,
    cita: { id: string; inicio: Date; ninoId: string | null } | null,
  ): Promise<ContextoConsultaMedicaDto | null> {
    const atencion = await this.prisma.atencionMedica.findFirst({
      where: { id: atencionId, expediente: EXPEDIENTE_REFERIDO_A_MEDICA },
      select: {
        id: true,
        consecutivo: true,
        expediente: {
          select: {
            id: true,
            numero: true,
            usuaria: {
              select: {
                id: true,
                ...SELECT_PERSONA,
                telefono: true,
                municipio: true,
                municipioOtro: true,
                departamentoOtro: true,
              },
            },
            ninos: {
              select: { id: true, ...SELECT_PERSONA },
              orderBy: { fechaNacimiento: 'asc' },
            },
          },
        },
      },
    });
    if (!atencion) {
      return null;
    }
    const { expediente } = atencion;
    const historial = await this.historialPorPersona(expediente.usuaria.id);

    const persona = (
      datos: { nombres: string; apellidos: string; fechaNacimiento: Date },
      ninoId: string | null,
    ): PersonaConsultaMedicaDto => {
      const clave = ninoId ?? '';
      return {
        ninoId,
        nombreCompleto: nombreCompleto(datos),
        edad: edad(datos),
        fechaNacimiento: fechaColumnaISO(datos.fechaNacimiento),
        ultimaTallaM: historial.get(clave)?.talla ?? null,
        consultasAnteriores: historial.get(clave)?.total ?? 0,
      };
    };

    return {
      atencionId: atencion.id,
      codigoAtencion: etiquetaAtencion(expediente.numero, atencion.consecutivo),
      expedienteId: expediente.id,
      expedienteNumero: expediente.numero,
      usuariaId: expediente.usuaria.id,
      usuariaNombreCompleto: nombreCompleto(expediente.usuaria),
      telefono: expediente.usuaria.telefono,
      procedencia: procedencia(expediente.usuaria),
      cita: cita
        ? {
            id: cita.id,
            fecha: fechaCalendarioGT(cita.inicio),
            hora: horaGT(cita.inicio),
            ninoId: cita.ninoId,
          }
        : null,
      personas: [
        persona(expediente.usuaria, null),
        ...expediente.ninos.map((nino) => persona(nino, nino.id)),
      ],
    };
  }

  async atencionActivaDeUsuaria(usuariaId: string): Promise<string | null> {
    const atencion = await this.prisma.atencionMedica.findFirst({
      where: {
        estado: 'ACTIVA',
        expediente: { usuariaId, ...EXPEDIENTE_REFERIDO_A_MEDICA },
      },
      select: { id: true },
    });
    return atencion?.id ?? null;
  }

  async listarPorUsuaria(
    usuariaId: string,
    persona: string | null | undefined,
    cursor: string | undefined,
  ): Promise<ConsultasMedicasPaginaDto> {
    const desde = decodificarCursor(cursor);
    const filas = await this.prisma.consultaMedica.findMany({
      where: {
        atencion: {
          expediente: { usuariaId, ...EXPEDIENTE_REFERIDO_A_MEDICA },
        },
        ...(persona !== undefined ? { ninoId: persona } : {}),
        ...(desde
          ? {
              OR: [
                { fechaHora: { lt: desde.instante } },
                { fechaHora: desde.instante, id: { lt: desde.id } },
              ],
            }
          : {}),
      },
      select: SELECT_CONSULTA,
      orderBy: [{ fechaHora: 'desc' }, { id: 'desc' }],
      take: PAGINA_CONSULTAS_MEDICA + 1,
    });
    const items = filas.slice(0, PAGINA_CONSULTAS_MEDICA);
    const ultima = items.at(-1);
    return {
      items: items.map(aConsultaDto),
      siguienteCursor:
        filas.length > PAGINA_CONSULTAS_MEDICA && ultima
          ? codificarCursor(ultima.fechaHora, ultima.id)
          : null,
    };
  }

  /** La cita debe ser de esa atención, seguir programada y no tener consulta. */
  private async marcarAtendida(
    tx: Prisma.TransactionClient,
    citaId: string,
    atencionId: string,
  ): Promise<void> {
    const { count } = await tx.citaMedica.updateMany({
      where: {
        id: citaId,
        atencionId,
        estado: 'PROGRAMADA',
        consulta: { is: null },
      },
      data: { estado: 'ATENDIDA', version: { increment: 1 } },
    });
    if (count === 0) {
      throw new CitaNoDisponibleError();
    }
  }

  /**
   * Los documentos que se subieron mientras se llenaba la consulta pasan a ella. Solo los de
   * quien guarda y de esta atención; si alguno ya venció (la limpieza puede haber borrado su
   * archivo), se rechaza todo para no guardar una consulta con documentos a medias.
   */
  private async asociarLote(
    tx: Prisma.TransactionClient,
    params: RegistrarConsultaParams,
    consultaId: string,
  ): Promise<number> {
    const pendientes = await tx.documentoMedicoPendiente.findMany({
      where: {
        lote: params.loteDocumentos!,
        subidoPorId: params.registradaPorId,
        atencionId: params.atencionId,
      },
    });
    if (
      pendientes.some((p) => p.expiraEn.getTime() <= params.ahora.getTime())
    ) {
      throw new LoteVencidoError();
    }
    if (pendientes.length === 0) {
      return 0;
    }
    await tx.documentoMedico.createMany({
      data: pendientes.map((p) => ({
        consultaId,
        tipo: p.tipo,
        nombreVisible: p.nombreVisible,
        nombreArchivo: p.nombreArchivo,
        claveObjeto: p.claveObjeto,
        mimeType: p.mimeType,
        tamanioBytes: p.tamanioBytes,
        subidoPorId: p.subidoPorId,
      })),
    });
    await tx.documentoMedicoPendiente.deleteMany({
      where: { id: { in: pendientes.map((p) => p.id) } },
    });
    return pendientes.length;
  }

  /**
   * Por persona de la usuaria ('' = ella, o el id del hijo/a): cuántas consultas tiene y la
   * última talla registrada, para precargarla en el formulario.
   */
  private async historialPorPersona(
    usuariaId: string,
  ): Promise<Map<string, { total: number; talla: number | null }>> {
    const consultas = await this.prisma.consultaMedica.findMany({
      where: {
        atencion: {
          expediente: { usuariaId, ...EXPEDIENTE_REFERIDO_A_MEDICA },
        },
      },
      select: { ninoId: true, tallaM: true },
      orderBy: { fechaHora: 'desc' },
    });
    const porPersona = new Map<
      string,
      { total: number; talla: number | null }
    >();
    for (const consulta of consultas) {
      const clave = consulta.ninoId ?? '';
      const actual = porPersona.get(clave) ?? { total: 0, talla: null };
      actual.total += 1;
      actual.talla ??= consulta.tallaM?.toNumber() ?? null;
      porPersona.set(clave, actual);
    }
    return porPersona;
  }
}
