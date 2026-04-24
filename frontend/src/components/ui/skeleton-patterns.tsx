/**
 * Composition patterns on top of the base <Skeleton> primitive.
 *
 * Each pattern represents a shape reused across UX-1 surfaces. Use these
 * inside <Suspense fallback={...}> for async RSC children, or inside
 * presentation components when envelope.status === 'unavailable'.
 *
 * Scope: UX-1 Phase 1a. Add more patterns as later phases need them.
 */

import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';

export function SkeletonRow({ className }: { className?: string }) {
  return <Skeleton className={cn('h-4 w-full', className)} />;
}

export function SkeletonCard({ className }: { className?: string }) {
  return <Skeleton className={cn('h-32 w-full rounded-lg', className)} />;
}

interface SkeletonListProps {
  count: number;
  itemShape?: 'row' | 'card';
  className?: string;
}

export function SkeletonList({ count, itemShape = 'row', className }: SkeletonListProps) {
  const Item = itemShape === 'card' ? SkeletonCard : SkeletonRow;
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Item key={i} />
      ))}
    </div>
  );
}

export function SkeletonHero({ className }: { className?: string }) {
  // Hero strip shape: large score number + delta badge + regime badge + button.
  return (
    <div className={cn('flex items-center justify-between gap-4 p-6', className)}>
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-32" />
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-10 w-32 rounded-md" />
    </div>
  );
}

export function SkeletonForm({ fieldCount = 3, className }: { fieldCount?: number; className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: fieldCount }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}
