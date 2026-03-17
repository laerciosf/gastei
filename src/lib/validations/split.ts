import { z } from "zod/v4";

export const splitEntrySchema = z.object({
  personName: z.string().min(1, "Nome obrigatório"),
  amount: z.coerce.number().int().min(1, "Valor deve ser maior que zero"),
});

export const splitEntriesSchema = z.array(splitEntrySchema).min(1, "Mínimo 1 pessoa para dividir");

export type SplitEntryInput = z.infer<typeof splitEntrySchema>;
