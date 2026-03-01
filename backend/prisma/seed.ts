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

  console.log("Demo users ready:");
  console.log("  Teacher:", teacher.email, "| password:", DEMO_PASSWORD);
  console.log("  Student:", student.email, "| password:", DEMO_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
