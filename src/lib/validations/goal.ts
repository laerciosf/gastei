import { z } from "zod/v4";

export const goalSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(["SAVINGS", "SPENDING"]),
  targetAmount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Valor deve ser maior que zero"),
  targetDate: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

export const goalEntrySchema = z.object({
  amount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Valor deve ser maior que zero"),
  type: z.enum(["deposit", "withdrawal"]),
  goalId: z.string().min(1, "Meta é obrigatória"),
  note: z.string().max(200, "Nota deve ter no máximo 200 caracteres").optional(),
});

export type GoalInput = z.infer<typeof goalSchema>;
export type GoalEntryInput = z.infer<typeof goalEntrySchema>;
