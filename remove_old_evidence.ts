import "dotenv/config";
import { prisma } from "./src/lib/prisma.js";

async function main() {
  console.log("🧹 Cleaning up old evidence...");

  // 1. Find the "The Midnight Heist" case
  const heistCase = await prisma.case.findFirst({
    where: { title: "The Midnight Heist" },
  });

  if (!heistCase) {
    console.error("❌ 'The Midnight Heist' case not found. Aborting to prevent accidental data loss.");
    return;
  }

  console.log(`✅ Found 'The Midnight Heist' case (ID: ${heistCase.id})`);

  // 2. Count evidence to be deleted
  const count = await prisma.evidence.count({
    where: {
      caseId: { not: heistCase.id },
    },
  });

  if (count === 0) {
    console.log("✨ No other evidence found to delete.");
    return;
  }

  console.log(`⚠️ Found ${count} evidence items NOT belonging to 'The Midnight Heist'.`);

  // 3. Delete them
  // Note: We need to delete related records first if cascade delete isn't set up in schema
  // But usually AccessLog, EvidenceFile, etc. are handled or we delete evidence directly.
  // Prisma handles cascade if configured in @relation(onDelete: Cascade).
  // Let's check schema... schema doesn't show explicit onDelete: Cascade for all relations.
  // So we might need to delete related data manually or rely on DB integrity.
  // Actually, let's try deleting evidence and catch error if it fails due to foreign keys.

  // To be safe, let's delete strictly where caseId != heistCase.id

  // We should also delete files, logs, etc. for these evidence items.
  const evidenceToDelete = await prisma.evidence.findMany({
    where: { caseId: { not: heistCase.id } },
    select: { id: true }
  });

  const ids = evidenceToDelete.map(e => e.id);

  if (ids.length > 0) {
    // Delete related tables first (reverse order of dependency)
    await prisma.evidenceFile.deleteMany({ where: { evidenceId: { in: ids } } });
    await prisma.accessLog.deleteMany({ where: { evidenceId: { in: ids } } });
    await prisma.evidenceComment.deleteMany({ where: { evidenceId: { in: ids } } });
    await prisma.evidenceAccessRequest.deleteMany({ where: { evidenceId: { in: ids } } });
    await prisma.labResult.deleteMany({ where: { evidenceId: { in: ids } } });
    await prisma.custodyEvent.deleteMany({ where: { evidenceId: { in: ids } } });

    // Finally delete evidence
    const deleteResult = await prisma.evidence.deleteMany({
      where: {
        id: { in: ids },
      },
    });
    console.log(`🗑️ Deleted ${deleteResult.count} evidence items.`);
  }

  // Also verify if there are any other Cases (optional, user said "except the evidences of the midnight heist")
  // User didn't explicitly say delete other CASES, just EVIDENCES.
  // But usually orphan cases are bad. I'll stick to deleting EVIDENCE as requested.

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
