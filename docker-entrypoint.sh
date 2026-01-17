#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma db push --skip-generate

echo "Starting application..."
exec "$@"
