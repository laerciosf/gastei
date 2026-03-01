"use client";

import { useState } from "react";
import { Trash2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CategoryForm } from "@/components/category-form";
import { deleteCategory } from "@/lib/actions/categories";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: string;
}

export function CategoriesList({ categories }: { categories: Category[] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

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

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;
    const result = await deleteCategory(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Categoria excluída");
    }
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
          <Button variant="ghost" size="icon" onClick={() => handleDelete(category.id)}>
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
          {expenseCategories.map(renderCategory)}
        </div>
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">
            Receitas <Badge variant="secondary">{incomeCategories.length}</Badge>
          </h3>
          {incomeCategories.map(renderCategory)}
        </div>
      </div>

      <CategoryForm open={formOpen} onOpenChange={setFormOpen} category={editing} />
    </>
  );
}
