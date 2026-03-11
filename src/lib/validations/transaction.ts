import { z } from "zod/v4";

export const transactionSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória").max(200),
  amount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Valor deve ser maior que zero"),
  type: z.enum(["INCOME", "EXPENSE"]),
  categoryId: z.string().min(1, "Categoria é obrigatória"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  tagIds: z.array(z.string().min(1)).max(2).optional(),
});

export type TransactionInput = z.infer<typeof transactionSchema>;
