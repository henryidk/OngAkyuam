import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CrearExpedienteConUsuariaParams,
  ExpedienteCreadoResultado,
  IExpedientesRepository,
} from '../interfaces/expedientes-repository.interface';

@Injectable()
export class ExpedientesRepository implements IExpedientesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async crearConUsuaria(
    params: CrearExpedienteConUsuariaParams,
  ): Promise<ExpedienteCreadoResultado> {
    try {
      return await this.intentarCrear(params);
    } catch (error) {
      // Choque raro en el primer expediente del año: dos creaciones concurrentes
      // intentan insertar el mismo ExpedienteContador.anio a la vez. Con el volumen
      // de este sistema (miles, no miles por segundo) un solo reintento es suficiente.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.intentarCrear(params);
      }
      throw error;
    }
  }

  private async intentarCrear(
    params: CrearExpedienteConUsuariaParams,
  ): Promise<ExpedienteCreadoResultado> {
    // "YYYY-MM-DD" -> año por recorte de string, nunca por aritmética de Date (ver CLAUDE.md).
    const anio = Number(params.fecha.slice(0, 4));
    const fecha = new Date(params.fecha);
    const fechaNacimiento = new Date(params.identidadUsuaria.fechaNacimiento);

    return this.prisma.$transaction(async (tx) => {
      const datosIdentidad = {
        nombres: params.identidadUsuaria.nombres,
        apellidos: params.identidadUsuaria.apellidos,
        dpi: params.identidadUsuaria.dpi,
        telefono: params.identidadUsuaria.telefono,
        direccion: params.identidadUsuaria.direccion,
        fechaNacimiento,
        grupoEtnico: params.identidadUsuaria.grupoEtnico,
      };

      // Sin pantalla de búsqueda previa, la única forma de no duplicar a la usuaria (RNF-09) es
      // reconciliar por DPI aquí mismo: si ya existe una Usuaria con ese DPI, se reutiliza y
      // actualiza en vez de intentar un create que violaría la restricción de unicidad.
      const usuariaExistente = params.identidadUsuaria.dpi
        ? await tx.usuaria.findUnique({
            where: { dpi: params.identidadUsuaria.dpi },
          })
        : null;

      const usuaria = usuariaExistente
        ? await tx.usuaria.update({
            where: { id: usuariaExistente.id },
            data: datosIdentidad,
          })
        : await tx.usuaria.create({ data: datosIdentidad });

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
          municipio: params.municipio,
          departamentoOtro: params.departamentoOtro,
          municipioOtro: params.municipioOtro,
          ubicacionGeografica: params.ubicacionGeografica,
          tipoRegistro: params.tipoRegistro,
          tipologiaDelito: params.tipologiaDelito,
          creadoPorId: params.creadoPorId,
          agresor: params.agresor ? { create: params.agresor } : undefined,
          ninos:
            params.ninos.length > 0
              ? {
                  create: params.ninos.map((nino) => ({
                    nombres: nino.nombres,
                    apellidos: nino.apellidos,
                    fechaNacimiento: new Date(nino.fechaNacimiento),
                    genero: nino.genero,
                  })),
                }
              : undefined,
        },
      });

      if (params.areasReferidas.length > 0) {
        await tx.referidoArea.createMany({
          data: params.areasReferidas.map((area) => ({
            expedienteId: expediente.id,
            area,
            otorgadoPorId: params.creadoPorId,
          })),
        });
      }

      return {
        id: expediente.id,
        numero: expediente.numero,
        usuariaId: usuaria.id,
        usuariaNombreCompleto: `${usuaria.nombres} ${usuaria.apellidos}`,
        fecha: params.fecha,
        municipio: expediente.municipio,
        tipoRegistro: expediente.tipoRegistro,
      };
    });
  }
}
