# Módulo de Medicina

Interfaz de v0 adaptada a React + Vite, conservando el tema crema y morado.
Iniciar sesión con rol MEDICA y abrir `/medica`. Las vistas usan
`?vista=agenda`, `?vista=pacientes` y `?vista=reportes`.

## Datos y flujo

- El directorio usa las usuarias y los expedientes del sistema que Trabajo
  Social refirió a MEDICA mediante `ReferidoArea`. No crea pacientes ni cuentas.
- La bandeja muestra las referencias sin cita programada ni atención registrada.
  Una ausencia permite volver a agendar desde esa bandeja.
- Las citas, notas clínicas, antecedentes, alergias y condiciones crónicas se
  guardan en Prisma, vinculadas al expediente existente.
- Después de atender una cita, la usuaria permanece en el directorio y su nota
  aparece en el historial y en los reportes del período correspondiente.
- La API comprueba la referencia MEDICA en cada lectura y escritura. Usa la
  autenticación, CSRF y protección de roles del sistema y audita las operaciones.
- No se precargan nombres, citas, diagnósticos ni historias de demostración.
  Cuando no existen registros, las listas e indicadores se muestran vacíos.
- Las fechas se interpretan con la fecha del negocio en Guatemala. El calendario
  permite cambiar de mes y los reportes usan rangos reales.

## Activar cambios en desarrollo

Desde la raíz del repositorio, con Docker Desktop abierto:

```powershell
docker compose up -d
docker compose exec -T --workdir /repo api-dev pnpm --filter @akyuam/api exec prisma migrate deploy
docker compose restart api-dev
pnpm dev:web
```

El arranque de `api-dev` compila `@akyuam/shared` y genera Prisma Client.
La migración `20261001030000_modulo_medicina` agrega `AtencionMedica` y
`CitaMedica`. No requiere volver a ejecutar seed ni recrear la base de datos.

## API

`GET /medicina/workspace`, `POST /medicina/citas`,
`PATCH /medicina/citas/:id`, `POST /medicina/citas/:id/consulta`,
`POST /medicina/citas/:id/ausencia` y
`PATCH /medicina/expedientes/:id/perfil`.

La consulta terminada no se sobrescribe. El seguimiento opcional crea una cita
a la misma hora y en la misma clínica; se rechazan colisiones de horario.
Los datos personales se mantienen como los registró Trabajo Social; Medicina
puede editar sus datos clínicos. La indicación de interconsulta se guarda en la
nota, sin otorgar acceso a otra área.

## Pendientes

La impresión de notas y recetas sigue pendiente. La descarga es CSV compatible
con Excel. No hay flujo de alta médica, por lo que el directorio distingue
entre nuevo ingreso y usuarias con atenciones registradas.
