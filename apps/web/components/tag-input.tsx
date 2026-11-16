'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { PlusIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { closestOption, fuzzyMatches, normalize } from '@/lib/options';

type Props = {
  id?: string;
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  max?: number;
  /** Cor das etiquetas: neutra, verde (quero) ou vermelha (evitar). */
  tone?: 'default' | 'positive' | 'negative';
  /** Avisa quando uma etiqueta parece uma gralha de uma sugestão (ex.: nomes de cidades). */
  checkTypos?: boolean;
  'aria-describedby'?: string;
};

const TONES = {
  default: 'bg-secondary text-secondary-foreground',
  positive: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  negative: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
};

/**
 * Campo de etiquetas: escreve e carrega Enter (ou vírgula), ou escolhe das sugestões.
 * Backspace num campo vazio apaga a última. Setas navegam nas sugestões.
 */
export function TagInput({
  id, value, onChange, suggestions = [], placeholder, max = 40, tone = 'default', checkTypos = false, ...aria
}: Props) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [usedArrows, setUsedArrows] = useState(false);

  const taken = useMemo(() => new Set(value.map(normalize)), [value]);
  const matches = useMemo(() => {
    const q = normalize(text);
    const free = suggestions.filter((s) => !taken.has(normalize(s)));
    if (!q) return free.slice(0, 8);
    // primeiro as que começam pelo texto, depois as que o contêm
    const starts = free.filter((s) => normalize(s).startsWith(q));
    const contains = free.filter((s) => !normalize(s).startsWith(q) && normalize(s).includes(q));
    const found = [...starts, ...contains];
    // poucas ou nenhuma: junta as parecidas (tolera gralhas)
    if (found.length < 8) found.push(...fuzzyMatches(q, free).filter((f) => !found.includes(f)));
    return found.slice(0, 8);
  }, [text, suggestions, taken]);

  const full = value.length >= max;
  const typed = text.trim();
  const canAddTyped = typed.length > 0 && !taken.has(normalize(typed)) && !matches.some((m) => normalize(m) === normalize(typed));
  const options = [...matches, ...(canAddTyped ? [typed] : [])];

  function add(raw: string) {
    const trimmed = raw.trim().slice(0, 60);
    // mesma palavra que uma sugestão (só muda maiúsculas/acentos): usa a grafia certa
    const item = suggestions.find((s) => normalize(s) === normalize(trimmed)) ?? trimmed;
    if (!item || full || taken.has(normalize(item))) return;
    onChange([...value, item]);
    setText('');
    setActive(0);
  }

  function remove(i: number) {
    onChange(value.filter((_, j) => j !== i));
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      if (e.key === 'Enter' && !typed && !usedArrows) return; // deixa o Enter submeter o formulário
      e.preventDefault();
      add(open && options[active] ? options[active]! : typed);
      setUsedArrows(false);
    } else if (e.key === 'Backspace' && !text && value.length) {
      remove(value.length - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setUsedArrows(true);
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setUsedArrows(true);
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text');
    if (!/[,;\n]/.test(pasted)) return;
    e.preventDefault();
    const next = [...value];
    const seen = new Set(taken);
    for (const part of pasted.split(/[,;\n]/)) {
      const item = part.trim().slice(0, 60);
      if (item && !seen.has(normalize(item)) && next.length < max) {
        next.push(item);
        seen.add(normalize(item));
      }
    }
    onChange(next);
  }

  const showList = open && !full && options.length > 0;

  // etiquetas escritas à mão que parecem gralhas de uma sugestão conhecida
  const typos = useMemo(() => {
    if (!checkTypos) return [];
    const known = new Set(suggestions.map(normalize));
    return value.flatMap((tag) => {
      if (known.has(normalize(tag))) {
        // só difere em maiúsculas/acentos: propõe a grafia oficial
        const canon = suggestions.find((s) => normalize(s) === normalize(tag))!;
        return canon !== tag ? [{ tag, fix: canon }] : [];
      }
      const fix = closestOption(tag, suggestions);
      return fix && !taken.has(normalize(fix)) ? [{ tag, fix }] : [];
    });
  }, [checkTypos, value, suggestions, taken]);
  const typoSet = new Set(typos.map((t) => t.tag));

  function fixTypo(tag: string, fix: string) {
    onChange(value.map((v) => (v === tag ? fix : v)));
  }

  return (
    <div className="relative">
      <div
        className="flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag, i) => (
          <span key={tag} className={cn(
            'inline-flex items-center gap-1 rounded-md py-0.5 pr-1 pl-2 text-sm',
            typoSet.has(tag) ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-400/60 dark:bg-amber-500/15 dark:text-amber-200' : TONES[tone],
          )}>
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(i); }}
              className="rounded p-0.5 opacity-60 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
              aria-label={`Remover ${tag}`}
            >
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          value={text}
          disabled={full}
          placeholder={full ? `Máximo de ${max}` : value.length ? 'Adicionar…' : placeholder}
          onChange={(e) => { setText(e.target.value); setOpen(true); setActive(0); setUsedArrows(false); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-describedby={aria['aria-describedby']}
          className="min-w-32 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-lg"
        >
          {options.map((opt, i) => {
            const isNew = canAddTyped && i === options.length - 1;
            return (
              <li
                key={`${opt}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); add(opt); }}
                onMouseEnter={() => setActive(i)}
                className={cn('flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5', i === active && 'bg-accent text-accent-foreground')}
              >
                {isNew ? <><PlusIcon className="size-3.5" /> Adicionar “{opt}”</> : opt}
              </li>
            );
          })}
        </ul>
      )}

      {typos.length > 0 && (
        <div className="mt-2 space-y-1.5 rounded-lg border border-amber-400/40 bg-amber-50 p-2.5 text-sm dark:bg-amber-500/10" role="status">
          <p className="flex items-center gap-1.5 font-medium text-amber-900 dark:text-amber-200">
            <TriangleAlertIcon className="size-4" /> Confirma a grafia, para as ofertas corresponderem:
          </p>
          <div className="flex flex-wrap gap-2">
            {typos.map(({ tag, fix }) => (
              <button key={tag} type="button" onClick={() => fixTypo(tag, fix)}
                className="rounded-md bg-background px-2 py-1 text-xs ring-1 ring-amber-400/50 transition-colors hover:bg-amber-100 dark:hover:bg-amber-500/20">
                <span className="text-muted-foreground line-through">{tag}</span> → <strong>{fix}</strong>
              </button>
            ))}
            {typos.length > 1 && (
              <button type="button" onClick={() => onChange(value.map((v) => typos.find((t) => t.tag === v)?.fix ?? v))}
                className="rounded-md px-2 py-1 text-xs font-medium text-amber-900 underline-offset-2 hover:underline dark:text-amber-200">
                Corrigir todas
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
