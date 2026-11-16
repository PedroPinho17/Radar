'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckIcon, Loader2Icon, LinkIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { clearHash, hashParam, useClientValue } from '@/lib/client-value';
import { AuthShell, FormError } from '@/components/auth-shell';
import { PasswordInput, PasswordStrength } from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const TOKEN_RE = /^[\w-]{43}$/;

export default function RedefinirPasswordPage() {
  const router = useRouter();
  // o token vem no fragmento (#token=…), que o browser nunca envia a servidores
  const isClient = useClientValue(() => true, false);
  const raw = useClientValue(hashParam('token'), null);
  const token = raw && TOKEN_RE.test(raw) ? raw : null;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // guarda o token e tira-o logo da barra de endereço e do histórico
  useEffect(() => {
    hashParam('token')();
    clearHash();
  }, []);

  const mismatch = confirm.length > 0 && confirm !== password;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('A password tem de ter pelo menos 8 caracteres.');
    if (password !== confirm) return setError('As passwords não coincidem.');
    setLoading(true);
    try {
      await api('/auth/reset-password', { method: 'POST', json: { token, password } });
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  if (!isClient) return null;

  if (token === null) {
    return (
      <AuthShell title="Link inválido" subtitle="Este link de recuperação está incompleto ou já foi usado.">
        <div className="flex items-start gap-3 rounded-xl border bg-card p-5 text-sm">
          <span className="rounded-full bg-destructive/10 p-2 text-destructive"><LinkIcon className="size-5" /></span>
          <p>Os links só funcionam uma vez e durante 30 minutos. Pede um novo e usa o mais recente que receberes.</p>
        </div>
        <Button size="lg" className="h-10 w-full" asChild>
          <Link href="/recuperar-password">Pedir novo link</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Escolhe uma nova password" subtitle="Depois de guardares, entras logo e as outras sessões abertas são terminadas.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Nova password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            autoFocus
            required
            minLength={8}
            maxLength={200}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordStrength password={password} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Repete a password</Label>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            required
            maxLength={200}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={mismatch || undefined}
          />
          {confirm.length > 0 && (
            mismatch
              ? <p className="text-xs text-destructive">As passwords não coincidem.</p>
              : <p className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400"><CheckIcon className="size-3.5" /> Coincidem.</p>
          )}
        </div>
        <FormError message={error} />
        <Button type="submit" size="lg" className="h-10 w-full" disabled={loading}>
          {loading && <Loader2Icon className="animate-spin" />}
          {loading ? 'A guardar…' : 'Guardar e entrar'}
        </Button>
      </form>
      {error?.includes('expirou') && (
        <Button variant="outline" size="lg" className="h-10 w-full" asChild>
          <Link href="/recuperar-password">Pedir novo link</Link>
        </Button>
      )}
    </AuthShell>
  );
}
