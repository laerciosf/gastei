import { z } from "zod/v4";

export const transactionSchema = z.object({
  description: z.string().min(1, "Descricao e obrigatoria").max(200),
  amount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Valor deve ser maior que zero"),
  type: z.enum(["INCOME", "EXPENSE"]),
  categoryId: z.string().min(1, "Categoria e obrigatoria"),
  date: z.string().min(1, "Data e obrigatoria"),
});

export type TransactionInput = z.infer<typeof transactionSchema>;
