export default {
  // eslint es type-aware (projectService) — por eso atrapa cosas que tsc solo
  // no atrapa, como el `any` filtrado de getOrThrow() que rompió el CI. Se le
  // pasan los archivos modificados directamente, sí soporta subconjuntos.
  'apps/api/**/*.ts': (files) =>
    `pnpm --filter @akyuam/api exec eslint --fix ${files.join(' ')}`,

  'apps/web/**/*.{ts,tsx}': (files) =>
    `pnpm --filter @akyuam/web exec oxlint ${files.join(' ')}`,

  // tsc con -p no admite mezclarse con archivos sueltos en la misma llamada,
  // así que acá se ignoran los nombres de archivo y se corre el proyecto
  // completo (rápido: es un solo paquete de schemas de Zod).
  'packages/shared/**/*.ts': () =>
    'pnpm --filter @akyuam/shared exec tsc -p tsconfig.json --noEmit',
};
