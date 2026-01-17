import { PrismaClient } from "@prisma/client";
import type { WalletType, PostType, ConsultTarget, TransactionType } from "@/types";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaAvailable: boolean;
  memoryDB: MemoryDB;
};

// In-memory storage types
interface ServerRecord {
  id: string;
  instances: string;
  instanceType: string;
  appSecret: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UserRecord {
  id: string;
  handle: string;
  account: string;
  hostName: string;
  token: string;
  serverId: string;
  ethAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ProfileRecord {
  id: string;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface WalletRecord {
  id: string;
  address: string;
  balance: number;
  userId: string; // Required (1:1 relation)
  walletType: WalletType;
  createdAt: Date;
}

interface PostRecord {
  id: string;
  content: string;
  walletId: string;
  parentId: string | null;
  postType: PostType;
  targetType: ConsultTarget | null;
  tokenCost: number;
  tokenReward: number;
  createdAt: Date;
}

interface FollowRecord {
  id: string;
  followerId: string;
  targetId: string;
  createdAt: Date;
}

interface TransactionRecord {
  id: string;
  postId: string | null;
  senderId: string;
  amount: number;
  txType: TransactionType;
  createdAt: Date;
}

interface ChatSessionRecord {
  id: string;
  userId: string;
  title: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ChatMessageRecord {
  id: string;
  sessionId: string;
  role: "USER" | "ASSISTANT";
  content: string;
  isCrisis: boolean;
  createdAt: Date;
}

interface MemoryDB {
  servers: Map<string, ServerRecord>;
  users: Map<string, UserRecord>;
  profiles: Map<string, ProfileRecord>;
  wallets: Map<string, WalletRecord>;
  posts: Map<string, PostRecord>;
  follows: Map<string, FollowRecord>;
  transactions: Map<string, TransactionRecord>;
  chatSessions: Map<string, ChatSessionRecord>;
  chatMessages: Map<string, ChatMessageRecord>;
}

// Initialize in-memory storage
if (!globalForPrisma.memoryDB) {
  globalForPrisma.memoryDB = {
    servers: new Map(),
    users: new Map(),
    profiles: new Map(),
    wallets: new Map(),
    posts: new Map(),
    follows: new Map(),
    transactions: new Map(),
    chatSessions: new Map(),
    chatMessages: new Map(),
  };
}

function createPrismaClient(): PrismaClient | null {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL not set, using in-memory database");
    globalForPrisma.prismaAvailable = false;
    return null;
  }

  try {
    const client = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
    globalForPrisma.prismaAvailable = true;
    return client;
  } catch (error) {
    console.warn("Failed to create Prisma client:", error);
    globalForPrisma.prismaAvailable = false;
    return null;
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production" && prisma) {
  globalForPrisma.prisma = prisma;
}

export function isPrismaAvailable(): boolean {
  return globalForPrisma.prismaAvailable === true && prisma !== null;
}

export const memoryDB = globalForPrisma.memoryDB;

// Helper to generate IDs
export function generateId(): string {
  return crypto.randomUUID();
}
