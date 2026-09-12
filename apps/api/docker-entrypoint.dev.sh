#!/bin/sh
set -e

# Los volúmenes nombrados (node_modules) los crea Docker como root la primera vez
# y conservan ese dueño entre reinicios (a diferencia del bind mount del código,
# que siempre refleja el dueño real del host). Se corrige aquí, como root, justo
# antes de bajar privilegios — así "node" puede escribir en ellos.
chown -R node:node /repo/node_modules /repo/apps/api/node_modules /repo/packages/shared/node_modules

exec su-exec node "$@"
