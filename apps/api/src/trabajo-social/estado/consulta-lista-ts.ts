import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ResolveresEstadoArea } from './resolveres-estado-area';

/**
 * SQL compartido por la lista de Usuarias y las colas de la bandeja: una fila por usuaria con
 * su caso activo y el estado derivado. Vive aquí (y no en cada repositorio) para que el chip
 * "Sin referir" de Usuarias y la cola "Pendientes de referir" de Inicio cuenten lo mismo.
 */
@Injectable()
export class ConsultaListaTs {
  constructor(private readonly resolveresEstado: ResolveresEstadoArea) {}

  /**
   * CTE `lista` (precedida de `caso_activo`): una fila por usuaria con su caso activo (el más
   * reciente) y el estado derivado. `condicionUsuaria` filtra sobre el alias `u` de `Usuaria`.
   */
  cteLista(condicionUsuaria: Prisma.Sql = Prisma.sql`TRUE`): Prisma.Sql {
    return Prisma.sql`
      WITH caso_activo AS (
        SELECT DISTINCT ON (e."usuariaId")
          e.id, e."usuariaId", e.numero, e."tipoRegistro", e."createdAt", e."fechaIngresoAlbergue",
          (e."tipoRegistro" = 'INTERNA' AND e."fechaEgresoAlbergue" IS NULL) AS "enAlbergue"
        FROM "Expediente" e
        ORDER BY e."usuariaId", e.fecha DESC, e."createdAt" DESC
      ),
      lista AS (
        SELECT
          u.id AS "usuariaId", u.nombres, u.apellidos, u."fechaNacimiento",
          c.id AS "expedienteId", c.numero, c."tipoRegistro", c."enAlbergue",
          c."createdAt" AS "casoCreadoEn", c."fechaIngresoAlbergue",
          (SELECT count(*)::int FROM "Nino" n WHERE n."expedienteId" = c.id) AS "cantidadNinos",
          ARRAY(
            SELECT r.area::text FROM "ReferidoArea" r WHERE r."expedienteId" = c.id ORDER BY r."createdAt"
          ) AS areas,
          ${this.expresionEstadoTs(Prisma.sql`c.id`)} AS estado,
          GREATEST(
            c."createdAt",
            (SELECT max(r."createdAt") FROM "ReferidoArea" r WHERE r."expedienteId" = c.id)
          ) AS "ultimaActividadEn",
          (
            SELECT r.area::text FROM "ReferidoArea" r WHERE r."expedienteId" = c.id
            ORDER BY r."createdAt" DESC LIMIT 1
          ) AS "ultimaActividadArea"
        FROM "Usuaria" u
        JOIN caso_activo c ON c."usuariaId" = u.id
        WHERE ${condicionUsuaria}
      )
    `;
  }

  /**
   * La regla de `combinarEstadoTs` en SQL, con la condición "área activa" que aporta la
   * estrategia de cada área — agregar un área no toca esta consulta.
   */
  expresionEstadoTs(columnaExpedienteId: Prisma.Sql): Prisma.Sql {
    const areasActivas = this.resolveresEstado.todos().map(
      (resolver) => Prisma.sql`(
        EXISTS (SELECT 1 FROM "ReferidoArea" r WHERE r."expedienteId" = ${columnaExpedienteId} AND r.area::text = ${resolver.area})
        AND ${resolver.condicionActivaSql(columnaExpedienteId)}
      )`,
    );
    return Prisma.sql`CASE
      WHEN NOT EXISTS (SELECT 1 FROM "ReferidoArea" r WHERE r."expedienteId" = ${columnaExpedienteId}) THEN 'SIN_REFERIR'
      WHEN ${Prisma.join(areasActivas, ' OR ')} THEN 'EN_ATENCION'
      ELSE 'SIN_ATENCION_ACTIVA'
    END`;
  }
}
