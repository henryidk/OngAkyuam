# Ajustes de Psicología para revisión

**Estado: en revisión. Aún falta pulir algunas cosas antes de dar estos cambios por definitivos.**

La lectura es compartida entre las cuentas con rol PSICOLOGIA sobre expedientes referidos al área. Las notas y documentos de sesión siguen dentro de Psicología; la responsable conserva las escrituras. Las otras áreas mantienen la visibilidad explícita que otorga Trabajo Social.

Cada hijo tiene un consecutivo estable dentro del expediente de su madre: `04-2026.01`, `04-2026.02`. `AtencionPsicologica.ninoId` identifica a la persona del proceso (`null` para la madre). Cada persona puede tener un proceso activo independiente. Cerrar un proceso cancela únicamente las citas de ese proceso. La base valida que la persona de cada cita coincida con la del proceso y que el hijo pertenezca al expediente de la madre.

La migración conserva las citas históricas y sus documentos; si un proceso mezclaba personas, separa las citas de los hijos en procesos propios. No se modifican las fechas de las citas históricas.

Las nuevas citas deben comenzar a partir de las 08:00 y finalizar a más tardar a las 17:00, en America/Guatemala. Se comprueba al abrir, programar, reprogramar y crear la próxima cita al guardar una sesión, tanto en los formularios como en la API.

Una sesión atendida pide Clínica 1 o Clínica 2. Se guardan clínica, profesional y enfoque terapéutico; las sesiones antiguas sin esos datos se muestran como sin registrar, sin inventarlos. El archivo de sesión se presenta como Hoja de evolución.

Los reportes del equipo incluyen grupos de edad 0–15, 16–30, 31–45 y 46 y más, desglosados por sexo, personas por municipio y procesos cerrados del año. Una persona se cuenta una vez por periodo aunque tenga varias sesiones. El Excel de personas también usa los rangos nuevos e indica el sexo.

## Verificación

`pnpm --filter @akyuam/api exec jest --runInBand --testPathPatterns=psicologia`

Con el backend compilado y DATABASE_URL apuntando a la copia local `akyuam_psicologia_testing_20261017`:

`pnpm --filter @akyuam/api test:psicologia:integracion`

La integración crea sus datos en una transacción y la revierte. Comprueba procesos independientes, lectura de colegas sin escritura, nuevos campos de sesión, códigos y reportes. Rechaza cualquier otra base de datos.
