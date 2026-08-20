#!/bin/sh
set -e

attempt=0
max_attempts=10

until pnpm exec prisma migrate deploy; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "prisma migrate deploy falló tras $max_attempts intentos. Abortando arranque."
    exit 1
  fi
  echo "prisma migrate deploy falló (intento $attempt/$max_attempts), reintentando en 3s..."
  sleep 3
done

exec node dist/main
