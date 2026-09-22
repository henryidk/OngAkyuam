import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AreaAtencion,
  UsuariaExpedienteHub,
  UsuariaResumenBusqueda,
} from '@akyuam/shared';
import { fechaColumnaISO } from '@akyuam/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  DatosIdentidadUsuariaParams,
  IUsuariasRepository,
} from '../interfaces/usuarias-repository.interface';

// Select explícito, mismo hábito que `USUARIO_ADMIN_SELECT` — nunca traer más de lo que la
// fila de resultados de búsqueda necesita mostrar.
const USUARIA_RESUMEN_SELECT = {
  id: true,
  nombres: true,
  apellidos: true,
  dpi: true,
  fechaNacimiento: true,
} as const;

type UsuariaResumenRow = {
  id: string;
  nombres: string;
  apellidos: string;
  dpi: string | null;
  fechaNacimiento: Date;
};

function mapearResumen(usuaria: UsuariaResumenRow): UsuariaResumenBusqueda {
  return {
    id: usuaria.id,
    nombres: usuaria.nombres,
    apellidos: usuaria.apellidos,
    dpi: usuaria.dpi,
    fechaNacimiento: fechaColumnaISO(usuaria.fechaNacimiento),
  };
}

@Injectable()
export class UsuariasRepository implements IUsuariasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarPorDpi(dpi: string): Promise<UsuariaResumenBusqueda | null> {
    const usuaria = await this.prisma.usuaria.findUnique({
      where: { dpi },
      select: USUARIA_RESUMEN_SELECT,
    });
    return usuaria ? mapearResumen(usuaria) : null;
  }

  async buscarPorNombre(
    nombre: string,
    limite: number,
  ): Promise<UsuariaResumenBusqueda[]> {
    // Reusa el índice GIN trigram ya creado sobre `(nombres || ' ' || apellidos)` (ver migración
    // 20260911071049_agrega_usuaria_expediente). Se usa `<%`/`word_similarity` (no `%`/`similarity`)
    // porque quien busca normalmente escribe solo un fragmento (ej. un apellido) — `similarity()`
    // compara contra la cadena completa y falla en fragmentos cortos dentro de un nombre largo;
    // `word_similarity()` compara el término contra cualquier substring de la cadena, que es el
    // caso real de uso aquí. Mismo índice GIN, soporta ambos operadores.
    const filas = await this.prisma.$queryRaw<UsuariaResumenRow[]>(Prisma.sql`
      SELECT id, nombres, apellidos, dpi, "fechaNacimiento"
      FROM "Usuaria"
      WHERE ${nombre} <% (nombres || ' ' || apellidos)
      ORDER BY word_similarity(${nombre}, nombres || ' ' || apellidos) DESC
      LIMIT ${limite}
    `);
    return filas.map(mapearResumen);
  }

  async obtenerHub(id: string): Promise<UsuariaExpedienteHub | null> {
    const usuaria = await this.prisma.usuaria.findUnique({
      where: { id },
      include: {
        expedientes: {
          orderBy: { fecha: 'desc' },
          include: { referidos: { select: { area: true } } },
        },
      },
    });
    if (!usuaria) {
      return null;
    }

    return {
      id: usuaria.id,
      createdAt: usuaria.createdAt.toISOString(),
      nombres: usuaria.nombres,
      apellidos: usuaria.apellidos,
      dpi: usuaria.dpi,
      telefono: usuaria.telefono,
      direccion: usuaria.direccion,
      fechaNacimiento: fechaColumnaISO(usuaria.fechaNacimiento),
      grupoEtnico: usuaria.grupoEtnico,
      municipio: usuaria.municipio,
      departamentoOtro: usuaria.departamentoOtro,
      municipioOtro: usuaria.municipioOtro,
      ubicacionGeografica: usuaria.ubicacionGeografica,
      casos: usuaria.expedientes.map((expediente) => ({
        id: expediente.id,
        numero: expediente.numero,
        fecha: fechaColumnaISO(expediente.fecha),
        tipoRegistro: expediente.tipoRegistro,
        // `referidos.area` solo se otorga a áreas de atención (nunca TRABAJO_SOCIAL/ADMINISTRACION
        // en la práctica) — el tipo de Prisma es el enum `Rol` completo, se acota aquí al subconjunto
        // que expone la API de trabajo social.
        areasReferidas: expediente.referidos.map(
          (referido) => referido.area as AreaAtencion,
        ),
      })),
    };
  }

  async existeDpi(dpi: string, excluirId?: string): Promise<boolean> {
    const existente = await this.prisma.usuaria.findUnique({
      where: { dpi },
      select: { id: true },
    });
    return !!existente && existente.id !== excluirId;
  }

  async actualizarIdentidad(
    id: string,
    datos: DatosIdentidadUsuariaParams,
  ): Promise<UsuariaExpedienteHub | null> {
    try {
      await this.prisma.usuaria.update({
        where: { id },
        data: {
          nombres: datos.nombres,
          apellidos: datos.apellidos,
          dpi: datos.dpi,
          telefono: datos.telefono,
          direccion: datos.direccion,
          fechaNacimiento: new Date(datos.fechaNacimiento),
          grupoEtnico: datos.grupoEtnico,
          municipio: datos.municipio,
          departamentoOtro: datos.departamentoOtro,
          municipioOtro: datos.municipioOtro,
          ubicacionGeografica: datos.ubicacionGeografica,
        },
      });
    } catch {
      // P2025: registro no encontrado — mismo criterio uniforme del resto del proyecto.
      return null;
    }
    return this.obtenerHub(id);
  }
}
