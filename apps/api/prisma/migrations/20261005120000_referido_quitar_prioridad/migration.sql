-- Trabajo Social no marca urgencia al referir: la prioridad nunca se usó en el flujo real.
-- Antes de aplicar en desarrollo: URGENTE 3, NORMAL 11 (todas eran datos ficticios).
-- Los registros viejos de AuditLog con `detalles.prioridad` no se tocan: la plantilla los ignora.

-- AlterTable
ALTER TABLE "ReferidoArea" DROP COLUMN "prioridad";

-- DropEnum
DROP TYPE "PrioridadReferido";
