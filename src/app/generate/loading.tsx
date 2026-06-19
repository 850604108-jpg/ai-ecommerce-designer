import { Skeleton } from "@/components/ui/skeleton";

export default function GenerateLoading() {
  return (
    <section className="space-y-6" aria-label="Loading generator">
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-44" />
      </div>
      <div className="rounded-lg border bg-card p-6">
        <Skeleton className="h-56 w-full" />
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      </div>
    </section>
  );
}
