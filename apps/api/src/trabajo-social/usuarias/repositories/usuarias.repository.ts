import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AreaAtencion,
  EstadoTs,
  FiltroListaUsuarias,
  ListaUsuariasTs,
  TipoRegistro,
  UsuariaResumenBusqueda,
} from '@akyuam/shared';
import { fechaColumnaISO } from '@akyuam/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { DpiUsuariaDuplicadoError } from '../../interfaces/expedientes-repository.interface';
import { ConsultaListaTs } from '../../estado/consulta-lista-ts';
import type {
  BusquedaListaUsuarias,
  DatosIdentidadUsuariaParams,
  IUsuariasRepository,
  ListarUsuariasParams,
  UsuariaHubRow,
} from '../interfaces/usuarias-repository.interface';

type UsuariaResumenRow = {
  id: string;
  nombres: string;
  apellidos: string;
  dpi: string | null;
  fechaNacimiento: Date;
  numeroExpediente: string | null;
};

// Subquery reusada por las 3 búsquedas de resumen: el número de su caso más reciente (o `null`
// si aún no tiene ninguno). Por `SELECT`, no `JOIN`, para no duplicar filas de `Usuaria`.
const SUBQUERY_NUMERO_EXPEDIENTE = Prisma.sql`(
  SELECT x.numero FROM "Expediente" x
  WHERE x."usuariaId" = u.id
  ORDER BY x.fecha DESC, x."createdAt" DESC
  LIMIT 1
)`;

type FilaListaRow = {
  usuariaId: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: Date;
  expedienteId: string;
  numero: string;
  tipoRegistro: TipoRegistro;
  enAlbergue: boolean;
  cantidadNinos: number;
  areas: string[];
  estado: EstadoTs;
  ultimaActividadEn: Date;
  ultimaActividadArea: string | null;
};

type ContadoresRow = { todas: number } & Record<FiltroListaUsuarias, number>;

function condicionFiltro(filtro: FiltroListaUsuarias | undefined): Prisma.Sql {
  if (!filtro) {
    return Prisma.sql`TRUE`;
  }
  if (filtro === 'EN_ALBERGUE') {
    return Prisma.sql`"enAlbergue"`;
  }
  return Prisma.sql`estado = ${filtro}`;
}

function condicionBusqueda(
  busqueda: BusquedaListaUsuarias | undefined,
): Prisma.Sql {
  if (!busqueda) {
    return Prisma.sql`TRUE`;
  }
  switch (busqueda.tipo) {
    // Cualquier caso de la usuaria, no solo el activo: quien busca por número puede traer el
    // de un caso anterior en la mano.
    case 'numeroExpediente':
      return Prisma.sql`EXISTS (SELECT 1 FROM "Expediente" x WHERE x."usuariaId" = u.id AND x.numero = ${busqueda.valor})`;
    case 'dpi':
      return Prisma.sql`u.dpi = ${busqueda.valor}`;
    // Mismo operador e índice trigram que `buscarPorNombre`.
    case 'nombre':
      return Prisma.sql`${busqueda.valor} <% (u.nombres || ' ' || u.apellidos)`;
  }
}

function mapearResumen(usuaria: UsuariaResumenRow): UsuariaResumenBusqueda {
  return {
    id: usuaria.id,
    nombres: usuaria.nombres,
    apellidos: usuaria.apellidos,
    dpi: usuaria.dpi,
    fechaNacimiento: fechaColumnaISO(usuaria.fechaNacimiento),
    numeroExpediente: usuaria.numeroExpediente,
  };
}

@Injectable()
export class UsuariasRepository implements IUsuariasRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consultaLista: ConsultaListaTs,
  ) {}

  async listar(params: ListarUsuariasParams): Promise<ListaUsuariasTs> {
    const base = this.consultaLista.cteLista(
      condicionBusqueda(params.busqueda),
    );
    const [filas, [contadores]] = await Promise.all([
      this.prisma.$queryRaw<FilaListaRow[]>(Prisma.sql`
        ${base}
        SELECT * FROM lista
        WHERE ${condicionFiltro(params.filtro)}
        ORDER BY "ultimaActividadEn" DESC, "usuariaId"
        LIMIT ${params.porPagina} OFFSET ${(params.pagina - 1) * params.porPagina}
      `),
      this.prisma.$queryRaw<ContadoresRow[]>(Prisma.sql`
        ${base}
        SELECT
          count(*)::int AS todas,
          count(*) FILTER (WHERE estado = 'SIN_REFERIR')::int AS "SIN_REFERIR",
          count(*) FILTER (WHERE estado = 'EN_ATENCION')::int AS "EN_ATENCION",
          count(*) FILTER (WHERE "enAlbergue")::int AS "EN_ALBERGUE",
          count(*) FILTER (WHERE estado = 'SIN_ATENCION_ACTIVA')::int AS "SIN_ATENCION_ACTIVA"
        FROM lista
      `),
    ]);

    return {
      filas: filas.map((fila) => ({
        usuariaId: fila.usuariaId,
        nombreCompleto: `${fila.nombres} ${fila.apellidos}`,
        fechaNacimiento: fechaColumnaISO(fila.fechaNacimiento),
        expedienteId: fila.expedienteId,
        numeroExpediente: fila.numero,
        tipoRegistro: fila.tipoRegistro,
        enAlbergue: fila.enAlbergue,
        cantidadNinos: fila.cantidadNinos,
        // Mismo acotamiento de `Rol` a áreas de atención que en `obtenerHub`.
        areasReferidas: fila.areas as AreaAtencion[],
        estado: fila.estado,
        ultimaActividadEn: fila.ultimaActividadEn.toISOString(),
        ultimaActividadArea: fila.ultimaActividadArea as AreaAtencion | null,
      })),
      pagina: params.pagina,
      porPagina: params.porPagina,
      total: params.filtro ? contadores[params.filtro] : contadores.todas,
      contadores: {
        TODAS: contadores.todas,
        SIN_REFERIR: contadores.SIN_REFERIR,
        EN_ATENCION: contadores.EN_ATENCION,
        EN_ALBERGUE: contadores.EN_ALBERGUE,
        SIN_ATENCION_ACTIVA: contadores.SIN_ATENCION_ACTIVA,
      },
    };
  }

  async buscarPorDpi(dpi: string): Promise<UsuariaResumenBusqueda | null> {
    const filas = await this.prisma.$queryRaw<UsuariaResumenRow[]>(Prisma.sql`
      SELECT u.id, u.nombres, u.apellidos, u.dpi, u."fechaNacimiento",
        ${SUBQUERY_NUMERO_EXPEDIENTE} AS "numeroExpediente"
      FROM "Usuaria" u
      WHERE u.dpi = ${dpi}
      LIMIT 1
    `);
    return filas[0] ? mapearResumen(filas[0]) : null;
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
      SELECT u.id, u.nombres, u.apellidos, u.dpi, u."fechaNacimiento",
        ${SUBQUERY_NUMERO_EXPEDIENTE} AS "numeroExpediente"
      FROM "Usuaria" u
      WHERE ${nombre} <% (u.nombres || ' ' || u.apellidos)
      ORDER BY word_similarity(${nombre}, u.nombres || ' ' || u.apellidos) DESC
      LIMIT ${limite}
    `);
    return filas.map(mapearResumen);
  }

  async buscarPorNumero(
    numero: string,
    limite: number,
  ): Promise<UsuariaResumenBusqueda[]> {
    const filas = await this.prisma.$queryRaw<UsuariaResumenRow[]>(Prisma.sql`
      SELECT u.id, u.nombres, u.apellidos, u.dpi, u."fechaNacimiento", x.numero AS "numeroExpediente"
      FROM "Usuaria" u
      JOIN "Expediente" x ON x."usuariaId" = u.id
      WHERE x.numero = ${numero}
      ORDER BY x.fecha DESC
      LIMIT ${limite}
    `);
    return filas.map(mapearResumen);
  }

  async obtenerHub(id: string): Promise<UsuariaHubRow | null> {
    const usuaria = await this.prisma.usuaria.findUnique({
      where: { id },
      include: {
        expedientes: {
          // Mismo orden que `caso_activo` de la lista: el primero es el caso activo.
          orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
          include: {
            referidos: {
              orderBy: { createdAt: 'asc' },
              select: {
                area: true,
                createdAt: true,
                profesionalAsignado: { select: { nombreCompleto: true } },
              },
            },
          },
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
        enAlbergue:
          expediente.tipoRegistro === 'INTERNA' &&
          expediente.fechaEgresoAlbergue === null,
        referidos: expediente.referidos.map((referido) => ({
          // `referidos.area` solo se otorga a áreas de atención (nunca TRABAJO_SOCIAL/ADMINISTRACION
          // en la práctica) — el tipo de Prisma es el enum `Rol` completo, se acota aquí al
          // subconjunto que expone la API de trabajo social.
          area: referido.area as AreaAtencion,
          profesional: referido.profesionalAsignado?.nombreCompleto ?? null,
          createdAt: referido.createdAt,
        })),
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
  ): Promise<UsuariaHubRow | null> {
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
    } catch (error) {
      // Otra petición tomó ese DPI entre la verificación del service y este UPDATE.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DpiUsuariaDuplicadoError();
      }
      // P2025: registro no encontrado — mismo criterio uniforme del resto del proyecto.
      return null;
    }
    return this.obtenerHub(id);
  }
}
