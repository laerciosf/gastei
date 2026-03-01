export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function parseCurrency(value: string): number {
  const num = parseFloat(value);
  return Math.round(num * 100);
}
