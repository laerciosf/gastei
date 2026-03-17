import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const user = await prisma.user.findFirst({ where: { email: "alice@test.com" } });
  if (!user?.householdId) { console.log("No user/household"); return; }

  const householdId = user.householdId;
  const startDate = new Date(Date.UTC(2026, 2, 1));
  const endDate = new Date(Date.UTC(2026, 3, 1));

  console.log("=== Current month query ===");
  try {
    const currentMonthTx = await prisma.transaction.findMany({
      where: { householdId, date: { gte: startDate, lt: endDate }, splitEntries: { some: {} } },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        user: { select: { name: true } },
        splitEntries: {
          select: { id: true, personName: true, amount: true, paid: true, paidAt: true },
          orderBy: { personName: "asc" },
        },
      },
      orderBy: { date: "desc" },
    });
    console.log("OK -", currentMonthTx.length, "transactions");
  } catch (e) {
    console.error("FAILED:", e);
  }

  console.log("\n=== Carry-over query ===");
  try {
    const carryOverTx = await prisma.transaction.findMany({
      where: { householdId, date: { lt: startDate }, splitEntries: { some: { paid: false } } },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        user: { select: { name: true } },
        splitEntries: {
          select: { id: true, personName: true, amount: true, paid: true, paidAt: true },
          where: { paid: false },
          orderBy: { personName: "asc" },
        },
      },
      orderBy: { date: "desc" },
    });
    console.log("OK -", carryOverTx.length, "transactions");
    for (const tx of carryOverTx) {
      console.log(" ", tx.description, "| entries:", tx.splitEntries.length);
    }
  } catch (e) {
    console.error("FAILED:", e);
  }

  console.log("\n=== Carry-over paid aggregate ===");
  try {
    const paidFromPrevious = await prisma.splitEntry.aggregate({
      where: {
        paid: true,
        paidAt: { gte: startDate, lt: endDate },
        transaction: { householdId, date: { lt: startDate } },
      },
      _sum: { amount: true },
    });
    console.log("OK - amount:", paidFromPrevious._sum.amount);
  } catch (e) {
    console.error("FAILED:", e);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
