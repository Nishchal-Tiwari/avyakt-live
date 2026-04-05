import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "demo123";

async function main() {
  const hashed = await bcrypt.hash(DEMO_PASSWORD, 12);

  const teacher = await prisma.user.upsert({
    where: { email: "teacher@yoga.demo" },
    update: { password: hashed },
    create: {
      email: "teacher@yoga.demo",
      password: hashed,
      role: "TEACHER",
      name: "Demo Teacher",
    },
  });

  const student = await prisma.user.upsert({
    where: { email: "student@yoga.demo" },
    update: { password: hashed },
    create: {
      email: "student@yoga.demo",
      password: hashed,
      role: "STUDENT",
      name: "Demo Student",
    },
  });

  const extraStudents: { id: string; email: string; name: string }[] = [];
  for (let n = 1; n <= 6; n++) {
    const id = `student${n}`;
    const row = await prisma.user.upsert({
      where: { id },
      update: { password: hashed },
      create: {
        id,
        email: `student${n}@yoga.demo`,
        password: hashed,
        role: "STUDENT",
        name: `Student ${n}`,
      },
    });
    extraStudents.push({ id: row.id, email: row.email, name: row.name ?? `Student ${n}` });
  }

  const testClass = await prisma.class.upsert({
    where: { roomName: "test-class" },
    update: {},
    create: {
      name: "Test Class",
      description: "Demo class for teacher",
      teacherId: teacher.id,
      roomName: "test-class",
    },
  });

  const allStudents = [student, ...extraStudents];
  for (const s of allStudents) {
    await prisma.classInvite.upsert({
      where: {
        classId_email: { classId: testClass.id, email: s.email },
      },
      update: {},
      create: {
        classId: testClass.id,
        email: s.email,
        invitedBy: teacher.id,
      },
    });
  }

  console.log("Demo users ready:");
  console.log("  Teacher:", teacher.email, "| password:", DEMO_PASSWORD);
  console.log("  Student:", student.email, "| password:", DEMO_PASSWORD);
  for (const s of extraStudents) {
    console.log(`  ${s.id}:`, s.email, "| password:", DEMO_PASSWORD);
  }
  console.log(`  Test Class: ${testClass.name} (Room: ${testClass.roomName}) - Seeded with ${allStudents.length} invites`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
