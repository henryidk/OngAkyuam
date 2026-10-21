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


## Agenda del equipo y Citas (21 de octubre de 2026)

- La agenda abre con **Solo mis pacientes** activado. Incluye pacientes de mis procesos y citas que atenderé por cobertura. Al desactivarlo consulta las citas del equipo de Psicología. Cada fila identifica la profesional de la cita y, si difiere, la responsable del proceso.
- **Citas** permite consultar por fechas y estado, con totales calculados sobre todo el resultado y páginas de 20 registros. Su detalle muestra quién atendió, la responsable del proceso, clínica, enfoque, notas y hoja de evolución, sin inventar datos históricos faltantes.
- Para atender una cita programada de una colega, se presenta una advertencia con sus nombres. **Continuar y atender** cambia únicamente la profesional de esa cita y registra la acción en auditoría. La responsable del proceso y las sesiones anteriores se conservan. También se avisa si el horario se cruza con otra cita propia.
- La confirmación lleva los identificadores que se mostraron en pantalla. Si otra pestaña cambia la cita, se pide actualizar antes de continuar. No se toman citas con borradores, notas o documentos de otra profesional, ni procesos cerrados. Solo la profesional de la cita puede registrar o corregir esa sesión; el cierre del proceso sigue correspondiendo a su responsable.
- Una cuenta de Psicología puede consultar el historial del área aunque la profesional anterior esté desactivada. El acceso de otras áreas conserva sus reglas.
- Fechas inválidas, rangos invertidos o mayores de un año y páginas inválidas se rechazan en el servidor. El horario laboral se valida de 08:00 a 17:00, incluida la duración, y el formulario muestra la causa correcta.

No requiere una migración adicional. Usa los campos existentes de responsable del proceso y profesional de cada cita. La integración de pruebas crea personas temporales únicamente en la copia de revisión y revierte todos sus registros.
