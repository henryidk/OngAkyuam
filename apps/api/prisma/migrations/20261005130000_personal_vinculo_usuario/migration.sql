-- Vincula cada ficha de Personal con la cuenta (Usuario) con la que esa persona inicia
-- sesión. Solo agrega una columna opcional: las fichas existentes quedan sin vínculo y
-- Administración las enlaza a mano.

-- AlterTable
ALTER TABLE "Personal" ADD COLUMN     "usuarioId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Personal_usuarioId_key" ON "Personal"("usuarioId");

-- AddForeignKey
ALTER TABLE "Personal" ADD CONSTRAINT "Personal_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
