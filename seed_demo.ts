import "dotenv/config";
import { prisma } from "./src/lib/prisma.js";
import bcrypt from "bcryptjs";
import fs from "node:fs";

async function main() {
  console.log("🌱 Seeding demo accounts and data...");

  const passwordHash = await bcrypt.hash("Demo123!", 10);

  // 1. Create Users
  const users = [
    {
      username: "head_officer",
      email: "head@police.dept",
      fullName: "Head Officer John",
      badgeNumber: "BADGE-001",
      department: "Major Crimes",
      role: "admin", // Admin/Head role
    },
    {
      username: "officer_dave",
      email: "dave@police.dept",
      fullName: "Officer Dave",
      badgeNumber: "BADGE-042",
      department: "Field Ops",
      role: "officer",
    },
    {
      username: "lawyer_sarah",
      email: "sarah@lawfirm.com",
      fullName: "Sarah Defender",
      role: "lawyer", // Read-only view
    },
    {
      username: "judge_dredd",
      email: "dredd@court.gov",
      fullName: "Hon. Judge Dredd",
      role: "judge", // Read-only view
    },
  ];

  const createdUsers: Record<string, any> = {};

  for (const user of users) {
    const u = await prisma.user.upsert({
      where: { username: user.username },
      update: {},
      create: {
        ...user,
        passwordHash,
        isActive: true,
      },
    });
    createdUsers[user.username] = u;
    console.log(`✅ User created: ${user.username}`);
  }

  // 2. Create a Case
  const demoCase = await prisma.case.create({
    data: {
      title: "The Midnight Heist",
      description: "Armed robbery at Central Bank. Suspects fled in a black van.",
      status: "open",
      createdById: createdUsers["head_officer"].id,
    },
  });
  console.log(`✅ Case created: ${demoCase.title}`);

  // 3. Create a Crime Box for the Case
  // Mock keys for demo purposes
  const privateKey = "k_priv_demo_" + Math.random().toString(36).substring(7);
  const publicKey = "k_pub_demo_" + Math.random().toString(36).substring(7);

  const crimeBox = await prisma.crimeBox.create({
    data: {
      name: "Box #404 - Bank Evidence",
      caseId: demoCase.id, // Linking strictly via unique caseId field in Schema
      caseRefId: demoCase.id, // Linking via relation field
      createdById: createdUsers["head_officer"].id,
      privateKey,
      publicKey,
    },
  });
  console.log(`✅ Crime Box created: ${crimeBox.name}`);

  // 4. Create Evidence (Head Officer & Officer)
  const evidenceList = [
    {
      type: "physical",
      description: "Crowbar found at rear entrance",
      location: "Central Bank, Rear Alley",
      collectionDate: new Date(),
      status: "secured",
      collectedById: createdUsers["head_officer"].id,
      files: {
        create: {
          fileName: "crowbar_photo.jpg",
          fileSize: 1024 * 500,
          mimeType: "image/jpeg",
          sha256Hash: "hash_crowbar_" + Date.now(),
        },
      },
      tags: JSON.stringify(["weapon", "metal", "fingerprints"]),
    },
    {
      type: "digital",
      description: "CCTV Footage - 11:45 PM",
      location: "Server Room",
      collectionDate: new Date(),
      status: "analyzed",
      collectedById: createdUsers["officer_dave"].id,
      files: {
        create: {
          fileName: "cctv_footage.mp4",
          fileSize: 1024 * 1024 * 50,
          mimeType: "video/mp4",
          sha256Hash: "hash_cctv_" + Date.now(),
        },
      },
      tags: JSON.stringify(["video", "surveillance"]),
    },
    {
      type: "physical",
      description: "Black Ski Mask",
      location: "Getaway Van (recovered)",
      collectionDate: new Date(),
      status: "in-custody",
      collectedById: createdUsers["officer_dave"].id,
      files: {
        create: {
          fileName: "mask_photo.jpg",
          fileSize: 1024 * 200,
          mimeType: "image/jpeg",
          sha256Hash: "hash_mask_" + Date.now(),
        },
      },
      tags: JSON.stringify(["clothing", "dna"]),
    },
  ];

  for (const ev of evidenceList) {
    await prisma.evidence.create({
      data: {
        ...ev,
        caseId: demoCase.id,
        currentCustodianId: ev.collectedById,
      },
    });
  }
  console.log(`✅ ${evidenceList.length} Evidence items created`);

  // 5. Generate Credentials File
  const credentials = `
========================================
BLOCK EVIDENCE - DEMO CREDENTIALS
========================================

1. HEAD OFFICER (Admin/Creator)
   Username: head_officer
   Password: Demo123!
   Role: Admin - Can create boxes, cases, users.

2. OFFICER (Investigator)
   Username: officer_dave
   Password: Demo123!
   Role: Officer - Can collect evidence, view boxes.

3. LAWYER (Defense)
   Username: lawyer_sarah
   Password: Demo123!
   Role: Lawyer (Read-Only) - Can view evidence, cannot edit.

4. JUDGE (Court)
   Username: judge_dredd
   Password: Demo123!
   Role: Judge (Read-Only) - Full chain of custody view.

========================================
DEMO DATA
========================================
Case: The Midnight Heist (${demoCase.id})
Crime Box: ${crimeBox.name}
  - Public Key: ${publicKey} (For Lawyer/Judge view access)
  - Private Key: ${privateKey} (For Officer write access)

Evidence:
  1. Crowbar (Physical)
  2. CCTV Footage (Digital)
  3. Ski Mask (Physical)
`;

  console.log("\n" + credentials);

  // Also write to file for user convenience
  fs.writeFileSync('credentials.txt', credentials);
  console.log("📄 Credentials saved to credentials.txt");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
