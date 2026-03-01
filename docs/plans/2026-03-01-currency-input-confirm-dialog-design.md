# Currency Input & Confirm Dialog — Design

**Goal:** Melhorar UX com máscara de moeda em tempo real nos inputs de valor e dialog de confirmação antes de exclusões.

## 1. CurrencyInput

Componente reutilizável `src/components/ui/currency-input.tsx`:

- Recebe `value` (centavos), `onChange(cents)`, `name`, props padrão de Input
- Exibe valor formatado "R$ 1.234,56" — estilo calculadora (dígitos entram pela direita)
- Campo `<input type="hidden" name={name}>` com valor numérico para FormData
- Usado em `transaction-form.tsx` e `budget-list.tsx`

## 2. ConfirmDialog

Componente `src/components/confirm-dialog.tsx` baseado em `AlertDialog` do shadcn/ui:

- Props: `open`, `onOpenChange`, `title`, `description`, `onConfirm`, `loading?`
- Botões: "Cancelar" (outline) + "Confirmar" (destructive)
- Substitui todos os `confirm()` nativos em:
  - `transactions-list.tsx`
  - `categories-list.tsx`
  - `budget-list.tsx`
  - `household-members.tsx`
