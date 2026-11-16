'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

export type SalaryPeriod = 'year' | 'month';

/** Em Portugal o salário bruto anual = 14 × mensal (subsídios de férias e Natal). */
export const MONTHS = 14;

const fmt = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 });
export const formatEuro = (n: number) => `${fmt.format(n)} €`;

const toDisplay = (annual: number | null, period: SalaryPeriod) =>
  annual === null ? '' : fmt.format(period === 'year' ? annual : Math.round(annual / MONTHS));

/**
 * Campo de salário com separador de milhares e "€".
 * Guarda sempre o valor ANUAL; mostra anual ou mensal conforme `period`.
 */
export function SalaryInput({ id, value, onChange, period, invalid, placeholder }: {
  id: string;
  value: number | null;
  onChange: (annual: number | null) => void;
  period: SalaryPeriod;
  invalid?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState(() => toDisplay(value, period));

  // quando muda o período (ou o valor vem de fora), reformata — ajustado durante o render, sem efeito
  const [shown, setShown] = useState({ value, period });
  if (shown.value !== value || shown.period !== period) {
    setShown({ value, period });
    setText(toDisplay(value, period));
  }

  function onInput(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 7);
    setText(digits ? fmt.format(Number(digits)) : '');
    if (!digits) return onChange(null);
    const n = Number(digits);
    onChange(Math.min(500000, period === 'year' ? n : n * MONTHS));
  }

  return (
    <div className="relative">
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={text}
        onChange={onInput}
        onBlur={() => setText(toDisplay(value, period))}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        className={cn(
          'h-10 w-full rounded-lg border border-input bg-transparent pr-16 pl-3 text-sm tabular-nums transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30',
          'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
        )}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
        € / {period === 'year' ? 'ano' : 'mês'}
      </span>
    </div>
  );
}
