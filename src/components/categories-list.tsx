"use client";

import { useState } from "react";
import { Trash2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CategoryForm } from "@/components/category-form";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteCategory } from "@/lib/actions/categories";
import { useDeleteAction } from "@/hooks/use-delete-action";
import type { Category } from "@/types";

export function CategoriesList({ categories }: { categories: Category[] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const { deleteId, setDeleteId, deleting, handleDelete } = useDeleteAction(deleteCategory);

  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");
  const incomeCategories = categories.filter((c) => c.type === "INCOME");

  function handleEdit(category: Category) {
    setEditing(category);
    setFormOpen(true);
  }

  function handleNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function renderCategory(category: Category) {
    return (
      <div key={category.id} className="flex items-center justify-between rounded-md border p-3">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-full" style={{ backgroundColor: category.color }} />
          <span className="font-medium">{category.name}</span>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => handleEdit(category)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteId(category.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Button onClick={handleNew}>
        <Plus className="mr-2 h-4 w-4" />
        Nova Categoria
      </Button>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">
            Despesas <Badge variant="secondary">{expenseCategories.length}</Badge>
          </h3>
          {expenseCategories.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">Nenhuma categoria de despesa</p>
          )}
          {expenseCategories.map(renderCategory)}
        </div>
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">
            Receitas <Badge variant="secondary">{incomeCategories.length}</Badge>
          </h3>
          {incomeCategories.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">Nenhuma categoria de receita</p>
          )}
          {incomeCategories.map(renderCategory)}
        </div>
      </div>

      <CategoryForm open={formOpen} onOpenChange={setFormOpen} category={editing} />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir categoria"
        description="Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita."
        onConfirm={handleDelete}
        loading={deleting}
      />
    </>
  );
}
