'use client';

import { useState } from 'react';
import { EyeIcon, EyeOffIcon, TriangleAlertIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

type Props = Omit<React.ComponentProps<'input'>, 'type'>;

/** Campo de password com "olhinho" para mostrar/esconder e aviso de Caps Lock. */
export function PasswordInput({ className, onKeyUp, onKeyDown, onBlur, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  const [caps, setCaps] = useState(false);
  const checkCaps = (e: React.KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.('CapsLock') ?? false);

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input
          {...props}
          type={visible ? 'text' : 'password'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={cn('h-10 pr-10', className)}
          onKeyDown={(e) => { checkCaps(e); onKeyDown?.(e); }}
          onKeyUp={(e) => { checkCaps(e); onKeyUp?.(e); }}
          onBlur={(e) => { setCaps(false); onBlur?.(e); }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Esconder password' : 'Mostrar password'}
          aria-pressed={visible}
          title={visible ? 'Esconder password' : 'Mostrar password'}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
        >
          {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      </div>
      {caps && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400" role="status">
          <TriangleAlertIcon className="size-3.5" /> O Caps Lock está ligado.
        </p>
      )}
    </div>
  );
}

/** Pontuação simples 0–4 da força da password (comprimento + variedade). */
export function passwordScore(p: string): number {
  if (!p) return 0;
  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(p)).length;
  if (kinds >= 2) score++;
  if (kinds >= 3 && p.length >= 10) score++;
  if (new Set(p).size < 4) score = Math.min(score, 1);
  return score;
}

const LEVELS = [
  { label: 'Muito fraca', bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
  { label: 'Fraca', bar: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400' },
  { label: 'Razoável', bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  { label: 'Boa', bar: 'bg-lime-500', text: 'text-lime-600 dark:text-lime-400' },
  { label: 'Forte', bar: 'bg-green-600', text: 'text-green-600 dark:text-green-400' },
];

/** Barra de força + dicas, para mostrar por baixo de uma password nova. */
export function PasswordStrength({ password }: { password: string }) {
  if (!password) {
    return <p className="text-xs text-muted-foreground">Usa pelo menos 8 caracteres. Uma frase curta é fácil de lembrar e difícil de adivinhar.</p>;
  }
  const score = passwordScore(password);
  const level = LEVELS[score]!;
  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn('h-1.5 flex-1 rounded-full bg-muted transition-colors', i < Math.max(score, 1) && level.bar)} />
        ))}
      </div>
      <p className={cn('text-xs font-medium', level.text)}>
        {level.label}
        {password.length < 8 && <span className="font-normal text-muted-foreground"> · faltam {8 - password.length} caracteres</span>}
        {password.length >= 8 && score < 3 && (
          <span className="font-normal text-muted-foreground"> · junta números, símbolos ou mais palavras</span>
        )}
      </p>
    </div>
  );
}
