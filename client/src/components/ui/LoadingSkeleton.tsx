import { cn } from '../../lib/utils';

export default function LoadingSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={cn(
      'animate-pulse rounded-2xl bg-white/[0.03] border border-white/[0.08]',
      'overflow-hidden relative',
      className
    )}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer" />
      <div className="space-y-3 p-6">
        <div className="h-4 bg-white/5 rounded-lg w-3/4" />
        <div className="h-3 bg-white/5 rounded-lg w-1/2" />
        <div className="h-3 bg-white/5 rounded-lg w-5/6" />
      </div>
    </div>
  );
}
