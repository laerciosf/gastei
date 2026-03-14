import { z } from "zod/v4";

export const splitShareSchema = z.object({
  userId: z.string().min(1, "Membro obrigatório"),
  amount: z.coerce.number().int().min(1, "Valor deve ser maior que zero"),
});

export const splitSchema = z.array(splitShareSchema).min(2, "Mínimo 2 membros para dividir");

export const settlementSchema = z.object({
  toUserId: z.string().min(1, "Membro obrigatório"),
  amount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Valor deve ser maior que zero"),
});

export const defaultSplitRatioSchema = z
  .record(z.string(), z.coerce.number().int().min(0))
  .refine((obj) => {
    const values = Object.values(obj);
    return values.length >= 2 && values.reduce((a, b) => a + b, 0) === 100;
  }, "Proporções devem somar 100%");

export type SplitShareInput = z.infer<typeof splitShareSchema>;
export type SettlementInput = z.infer<typeof settlementSchema>;
