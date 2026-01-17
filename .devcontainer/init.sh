#!/bin/bash
set -e

cd /workspace

echo "Installing dependencies..."
pnpm install

echo "Generating Prisma client..."
pnpm prisma:generate

echo "Waiting for PostgreSQL..."
until pg_isready -h postgres -U yamix 2>/dev/null; do
  sleep 1
done

echo "Pushing database schema..."
pnpm prisma db push

echo "Development environment ready!"
echo "Run 'pnpm dev' to start the development server"
