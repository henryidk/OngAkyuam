# Instrucciones del sistema AKyuam

Este documento especifica **las reglas de negocio y el funcionamiento del sistema**, tal como fueron descritas en `capturas/requerimientos.txt` y refinadas en conversaciones posteriores. Es el documento de referencia para construir cualquier área del sistema, presente o futura.

No repite decisiones de stack técnico ni de proceso de trabajo con git/infraestructura — eso ya vive en `CLAUDE.md`. Este documento cubre el **qué** (reglas de negocio, flujo real de la ONG, modelo de datos) para que cualquier parte del sistema que se construya sea consistente con las demás.

Datos altamente sensibles (sobrevivientes de violencia). Cualquier ejemplo en este documento usa nombres ficticios.

---

## 1. Qué es Akyuam

Ak'Yu'Am es una ONG que atiende a mujeres víctimas de violencia. Tiene cuatro áreas de atención:

- **Trabajo Social**
- **Jurídico**
- **Psicología**
- **Médica**

Cualquier mujer que llega es atendida primero por **Trabajo Social**, que es el punto de entrada único al sistema. Trabajo Social decide a qué otra(s) área(s) referir el caso, según lo que la usuaria necesite.

> **Corrección respecto a `CLAUDE.md`:** ese archivo menciona un paso previo de "Gerencia" que registra información rápida antes de Trabajo Social. `requerimientos.txt` no lo menciona, y se confirmó explícitamente que **Trabajo Social es el primer punto de atención real** — no existe un paso de Gerencia. `CLAUDE.md` debería actualizarse para reflejar esto (pendiente, no se ha tocado ese archivo todavía).

---

## 2. Modelo de acceso

- Es **un solo sistema** (una SPA), con un **login único**. Al iniciar sesión, cada usuaria del sistema (personal de la ONG) es redirigida a la interfaz de **su área**, como si fueran sistemas distintos — pero comparten backend, base de datos y autenticación.
- **Cada cuenta pertenece a una sola área.** Si una misma persona trabajara en dos áreas, necesitaría dos cuentas (no se modela pertenencia múltiple a áreas en una sola cuenta).
- Áreas/roles del sistema: `trabajo_social`, `juridico`, `psicologia`, `medica`, y un quinto rol transversal: `administracion` (ver sección 8).

---

## 3. Modelo de datos: usuaria → expediente → áreas → sub-registros por área

Esta jerarquía es el corazón del sistema y gobierna todo lo demás:

1. **Usuaria** — identificada de forma única por **DPI o nombre** (no por un ID de expediente, que no es fijo).
2. Cada vez que una usuaria llega a pedir ayuda —sea la primera vez o si ya existía en el sistema— se abre un **expediente nuevo**. Una usuaria puede acumular varios expedientes a lo largo del tiempo (visitas distintas, necesidades distintas).
3. El sistema debe permitir **buscar una usuaria** (por DPI o nombre) y ver **todos sus expedientes**.
4. Cada expediente agrega el trabajo de **una o varias áreas** (las que Trabajo Social haya referido). Al abrir un expediente se debe poder ver qué áreas trabajaron en él.
5. Dentro de un expediente, cada área puede tener **sus propios sub-registros** — por ejemplo, en Jurídico un mismo expediente puede contener **múltiples procesos/casos** (una usuaria puede iniciar un proceso legal, cerrarlo, y luego abrir otro).

```
Usuaria (DPI / nombre)
 └─ Expediente 05-2026 (uno por visita/ocasión)
     ├─ Trabajo Social: datos base, documentos físicos escaneados
     ├─ Jurídico (si fue referida): J1-05-2026, J2-05-2026, ...
     ├─ Psicología (si fue referida): P1-05-2026, ...
     └─ Médica (si fue referida): M1-05-2026, ...
```

### 3.1. Número de expediente y numeración de sub-registros por área — resuelto

- El **número de expediente** tiene formato `NN-AAAA` (ej. `05-2026` = expediente 5 del año 2026) y es el identificador **usado en toda la organización**, asignado por Trabajo Social al abrir el expediente. Reemplaza el correlativo genérico (`#0139`) usado como ejemplo provisional en versiones anteriores de este documento y en el mockup — hay que ajustar el mockup a este formato real.
- Cualquier área que necesite llevar **sub-registros internos** dentro de un expediente (procesos de Jurídico, casos/seguimientos de Psicología, consultas de Médica que se quieran identificar individualmente) usa una convención derivada del número de expediente: **`{PREFIJO}{consecutivo}-{expediente}`**.
  - Ejemplo: `J1-05-2026` = primer proceso de Jurídico del expediente `05-2026`. Si la usuaria abre un segundo proceso legal más adelante en ese mismo expediente, sería `J2-05-2026`.
  - Prefijos por área: `J` Jurídico, `P` Psicología, `M` Médica. Trabajo Social no necesita prefijo propio porque es dueño del expediente mismo.
  - El consecutivo (`1`, `2`, ...) es **propio de cada área dentro de ese expediente** — no se comparte entre áreas ni con el número de expediente.
- Esta convención aplica de forma consistente a **cualquier área con sub-registros múltiples por expediente**, no solo a Jurídico (ver notas en las secciones 7 y 8).

---

## 4. Principio: evitar duplicación de datos y formularios

Instrucción explícita del usuario: *"quiero que me ayudes a diseñar el sistema... para que no exista formularios duplicados o información duplicada o incluso un doble llenado de formularios."*

Regla: los **campos núcleo** de identidad/demografía de la usuaria se capturan **una sola vez**, en Trabajo Social, al abrir el expediente. Las demás áreas los **consultan** (solo lectura) — nunca los vuelven a pedir en un formulario propio.

| Campo | Se captura en | Otras áreas |
|---|---|---|
| Nombres, apellidos, DPI | Trabajo Social | Solo lectura |
| Fecha de nacimiento / edad (+ rango) | Trabajo Social | Solo lectura |
| Departamento / municipio | Trabajo Social | Solo lectura |
| Grupo étnico | Trabajo Social | Solo lectura |
| Tipología 22-2008 | Trabajo Social | Solo lectura |
| Datos del agresor | Trabajo Social | Solo lectura (si el área tiene acceso) |
| Hijos/as acompañantes | Trabajo Social | Solo lectura |

Cada área **solo agrega lo que le es propio** (ver secciones 6-8). Los reportes de cada área **combinan** estos campos núcleo con sus propios campos — nunca se vuelven a teclear a mano.

> Nota sobre el Excel actual de Trabajo Social: la columna "Género" se usaba informalmente para anotar si la usuaria traía hijos/as. En el sistema esto **no se replica así** — los hijos/as tienen su propia sección de registro, separada y estructurada (ver 5.3), porque el sistema solo atiende mujeres y el campo "género" no tiene otro uso real.

---

## 5. Trabajo Social

Punto de entrada único. Ya diseñado y con mockup interactivo aprobado en revisión (`akyuam-mockup-ts.html`). Resumen de las reglas vigentes:

### 5.1. Datos capturados al registrar una usuaria

`requerimientos.txt` distingue explícitamente **dos grupos de información** capturados por Trabajo Social — es una separación real del negocio, no solo una conveniencia de formulario, y debe respetarse en el modelo de datos: **Grupo 1** (usuaria, agresor, tipo de registro, observaciones) se llena una sola vez al recibir a la usuaria; **Grupo 2** (datos de población beneficiada) alimenta los reportes y es la información que las demás áreas heredan al ser referidas.

- **Usuaria (Grupo 1):** nombres, apellidos, teléfono, dirección, fecha de nacimiento (con edad y rango calculados automáticamente: `0-13`, `14-30`, `31-60`, `60+`), DPI.
- **Agresor (Grupo 1):** nombre, apellidos, teléfono, dirección — puede omitirse si la usuaria no lo sabe o no desea compartirlo.
- **Registro (Grupo 1):** Interna (si pide albergue) / Externa.
- **Observaciones (Grupo 1):** texto libre.
- **Datos de expediente / población beneficiada (Grupo 2):** número de expediente (autogenerado, formato `NN-AAAA` — ver 3.1), fecha de registro (autogenerada), municipio (de **Alta Verapaz**, ver 5.2), grupo étnico (Maya Q'eqchi', Maya Poqomchi', Xinca, Garífuna, Ladino, Otro), ubicación geográfica, tipología 22-2008 (selección múltiple: física, psicológica, sexual, patrimonial).
- **Hijos/as acompañantes:** menores de 12 años que llegan con la usuaria. Se registran como población beneficiada asociada a la madre, no como usuarias independientes.

### 5.2. Departamento: realidad geográfica de la ONG

La ONG atiende casi siempre casos de **Alta Verapaz**. Por eso el campo principal es un selector de **municipio de Alta Verapaz** (Cobán, San Pedro Carchá, San Juan Chamelco, Santa Cruz Verapaz, San Cristóbal Verapaz, Tactic, Tamahú, Tucurú, Panzós, Senahú, Chisec, Chahal, Fray Bartolomé de las Casas, Lanquín, Santa Catalina La Tinta, Raxruhá), con un checkbox de excepción **"la usuaria viene de otro departamento"** que revela campos libres de Departamento/Municipio para el caso raro en que aplique.

### 5.3. Documentos físicos

Se llenan siempre en papel (temas legales requieren documento físico) y se escanean y suben al sistema vía R2:

1. Entrevista a usuaria
2. Convenio de ingreso
3. Convenio de egreso
4. Acciones realizadas
5. Documento de recepción de bienes

### 5.4. Referir a áreas

- Trabajo Social decide a qué área(s) referir (Jurídico, Psicología, Médica). Una vez referida, esa área puede ver la información del expediente — **antes de ser referida, ningún área puede verla**.
- **Referir debe poder hacerse en el mismo flujo de registro** (paso opcional al final del formulario de alta), para no obligar a un segundo paso separado inmediatamente después de registrar. También debe seguir siendo posible referir después, desde el expediente ya abierto, para cuando la decisión no es inmediata.
- **Privacidad por documento:** al referir a un área, Trabajo Social decide documento por documento si esa área puede verlo (`Entrevista a usuaria`, `Convenio de ingreso`, `Convenio de egreso` son los ejemplos explícitos en los requerimientos — en la práctica aplica a los 5). Es decir: ser referido a un área **no da acceso automático a todos los documentos**.
- **Excepción: Jurídico tiene acceso total.** No se le puede restringir el acceso a ninguna información ni documento, nunca.

### 5.5. Estados

- **Estado del expediente (propiedad de Trabajo Social):** `Activo` / `Cerrado`. Nunca debe mostrar el estado interno de otra área (ej. "en trámite" de Jurídico no debe aparecer aquí — fue uno de los problemas del primer mockup).
- **Vista de trabajo (pestañas, no reemplazan el Estado):** `Pendientes de referir` / `En atención` / `Cerrados` — filtros de flujo de trabajo para ubicar rápido en qué punto está cada expediente.
- Un expediente **cerrado sigue siendo completamente editable** — cerrar es solo una etiqueta de estado, no bloquea nada. Debe poder reabrirse.

### 5.6. Reportes

Módulo de reportes con filtros (fecha, área referida, departamento) y exportación a Excel de la población beneficiada, con vista previa en tabla antes de descargar.

---

## 6. Jurídico

No construido aún — reglas documentadas para cuando se aborde.

**Necesidad general declarada por la ONG** (`requerimientos.txt`): digitalizar toda la información de los expedientes que hoy se lleva en Excel/papel, y dar visibilidad al estado de cada caso — ver también 6.6.

### 6.1. Datos propios al recibir una usuaria referida

- Si la usuaria necesita **medidas de seguridad** (el detalle exacto del campo — booleano simple vs. tipo/vigencia/fecha — queda **pendiente de confirmar**, ver sección 9).

### 6.2. Modelo: expediente → múltiples procesos

- Un expediente puede contener **múltiples procesos/casos** de Jurídico (la usuaria puede iniciar un proceso, cerrarlo, y luego someterse a otro distinto). Cada proceso se identifica con la convención `J{consecutivo}-{expediente}` (ver 3.1) — ej. `J1-05-2026`, `J2-05-2026`.
- Acción **"Agregar proceso"** dentro del expediente.
- Cada proceso registra **inicio y cierre**.
- Cada proceso permite **adjuntar documentos** propios (distintos a los 5 documentos de Trabajo Social).
- Cada proceso permite **asignar abogada y procuradora** — seleccionadas de la lista de personal de Jurídico (ver sección 8, módulo de Administración).

### 6.3. Estados

Dos estados por proceso (no por expediente completo, ya que puede haber varios procesos en paralelo o en momentos distintos):

- **Procesos en trámite**
- **Procesos concluidos**

El panel de Jurídico debe poder agrupar/filtrar por estos dos estados.

### 6.4. Privacidad

- Jurídico tiene **acceso total** a toda la información del expediente (documentos de Trabajo Social incluidos) — no se le puede restringir nunca.
- La información **propia de Jurídico** (sus procesos) es visible **por defecto solo para Jurídico y para Trabajo Social** (`requerimientos.txt` es explícito en esto: "la información de los casos será visible para jurídico y además para trabajo social"). Es privada por defecto hacia **las demás áreas** (Psicología, Médica) — Jurídico puede decidir hacerla pública para alguna de ellas específicamente (igual que Trabajo Social decide por documento).

### 6.5. Reportes propios

Campos de su base de Excel actual: número de expediente, tipo de proceso, rango de edades, avance, responsables (abogada/procuradora), etnia, edad.

**Importante (principio de la sección 4):** rango de edades, etnia y edad **ya existen** en los datos núcleo capturados por Trabajo Social — Jurídico no los vuelve a pedir, los hereda para su reporte. Jurídico solo captura y reporta lo que es realmente suyo: tipo de proceso, avance, responsables.

### 6.6. Idea de producto (no confirmada, sugerida por la ONG)

La ONG pidió "un sistema donde se observe el estado de cada caso o bien... la ruta del proceso jurídico" — esto sugiere una visualización tipo línea de tiempo/stepper por proceso (similar al historial que ya se diseñó para Trabajo Social). Se define en detalle cuando se construya esta área.

---

## 7. Psicología

No construido aún — reglas documentadas para cuando se aborde.

### 7.1. Flujo

- Registro de **inicio de caso**, **seguimiento** y **cierre**.
- Reutiliza los datos núcleo de Trabajo Social (sección 4) — **no vuelve a llenar el mismo formulario**.
- **Trabajo Social asigna qué psicóloga atiende** a la usuaria (selección de la lista de personal de Psicología, ver sección 8).
- Si la usuaria abre más de un caso de Psicología en el mismo expediente (ej. un seguimiento nuevo tiempo después de haber cerrado uno anterior), cada uno se identifica con la convención `P{consecutivo}-{expediente}` (ver 3.1) — ej. `P1-05-2026`.

### 7.2. Seguimiento y citas

- Control de citas/consultas: fecha y hora de atención, y próximas fechas programadas.
- El objetivo explícito es que el área tenga "a mano lo que se ha trabajado con cada una" — historial de sesiones accesible rápido.

### 7.3. Estadísticas

- Cuántos procesos se llevan actualmente (activos).
- Cuántas personas atendidas, por año y por mes.

> Nota de lectura de la fuente: `requerimientos.txt`, dentro de la sección de Psicología, dice literalmente "cuantas personas han sido atendidas en el área jurídica" — por contexto (está en el bloque de Psicología, entre "Fin área psicología") parece una errata del documento original y aquí se interpreta como personas atendidas **en Psicología**. Confirmar con la ONG si en algún momento se revisa esta sección a detalle.

---

## 8. Médica

No construido aún — reglas documentadas para cuando se aborde.

### 8.1. Datos por consulta

Campos de su Excel actual: número de expediente, fecha, paciente, edad, motivo de consulta, antecedentes importantes, diagnóstico, evolución.

Igual que en Jurídico y Psicología: **expediente, paciente y edad ya existen** en los datos núcleo — Médica solo agrega lo propio de cada consulta (fecha, motivo, antecedentes, diagnóstico, evolución). Una usuaria puede tener múltiples consultas médicas en un mismo expediente; si conviene identificarlas individualmente, siguen la misma convención `M{consecutivo}-{expediente}` (ver 3.1) — ej. `M1-05-2026`.

### 8.2. Estadísticas

- Cuántas consultas se le han dado a una usuaria.
- Cuántas personas atendidas, por año y por mes.

---

## 9. Administración (módulo transversal, no es un área de atención)

Idea del usuario para resolver la gestión de personal que Jurídico y Psicología necesitan (asignar abogada/procuradora, asignar psicóloga):

- Panel donde se **agregan profesionales** y se les asigna **una sola área** (`trabajo_social`, `juridico`, `psicologia`, `medica`).
- Permite **desactivar cuentas** y **resetear contraseñas**.
- Administración **no atiende casos** — es puramente gestión de identidades/cuentas del personal.
- Las listas de "abogada/procuradora" (Jurídico) y "psicóloga" (Psicología, seleccionada por Trabajo Social) se alimentan de las cuentas activas que Administración haya creado para esa área.

---

## 10. Reglas de privacidad — resumen transversal

1. Todo expediente es invisible para un área hasta que Trabajo Social la refiere explícitamente.
2. Ser referido a un área da acceso al **expediente**, pero no automáticamente a **todos los documentos** — Trabajo Social controla la visibilidad documento por documento.
3. **Jurídico es la única excepción**: acceso total, no restringible, a toda la información y documentos del expediente.
4. La información propia de cada área (procesos de Jurídico, sesiones de Psicología, consultas de Médica) es privada por defecto hacia las demás áreas; cada área puede decidir hacerla pública a otra área específica.
5. Toda lectura o escritura de datos sensibles debe quedar en `audit_log` (ya definido en `CLAUDE.md`).

---

## 11. Orden de construcción

1. **Trabajo Social** — en curso (mockup aprobado, pendiente de pasar a implementación real cuando el usuario lo indique).
2. Jurídico, Psicología, Médica y Administración — **después**, en el orden que se decida, uno a la vez.

No se construye nada de las secciones 6-9 hasta que se confirme explícitamente empezar esa área — este documento existe para que, cuando llegue el momento, las reglas ya estén claras y no haya que re-descubrirlas.

---

## 12. Pendientes de confirmar con la ONG

- **Campo "medidas de seguridad" en Jurídico** (sección 6.1): ¿es un simple sí/no, o necesita tipo de medida, fecha de solicitud, vigencia?
- Cualquier otro matiz del flujo real que no se haya cubierto todavía — según indica `CLAUDE.md`, preguntar antes de asumir reglas de negocio no confirmadas.
