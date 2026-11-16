'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2Icon } from 'lucide-react';
import { api } from '@/lib/api';
import { searchParam, useClientValue } from '@/lib/client-value';
import { cn } from '@/lib/utils';
import { AuthShell, FormError } from '@/components/auth-shell';
import { PasswordInput, PasswordStrength } from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const router = useRouter();
  // vindo de "Criar conta" na apresentação (?modo=registo): abre já no registo
  const fromQuery = useClientValue(searchParam('modo'), null);
  const [choice, setMode] = useState<Mode | null>(null);
  const mode: Mode = choice ?? (fromQuery === 'registo' ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLogin = mode === 'login';

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setPassword('');
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!isLogin && password.length < 8) {
      setError('A password tem de ter pelo menos 8 caracteres.');
      return;
    }
    if (!isLogin && !acceptTerms) {
      setError('Para criar conta tens de aceitar os Termos e a Política de Privacidade.');
      return;
    }
    setLoading(true);
    try {
      await api(`/auth/${mode}`, { method: 'POST', json: isLogin ? { email, password } : { email, password, acceptTerms } });
      router.replace('/'); // conta nova: os primeiros passos estão na página inicial
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={isLogin ? 'Bem-vindo de volta' : 'Cria a tua conta'}
      subtitle={isLogin ? 'Entra para ver as tuas ofertas.' : 'Demora menos de um minuto. Depois escolhes a área e o perfil.'}
    >
      <div className="grid grid-cols-2 rounded-lg bg-muted p-1" role="tablist" aria-label="Entrar ou criar conta">
        {(['login', 'register'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={cn(
              'rounded-md py-1.5 text-sm font-medium transition-all',
              mode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {m === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate={false}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {isLogin && (
              <Link
                href={`/recuperar-password${email ? `?email=${encodeURIComponent(email)}` : ''}`}
                className="text-xs font-medium text-primary hover:underline"
              >
                Esqueceste-te da password?
              </Link>
            )}
          </div>
          <PasswordInput
            id="password"
            name="password"
            required
            minLength={isLogin ? undefined : 8}
            maxLength={200}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!error || undefined}
          />
          {!isLogin && <PasswordStrength password={password} />}
        </div>

        {!isLogin && (
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary" />
            {/* sem "required": o balão nativo do browser escondia a mensagem clara do Radar */}
            <span className="text-muted-foreground">
              Li e aceito os{' '}
              <Link href="/termos" target="_blank" className="font-medium text-primary hover:underline">Termos de Utilização</Link> e a{' '}
              <Link href="/privacidade" target="_blank" className="font-medium text-primary hover:underline">Política de Privacidade</Link>.
              O perfil (CV ou formulário) é analisado por IA para comparar com ofertas de emprego.
            </span>
          </label>
        )}

        <FormError message={error} />

        <Button type="submit" size="lg" className="h-10 w-full" disabled={loading}>
          {loading && <Loader2Icon className="animate-spin" />}
          {loading ? (isLogin ? 'A entrar…' : 'A criar conta…') : isLogin ? 'Entrar' : 'Criar conta'}
        </Button>
      </form>
    </AuthShell>
  );
}
