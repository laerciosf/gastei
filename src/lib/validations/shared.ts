export function validateTransactionFormData(formData: FormData): string | null {
  const description = formData.get("description") as string;
  if (!description?.trim()) return "Descrição é obrigatória";

  const amount = formData.get("amount") as string;
  if (!amount || parseFloat(amount) <= 0) return "Valor deve ser maior que zero";

  const categoryId = formData.get("categoryId") as string;
  if (!categoryId) return "Selecione uma categoria";

  return null;
}
