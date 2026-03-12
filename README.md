# Gastei

Aplicativo de finanças pessoais com suporte a households (famílias/grupos). Controle receitas, despesas, orçamentos e transações recorrentes de forma colaborativa.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Server Actions)
- **Banco:** PostgreSQL + Prisma 7
- **Auth:** NextAuth v5
- **UI:** shadcn/ui + Tailwind CSS v4 + Recharts
- **Validação:** Zod v4
- **Testes:** Vitest + Testing Library

## Roadmap

- [x] Autenticação com email/senha
- [x] Households — convide membros para gerenciar finanças juntos
- [x] Transações (receitas e despesas) com categorias e paginação
- [x] Transações recorrentes com controle de ocorrências
- [x] Orçamentos mensais por categoria
- [x] Dashboard com resumo mensal, gráfico de categorias e transações recentes
- [x] Insights automáticos — variações mês a mês e tendências por categoria
- [x] Tags em transações (max 2) — autocomplete, cor personalizada, filtro e resumo por tag
- [x] Gráfico anual comparativo no dashboard
- [x] Gerenciamento de tags e categorias
- [x] Tema claro/escuro
- [ ] Metas de economia (savings goals) com progresso visual
- [ ] Transações parceladas (installments) — suporte a compras no cartão
- [ ] Importação de extrato bancário (CSV/OFX)
- [ ] Relatórios e exportação (PDF/CSV) — evolução mensal, comparativos
- [ ] Contas/carteiras (accounts) — separar por banco, cartão, carteira
- [ ] Notificações e alertas de orçamento (80%/100% do limite)
- [ ] Anexos em transações (comprovantes, notas fiscais)
- [ ] Divisão de despesas entre membros do household (split)

## Getting Started

```bash
# Instalar dependências
pnpm install

# Configurar banco de dados
cp .env.example .env
npx prisma migrate dev

# Rodar servidor de desenvolvimento
pnpm dev
```

O app roda em [http://localhost:5000](http://localhost:5000).

## Testes

```bash
pnpm test        # watch mode
pnpm test:run    # single run
```
