/**
 * Encryption Migration Script: V1 → V2
 *
 * Purpose: Re-encrypt all V1 messages with V2 format (random salt per message)
 *
 * Usage:
 *   npx tsx scripts/migrate-encryption-v1-to-v2.ts [--dry-run] [--batch-size=100]
 *
 * IMPORTANT: Run this during maintenance window or low-traffic period
 */

import { PrismaClient } from "@prisma/client";
import { encryptMessage, decryptMessage, getEncryptionVersion } from "../src/lib/encryption";

const prisma = new PrismaClient();

interface MigrationStats {
  total: number;
  v1Messages: number;
  v2Messages: number;
  plainMessages: number;
  migrated: number;
  errors: number;
}

interface MigrationOptions {
  dryRun: boolean;
  batchSize: number;
  verbose: boolean;
}

function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    dryRun: args.includes("--dry-run"),
    batchSize: 100,
    verbose: args.includes("--verbose") || args.includes("-v"),
  };

  const batchSizeArg = args.find((arg) => arg.startsWith("--batch-size="));
  if (batchSizeArg) {
    options.batchSize = parseInt(batchSizeArg.split("=")[1], 10);
  }

  return options;
}

async function analyzeMessages(): Promise<MigrationStats> {
  console.log("📊 Analyzing encrypted messages...\n");

  const messages = await prisma.chatMessage.findMany({
    select: {
      id: true,
      content: true,
      sessionId: true,
      session: {
        select: {
          userId: true,
        },
      },
    },
  });

  const stats: MigrationStats = {
    total: messages.length,
    v1Messages: 0,
    v2Messages: 0,
    plainMessages: 0,
    migrated: 0,
    errors: 0,
  };

  for (const msg of messages) {
    const version = getEncryptionVersion(msg.content);
    if (version === "v1") stats.v1Messages++;
    else if (version === "v2") stats.v2Messages++;
    else stats.plainMessages++;
  }

  console.log(`Total messages: ${stats.total}`);
  console.log(`  - V2 (secure):  ${stats.v2Messages} ✅`);
  console.log(`  - V1 (weak):    ${stats.v1Messages} ⚠️  (needs migration)`);
  console.log(`  - Plain:        ${stats.plainMessages} ⚠️  (unencrypted)`);
  console.log();

  return stats;
}

async function migrateMessages(options: MigrationOptions): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    v1Messages: 0,
    v2Messages: 0,
    plainMessages: 0,
    migrated: 0,
    errors: 0,
  };

  let skip = 0;
  const { batchSize, dryRun, verbose } = options;

  console.log(`\n🔄 Starting migration (batch size: ${batchSize})${dryRun ? " [DRY RUN]" : ""}\n`);

  while (true) {
    // Fetch batch of V1 messages
    const messages = await prisma.chatMessage.findMany({
      where: {
        content: {
          startsWith: "$enc$", // V1 prefix
        },
      },
      include: {
        session: {
          select: {
            userId: true,
          },
        },
      },
      take: batchSize,
      skip,
    });

    if (messages.length === 0) {
      break; // No more V1 messages
    }

    stats.v1Messages += messages.length;

    // Process batch
    for (const msg of messages) {
      try {
        const userId = msg.session.userId;

        // Step 1: Decrypt with V1
        const plaintext = decryptMessage(msg.content, userId);

        if (verbose) {
          console.log(`  Decrypted message ${msg.id.slice(0, 8)}... (${plaintext.slice(0, 30)}...)`);
        }

        // Step 2: Re-encrypt with V2
        const v2Content = encryptMessage(plaintext, userId);

        // Step 3: Update database
        if (!dryRun) {
          await prisma.chatMessage.update({
            where: { id: msg.id },
            data: { content: v2Content },
          });
        }

        stats.migrated++;

        if (stats.migrated % 100 === 0) {
          console.log(`  ✅ Migrated ${stats.migrated} messages...`);
        }
      } catch (error) {
        stats.errors++;
        console.error(`  ❌ Error migrating message ${msg.id}:`, error);
      }
    }

    skip += batchSize;

    // Prevent infinite loop if dry-run
    if (dryRun) {
      break;
    }
  }

  return stats;
}

async function main() {
  const options = parseArgs();

  console.log("🔒 Encryption Migration Script: V1 → V2\n");
  console.log("=" .repeat(50));
  console.log();

  if (options.dryRun) {
    console.log("⚠️  DRY RUN MODE - No changes will be made\n");
  }

  try {
    // Step 1: Analyze current state
    const analyzeStats = await analyzeMessages();

    if (analyzeStats.v1Messages === 0) {
      console.log("✅ No V1 messages found. Migration not needed!");
      return;
    }

    console.log(`\n⚠️  Found ${analyzeStats.v1Messages} messages that need migration\n`);

    if (options.dryRun) {
      console.log("Run without --dry-run to perform actual migration.");
      return;
    }

    // Confirmation (skip in CI/automated environments)
    if (process.env.CI !== "true" && !process.env.AUTO_MIGRATE) {
      console.log("⏸️  Press Ctrl+C to cancel, or wait 5 seconds to continue...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // Step 2: Migrate
    const startTime = Date.now();
    const migrateStats = await migrateMessages(options);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Step 3: Summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 Migration Summary\n");
    console.log(`Total V1 messages: ${migrateStats.v1Messages}`);
    console.log(`Successfully migrated: ${migrateStats.migrated} ✅`);
    console.log(`Errors: ${migrateStats.errors} ${migrateStats.errors > 0 ? "❌" : ""}`);
    console.log(`Duration: ${duration}s`);
    console.log();

    if (migrateStats.errors === 0 && migrateStats.migrated > 0) {
      console.log("✅ Migration completed successfully!");
      console.log("\nNext steps:");
      console.log("1. Verify all messages are readable in the app");
      console.log("2. After verification, you can safely remove V1 decryption code");
      console.log("3. Update encryption.ts to remove deriveUserKeyV1() function");
    } else if (migrateStats.errors > 0) {
      console.log("⚠️  Migration completed with errors. Please review the error messages above.");
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
