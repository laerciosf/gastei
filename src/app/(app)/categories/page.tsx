import { getCategories } from "@/lib/actions/categories";
import { CategoriesList } from "@/components/categories-list";

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold">Categorias</h2>
      <CategoriesList categories={categories} />
    </div>
  );
}
