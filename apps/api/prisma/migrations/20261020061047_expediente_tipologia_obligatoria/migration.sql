-- La tipología del delito siempre se marca (al menos una), igual que exige `datosCasoSchema`.
-- Prisma no puede declarar una lista como obligatoria: la columna admite NULL y lista vacía, y
-- un expediente así rompía los reportes de población beneficiada. La regla queda en la base.
-- Si algún expediente ya existente no la cumple, la migración falla en vez de inventar un dato.
ALTER TABLE "Expediente"
  ADD CONSTRAINT "Expediente_tipologia_obligatoria_chk"
    CHECK ("tipologiaDelito" IS NOT NULL AND cardinality("tipologiaDelito") >= 1);
