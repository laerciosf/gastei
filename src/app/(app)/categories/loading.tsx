import { Skeleton } from "@/components/ui/skeleton";

export default function CategoriesLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-9 w-40" />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="h-6 w-24" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
        <div className="space-y-3">
          <Skeleton className="h-6 w-24" />
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
