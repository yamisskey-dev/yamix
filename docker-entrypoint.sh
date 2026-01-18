#!/bin/sh
set -e

echo "Running Prisma migrations..."
prisma db push --skip-generate --accept-data-loss

echo "Starting application..."
exec "$@"
