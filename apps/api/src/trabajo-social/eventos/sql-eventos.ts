import { Prisma } from '@prisma/client';

/**
 * CTE `eventos`: filas de `AuditLog` de las acciones dadas, ya resueltas a su expediente. Cada
 * acción audita una entidad distinta (el expediente, un documento, un proceso, una cita…), así
 * que cada rama parte del expediente — filtrado por `condicionExpediente` sobre el alias `e` —
 * y llega al `AuditLog` por el índice `(entidad, entidadId, createdAt)`.
 */
export function cteEventos(
  acciones: string[],
  condicionExpediente: Prisma.Sql,
): Prisma.Sql {
  const filtroAccion = Prisma.sql`a.accion IN (${Prisma.join(acciones)})`;
  const columnas = Prisma.sql`a.id, a.accion, a.detalles, a."createdAt", a."usuarioId", e.id AS "expedienteId"`;

  return Prisma.sql`
    eventos AS (
      SELECT ${columnas}
      FROM "Expediente" e
      JOIN "AuditLog" a ON a.entidad = 'Expediente' AND a."entidadId" = e.id
      WHERE ${condicionExpediente} AND ${filtroAccion}
      UNION ALL
      SELECT ${columnas}
      FROM "Expediente" e
      JOIN "Documento" d ON d."expedienteId" = e.id
      JOIN "AuditLog" a ON a.entidad = 'Documento' AND a."entidadId" = d.id
      WHERE ${condicionExpediente} AND ${filtroAccion}
      UNION ALL
      SELECT ${columnas}
      FROM "Expediente" e
      JOIN "ProcesoJuridico" p ON p."expedienteId" = e.id
      JOIN "AuditLog" a ON a.entidad = 'ProcesoJuridico' AND a."entidadId" = p.id
      WHERE ${condicionExpediente} AND ${filtroAccion}
      UNION ALL
      SELECT ${columnas}
      FROM "Expediente" e
      JOIN "AtencionPsicologica" ap ON ap."expedienteId" = e.id
      JOIN "AuditLog" a ON a.entidad = 'AtencionPsicologica' AND a."entidadId" = ap.id
      WHERE ${condicionExpediente} AND ${filtroAccion}
      UNION ALL
      SELECT ${columnas}
      FROM "Expediente" e
      JOIN "AtencionPsicologica" ap ON ap."expedienteId" = e.id
      JOIN "CitaPsicologica" c ON c."atencionId" = ap.id
      JOIN "AuditLog" a ON a.entidad = 'CitaPsicologica' AND a."entidadId" = c.id
      WHERE ${condicionExpediente} AND ${filtroAccion}
    )
  `;
}
