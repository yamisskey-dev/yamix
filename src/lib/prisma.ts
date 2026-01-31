import { PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required. PostgreSQL is mandatory for Yamix."
    );
  }

  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  logger.info("Prisma client created");
  return client;
}

// Lazy initialization: Prisma client is created on first access, not at import time.
// This avoids errors during Next.js build (which imports modules but doesn't have DATABASE_URL).
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient();
    }
    return Reflect.get(globalForPrisma.prisma, prop);
  },
});

export function generateId(): string {
  return crypto.randomUUID();
}
