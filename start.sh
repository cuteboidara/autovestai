#!/bin/sh
set -e

# Trim leading/trailing whitespace from DATABASE_URL so Prisma doesn't
# reject a valid URL that arrived with stray spaces or newlines.
if [ -n "$DATABASE_URL" ]; then
  DATABASE_URL=$(printf '%s' "$DATABASE_URL" | tr -d '[:space:]')
  export DATABASE_URL
fi

echo "=== Running migrations ==="
npx prisma migrate deploy 2>/dev/null || echo "Migration warning ignored"
echo "=== Starting application ==="
exec node dist/main
