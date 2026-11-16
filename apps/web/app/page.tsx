'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { InboxIcon, Loader2Icon, SparklesIcon } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { storageValue, useClientValue } from '@/lib/client-value';
import { cn } from '@/lib/utils';
import { countBySource } from '@/lib/sources';
import type { Match } from '@/lib/types';
import { MatchCard } from '@/components/match-card';
import { OnboardingCard, useOnboarding } from '@/components/onboarding';
import { CardSkeleton, EmptyState, PageHeader, Tabs } from '@/components/page';
import { Button } from '@/components/ui/button';

const TABS = [
  { id: 'todo', label: 'Por decidir', test: (m: Match) => !m.decision },
  { id: 'like', label: 'Gostei', test: (m: Match) => m.decision === 'like' },
  { id: 'applied', label: 'Candidatei-me', test: (m: Match) => m.decision === 'applied' },
  { id: 'dislike', label: 'Não gostei', test: (m: Match) => m.decision === 'dislike' },
] as const;
type TabId = (typeof TABS)[number]['id'];
const SOURCE_KEY = 'radar:fonte';

export default function Home() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [tab, setTab] = useState<TabId>('todo');
  const [analysing, setAnalysing] = useState(false);
  const onboarding = useOnboarding();
  // filtro por fonte, lembrado neste browser ('' = todas)
  const storedSource = useClientValue(storageValue(SOURCE_KEY), null);
  const [sourceChoice, setSourceChoice] = useState<string | null>(null);

  function chooseSource(s: string) {
    setSourceChoice(s);
    try { localStorage.setItem(SOURCE_KEY, s); } catch { /* sem localStorage: só nesta visita */ }
  }

  async function load() {
    setMatches(await api<Match[]>('/jobs/matches'));
  }

  useEffect(() => {
    api<Match[]>('/jobs/matches').then(setMatches).catch((err) => {
      if (err instanceof ApiError && err.status === 401) router.replace('/login');
      else toast.error((err as Error).message);
    });
  }, [router]);

  async function analyse() {
    setAnalysing(true);
    const id = toast.loading('A IA está a analisar as ofertas novas… pode demorar uns minutos.');
    try {
      const r = await api<{ pending: number; scored: number }>('/jobs/match', { method: 'POST' });
      toast.success(r.pending ? `${r.scored} oferta${r.scored === 1 ? '' : 's'} analisada${r.scored === 1 ? '' : 's'}.` : 'Não há ofertas novas.', { id });
      await load();
    } catch (err) {
      const msg = (err as Error).message;
      toast.error(/CV|perfil/i.test(msg) ? 'Cria primeiro o teu perfil (CV ou formulário).' : msg, { id });
    } finally {
      setAnalysing(false);
    }
  }

  const update = (m: Match) => setMatches((all) => all?.map((x) => (x.id === m.id ? m : x)) ?? null);
  const current = TABS.find((t) => t.id === tab)!;
  const inTab = matches?.filter(current.test) ?? [];
  const sources = countBySource(inTab);
  const wanted = sourceChoice ?? storedSource ?? '';
  // uma fonte que já não tem ofertas neste separador volta a "Todas"
  const source = sources.some((s) => s.source === wanted) ? wanted : '';
  const visible = source ? inTab.filter((m) => m.job.source === source) : inTab;
  // conta nova ainda sem ofertas: só os primeiros passos, sem abas vazias nem mensagens repetidas
  const gettingStarted = !!onboarding && !onboarding.done && matches?.length === 0;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Ofertas"
        description="Ordenadas pela nota que a IA lhes deu face ao teu perfil."
        action={gettingStarted ? undefined : (
          <Button onClick={analyse} disabled={analysing}>
            {analysing ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
            {analysing ? 'A analisar…' : 'Analisar novas'}
          </Button>
        )}
      />

      {onboarding && !onboarding.done && <OnboardingCard state={onboarding} />}

      {!gettingStarted && <>
      <Tabs
        label="Filtrar ofertas"
        value={tab}
        onChange={setTab}
        tabs={TABS.map((t) => ({ id: t.id, label: t.label, count: matches?.filter(t.test).length ?? 0 }))}
      />

      {sources.length > 1 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por fonte">
          <span className="text-sm text-muted-foreground">Fonte:</span>
          {[{ source: '', label: 'Todas', count: inTab.length }, ...sources].map((s) => (
            <button key={s.source || 'todas'} type="button" aria-pressed={source === s.source} onClick={() => chooseSource(s.source)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
                source === s.source ? 'border-primary bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}>
              {s.label}
              <span className="text-xs tabular-nums opacity-70">{s.count}</span>
            </button>
          ))}
        </div>
      )}

      {matches === null ? (
        <div className="space-y-4"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
      ) : visible.length === 0 ? (
        matches.length === 0 ? (
          <EmptyState
            icon={SparklesIcon}
            title="Ainda não há ofertas avaliadas"
            description="Cria o perfil no Perfil (CV ou formulário) e depois carrega em “Analisar novas”. Também o fazemos sozinhos antes de cada email."
            action={<Button variant="outline" asChild><Link href="/perfil">Ir para o Perfil</Link></Button>}
          />
        ) : (
          <EmptyState icon={InboxIcon} title="Nada aqui por agora" description="As ofertas que marcares aparecem nesta lista." />
        )
      ) : (
        <div className="space-y-4">
          {visible.map((m) => <MatchCard key={m.id} match={m} onChange={update} />)}
        </div>
      )}
      </>}
    </main>
  );
}
