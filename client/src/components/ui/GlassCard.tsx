import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export default function GlassCard({ children, className = '', hover = false, onClick, style }: GlassCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl',
        'transition-all duration-300 ease-out',
        'shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]',
        hover && 'hover:bg-white/[0.06] hover:border-white/[0.12] hover:shadow-[0_8px_30px_-12px_rgba(99,102,241,0.15)] hover:-translate-y-0.5 cursor-pointer',
        className
      )}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  );
}
