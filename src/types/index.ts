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
  dayOfMonth: number;
  startMonth: string;
  endMonth: string | null;
  active: boolean;
  categoryId: string;
  category: Pick<Category, "id" | "name" | "type" | "color">;
  user: { name: string | null };
}

export interface HouseholdMember {
  id: string;
  name: string | null;
  email: string;
}

export interface HouseholdInvite {
  id: string;
  status: string;
  createdAt: Date;
  expiresAt: Date;
  invitee: { name: string | null; email: string };
  inviter: { name: string | null };
  household: { name: string };
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
