import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  PAGINA_CONSULTAS_MEDICA,
  fechaCalendarioGT,
  fechaColumnaISO,
  horaGT,
  etiquetaAtencion,
} from '@akyuam/shared';
import type {
  ConsultasMedicasPaginaDto,
  ContextoConsultaMedicaDto,
  PersonaConsultaMedicaDto,
  VisitaConsultaMedicaDto,
} from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SELECT_PERSONA,
  edad,
  nombreCompleto,
} from '../../psicologia/repositories/personas';
import type {
  ConsultaCreada,
  ConsultaRegistrada,
  IConsultasMedicasRepository,
  RegistrarConsultaParams,
} from '../interfaces/consultas-medicas-repository.interface';
import {
  AtencionNoActivaError,
  CitaNoDisponibleError,
  LoteVencidoError,
  PersonaAjenaError,
  PersonasVisitaIncompletaError,
} from '../interfaces/errores-medica';
import { EXPEDIENTE_REFERIDO_A_MEDICA } from './acceso-medica.repository';
import { SELECT_CONSULTA, aConsultaDto } from './consulta-completa';
import { crearCitaEnTx } from './crear-cita';
import { horaFin } from '../dominio/horario';
import { codificarCursor, decodificarCursor, procedencia } from './mapeo';
import { SERIALIZABLE, conReintentosHorario } from './transaccion';

/** La consulta completa más lo necesario para agruparla por visita en la historia clínica. */
const SELECT_CONSULTA_HISTORIA = {
  ...SELECT_CONSULTA,
  ninoId: true,
  cita: {
    select: { duracionMin: true, personas: { select: { ninoId: true } } },
  },
} satisfies Prisma.ConsultaMedicaSelect;

type FilaConsultaHistoria = Prisma.ConsultaMedicaGetPayload<{
  select: typeof SELECT_CONSULTA_HISTORIA;
}>;

@Injectable()
export class ConsultasMedicasRepository implements IConsultasMedicasRepository {
  constructor(private readonly prisma: PrismaService) {}

  registrar(params: RegistrarConsultaParams): Promise<ConsultaRegistrada> {
    return conReintentosHorario(() =>
      this.prisma.$transaction(async (tx) => {
        const atencion = await tx.atencionMedica.findUnique({
          where: { id: params.atencionId },
          select: {
            estado: true,
            expediente: {
              select: {
                id: true,
                usuaria: { select: { nombres: true, apellidos: true } },
              },
            },
          },
        });
        if (atencion?.estado !== 'ACTIVA') {
          throw new AtencionNoActivaError();
        }
        if (params.citaId !== null) {
          await this.exigirPersonasPendientes(tx, params, params.citaId);
        }

        const consultas: ConsultaCreada[] = [];
        for (const registro of params.registros) {
          const consulta = await tx.consultaMedica.create({
            data: {
              atencionId: params.atencionId,
              citaId: params.citaId,
              ninoId: registro.ninoId,
              fechaHora: params.fechaHora,
              motivoConsulta: registro.motivoConsulta,
              ...registro.signos,
              diagnostico: registro.diagnostico,
              planTratamiento: registro.planTratamiento,
              recetaLaboratorios: registro.recetaLaboratorios,
              registradaPorId: params.registradaPorId,
            },
            select: {
              id: true,
              nino: { select: { nombres: true, apellidos: true } },
            },
          });
          consultas.push({
            consultaId: consulta.id,
            ninoId: registro.ninoId,
            personaNombre: nombreCompleto(
              consulta.nino ?? atencion.expediente.usuaria,
            ),
            documentosAsociados: registro.loteDocumentos
              ? await this.asociarLote(
                  tx,
                  params,
                  registro.loteDocumentos,
                  consulta.id,
                )
              : 0,
          });
        }

        if (params.citaId !== null) {
          await tx.citaMedica.update({
            where: { id: params.citaId },
            data: { estado: 'ATENDIDA', version: { increment: 1 } },
          });
        }
        let proximaCitaId: string | null = null;
        if (params.proxima) {
          await this.exigirPersonasDelExpediente(
            tx,
            atencion.expediente.id,
            params.proxima.personas,
          );
          proximaCitaId = await crearCitaEnTx(tx, {
            atencionId: params.atencionId,
            personas: params.proxima.personas,
            inicio: params.proxima.inicio,
            duracionMin: params.proxima.duracionMin,
            creadoPorId: params.registradaPorId,
          });
        }

        return { consultas, proximaCitaId };
      }, SERIALIZABLE),
    );
  }

  async contexto(
    atencionId: string,
    cita: {
      id: string;
      inicio: Date;
      duracionMin: number;
      personas: (string | null)[];
    } | null,
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
            duracionMin: cita.duracionMin,
            personas: cita.personas,
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
      select: SELECT_CONSULTA_HISTORIA,
      orderBy: [{ fechaHora: 'desc' }, { id: 'desc' }],
      take: PAGINA_CONSULTAS_MEDICA + 1,
    });
    const items = filas.slice(0, PAGINA_CONSULTAS_MEDICA);
    const ultima = items.at(-1);
    const visita = await this.visitas(items);
    return {
      items: items.map((fila) => ({
        ...aConsultaDto(fila),
        visita: visita(fila),
      })),
      siguienteCursor:
        filas.length > PAGINA_CONSULTAS_MEDICA && ultima
          ? codificarCursor(ultima.fechaHora, ultima.id)
          : null,
    };
  }

  /**
   * Datos de la visita de cada consulta de la página: quiénes se atendieron (de la cita o, sin
   * cita, de las consultas registradas juntas) y si fue la primera de su atención. Se calcula
   * sin el filtro por persona, para que la historia de un hijo/a diga con quién vino.
   */
  private async visitas(
    filas: FilaConsultaHistoria[],
  ): Promise<(fila: FilaConsultaHistoria) => VisitaConsultaMedicaDto> {
    const sinCita = filas.filter((fila) => fila.citaId === null);
    // Sin filas, `in: []` y `OR: []` no devuelven nada.
    const [inicios, juntas] = await Promise.all([
      this.prisma.consultaMedica.groupBy({
        by: ['atencionId'],
        where: {
          atencionId: { in: [...new Set(filas.map((f) => f.atencionId))] },
        },
        _min: { fechaHora: true },
      }),
      this.prisma.consultaMedica.findMany({
        where: {
          citaId: null,
          OR: sinCita.map((fila) => ({
            atencionId: fila.atencionId,
            fechaHora: fila.fechaHora,
          })),
        },
        select: { atencionId: true, fechaHora: true, ninoId: true },
      }),
    ]);
    const inicioDe = new Map(
      inicios.map((inicio) => [inicio.atencionId, inicio._min.fechaHora]),
    );
    const claveSinCita = (atencionId: string, fechaHora: Date) =>
      `${atencionId}:${fechaHora.toISOString()}`;
    const personasSinCita = new Map<string, (string | null)[]>();
    for (const consulta of juntas) {
      const clave = claveSinCita(consulta.atencionId, consulta.fechaHora);
      personasSinCita.set(clave, [
        ...(personasSinCita.get(clave) ?? []),
        consulta.ninoId,
      ]);
    }
    return (fila) => {
      const clave =
        fila.citaId ?? claveSinCita(fila.atencionId, fila.fechaHora);
      return {
        clave,
        horaFin: fila.cita
          ? horaFin(horaGT(fila.fechaHora), fila.cita.duracionMin)
          : null,
        personas: fila.cita
          ? fila.cita.personas.map((persona) => persona.ninoId)
          : (personasSinCita.get(clave) ?? [fila.ninoId]),
        primera:
          inicioDe.get(fila.atencionId)?.getTime() === fila.fechaHora.getTime(),
      };
    };
  }

  /** Los hijos/as de la próxima cita son de este expediente (se lee dentro de la transacción). */
  private async exigirPersonasDelExpediente(
    tx: Prisma.TransactionClient,
    expedienteId: string,
    personas: (string | null)[],
  ): Promise<void> {
    const ninos = personas.filter(
      (persona): persona is string => persona !== null,
    );
    if (ninos.length === 0) {
      return;
    }
    const delExpediente = await tx.nino.count({
      where: { id: { in: ninos }, expedienteId },
    });
    if (delExpediente !== ninos.length) {
      throw new PersonaAjenaError();
    }
  }

  /**
   * La cita debe ser de esa atención y seguir programada, y los registros deben ser exactamente
   * las personas de la cita que aún no tienen consulta: ni falta nadie (la visita no queda a
   * medias) ni sobra nadie. Los índices `ConsultaMedica_cita_*_uq` respaldan la comprobación ante
   * dos registros simultáneos de la misma persona.
   */
  private async exigirPersonasPendientes(
    tx: Prisma.TransactionClient,
    params: RegistrarConsultaParams,
    citaId: string,
  ): Promise<void> {
    const cita = await tx.citaMedica.findFirst({
      where: {
        id: citaId,
        atencionId: params.atencionId,
        estado: 'PROGRAMADA',
      },
      select: {
        personas: { select: { ninoId: true } },
        consultas: { select: { ninoId: true } },
      },
    });
    if (!cita) {
      throw new CitaNoDisponibleError();
    }
    const registradas = new Set(cita.consultas.map((c) => c.ninoId));
    const pendientes = cita.personas
      .map((persona) => persona.ninoId)
      .filter((ninoId) => !registradas.has(ninoId));
    const enviadas = params.registros.map((registro) => registro.ninoId);
    if (enviadas.some((ninoId) => !pendientes.includes(ninoId))) {
      throw enviadas.some((ninoId) => registradas.has(ninoId))
        ? new CitaNoDisponibleError()
        : new PersonaAjenaError();
    }
    if (pendientes.some((ninoId) => !enviadas.includes(ninoId))) {
      throw new PersonasVisitaIncompletaError();
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
    lote: string,
    consultaId: string,
  ): Promise<number> {
    const pendientes = await tx.documentoMedicoPendiente.findMany({
      where: {
        lote,
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
