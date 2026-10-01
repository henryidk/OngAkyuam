#!/bin/sh
# Falla si un archivo de arranque o despliegue ejecuta algo que pueda borrar o reiniciar datos.
# Lo único permitido ahí es `prisma migrate deploy`; los seeds se corren solo a mano (ver la
# regla en CLAUDE.md). Los comentarios (líneas que empiezan con #) no cuentan.
set -eu

PROHIBIDO='migrate[[:space:]]+(dev|reset)|db[[:space:]]+(push|seed)|accept-data-loss|force-reset|prisma/seeds?|seed\.ts'

archivos=$(git ls-files \
  '*Dockerfile*' 'docker-compose*.yml' 'docker-compose*.yaml' \
  '*.sh' '.github/workflows/*' '.husky/*' \
  | grep -v '^scripts/verificar-arranque-seguro\.sh$')

encontrado=0
for archivo in $archivos; do
  coincidencias=$(grep -nE "$PROHIBIDO" "$archivo" | grep -vE '^[0-9]+:[[:space:]]*#' || true)
  if [ -n "$coincidencias" ]; then
    echo "::error file=$archivo::Comando que puede reiniciar datos en un archivo de arranque/despliegue"
    echo "$archivo:"
    echo "$coincidencias"
    encontrado=1
  fi
done

if [ "$encontrado" -eq 1 ]; then
  echo "Solo 'prisma migrate deploy' puede correr de forma automática."
  exit 1
fi
echo "Arranque y despliegue sin comandos que reinicien datos."
