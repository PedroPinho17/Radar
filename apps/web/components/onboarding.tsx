'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckIcon, Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type OnboardingState = {
  emailVerified: boolean;
  hasAreas: boolean;
  hasProfile: boolean;
  hasCv?: boolean;
  hasPreferences: boolean;
  hasMatches: boolean;
  done: boolean;
};

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState | null>(null);
  useEffect(() => {
    api<OnboardingState>('/account/onboarding').then(setState).catch(() => {});
  }, []);
  return state;
}

/** Guia: email → área → perfil (CV ou formulário) → preferências. */
export function OnboardingCard({ state }: { state: OnboardingState }) {
  const [resending, setResending] = useState(false);
  const hasProfile = state.hasProfile || !!state.hasCv;

  async function resend() {
    setResending(true);
    try {
      await api('/auth/resend-verification', { method: 'POST' });
      toast.success('Enviámos um link novo. Vê também a pasta de spam.');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setResending(false);
    }
  }

  const steps = [
    {
      done: state.emailVerified,
      title: 'Confirma o teu email',
      text: 'Abre o link que te enviámos. Sem isto não te podemos mandar ofertas.',
      action: (
        <Button size="sm" variant="outline" onClick={resend} disabled={resending}>
          {resending && <Loader2Icon className="animate-spin" />} Reenviar email
        </Button>
      ),
    },
    {
      done: state.hasAreas,
      title: 'Escolhe a tua área',
      text: 'Limpeza, restauração, creche, saúde, comércio, informática… podes escolher várias.',
      action: <Button size="sm" asChild><Link href="/perfil#procura">Escolher área</Link></Button>,
    },
    {
      done: hasProfile,
      title: 'Cria o teu perfil',
      text: 'Envia um CV em PDF ou preenche o formulário simples (experiência, escolaridade, onde podes trabalhar).',
      action: (
        <Button size="sm" variant={state.hasAreas ? 'default' : 'outline'} asChild>
          <Link href="/perfil#cv">CV ou formulário</Link>
        </Button>
      ),
    },
    {
      done: state.hasPreferences,
      title: 'Distrito, turnos e emails',
      text: 'Confirma onde queres trabalhar, horários e quando queres receber emails.',
      action: (
        <Button size="sm" variant={hasProfile ? 'default' : 'outline'} asChild>
          <Link href="/perfil#local">Rever preferências</Link>
        </Button>
      ),
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.findIndex((s) => !s.done);

  return (
    <section aria-labelledby="onboarding-title" className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="space-y-3 border-b bg-gradient-to-br from-primary/10 to-transparent p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="onboarding-title" className="text-lg font-semibold tracking-tight">Primeiros passos</h2>
          <span className="text-sm text-muted-foreground">{doneCount} de {steps.length} feitos</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount}>
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
      </div>
      <ol className="divide-y">
        {steps.map((s, i) => (
          <li key={s.title} className={cn('flex items-start gap-4 p-4 sm:p-5', i === next && 'bg-primary/[0.03]')}>
            <span className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
              s.done ? 'bg-green-600 text-white' : i === next ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}>
              {s.done ? <CheckIcon className="size-4" /> : i + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 space-y-1">
                <p className={cn('font-medium', s.done && 'text-muted-foreground line-through decoration-muted-foreground/40')}>{s.title}</p>
                {!s.done && <p className="text-sm text-muted-foreground">{s.text}</p>}
              </div>
              {!s.done && <div className="shrink-0">{s.action}</div>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
