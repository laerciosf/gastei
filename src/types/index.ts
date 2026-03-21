export type TransactionType = "INCOME" | "EXPENSE";

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: TransactionType;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  date: string | Date;
  categoryId: string;
  category: Pick<Category, "id" | "name" | "icon" | "color">;
  user: { name: string | null };
  tags?: { tag: Tag }[];
}

export interface Budget {
  id: string;
  month: string;
  amount: number;
  categoryId: string;
  category: Pick<Category, "id" | "name" | "type">;
  spent?: number;
}

export interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  dayOfMonth: number | null;
  startMonth: string;
  endMonth: string | null;
  installments: number | null;
  active: boolean;
  categoryId: string;
  category: Pick<Category, "id" | "name" | "type" | "color">;
  user: { name: string | null };
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface TagSummary {
  tagId: string;
  tagName: string;
  tagColor: string;
  totalIncome: number;
  totalExpense: number;
}

export interface Insight {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  currentAmount: number;
  previousAmount: number;
  averageAmount: number;
  deltaMonth: number;
  deltaTrend: number;
  type: "increase" | "decrease" | "new" | "gone";
  transactionType: TransactionType;
}

export interface SplitEntry {
  id: string;
  personName: string;
  amount: number;
  paid: boolean;
  paidAt: Date | null;
}

export type GoalType = "SAVINGS" | "SPENDING";

export interface SavingsGoal {
  id: string;
  name: string;
  type: GoalType;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | Date | null;
  icon: string;
  color: string;
  user: { name: string | null };
}

export interface GoalEntry {
  id: string;
  amount: number;
  note: string | null;
  createdAt: string | Date;
}
