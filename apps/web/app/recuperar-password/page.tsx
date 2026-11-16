'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon, Loader2Icon, MailCheckIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { searchParam, useClientValue } from '@/lib/client-value';
import { AuthShell, FormError } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function RecuperarPasswordPage() {
  // vindo do login, o email já vem preenchido (?email=…)
  const fromLogin = useClientValue(searchParam('email'), null);
  const [typed, setEmail] = useState<string | null>(null);
  const email = typed ?? fromLogin ?? '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);


  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api('/auth/forgot-password', { method: 'POST', json: { email } });
      setSentTo(email.trim());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (sentTo) {
    return (
      <AuthShell title="Vê o teu email" subtitle="Enviámos-te um link para escolheres uma nova password.">
        <div className="space-y-4 rounded-xl border bg-card p-5 text-sm">
          <div className="flex items-start gap-3">
            <span className="rounded-full bg-primary/10 p-2 text-primary"><MailCheckIcon className="size-5" /></span>
            <p>
              Se existir uma conta com <strong className="break-all">{sentTo}</strong>, vais receber o email dentro de
              momentos. O link é válido durante 30 minutos.
            </p>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Não chegou? Vê a pasta de spam ou promoções.</li>
            <li>Confirma que escreveste bem o email.</li>
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <Button variant="outline" size="lg" className="h-10" onClick={() => setSentTo(null)}>
            Usar outro email ou reenviar
          </Button>
          <Button variant="ghost" size="lg" className="h-10" asChild>
            <Link href="/login"><ArrowLeftIcon /> Voltar ao login</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Esqueceste-te da password?"
      subtitle="Sem problema. Indica o email da tua conta e enviamos-te um link para criares uma nova."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            required
            placeholder="nome@exemplo.pt"
            className="h-10"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <FormError message={error} />
        <Button type="submit" size="lg" className="h-10 w-full" disabled={loading}>
          {loading && <Loader2Icon className="animate-spin" />}
          {loading ? 'A enviar…' : 'Enviar link'}
        </Button>
      </form>
      <Button variant="ghost" size="lg" className="h-10 w-full" asChild>
        <Link href="/login"><ArrowLeftIcon /> Voltar ao login</Link>
      </Button>
    </AuthShell>
  );
}
