# Módulo de Medicina — interfaz de demostración

Adaptación de los componentes originales de v0 (Next.js) a React + Vite.

## Acceso

Iniciar sesión con rol MEDICA y abrir `/medica`. Las vistas usan
`?vista=agenda`, `?vista=pacientes` y `?vista=reportes`. Se conserva la ruta
`/medica/:id` del expediente existente del sistema.

## Incluido

- Agenda del día, próximas consultas, calendario y referencias de Trabajo Social.
- Directorio con búsqueda y filtros por estado.
- Expediente con evolución, signos vitales, antecedentes y datos generales.
- Formularios de consulta (CIE-10, signos vitales, receta, plan) y de citas.
- Reportes por período, indicadores y descarga CSV compatible con Excel.
- Menú adaptable a móvil y paneles con primitivas accesibles de Base UI.
- Sesión real del sistema, cierre de sesión y protección por rol.

## Alcance y pendientes

Los datos de `medicine-data.ts` son ficticios y la fecha de demostración está
fijada al 18 de agosto de 2026 para reproducir los mockups. Los formularios
simulan el flujo; no persisten cambios ni modifican referencias de Trabajo
Social. Impresión de notas y recetas queda pendiente. La exportación genera
CSV, no un archivo XLSX.

La conexión con Prisma/API, persistencia, auditoría y permisos clínicos debe
implementarse antes de utilizar este módulo con información real. El acceso
a cada área requiere el rol autorizado del sistema.

El tema está limitado a `.medicina-theme`, incluidos los portales de paneles
y selects. Los componentes originales del sistema permanecen disponibles.
