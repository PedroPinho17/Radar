'use client';

import { useEffect, useState } from 'react';
import { CheckIcon, InboxIcon } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Item = {
  id: string;
  type: 'bug' | 'oferta' | 'sugestao' | 'outro';
  message: string;
  page: string | null;
  email: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

const TYPE: Record<Item['type'], { label: string; cls: string }> = {
  bug: { label: 'Erro', cls: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300' },
  oferta: { label: 'Oferta mal avaliada', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' },
  sugestao: { label: 'Sugestão', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300' },
  outro: { label: 'Outro', cls: 'bg-muted text-muted-foreground' },
};

/** O que os utilizadores reportaram (só admins). */
export function FeedbackList() {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    api<Item[]>('/feedback').then(setItems).catch(() => setItems([]));
  }, []);

  async function resolve(id: string) {
    try {
      await api(`/feedback/${id}/resolve`, { method: 'POST' });
      setItems((all) => all?.map((f) => (f.id === id ? { ...f, resolvedAt: new Date().toISOString() } : f)) ?? null);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const open = items?.filter((f) => !f.resolvedAt).length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-semibold">Reportado pelos utilizadores {open > 0 && <span className="ml-1 text-sm font-normal text-muted-foreground">({open} por resolver)</span>}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        {items === null && <p className="py-3 text-sm text-muted-foreground">A carregar…</p>}
        {items?.length === 0 && (
          <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><InboxIcon className="size-4" /> Ainda ninguém reportou nada.</p>
        )}
        {items?.map((f) => (
          <div key={f.id} className={cn('space-y-1.5 py-3', f.resolvedAt && 'opacity-50')}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge className={TYPE[f.type].cls}>{TYPE[f.type].label}</Badge>
              <span className="text-muted-foreground">
                {f.email ?? 'conta apagada'} · {new Date(f.createdAt).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                {f.page && ` · ${f.page}`}
              </span>
              <span className="ml-auto">
                {f.resolvedAt
                  ? <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckIcon className="size-3.5" /> Resolvido</span>
                  : <Button size="xs" variant="outline" onClick={() => resolve(f.id)}>Marcar como resolvido</Button>}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{f.message}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
