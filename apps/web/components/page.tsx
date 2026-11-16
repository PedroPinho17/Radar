import { cn } from '@/lib/utils';

export function PageHeader({ title, description, action }: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10" aria-hidden>
      <div className="h-5 w-1/3 rounded bg-muted" />
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={cn('h-3.5 rounded bg-muted', i % 2 ? 'w-2/3' : 'w-5/6')} />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center">
      <span className="rounded-full bg-muted p-3 text-muted-foreground"><Icon className="size-6" /></span>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Abas tipo "segmented control" com contador. */
export function Tabs<T extends string>({ value, onChange, tabs, label }: {
  value: T;
  onChange: (v: T) => void;
  tabs: { id: T; label: string; count?: number }[];
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all',
            value === t.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cn('rounded-full px-1.5 text-xs tabular-nums', value === t.id ? 'bg-primary/10 text-primary' : 'bg-background/60')}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
