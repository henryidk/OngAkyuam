import { Inject, Injectable } from '@nestjs/common';
import {
  diasDesdeFechaGT,
  fechaColumnaISO,
  finMesGT,
  inicioMesGT,
  mesActualGT,
  type BandejaTs,
  type NovedadArea,
} from '@akyuam/shared';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import {
  ACCIONES_NOVEDAD_AREA,
  describirEvento,
} from '../eventos/plantillas-eventos';
import { BANDEJA_REPOSITORY } from './interfaces/bandeja-repository.interface';
import type {
  IBandejaRepository,
  NovedadRow,
} from './interfaces/bandeja-repository.interface';

/** Filas visibles por cola; el resto se ve en Usuarias con el filtro correspondiente. */
export const FILAS_POR_COLA = 5;
export const LIMITE_NOVEDADES = 10;

function nombreCompleto(fila: { nombres: string; apellidos: string }): string {
  return `${fila.nombres} ${fila.apellidos}`;
}

function aNovedad(fila: NovedadRow): NovedadArea | null {
  const evento = describirEvento(fila.accion, fila.detalles);
  if (!evento?.area) {
    return null;
  }
  return {
    id: fila.id,
    area: evento.area,
    expedienteId: fila.expedienteId,
    usuariaId: fila.usuariaId,
    nombreCompleto: nombreCompleto(fila),
    texto: evento.texto,
    createdAt: fila.createdAt.toISOString(),
  };
}

@Injectable()
export class BandejaService {
  constructor(
    @Inject(BANDEJA_REPOSITORY)
    private readonly bandejaRepository: IBandejaRepository,
  ) {}

  // Sin auditoría de lectura: la bandeja se refresca sola por socket y cada refresco sería un
  // evento; lo sensible (abrir una ficha, una bitácora, un documento) ya se audita al abrirlo.
  async obtener(contexto: ContextoAuditoria): Promise<BandejaTs> {
    const { anio, mes } = mesActualGT();
    const [
      pendientesReferir,
      documentosPendientes,
      enAlbergue,
      recientes,
      novedades,
      resumenMes,
    ] = await Promise.all([
      this.bandejaRepository.pendientesReferir(FILAS_POR_COLA),
      this.bandejaRepository.documentosPendientes(FILAS_POR_COLA),
      this.bandejaRepository.enAlbergue(FILAS_POR_COLA),
      this.bandejaRepository.recientes(FILAS_POR_COLA),
      this.bandejaRepository.novedades(
        contexto.usuarioId,
        ACCIONES_NOVEDAD_AREA,
        LIMITE_NOVEDADES,
      ),
      this.bandejaRepository.resumenMes({
        anio,
        mes,
        inicio: inicioMesGT(anio, mes),
        fin: finMesGT(anio, mes),
      }),
    ]);

    return {
      pendientesReferir: {
        total: pendientesReferir.total,
        filas: pendientesReferir.filas.map((fila) => ({
          expedienteId: fila.expedienteId,
          usuariaId: fila.usuariaId,
          numeroExpediente: fila.numero,
          nombreCompleto: nombreCompleto(fila),
          tipoRegistro: fila.tipoRegistro,
          createdAt: fila.casoCreadoEn.toISOString(),
        })),
      },
      documentosPendientes: {
        total: documentosPendientes.total,
        filas: documentosPendientes.filas.map((fila) => ({
          expedienteId: fila.expedienteId,
          usuariaId: fila.usuariaId,
          numeroExpediente: fila.numero,
          nombreCompleto: nombreCompleto(fila),
          tiposFaltantes: fila.faltantes,
        })),
      },
      enAlbergue: {
        total: enAlbergue.total,
        filas: enAlbergue.filas.map((fila) => {
          const fechaIngreso = fila.fechaIngresoAlbergue
            ? fechaColumnaISO(fila.fechaIngresoAlbergue)
            : null;
          return {
            expedienteId: fila.expedienteId,
            usuariaId: fila.usuariaId,
            numeroExpediente: fila.numero,
            nombreCompleto: nombreCompleto(fila),
            fechaIngresoAlbergue: fechaIngreso,
            diasEnAlbergue: fechaIngreso
              ? diasDesdeFechaGT(fechaIngreso)
              : null,
            cantidadNinos: fila.cantidadNinos,
          };
        }),
      },
      recientes: recientes.map((fila) => ({
        expedienteId: fila.expedienteId,
        usuariaId: fila.usuariaId,
        numeroExpediente: fila.numero,
        nombreCompleto: nombreCompleto(fila),
        areas: fila.areas,
        estado: fila.estado,
      })),
      novedades: novedades.flatMap((fila) => aNovedad(fila) ?? []),
      resumenMes,
    };
  }
}
