'use client';

import { useState } from 'react';
import { Loader2Icon, PenLineIcon } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Profile } from '@/lib/types';
import { AREAS, CONTRACT_TYPES, DISTRICTS, EDUCATION_LEVELS, SHIFTS, WORK_TIMES } from '@/lib/options';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';

type FormState = {
  title: string;
  yearsExperience: number;
  education: string;
  drivingLicense: string;
  areas: string[];
  district: string;
  city: string;
  maxDistanceKm: number | null;
  shifts: string[];
  contractTypes: string[];
  workTime: string;
  summary: string;
};

const empty: FormState = {
  title: '', yearsExperience: 0, education: '', drivingLicense: '',
  areas: [], district: '', city: '', maxDistanceKm: null,
  shifts: [], contractTypes: [], workTime: '', summary: '',
};

export function ProfileForm({ onSaved }: { onSaved: (p: Profile) => void }) {
  const [f, setF] = useState<FormState>(empty);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((o) => ({ ...o, [k]: v }));

  function toggle(list: string[], value: string) {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.areas.length) return toast.error('Escolhe pelo menos uma área.');
    if (!f.title.trim()) return toast.error('Indica a função que procuras.');
    if (!f.district && !f.city) return toast.error('Indica o distrito ou a cidade.');
    setBusy(true);
    try {
      const profile = await api<Profile>('/profile/form', {
        method: 'POST',
        json: {
          title: f.title.trim(),
          yearsExperience: f.yearsExperience,
          education: f.education.trim() || null,
          drivingLicense: f.drivingLicense.trim() || null,
          areas: f.areas,
          district: f.district || null,
          city: f.city.trim() || null,
          maxDistanceKm: f.maxDistanceKm,
          shifts: f.shifts,
          contractTypes: f.contractTypes,
          workTime: f.workTime || null,
          summary: f.summary.trim() || null,
          location: f.city.trim() || f.district || null,
        },
      });
      onSaved(profile);
      toast.success('Perfil guardado.');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3">
        <span className="rounded-lg bg-primary/10 p-2 text-primary"><PenLineIcon className="size-5" /></span>
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">Sem CV? Preenche isto</CardTitle>
          <CardDescription>Experiência, escolaridade e onde podes trabalhar. Sem PDF.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label>Área profissional</Label>
            <div className="flex flex-wrap gap-2">
              {AREAS.map((a) => (
                <button key={a} type="button" aria-pressed={f.areas.includes(a)} onClick={() => set('areas', toggle(f.areas, a))}
                  className={cn('rounded-lg border px-3 py-1.5 text-sm', f.areas.includes(a) ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted')}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pf-title">Função que procuras</Label>
              <Input id="pf-title" value={f.title} onChange={(e) => set('title', e.target.value)}
                placeholder="Ex.: Auxiliar de Limpeza" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf-years">Anos de experiência</Label>
              <NativeSelect id="pf-years" value={f.yearsExperience}
                onChange={(e) => set('yearsExperience', Number(e.target.value))}>
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i} value={i}>{i === 0 ? 'Sem experiência' : `${i} ano${i > 1 ? 's' : ''}`}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf-edu">Escolaridade</Label>
              <NativeSelect id="pf-edu" value={f.education} onChange={(e) => set('education', e.target.value)}>
                <option value="">Escolhe…</option>
                {/* valor antigo escrito à mão continua a aparecer */}
                {f.education && !EDUCATION_LEVELS.includes(f.education) && <option value={f.education}>{f.education}</option>}
                {EDUCATION_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf-carta">Carta de condução</Label>
              <NativeSelect id="pf-carta" value={f.drivingLicense}
                onChange={(e) => set('drivingLicense', e.target.value)}>
                <option value="">Não aplicável</option>
                <option value="sem">Não tenho</option>
                <option value="B">Categoria B</option>
                <option value="C">Categoria C</option>
                <option value="D">Categoria D</option>
                <option value="BE">BE / reboque</option>
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf-district">Distrito</Label>
              <NativeSelect id="pf-district" value={f.district} onChange={(e) => set('district', e.target.value)} required>
                <option value="">Escolhe…</option>
                {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf-city">Cidade</Label>
              <Input id="pf-city" value={f.city} onChange={(e) => set('city', e.target.value)} placeholder="Ex.: Matosinhos" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf-dist">Distância máxima (km)</Label>
              <NativeSelect id="pf-dist" value={f.maxDistanceKm ?? ''}
                onChange={(e) => set('maxDistanceKm', e.target.value ? Number(e.target.value) : null)}>
                <option value="">Sem limite</option>
                {[5, 10, 15, 20, 30, 50, 100].map((n) => <option key={n} value={n}>{n} km</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf-wt">Tempo de trabalho</Label>
              <NativeSelect id="pf-wt" value={f.workTime} onChange={(e) => set('workTime', e.target.value)}>
                <option value="">Indiferente</option>
                {WORK_TIMES.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
              </NativeSelect>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Horários possíveis</Label>
            <div className="flex flex-wrap gap-2">
              {SHIFTS.map((s) => (
                <button key={s.value} type="button" onClick={() => set('shifts', toggle(f.shifts, s.value))}
                  className={cn('rounded-lg border px-3 py-1.5 text-sm', f.shifts.includes(s.value) ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted')}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tipo de contrato</Label>
            <div className="flex flex-wrap gap-2">
              {CONTRACT_TYPES.map((c) => (
                <button key={c.value} type="button" onClick={() => set('contractTypes', toggle(f.contractTypes, c.value))}
                  className={cn('rounded-lg border px-3 py-1.5 text-sm', f.contractTypes.includes(c.value) ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted')}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf-sum">Breve apresentação (opcional)</Label>
            <Textarea id="pf-sum" rows={3} maxLength={1000} value={f.summary}
              onChange={(e) => set('summary', e.target.value)}
              placeholder="Ex.: Trabalhei 3 anos em limpeza de escritórios…" />
          </div>
          <Button type="submit" disabled={busy} className="w-full sm:w-auto">
            {busy && <Loader2Icon className="animate-spin" />}
            {busy ? 'A guardar…' : 'Guardar perfil'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
