import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {Icon && (
        <div className={cn(
          'p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] mb-5',
          'transition-transform duration-300'
        )}>
          <Icon className="w-8 h-8 text-slate-500" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-white mb-1.5 tracking-tight">{title}</h3>
      {description && (
        <p className="text-sm text-slate-400 max-w-sm leading-relaxed mb-5">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
