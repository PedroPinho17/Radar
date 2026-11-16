'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangleIcon, BuildingIcon, ExternalLinkIcon, Loader2Icon, MapPinIcon, SendIcon } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { safeUrl } from '@/lib/url';
import type { Application, AppStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { CardSkeleton, EmptyState, PageHeader, Tabs } from '@/components/page';

const STATUS: Record<AppStatus, string> = {
  applied: 'Enviada',
  interview: 'Entrevista',
  offer: 'Proposta',
  accepted: 'Aceite',
  rejected: 'Rejeitada',
  withdrawn: 'Desisti',
};
const STATUS_STYLE: Record<AppStatus, string> = {
  applied: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  interview: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  offer: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  accepted: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  withdrawn: 'bg-muted text-muted-foreground',
};
const OPEN: AppStatus[] = ['applied', 'interview', 'offer'];

const date = (s: string) => new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });

function AppCard({ app, onChange }: { app: Application; onChange: (a: Application) => void }) {
  const [status, setStatus] = useState<AppStatus>(app.status);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const url = safeUrl(app.job.url);
  const unchanged = status === app.status && !note.trim();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await api<Application>(`/applications/${app.id}/status`, {
        method: 'POST',
        json: { status, note: note.trim() || undefined },
      });
      onChange({ ...saved, stale: false });
      setNote('');
      toast.success('Candidatura atualizada.');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={cn(app.stale && 'ring-amber-500/40')}>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <CardTitle className="text-lg leading-snug font-semibold">
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer" className="group inline-flex items-start gap-1.5 hover:text-primary">
                {app.job.title}
                <ExternalLinkIcon className="mt-1 size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
              </a>
            ) : app.job.title}
          </CardTitle>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><BuildingIcon className="size-3.5" />{app.job.company}</span>
            {app.job.location && <span className="flex items-center gap-1"><MapPinIcon className="size-3.5" />{app.job.location}</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge className={STATUS_STYLE[app.status]}>{STATUS[app.status]}</Badge>
          {app.stale && (
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              <AlertTriangleIcon /> Parada há +14 dias
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <ol className="relative space-y-3 border-l-2 border-muted pl-5 text-sm">
          {app.events.map((ev, i) => (
            <li key={ev.id} className="relative">
              <span className={cn(
                'absolute top-1.5 -left-[1.69rem] size-2.5 rounded-full ring-4 ring-card',
                i === app.events.length - 1 ? 'bg-primary' : 'bg-muted-foreground/40',
              )} />
              <span className="font-medium">{STATUS[ev.status]}</span>
              <span className="text-muted-foreground"> · {date(ev.createdAt)}</span>
              {ev.note && <p className="text-muted-foreground">{ev.note}</p>}
            </li>
          ))}
        </ol>

        <form onSubmit={save} className="flex flex-wrap gap-2 border-t pt-4">
          <NativeSelect aria-label="Estado" className="w-40" value={status} onChange={(e) => setStatus(e.target.value as AppStatus)}>
            {Object.entries(STATUS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </NativeSelect>
          <Input
            className="h-10 min-w-48 flex-1"
            placeholder="Nota (ex.: entrevista dia 20 às 10h)"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button type="submit" size="lg" className="h-10" disabled={busy || unchanged}>
            {busy && <Loader2Icon className="animate-spin" />} Atualizar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function CandidaturasPage() {
  const [apps, setApps] = useState<Application[] | null>(null);
  const [tab, setTab] = useState<'open' | 'closed'>('open');

  useEffect(() => {
    api<Application[]>('/applications').then(setApps).catch((err) => toast.error(err.message));
  }, []);

  const update = (a: Application) => setApps((all) => all?.map((x) => (x.id === a.id ? a : x)) ?? null);
  const isOpen = (a: Application) => OPEN.includes(a.status);
  const visible = apps?.filter((a) => (tab === 'open' ? isOpen(a) : !isOpen(a))) ?? [];
  const staleCount = apps?.filter((a) => a.stale).length ?? 0;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Candidaturas"
        description={staleCount ? `${staleCount} sem novidades há mais de 2 semanas: talvez seja hora de um follow-up.` : 'Acompanha cada candidatura até ao fim.'}
      />
      <Tabs
        label="Filtrar candidaturas"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'open', label: 'Em curso', count: apps?.filter(isOpen).length ?? 0 },
          { id: 'closed', label: 'Terminadas', count: apps?.filter((a) => !isOpen(a)).length ?? 0 },
        ]}
      />

      {apps === null ? (
        <div className="space-y-4"><CardSkeleton /><CardSkeleton /></div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={SendIcon}
          title={tab === 'open' ? 'Sem candidaturas em curso' : 'Nenhuma candidatura terminada'}
          description={tab === 'open' ? 'Quando carregares em “Candidatei-me” numa oferta, ela aparece aqui.' : undefined}
          action={tab === 'open' ? <Button variant="outline" asChild><Link href="/">Ver ofertas</Link></Button> : undefined}
        />
      ) : (
        <div className="space-y-4">
          {visible.map((a) => <AppCard key={a.id} app={a} onChange={update} />)}
        </div>
      )}
    </main>
  );
}
