import { Card, Skeleton } from "./ui";

/**
 * Stands in for the bill summary while the portal is answering, which takes a few
 * seconds. Shaped like the card it replaces so the page does not jump when the
 * real content lands.
 */
export function BillSummarySkeleton() {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="w-full">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-5 w-full" />
          <Skeleton className="mt-2 h-5 w-2/3" />
        </div>
      </div>

      <Skeleton className="mt-6 h-20 w-full rounded-2xl" />

      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index}>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-4 w-24" />
          </div>
        ))}
      </div>
    </Card>
  );
}
