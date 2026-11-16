'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CircleCheckIcon, Loader2Icon, LinkIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { clearHash, hashParam, useClientValue } from '@/lib/client-value';
import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';

type State = { kind: 'loading' } | { kind: 'ok'; email: string } | { kind: 'error'; message: string };

export default function ConfirmarEmailPage() {
  const isClient = useClientValue(() => true, false);
  const token = useClientValue(hashParam('token'), null);
  const [result, setResult] = useState<State | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const t = hashParam('token')(); // guarda o token antes de o tirar do URL
    clearHash();
    if (!t || started.current) return; // em dev o React corre os efeitos duas vezes: o token só serve uma vez
    started.current = true;
    api<{ email: string }>('/auth/verify-email', { method: 'POST', json: { token: t } })
      .then((r) => setResult({ kind: 'ok', email: r.email }))
      .catch((err) => setResult({ kind: 'error', message: (err as Error).message }));
  }, []);

  const state: State = result
    ?? (isClient && !token
      ? { kind: 'error', message: 'O link está incompleto. Abre-o outra vez a partir do email.' }
      : { kind: 'loading' });

  if (state.kind === 'loading') {
    return (
      <AuthShell title="A confirmar o teu email…" subtitle="Só um segundo.">
        <Loader2Icon className="size-8 animate-spin text-primary" />
      </AuthShell>
    );
  }

  if (state.kind === 'error') {
    return (
      <AuthShell title="Não foi possível confirmar" subtitle="O link pode ter expirado ou já ter sido usado.">
        <div className="flex items-start gap-3 rounded-xl border bg-card p-5 text-sm">
          <span className="rounded-full bg-destructive/10 p-2 text-destructive"><LinkIcon className="size-5" /></span>
          <p>{state.message} Depois de entrares, podes pedir um link novo no aviso no topo da página.</p>
        </div>
        <Button size="lg" className="h-10 w-full" asChild>
          <Link href="/">Entrar no Radar</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Email confirmado!" subtitle="Já podes receber os resumos com as melhores ofertas.">
      <div className="flex items-start gap-3 rounded-xl border bg-card p-5 text-sm">
        <span className="rounded-full bg-green-500/10 p-2 text-green-600 dark:text-green-400"><CircleCheckIcon className="size-5" /></span>
        <p><strong className="break-all">{state.email}</strong> está confirmado. Obrigado!</p>
      </div>
      <Button size="lg" className="h-10 w-full" asChild>
        <Link href="/perfil">Continuar para o meu perfil</Link>
      </Button>
    </AuthShell>
  );
}
