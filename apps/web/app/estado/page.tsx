'use client';

import { useCallback, useEffect, useState } from 'react';
import { ActivityIcon, CircleAlertIcon, CircleCheckIcon, CircleDashedIcon, RefreshCwIcon } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CardSkeleton, EmptyState, PageHeader } from '@/components/page';
import { FeedbackList } from '@/components/feedback-list';

type Check = { lastOkAt: string | null; lastErrorAt: string | null; lastError: string | null; failures: number };
type Source = { ok: boolean; lastCount: number | null; lastOkAt: string | null; lastErrorAt: string | null; lastError: string | null; consecutiveFailures: number };
type Details = {
  status: 'ok' | 'degraded';
  database: 'ok' | 'down';
  startedAt: string;
  uptimeSeconds: number;
  alertsTo: string;
  lastSyncAt: string | null;
  sources: Record<string, Source>;
  mail: Check;
  ai: Check;
  digest: { lastRunAt: string | null; sent: number; skipped: number; failed: number; lastError: string | null };
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

type State = 'ok' | 'warn' | 'soft' | 'unknown';

function Status({ state }: { state: State }) {
  const map = {
    ok: { icon: CircleCheckIcon, cls: 'text-green-600 dark:text-green-400', label: 'A funcionar' },
    warn: { icon: CircleAlertIcon, cls: 'text-red-600 dark:text-red-400', label: 'Com problemas' },
    soft: { icon: CircleAlertIcon, cls: 'text-amber-600 dark:text-amber-400', label: 'Falhou uma vez' },
    unknown: { icon: CircleDashedIcon, cls: 'text-muted-foreground', label: 'Sem dados ainda' },
  }[state];
  const Icon = map.icon;
  return <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', map.cls)}><Icon className="size-4" /> {map.label}</span>;
}

const checkState = (c: Check): State => (c.failures > 0 ? 'warn' : c.lastOkAt ? 'ok' : 'unknown');

function Row({ name, state, detail, error }: { name: string; state: State; detail: string; error?: string | null }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3">
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium">{name}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
        {(state === 'warn' || state === 'soft') && error && (
          <p className={cn('text-sm break-words', state === 'warn' ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-400')}>{error}</p>
        )}
      </div>
      <Status state={state} />
    </div>
  );
}

export default function EstadoPage() {
  const [data, setData] = useState<Details | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api<Details>('/health/details'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setDenied(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // carga inicial sem mexer no "loading" (só o botão Atualizar o mostra)
    api<Details>('/health/details').then(setData).catch((err) => {
      if (err instanceof ApiError && err.status === 404) setDenied(true);
    });
    const t = setInterval(load, 60_000); // atualiza sozinho a cada minuto
    return () => clearInterval(t);
  }, [load]);

  if (denied) {
    return (
      <main className="mx-auto max-w-4xl p-4 md:p-8">
        <EmptyState icon={ActivityIcon} title="Sem acesso" description="Esta página é só para quem gere o Radar." />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Estado do sistema"
        description={data ? `Ligado desde ${when(data.startedAt)} · alertas por email: ${data.alertsTo}` : 'A verificar…'}
        action={<Button variant="outline" onClick={load} disabled={loading}><RefreshCwIcon className={cn(loading && 'animate-spin')} /> Atualizar</Button>}
      />
      {!data ? <CardSkeleton lines={6} /> : (
        <>
          <div className={cn(
            'flex items-center gap-3 rounded-xl p-4 ring-1',
            data.status === 'ok' && data.database === 'ok'
              ? 'bg-green-50 ring-green-600/20 dark:bg-green-500/10'
              : 'bg-red-50 ring-red-600/20 dark:bg-red-500/10',
          )}>
            {data.status === 'ok' && data.database === 'ok'
              ? <><CircleCheckIcon className="size-6 text-green-600" /><p className="font-medium">Está tudo a funcionar.</p></>
              : <><CircleAlertIcon className="size-6 text-red-600" /><p className="font-medium">Há peças com problemas. Vê os detalhes abaixo.</p></>}
          </div>

          <Card>
            <CardHeader><CardTitle className="font-semibold">Serviços</CardTitle></CardHeader>
            <CardContent className="divide-y">
              <Row name="Base de dados" state={data.database === 'ok' ? 'ok' : 'warn'} detail="Responde a pedidos" error="Não responde" />
              <Row name="Envio de emails" state={checkState(data.mail)} detail={`Último envio: ${when(data.mail.lastOkAt)}`} error={data.mail.lastError} />
              <Row name="IA (avaliação de ofertas)" state={checkState(data.ai)} detail={`Última ronda com sucesso: ${when(data.ai.lastOkAt)}`} error={data.ai.lastError} />
              <Row name="Resumos por email" state={data.digest.lastRunAt ? (data.digest.failed ? 'warn' : 'ok') : 'unknown'}
                detail={data.digest.lastRunAt
                  ? `${when(data.digest.lastRunAt)}: ${data.digest.sent} enviados, ${data.digest.skipped} sem novidades, ${data.digest.failed} falhados`
                  : 'Ainda não correu desde o arranque'}
                error={data.digest.lastError} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-semibold">Fontes de ofertas</CardTitle></CardHeader>
            <CardContent className="divide-y">
              {Object.keys(data.sources).length === 0 && <p className="py-3 text-sm text-muted-foreground">Ainda não houve nenhum sync desde o arranque.</p>}
              {Object.entries(data.sources).map(([name, s]) => (
                <Row key={name} name={name}
                  state={s.consecutiveFailures >= 2 ? 'warn' : s.ok ? 'ok' : 'soft'}
                  detail={s.ok
                    ? `${s.lastCount ?? 0} ofertas no último sync · ${when(s.lastOkAt)}`
                    : `${s.consecutiveFailures === 1 ? 'Falhou no último sync' : `Falhou ${s.consecutiveFailures} vezes seguidas`} · último sucesso: ${when(s.lastOkAt)}`}
                  error={s.lastError} />
              ))}
              <p className="pt-3 text-xs text-muted-foreground">Último sync: {when(data.lastSyncAt)}. Uma falha isolada é normal; a partir de 2 seguidas, é enviado um alerta.</p>
            </CardContent>
          </Card>

          <FeedbackList />
        </>
      )}
    </main>
  );
}
