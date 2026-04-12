#!/bin/sh
set -e
echo "=== Running migrations ==="
npx prisma migrate deploy 2>/dev/null || echo "Migration warning ignored"
echo "=== Starting application ==="
exec node dist/main
