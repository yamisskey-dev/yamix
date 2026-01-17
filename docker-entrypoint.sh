#!/bin/sh
set -e

echo "Running Prisma migrations..."
prisma db push --skip-generate

echo "Starting application..."
exec "$@"
