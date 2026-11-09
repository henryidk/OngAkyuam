-- Un caso de Psicología ahora se toma al confirmar su primera cita (o al registrar "Atender
-- ahora"), en la misma transacción. Ya no existen casos "tomados por agendar": se borran los que
-- quedaron así, que vuelven a Área de atención porque su referencia sigue sin tomar.
-- Solo los que nunca tuvieron cita: sin fecha de inicio, sin cerrar y sin ninguna cita. Lo que
-- cuelga de ellos (cambios de estado) se borra en cascada.
DELETE FROM "AtencionPsicologica" a
WHERE a."fechaInicio" IS NULL
  AND a."estado" <> 'CIERRE'
  AND a."psicologaAsignadaId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "CitaPsicologica" c WHERE c."atencionId" = a.id
  );
