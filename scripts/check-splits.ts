import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const entries = await prisma.splitEntry.findMany({
    include: { transaction: { select: { description: true, date: true, householdId: true } } },
  });
  console.log("Split entries:", entries.length);
  for (const e of entries) {
    console.log(
      e.transaction.date.toISOString().slice(0, 10),
      "|", e.transaction.description,
      "|", e.personName,
      "|", e.amount,
      "| paid:", e.paid,
    );
  }

  const user = await prisma.user.findFirst({ where: { email: "alice@test.com" } });
  console.log("\nUser householdId:", user?.householdId);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
