import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { TransactionType } from "@prisma/client";

import "dotenv/config";

const DEFAULT_CATEGORIES = [
  { name: "Alimentação", icon: "utensils", color: "#ef4444", type: TransactionType.EXPENSE },
  { name: "Transporte", icon: "car", color: "#f97316", type: TransactionType.EXPENSE },
  { name: "Moradia", icon: "home", color: "#eab308", type: TransactionType.EXPENSE },
  { name: "Saúde", icon: "heart-pulse", color: "#22c55e", type: TransactionType.EXPENSE },
  { name: "Educação", icon: "graduation-cap", color: "#3b82f6", type: TransactionType.EXPENSE },
  { name: "Lazer", icon: "gamepad-2", color: "#8b5cf6", type: TransactionType.EXPENSE },
  { name: "Vestuário", icon: "shirt", color: "#ec4899", type: TransactionType.EXPENSE },
  { name: "Outros", icon: "ellipsis", color: "#6b7280", type: TransactionType.EXPENSE },
  { name: "Salário", icon: "banknote", color: "#10b981", type: TransactionType.INCOME },
  { name: "Freelance", icon: "laptop", color: "#06b6d4", type: TransactionType.INCOME },
  { name: "Investimentos", icon: "trending-up", color: "#14b8a6", type: TransactionType.INCOME },
  { name: "Outros (Receita)", icon: "plus-circle", color: "#6b7280", type: TransactionType.INCOME },
];

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TEST_EMAIL = "alice@test.com";

function d(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

async function cleanup() {
  console.log("Cleaning up test data...");
  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  if (!user) { console.log("No test user found."); return; }

  const householdId = user.householdId;
  if (householdId) {
    await prisma.splitEntry.deleteMany({ where: { transaction: { householdId } } });
    await prisma.recurringOccurrence.deleteMany({ where: { recurringTransaction: { householdId } } });
    await prisma.recurringTransaction.deleteMany({ where: { householdId } });
    await prisma.transactionTag.deleteMany({ where: { transaction: { householdId } } });
    await prisma.transaction.deleteMany({ where: { householdId } });
    await prisma.budget.deleteMany({ where: { householdId } });
    await prisma.tag.deleteMany({ where: { householdId } });
    await prisma.category.deleteMany({ where: { householdId } });
  }

  await prisma.user.delete({ where: { id: user.id } });
  if (householdId) {
    await prisma.household.delete({ where: { id: householdId } }).catch(() => {});
  }

  console.log("Done.");
}

async function seed() {
  console.log("Creating test data...\n");

  const passwordHash = await bcrypt.hash("TestPassword123", 12);

  const { alice, householdId } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email: TEST_EMAIL, name: "Alice", passwordHash } });
    const household = await tx.household.create({ data: { name: "Casa de Alice", ownerId: user.id } });
    await tx.user.update({ where: { id: user.id }, data: { householdId: household.id } });
    await tx.category.createMany({ data: DEFAULT_CATEGORIES.map((c) => ({ ...c, householdId: household.id })) });
    return { alice: user, householdId: household.id };
  });
  console.log("✓ Registered Alice (alice@test.com)\n");

  const cats = await prisma.category.findMany({ where: { householdId } });
  const cat = (name: string) => cats.find((c) => c.name === name)!;

  const incomes = [
    { desc: "Salário", amount: 850000, cat: "Salário", date: d(2026, 3, 5) },
    { desc: "Freelance website", amount: 150000, cat: "Freelance", date: d(2026, 3, 10) },
    { desc: "Dividendos FIIs", amount: 45000, cat: "Investimentos", date: d(2026, 3, 12) },
  ];
  for (const i of incomes) {
    await prisma.transaction.create({ data: { description: i.desc, amount: i.amount, type: "INCOME", date: i.date, categoryId: cat(i.cat).id, userId: alice.id, householdId } });
  }

  const expenses = [
    { desc: "Almoço restaurante", amount: 4500, cat: "Alimentação", date: d(2026, 3, 3) },
    { desc: "Uber trabalho", amount: 2800, cat: "Transporte", date: d(2026, 3, 4) },
    { desc: "Farmácia", amount: 8900, cat: "Saúde", date: d(2026, 3, 6) },
    { desc: "Livro técnico", amount: 7500, cat: "Educação", date: d(2026, 3, 7) },
    { desc: "Cinema", amount: 5000, cat: "Lazer", date: d(2026, 3, 8) },
    { desc: "Tênis corrida", amount: 35000, cat: "Vestuário", date: d(2026, 3, 9) },
    { desc: "Gasolina", amount: 18000, cat: "Transporte", date: d(2026, 3, 11) },
    { desc: "Curso online", amount: 9900, cat: "Educação", date: d(2026, 3, 13) },
    { desc: "Jantar delivery", amount: 6200, cat: "Alimentação", date: d(2026, 3, 14) },
    { desc: "Consulta médica", amount: 25000, cat: "Saúde", date: d(2026, 3, 14) },
  ];
  for (const e of expenses) {
    await prisma.transaction.create({ data: { description: e.desc, amount: e.amount, type: "EXPENSE", date: e.date, categoryId: cat(e.cat).id, userId: alice.id, householdId } });
  }

  const shared = [
    { desc: "Aluguel março", amount: 280000, cat: "Moradia", date: d(2026, 3, 1), splits: [{ name: "Bob", amount: 112000 }] },
    { desc: "Conta de luz", amount: 32000, cat: "Moradia", date: d(2026, 3, 2), splits: [{ name: "Bob", amount: 16000 }] },
    { desc: "Internet fibra", amount: 12000, cat: "Moradia", date: d(2026, 3, 2), splits: [{ name: "Bob", amount: 6000 }] },
    { desc: "Supermercado semanal", amount: 45000, cat: "Alimentação", date: d(2026, 3, 7), splits: [{ name: "Bob", amount: 18000 }] },
    { desc: "Supermercado semanal 2", amount: 38000, cat: "Alimentação", date: d(2026, 3, 14), splits: [{ name: "Bob", amount: 19000 }] },
    { desc: "Jantar casal", amount: 18000, cat: "Alimentação", date: d(2026, 3, 10), splits: [{ name: "Bob", amount: 9000 }] },
    { desc: "Produtos limpeza", amount: 8500, cat: "Outros", date: d(2026, 3, 8), splits: [{ name: "Bob", amount: 4250 }] },
    { desc: "Assinatura streaming", amount: 5500, cat: "Lazer", date: d(2026, 3, 5), splits: [{ name: "Bob", amount: 2750 }] },
  ];
  for (const s of shared) {
    const tx = await prisma.transaction.create({ data: { description: s.desc, amount: s.amount, type: "EXPENSE", date: s.date, categoryId: cat(s.cat).id, userId: alice.id, householdId } });
    await prisma.splitEntry.createMany({
      data: s.splits.map((sp) => ({ transactionId: tx.id, personName: sp.name, amount: sp.amount })),
    });
  }

  const feb = [
    { desc: "Aluguel fevereiro", amount: 280000, cat: "Moradia", date: d(2026, 2, 1), type: "EXPENSE" as const },
    { desc: "Supermercado", amount: 52000, cat: "Alimentação", date: d(2026, 2, 7), type: "EXPENSE" as const },
    { desc: "Conta de luz", amount: 28000, cat: "Moradia", date: d(2026, 2, 3), type: "EXPENSE" as const },
    { desc: "Uber", amount: 3500, cat: "Transporte", date: d(2026, 2, 10), type: "EXPENSE" as const },
    { desc: "Farmácia", amount: 4500, cat: "Saúde", date: d(2026, 2, 15), type: "EXPENSE" as const },
    { desc: "Cinema", amount: 4000, cat: "Lazer", date: d(2026, 2, 20), type: "EXPENSE" as const },
    { desc: "Salário", amount: 850000, cat: "Salário", date: d(2026, 2, 5), type: "INCOME" as const },
  ];
  for (const f of feb) {
    await prisma.transaction.create({ data: { description: f.desc, amount: f.amount, type: f.type, date: f.date, categoryId: cat(f.cat).id, userId: alice.id, householdId } });
  }

  const febSplits = [
    { desc: "Aluguel fevereiro", amount: 280000, cat: "Moradia", date: d(2026, 2, 1), splits: [{ name: "Bob", amount: 140000, paid: true }, { name: "Carol", amount: 70000, paid: false }] },
    { desc: "Supermercado fev", amount: 52000, cat: "Alimentação", date: d(2026, 2, 7), splits: [{ name: "Bob", amount: 26000, paid: false }] },
    { desc: "Conta de água fev", amount: 9500, cat: "Moradia", date: d(2026, 2, 10), splits: [{ name: "Bob", amount: 4750, paid: false }] },
  ];
  for (const s of febSplits) {
    const tx = await prisma.transaction.create({ data: { description: s.desc, amount: s.amount, type: "EXPENSE", date: s.date, categoryId: cat(s.cat).id, userId: alice.id, householdId } });
    for (const sp of s.splits) {
      await prisma.splitEntry.create({
        data: { transactionId: tx.id, personName: sp.name, amount: sp.amount, paid: sp.paid, paidAt: sp.paid ? d(2026, 2, 15) : null },
      });
    }
  }

  const jan = [
    { desc: "Jantar de aniversário", amount: 32000, cat: "Alimentação", date: d(2026, 1, 20), splits: [{ name: "Bob", amount: 16000, paid: false }, { name: "Diana", amount: 8000, paid: true }] },
  ];
  for (const j of jan) {
    const tx = await prisma.transaction.create({ data: { description: j.desc, amount: j.amount, type: "EXPENSE", date: j.date, categoryId: cat(j.cat).id, userId: alice.id, householdId } });
    for (const sp of j.splits) {
      await prisma.splitEntry.create({
        data: { transactionId: tx.id, personName: sp.name, amount: sp.amount, paid: sp.paid, paidAt: sp.paid ? d(2026, 1, 25) : null },
      });
    }
  }

  const tags = [
    { name: "Fixo", color: "#6366f1" },
    { name: "Variável", color: "#f59e0b" },
    { name: "Essencial", color: "#10b981" },
    { name: "Supérfluo", color: "#ef4444" },
  ];
  const createdTags: { id: string; name: string; color: string; householdId: string }[] = [];
  for (const tag of tags) {
    const t = await prisma.tag.create({ data: { ...tag, householdId } });
    createdTags.push(t);
  }
  const tagByName = (name: string) => createdTags.find((t) => t.name === name)!;

  const allTxs = await prisma.transaction.findMany({
    where: { householdId },
    orderBy: { date: "asc" },
  });
  const tagAssignments: { desc: string; tags: string[] }[] = [
    { desc: "Aluguel março", tags: ["Fixo", "Essencial"] },
    { desc: "Conta de luz", tags: ["Fixo", "Essencial"] },
    { desc: "Internet fibra", tags: ["Fixo", "Essencial"] },
    { desc: "Almoço restaurante", tags: ["Variável"] },
    { desc: "Cinema", tags: ["Variável", "Supérfluo"] },
    { desc: "Tênis corrida", tags: ["Supérfluo"] },
    { desc: "Assinatura streaming", tags: ["Fixo", "Supérfluo"] },
    { desc: "Salário", tags: ["Fixo"] },
    { desc: "Freelance website", tags: ["Variável"] },
    { desc: "Supermercado semanal", tags: ["Variável", "Essencial"] },
    { desc: "Farmácia", tags: ["Variável", "Essencial"] },
    { desc: "Gasolina", tags: ["Variável", "Essencial"] },
  ];
  for (const a of tagAssignments) {
    const tx = allTxs.find((t) => t.description === a.desc);
    if (!tx) continue;
    await prisma.transactionTag.createMany({
      data: a.tags.map((tagName) => ({ transactionId: tx.id, tagId: tagByName(tagName).id })),
    });
  }

  const budgets = [
    { cat: "Alimentação", amount: 80000 },
    { cat: "Transporte", amount: 25000 },
    { cat: "Moradia", amount: 350000 },
    { cat: "Saúde", amount: 30000 },
    { cat: "Lazer", amount: 15000 },
    { cat: "Vestuário", amount: 40000 },
    { cat: "Educação", amount: 20000 },
  ];
  for (const b of budgets) {
    await prisma.budget.create({
      data: { month: "2026-03", amount: b.amount, categoryId: cat(b.cat).id, householdId },
    });
  }

  const recurring = [
    { desc: "Aluguel", amount: 280000, cat: "Moradia", day: 1, installments: null },
    { desc: "Internet", amount: 12000, cat: "Moradia", day: 5, installments: null },
    { desc: "Streaming", amount: 5500, cat: "Lazer", day: 10, installments: null },
    { desc: "Tênis parcelado", amount: 210000, cat: "Vestuário", day: 15, installments: 6 },
    { desc: "Curso de inglês", amount: 180000, cat: "Educação", day: 20, installments: 12 },
  ];
  for (const r of recurring) {
    const startMonth = "2026-01";
    const endMonth = r.installments
      ? (() => {
          const [y, m] = startMonth.split("-").map(Number);
          const total = y * 12 + (m - 1) + (r.installments - 1);
          return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
        })()
      : null;

    const rec = await prisma.recurringTransaction.create({
      data: {
        description: r.desc,
        amount: r.amount,
        type: "EXPENSE",
        dayOfMonth: r.day,
        startMonth,
        endMonth,
        installments: r.installments,
        categoryId: cat(r.cat).id,
        userId: alice.id,
        householdId,
      },
    });

    const months = ["2026-01", "2026-02", "2026-03"];
    const applicableMonths = endMonth
      ? months.filter((m) => m >= startMonth && m <= endMonth)
      : months;

    for (const month of applicableMonths) {
      await prisma.recurringOccurrence.create({
        data: {
          month,
          recurringTransactionId: rec.id,
          paid: month < "2026-03",
        },
      });
    }
  }

  console.log(`✓ ${incomes.length} receitas (março)`);
  console.log(`✓ ${expenses.length} despesas individuais (março)`);
  console.log(`✓ ${shared.length} despesas compartilhadas com split pessoal (março)`);
  console.log(`✓ ${feb.length} transações (fevereiro)`);
  console.log(`✓ ${tags.length} tags + ${tagAssignments.length} associações`);
  console.log(`✓ ${budgets.length} orçamentos (março)`);
  console.log(`✓ ${recurring.length} recorrências com ocorrências`);
  console.log("\nCredenciais:");
  console.log("  alice@test.com / TestPassword123");
}

const isCleanup = process.argv.includes("--cleanup");

(isCleanup ? cleanup() : seed())
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
