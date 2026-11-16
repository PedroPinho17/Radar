'use client';

import { useEffect, useState } from 'react';
import {
  BellIcon, ClockIcon, FilterIcon, Loader2Icon, MapPinIcon, SendIcon, TargetIcon, WalletIcon, XIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { storageValue, useClientValue } from '@/lib/client-value';
import { cn } from '@/lib/utils';
import type { Preferences } from '@/lib/types';
import {
  AREAS, CITIES, CONTRACT_TYPES, DISTRICTS, GENERAL_AVOID, GENERAL_KEYWORDS, isTech, KEYWORD_SUGGESTIONS,
  ROLE_SUGGESTIONS, ROLES_BY_SECTOR, SHIFTS, TECH_SUGGESTIONS, TIME_SLOTS, WEEKDAYS, WORK_TIMES,
} from '@/lib/options';
import { TagInput } from '@/components/tag-input';
import { formatEuro, MONTHS, SalaryInput, type SalaryPeriod } from '@/components/salary-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

// ---------- pequenos blocos de layout ----------

function Section({ id, icon: Icon, title, description, children }: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-20">
      <CardHeader className="flex flex-row items-start gap-3">
        <span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="size-5" /></span>
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">{children}</CardContent>
    </Card>
  );
}

function Field({ id, label, hint, children, className }: {
  id?: string;
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id} className="font-medium">{label}</Label>
      {children}
      {hint && <p id={id ? `${id}-hint` : undefined} className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SwitchRow({ id, checked, onChange, title, description }: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label htmlFor={id} className="flex items-center justify-between gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/50">
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

/** Botões tipo "segmented control". */
function Segmented<T extends string | number>({ value, options, onChange, label }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-muted p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-3 py-1 text-sm font-medium transition-all',
            value === o.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- textos ----------

const hhmm = (t: string) => t.replace(':', 'h');
const joinPt = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`;

function describeDays(days: number[]) {
  const set = new Set(days);
  if (set.size === 7) return 'todos os dias';
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'de segunda a sexta';
  if (set.size === 2 && set.has(6) && set.has(0)) return 'ao fim de semana';
  return `${set.size === 1 ? 'ao dia' : 'aos dias'} ${joinPt(WEEKDAYS.filter((w) => set.has(w.value)).map((w) => w.long))}`;
}

function emailSummary(p: Preferences) {
  if (!p.dailyEmail) return 'Os emails estão desligados. Podes sempre ver as ofertas no Radar.';
  if (!p.emailDays.length) return 'Escolhe pelo menos um dia.';
  const n = p.emailTimes.length;
  return `Vais receber até ${n} email${n > 1 ? 's' : ''} por dia, ${describeDays(p.emailDays)}, às ${joinPt(p.emailTimes.map(hhmm))}, com as ${p.emailMaxJobs} melhores ofertas novas com nota ${p.digestMinScore} ou mais. Se não houver novidades, não enviamos nada.`;
}

const scoreTone = (s: number) =>
  s >= 75 ? 'text-green-600 dark:text-green-400' : s >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground';

const TIME_PRESETS = [
  { label: '1× por dia', times: ['08:30'] },
  { label: '2× por dia', times: ['08:30', '18:00'] },
  { label: '3× por dia', times: ['08:30', '13:00', '18:00'] },
];
const DAY_PRESETS = [
  { label: 'Todos', days: [1, 2, 3, 4, 5, 6, 0] },
  { label: 'Dias úteis', days: [1, 2, 3, 4, 5] },
  { label: 'Fim de semana', days: [6, 0] },
];
const sameSet = (a: (string | number)[], b: (string | number)[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/** Segunda primeiro, domingo no fim (igual ao servidor). */
const sortDays = (d: number[]) => [...d].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));

const PERIOD_KEY = 'radar:salary-period';

// ---------- formulário ----------

export function PreferencesForm({ initial, cvRoles = [] }: {
  initial: Preferences;
  /** Funções que a IA sugeriu a partir do CV (aparecem primeiro nas sugestões). */
  cvRoles?: string[];
}) {
  const [saved, setSaved] = useState(initial);
  const [p, setP] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  // anual/mensal: lembrado neste browser
  const storedPeriod = useClientValue(storageValue(PERIOD_KEY), null);
  const [periodChoice, setPeriod] = useState<SalaryPeriod | null>(null);
  const period: SalaryPeriod = periodChoice ?? (storedPeriod === 'month' ? 'month' : 'year');
  const [showExclude, setShowExclude] = useState(false);

  const dirty = JSON.stringify(p) !== JSON.stringify(saved);
  const areas = p.areas?.length ? p.areas : (p.sector ? [p.sector] : []);
  const tech = isTech(areas, p.sector);
  const roleSuggestions = [...new Set([
    ...cvRoles,
    ...(tech ? ROLE_SUGGESTIONS : []),
    ...areas.flatMap((a) => ROLES_BY_SECTOR[a] ?? []),
  ])];
  const set = <K extends keyof Preferences>(k: K, v: Preferences[K]) => setP((old) => ({ ...old, [k]: v }));
  function toggleArea(area: string) {
    const next = areas.includes(area) ? areas.filter((a) => a !== area) : [...areas, area];
    setP((old) => ({ ...old, areas: next, sector: next[0] ?? null }));
  }
  function toggleShift(s: string) {
    const cur = p.shifts ?? [];
    set('shifts', cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);
  }
  function toggleContract(c: string) {
    const cur = p.contractTypes ?? [];
    set('contractTypes', cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]);
  }

  function changePeriod(v: SalaryPeriod) {
    setPeriod(v);
    try { localStorage.setItem(PERIOD_KEY, v); } catch { /* ignora */ }
  }

  // avisa antes de sair da página com alterações por guardar
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const salaryError =
    p.targetSalaryMin !== null && p.targetSalaryMax !== null && p.targetSalaryMin > p.targetSalaryMax
      ? 'O mínimo não pode ser maior que o máximo.'
      : null;
  const emailError = p.dailyEmail && !p.emailDays.length ? 'Escolhe pelo menos um dia.' : null;

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (salaryError || emailError) {
      toast.error(salaryError ?? emailError);
      return;
    }
    setBusy(true);
    try {
      const next = await api<Preferences>('/preferences', { method: 'PUT', json: p });
      setSaved(next);
      setP(next);
      toast.success('Preferências guardadas.');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const r = await api<{ sent: boolean; matches: number }>('/digest/send-now', { method: 'POST' });
      if (r.sent) toast.success('Email de teste enviado. Vê a tua caixa de correio.');
      else toast.info('Não há ofertas das últimas 24h com essa nota mínima, por isso não enviámos nada.');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setTesting(false);
    }
  }

  const raise =
    p.currentSalary && p.targetSalaryMin ? Math.round(((p.targetSalaryMin - p.currentSalary) / p.currentSalary) * 100) : null;
  const freeSlots = TIME_SLOTS.filter((t) => !p.emailTimes.includes(t));

  return (
    <form onSubmit={save} className={cn('space-y-6', dirty && 'pb-20')}>
      {/* ---------- O que procuras ---------- */}
      <Section id="procura" icon={TargetIcon} title="O que procuras" description="Usamos isto para procurar ofertas e para a IA dar a nota.">
        <Field label="Área profissional" hint="Podes escolher mais do que uma. Muda as sugestões e os sites onde procuramos.">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Áreas profissionais">
            {AREAS.map((a) => (
              <button key={a} type="button" aria-pressed={areas.includes(a)} onClick={() => toggleArea(a)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                  areas.includes(a) ? 'border-primary bg-primary/10 font-medium text-primary' : 'hover:bg-muted',
                )}>
                {a}
              </button>
            ))}
          </div>
          {!areas.length && <p className="text-sm text-amber-700 dark:text-amber-400">Escolhe pelo menos uma área.</p>}
        </Field>
        <Field id="roles" label="Funções que procuras"
          hint={tech
            ? 'Títulos de oferta que te interessam. Vazio = qualquer função de programação.'
            : 'Pesquisamos estes títulos nos sites de emprego. Junta variantes (ex.: “Auxiliar de Ação Educativa” e “Assistente Operacional”).'}>
          <TagInput id="roles" tone="positive" value={p.roles} onChange={(v) => set('roles', v)} max={20}
            suggestions={roleSuggestions}
            placeholder={tech ? 'Ex.: Full Stack, Programador…' : 'Ex.: Auxiliar de Ação Educativa, Cozinheiro…'}
            aria-describedby="roles-hint" />
          {!tech && !p.roles.length && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Sem funções, não sabemos o que procurar por ti. Escolhe pelo menos uma.
            </p>
          )}
        </Field>
        <Field label="Turnos que aceitas" hint="A IA usa isto na nota. Deixa vazio se fores flexível.">
          <div className="flex flex-wrap gap-2">
            {SHIFTS.map((s) => (
              <button key={s.value} type="button" onClick={() => toggleShift(s.value)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm',
                  (p.shifts ?? []).includes(s.value) ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted',
                )}>{s.label}</button>
            ))}
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo de contrato">
            <div className="flex flex-wrap gap-2">
              {CONTRACT_TYPES.map((c) => (
                <button key={c.value} type="button" onClick={() => toggleContract(c.value)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-sm',
                    (p.contractTypes ?? []).includes(c.value) ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted',
                  )}>{c.label}</button>
              ))}
            </div>
          </Field>
          <Field id="workTime" label="Tempo de trabalho">
            <NativeSelect id="workTime" value={p.workTime ?? ''}
              onChange={(e) => set('workTime', (e.target.value || null) as Preferences['workTime'])}>
              <option value="">Indiferente</option>
              {WORK_TIMES.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </NativeSelect>
          </Field>
        </div>
        <Field id="avoid" label={tech ? 'Tecnologias que preferes evitar' : 'O que preferes evitar'}
          hint="Ofertas com isto no título ficam escondidas e a IA baixa a nota das outras.">
          <TagInput id="avoid" tone="negative" value={p.avoid} onChange={(v) => set('avoid', v)}
            suggestions={tech ? TECH_SUGGESTIONS : GENERAL_AVOID}
            placeholder={tech ? 'Ex.: .NET, PHP…' : 'Ex.: Turnos noturnos, Fins de semana…'} aria-describedby="avoid-hint" />
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field id="maxYears" label="Experiência máxima pedida" hint="Esconde ofertas que pedem mais anos do que isto.">
            <NativeSelect id="maxYears" value={p.maxYears} onChange={(e) => set('maxYears', Number(e.target.value))}>
              {Array.from({ length: 16 }, (_, i) => (
                <option key={i} value={i}>{i === 0 ? 'Sem experiência' : `Até ${i} ano${i > 1 ? 's' : ''}`}</option>
              ))}
            </NativeSelect>
          </Field>
          {tech && (
            <Field id="github" label="GitHub" hint="Os teus repositórios ajudam a IA a conhecer as tuas skills.">
              <div className="flex h-10 items-center rounded-lg border border-input transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
                <span className="pl-3 text-sm text-muted-foreground">github.com/</span>
                <input id="github" value={p.githubUsername ?? ''} maxLength={39} autoComplete="off" spellCheck={false}
                  placeholder="utilizador"
                  onChange={(e) => set('githubUsername', e.target.value.replace(/[^a-z0-9-]/gi, '') || null)}
                  className="h-full min-w-0 flex-1 bg-transparent pr-3 text-sm outline-none placeholder:text-muted-foreground" />
              </div>
            </Field>
          )}
        </div>
        <Field id="notes" label="Notas para a IA" hint={`${(p.notes ?? '').length}/1000 · Ex.: horários, tipo de empresa, o que estás a aprender.`}>
          <Textarea id="notes" rows={3} maxLength={1000}
            placeholder={tech
              ? 'Ex.: estou a aprender Spring Boot e Flutter; prefiro produto a consultoria.'
              : 'Ex.: prefiro horário de manhã; tenho carta de condução; gostava de trabalhar com crianças.'}
            value={p.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} />
        </Field>
      </Section>

      {/* ---------- Onde ---------- */}
      <Section id="local" icon={MapPinIcon} title="Onde queres trabalhar" description="Ofertas presenciais fora do teu distrito/cidade ficam escondidas.">
        <SwitchRow id="remote" checked={p.remoteAnywhere} onChange={(v) => set('remoteAnywhere', v)}
          title="Aceito trabalho 100% remoto" description="Mostra ofertas remotas de qualquer sítio, incluindo do estrangeiro." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="district" label="Distrito" hint={!p.remoteAnywhere ? 'Obrigatório se não aceitas remoto em qualquer sítio.' : 'Opcional'}>
            <NativeSelect id="district" value={p.district ?? ''}
              onChange={(e) => set('district', e.target.value || null)}>
              <option value="">Escolhe…</option>
              {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </NativeSelect>
          </Field>
          <Field id="city" label="Cidade / concelho">
            <input id="city" value={p.city ?? ''} maxLength={60}
              onChange={(e) => set('city', e.target.value.trim() || null)}
              placeholder="Ex.: Matosinhos"
              className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30" />
          </Field>
        </div>
        <Field id="maxDistanceKm" label="Distância máxima (km)" hint="Informativo — usamos distrito/cidade para filtrar, não km reais.">
          <NativeSelect id="maxDistanceKm" value={p.maxDistanceKm ?? ''}
            onChange={(e) => set('maxDistanceKm', e.target.value ? Number(e.target.value) : null)}>
            <option value="">Sem limite</option>
            {[5, 10, 15, 20, 30, 50, 100].map((n) => <option key={n} value={n}>{n} km</option>)}
          </NativeSelect>
        </Field>
        <Field id="onsite" label="Outras cidades onde aceitas ir" hint="Presencial, híbrido ou remoto nestas cidades.">
          <TagInput id="onsite" value={p.onsiteLocations} onChange={(v) => set('onsiteLocations', v)}
            checkTypos suggestions={CITIES} placeholder="Escreve uma cidade…" aria-describedby="onsite-hint" />
        </Field>
        <Field id="hybrid" label="Cidades onde só aceitas híbrido" hint="Mais longe: só vais lá alguns dias por semana.">
          <TagInput id="hybrid" value={p.hybridLocations} onChange={(v) => set('hybridLocations', v)}
            checkTypos suggestions={CITIES} placeholder="Escreve uma cidade…" aria-describedby="hybrid-hint" />
        </Field>
      </Section>

      {/* ---------- Salário ---------- */}
      <Section id="salario" icon={WalletIcon} title="Salário" description="Valores brutos. A IA tira pontos a ofertas que pagam menos do que ganhas hoje.">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">Mostrar valores</span>
          <Segmented label="Período do salário" value={period} onChange={changePeriod}
            options={[{ value: 'year', label: 'Por ano' }, { value: 'month', label: `Por mês (×${MONTHS})` }]} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="currentSalary" label="Ganho hoje"
            hint={p.currentSalary ? (period === 'year' ? `≈ ${formatEuro(p.currentSalary / MONTHS)}/mês` : `= ${formatEuro(p.currentSalary)}/ano`) : 'Opcional'}>
            <SalaryInput id="currentSalary" period={period} value={p.currentSalary} onChange={(v) => set('currentSalary', v)}
              placeholder={period === 'year' ? '20 000' : '1 430'} />
          </Field>
          <Field id="targetSalaryMin" label="Quero pelo menos"
            hint={raise !== null ? <span className={raise >= 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600'}>{raise >= 0 ? '+' : ''}{raise}% face ao atual</span>
              : p.targetSalaryMin ? (period === 'year' ? `≈ ${formatEuro(p.targetSalaryMin / MONTHS)}/mês` : `= ${formatEuro(p.targetSalaryMin)}/ano`) : 'Opcional'}>
            <SalaryInput id="targetSalaryMin" period={period} value={p.targetSalaryMin} onChange={(v) => set('targetSalaryMin', v)}
              invalid={!!salaryError} placeholder={period === 'year' ? '25 000' : '1 790'} />
          </Field>
          <Field id="targetSalaryMax" label="Idealmente até"
            hint={p.targetSalaryMax ? (period === 'year' ? `≈ ${formatEuro(p.targetSalaryMax / MONTHS)}/mês` : `= ${formatEuro(p.targetSalaryMax)}/ano`) : 'Opcional'}>
            <SalaryInput id="targetSalaryMax" period={period} value={p.targetSalaryMax} onChange={(v) => set('targetSalaryMax', v)}
              invalid={!!salaryError} placeholder={period === 'year' ? '32 000' : '2 290'} />
          </Field>
        </div>
        {salaryError && <p role="alert" className="text-sm text-destructive">{salaryError}</p>}
      </Section>

      {/* ---------- Emails ---------- */}
      <Section id="emails" icon={BellIcon} title="Emails com ofertas" description="Escolhe quando e quantos emails queres receber.">
        <SwitchRow id="dailyEmail" checked={p.dailyEmail} onChange={(v) => set('dailyEmail', v)}
          title="Receber emails" description="Com as ofertas novas que combinam contigo e lembretes de follow-up." />

        <fieldset disabled={!p.dailyEmail} className="space-y-6 transition-opacity disabled:opacity-50">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="font-medium">Dias</Label>
              <div className="flex gap-1">
                {DAY_PRESETS.map((d) => (
                  <Button key={d.label} type="button" size="xs" variant={sameSet(p.emailDays, d.days) ? 'secondary' : 'ghost'}
                    onClick={() => set('emailDays', d.days)}>{d.label}</Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Dias da semana">
              {WEEKDAYS.map((d) => {
                const on = p.emailDays.includes(d.value);
                return (
                  <button key={d.value} type="button" aria-pressed={on} title={d.long}
                    onClick={() => set('emailDays', sortDays(on ? p.emailDays.filter((x) => x !== d.value) : [...p.emailDays, d.value]))}
                    className={cn(
                      'h-10 rounded-lg border text-sm font-medium transition-colors',
                      on
                        ? 'border-primary/40 bg-primary/10 text-primary dark:bg-primary/20 dark:text-indigo-200'
                        : 'border-dashed text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}>
                    {d.short}
                  </button>
                );
              })}
            </div>
            {emailError && <p role="alert" className="text-sm text-destructive">{emailError}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="font-medium">Horas <span className="font-normal text-muted-foreground">(até 6 por dia)</span></Label>
              <div className="flex gap-1">
                {TIME_PRESETS.map((t) => (
                  <Button key={t.label} type="button" size="xs" variant={sameSet(p.emailTimes, t.times) ? 'secondary' : 'ghost'}
                    onClick={() => set('emailTimes', t.times)}>{t.label}</Button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {p.emailTimes.map((t) => (
                <span key={t} className="inline-flex h-10 items-center gap-1.5 rounded-lg border bg-card pr-1.5 pl-3 text-sm font-medium tabular-nums">
                  <ClockIcon className="size-3.5 text-muted-foreground" /> {hhmm(t)}
                  <button type="button" disabled={p.emailTimes.length <= 1}
                    onClick={() => set('emailTimes', p.emailTimes.filter((x) => x !== t))}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                    aria-label={`Remover ${hhmm(t)}`} title={p.emailTimes.length <= 1 ? 'Precisas de pelo menos uma hora' : 'Remover'}>
                    <XIcon className="size-3.5" />
                  </button>
                </span>
              ))}
              {p.emailTimes.length < 6 && (
                <NativeSelect aria-label="Adicionar hora" className="w-40" value=""
                  onChange={(e) => e.target.value && set('emailTimes', [...p.emailTimes, e.target.value].sort())}>
                  <option value="">+ Adicionar hora</option>
                  {freeSlots.map((t) => <option key={t} value={t}>{hhmm(t)}</option>)}
                </NativeSelect>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Hora de Portugal continental.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field id="emailMaxJobs" label="Ofertas por email" hint="As de nota mais alta vêm primeiro.">
              <NativeSelect id="emailMaxJobs" value={p.emailMaxJobs} onChange={(e) => set('emailMaxJobs', Number(e.target.value))}>
                {[3, 5, 10, 15, 20, 30, 50].map((n) => <option key={n} value={n}>Até {n} ofertas</option>)}
              </NativeSelect>
            </Field>
            <Field id="minScore" label="Nota mínima" hint="Ofertas abaixo disto não vão no email (continuam no Radar).">
              <div className="flex h-10 items-center gap-3">
                <input id="minScore" type="range" min={0} max={100} step={5} value={p.digestMinScore}
                  onChange={(e) => set('digestMinScore', Number(e.target.value))}
                  className="h-2 flex-1 cursor-pointer accent-primary" aria-describedby="minScore-hint" />
                <span className={cn('w-10 text-right text-lg font-semibold tabular-nums', scoreTone(p.digestMinScore))}>{p.digestMinScore}</span>
              </div>
            </Field>
          </div>
        </fieldset>

        <div className="rounded-lg bg-muted/60 p-3 text-sm">{emailSummary(p)}</div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={sendTest} disabled={testing || dirty}>
            {testing ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
            Enviar email de teste
          </Button>
          <span className="text-xs text-muted-foreground">
            {dirty ? 'Guarda primeiro as alterações.' : 'Com as ofertas das últimas 24h. Não altera o agendamento.'}
          </span>
        </div>
      </Section>

      {/* ---------- Filtros avançados ---------- */}
      <Section id="filtros" icon={FilterIcon} title="Filtros avançados" description="Ofertas com estas palavras no título nunca te aparecem.">
        {showExclude ? (
          <Field id="exclude" label="Esconder ofertas com" hint="Palavras inteiras: “SAP” esconde “Consultor SAP” mas não “ASAP”.">
            <TagInput id="exclude" value={p.excludeKeywords} onChange={(v) => set('excludeKeywords', v)}
              suggestions={tech ? [...GENERAL_KEYWORDS, ...KEYWORD_SUGGESTIONS] : GENERAL_KEYWORDS} placeholder={tech ? 'Ex.: Helpdesk, SAP…' : 'Ex.: Estágio, Call Center…'} aria-describedby="exclude-hint" />
          </Field>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-medium">{p.excludeKeywords.length} palavra{p.excludeKeywords.length === 1 ? '' : 's'} escondida{p.excludeKeywords.length === 1 ? '' : 's'}</span>
              {p.excludeKeywords.length > 0 && (
                <span className="block truncate text-muted-foreground">
                  {p.excludeKeywords.slice(0, 6).join(', ')}{p.excludeKeywords.length > 6 && ` e mais ${p.excludeKeywords.length - 6}`}
                </span>
              )}
            </p>
            <Button type="button" variant="outline" onClick={() => setShowExclude(true)}>Ver e editar</Button>
          </div>
        )}
      </Section>

      {/* ---------- barra para guardar ---------- */}
      <div className={cn(
        'fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 transition-all duration-200',
        dirty ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
      )}>
        <div className="flex w-full max-w-xl items-center gap-3 rounded-xl border bg-popover/95 p-2 pl-4 shadow-xl backdrop-blur">
          <span className="flex-1 text-sm font-medium">Tens alterações por guardar</span>
          <Button type="button" variant="ghost" onClick={() => setP(saved)} disabled={busy}>Descartar</Button>
          <Button type="submit" disabled={busy}>
            {busy && <Loader2Icon className="animate-spin" />}
            {busy ? 'A guardar…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </form>
  );
}
