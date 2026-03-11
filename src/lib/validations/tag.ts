import { z } from "zod/v4";

export const tagSchema = z.object({
  name: z
    .string()
    .transform((s) => s.trim().toLowerCase())
    .pipe(z.string().min(1, "Nome é obrigatório").max(30, "Nome muito longo")),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida"),
});

export type TagInput = z.infer<typeof tagSchema>;
