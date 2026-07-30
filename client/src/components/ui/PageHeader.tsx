import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
  icon?: LucideIcon;
}

export default function PageHeader({ title, description, action, breadcrumb, icon: Icon }: PageHeaderProps) {
  return (
    <div className="animate-slide-up">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="flex mb-3" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            {breadcrumb.map((item, index) => (
              <li key={index} className="flex items-center">
                {index > 0 && <span className="text-slate-600 mx-2">/</span>}
                {item.href ? (
                  <a href={item.href} className="text-xs text-slate-500 hover:text-white transition-colors">
                    {item.label}
                  </a>
                ) : (
                  <span className="text-xs text-slate-400 font-medium">{item.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="p-2 rounded-xl bg-white/[0.06] border border-white/[0.08]">
              <Icon className="w-5 h-5 text-indigo-400" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
            {description && <p className="mt-1 text-sm text-slate-400 leading-relaxed max-w-2xl">{description}</p>}
          </div>
        </div>
        {action && <div className="flex items-center gap-3 pt-1">{action}</div>}
      </div>
    </div>
  );
}
