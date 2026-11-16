'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ActivityIcon, BriefcaseIcon, Loader2Icon, LogOutIcon, MailWarningIcon, MoonIcon, RadarIcon, SendIcon, SunIcon, UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const LINKS = [
  { href: '/', label: 'Ofertas', icon: BriefcaseIcon },
  { href: '/candidaturas', label: 'Candidaturas', icon: SendIcon },
  { href: '/perfil', label: 'Perfil', icon: UserIcon },
];

/** Páginas sem sessão: sem barra de navegação. */
export const PUBLIC = ['/login', '/recuperar-password', '/redefinir-password', '/confirmar-email', '/privacidade', '/termos', '/bem-vindo'];

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      title={dark ? 'Tema claro' : 'Tema escuro'}
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </Button>
  );
}

/** Utilizador da sessão (GET /auth/me). */
type Me = { email: string; emailVerified: boolean; isAdmin?: boolean };

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [resending, setResending] = useState(false);
  const email = me?.email ?? null;
  const isPublic = PUBLIC.includes(pathname);

  useEffect(() => {
    if (isPublic) return;
    api<Me>('/auth/me')
      .then(setMe)
      .catch(() => router.replace('/login'));
  }, [isPublic, router]); // ao vir de uma página pública (ex.: "email confirmado") volta a perguntar

  if (isPublic) return null;

  async function resend() {
    setResending(true);
    try {
      const r = await api<{ alreadyVerified: boolean }>('/auth/resend-verification', { method: 'POST' });
      if (r.alreadyVerified) setMe((m) => (m ? { ...m, emailVerified: true } : m));
      else toast.success(`Enviámos um link novo para ${email}.`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setResending(false);
    }
  }

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-4xl items-center gap-2 px-4 md:px-8">
        <Link href="/" className="mr-2 flex items-center gap-2 font-semibold text-primary">
          <RadarIcon className="size-5" />
          <span className="hidden sm:inline">Radar</span>
        </Link>

        <nav className="flex items-center gap-1" aria-label="Principal">
          {[...LINKS, ...(me?.isAdmin ? [{ href: '/estado', label: 'Estado', icon: ActivityIcon }] : [])].map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors',
                  active ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {email && <span className="mr-2 hidden max-w-48 truncate text-sm text-muted-foreground md:inline" title={email}>{email}</span>}
          <ThemeToggle />
          <Button size="icon-sm" variant="ghost" onClick={logout} aria-label="Terminar sessão" title="Terminar sessão">
            <LogOutIcon />
          </Button>
        </div>
      </div>
      {me && !me.emailVerified && (
        <div className="border-t border-amber-500/20 bg-amber-50 dark:bg-amber-500/10" role="status">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm text-amber-900 sm:flex-nowrap md:px-8 dark:text-amber-200">
            <span className="basis-full sm:min-w-0 sm:flex-1 sm:basis-auto">
              <MailWarningIcon className="mr-2 inline size-4 -translate-y-px" />
              Confirma o teu email: enviámos um link para <strong className="break-all">{me.email}</strong>. Sem isso não te mandamos ofertas.
            </span>
            <button type="button" onClick={resend} disabled={resending}
              className="inline-flex shrink-0 items-center gap-1.5 font-medium whitespace-nowrap underline-offset-2 hover:underline disabled:opacity-50">
              {resending && <Loader2Icon className="size-3.5 animate-spin" />} Reenviar email
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
