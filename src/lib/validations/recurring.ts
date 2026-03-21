import { z } from "zod/v4";

export const recurringSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória").max(200),
  amount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Valor deve ser maior que zero"),
  type: z.enum(["INCOME", "EXPENSE"]),
  categoryId: z.string().min(1, "Categoria é obrigatória"),
  dayOfMonth: z.coerce.number().int().min(1, "Dia deve ser entre 1 e 28").max(28, "Dia deve ser entre 1 e 28").optional().or(z.literal("").transform(() => undefined)),
  installments: z.coerce.number().int().min(2, "Mínimo 2 parcelas").max(48, "Máximo 48 parcelas").optional().or(z.literal("").transform(() => undefined)),
});

export type RecurringInput = z.infer<typeof recurringSchema>;
