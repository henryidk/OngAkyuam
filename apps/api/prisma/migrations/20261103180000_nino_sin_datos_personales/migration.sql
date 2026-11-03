-- Los datos personales de cada hijo/a viven solo en "HijoUsuaria" (migración
-- `hijos_identidad_estable`); "Nino" queda como el enlace del hijo/a con un caso. Se borran las
-- copias viejas, que el código ya no lee ni escribe.

-- Verificación previa: ningún enlace con datos propios distintos a los de su hijo/a (sería
-- información que solo existe aquí y se perdería).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Nino" n JOIN "HijoUsuaria" h ON h.id = n."hijoId"
    WHERE (n.nombres IS NOT NULL AND lower(btrim(n.nombres)) <> lower(btrim(h.nombres)))
       OR (n.apellidos IS NOT NULL AND lower(btrim(n.apellidos)) <> lower(btrim(h.apellidos)))
       OR (n."fechaNacimiento" IS NOT NULL AND n."fechaNacimiento" <> h."fechaNacimiento")
       OR (n.genero IS NOT NULL AND n.genero <> h.genero)
  ) THEN
    RAISE EXCEPTION 'Hay enlaces "Nino" con datos distintos a los de su hijo/a; revisar a mano antes de borrar';
  END IF;
END $$;

ALTER TABLE "Nino" DROP COLUMN "apellidos",
DROP COLUMN "fechaNacimiento",
DROP COLUMN "genero",
DROP COLUMN "nombres";
