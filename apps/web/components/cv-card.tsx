'use client';

import { useRef, useState } from 'react';
import { FileTextIcon, Loader2Icon, SparklesIcon, UploadCloudIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Profile } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const MAX_MB = 5;
const SENIORITY: Record<string, string> = { junior: 'Júnior', mid: 'Intermédio', senior: 'Sénior' };

function checkPdf(file: File): string | null {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return 'Tem de ser um PDF.';
  if (file.size > MAX_MB * 1024 * 1024) return `O ficheiro tem mais de ${MAX_MB} MB.`;
  return null;
}

function DropZone({ label, hint, file, onFile, optional }: {
  label: string;
  hint: string;
  file: File | null;
  onFile: (f: File | null) => void;
  optional?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function pick(f: File | undefined) {
    if (!f) return;
    const err = checkPdf(f);
    if (err) return toast.error(`${label}: ${err}`);
    onFile(f);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); }}
      className={cn(
        'relative flex min-h-28 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-4 text-center transition-colors',
        over ? 'border-primary bg-primary/5' : file ? 'border-primary/40 bg-primary/5' : 'hover:border-primary/40 hover:bg-muted/50',
      )}
    >
      <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label={label}
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      {file ? (
        <>
          <FileTextIcon className="size-6 text-primary" />
          <p className="max-w-full truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          <button type="button" onClick={() => onFile(null)} aria-label={`Remover ${label}`}
            className="absolute top-2 right-2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <XIcon className="size-4" />
          </button>
        </>
      ) : (
        <button type="button" onClick={() => input.current?.click()} className="flex flex-col items-center gap-1">
          <UploadCloudIcon className="size-6 text-muted-foreground" />
          <span className="text-sm font-medium">{label}{optional && <span className="font-normal text-muted-foreground"> (opcional)</span>}</span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </button>
      )}
    </div>
  );
}

export function CvCard({ profile, onSaved }: { profile: Profile | null; onSaved: (p: Profile) => void }) {
  const [busy, setBusy] = useState(false);
  const [cv, setCv] = useState<File | null>(null);
  const [linkedin, setLinkedin] = useState<File | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cv) return toast.error('Escolhe primeiro o PDF do teu CV.');
    const form = new FormData();
    form.append('cv', cv);
    if (linkedin) form.append('linkedin', linkedin);
    setBusy(true);
    const id = toast.loading('A IA está a ler o teu CV… pode demorar até um minuto.');
    try {
      onSaved(await api<Profile>('/profile/cv', { method: 'POST', body: form }));
      toast.success('Perfil atualizado.', { id });
      setCv(null);
      setLinkedin(null);
    } catch (err) {
      toast.error((err as Error).message, { id });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3">
        <span className="rounded-lg bg-primary/10 p-2 text-primary"><SparklesIcon className="size-5" /></span>
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">CV (opcional)</CardTitle>
          <CardDescription>Se tiveres PDF, a IA lê-o. Se não, usa o formulário em baixo.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {profile ? (
          <div className="space-y-3 rounded-xl bg-muted/50 p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-base">{profile.title}</strong>
              <Badge variant="secondary">{SENIORITY[profile.seniority] ?? profile.seniority}</Badge>
              <Badge variant="outline">{profile.yearsExperience} ano{profile.yearsExperience === 1 ? '' : 's'} de experiência</Badge>
              {profile.location && <Badge variant="outline">{profile.location}</Badge>}
              {profile.sector && <Badge variant="outline">{profile.sector}</Badge>}
              {profile.source === 'form' && <Badge variant="outline">Sem CV</Badge>}
            </div>
            <p className="text-muted-foreground">{profile.summary}</p>
            <div className="flex flex-wrap gap-1">
              {profile.skills.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
            </div>
            {profile.languages.length > 0 && <p className="text-muted-foreground">Línguas: {profile.languages.join(', ')}</p>}
          </div>
        ) : (
          <p className="rounded-xl bg-primary/5 p-4 text-sm">
            <strong>Perfil:</strong> envia um CV em PDF ou preenche o formulário sem CV. Escolhe primeiro a tua área em «O que procuras».
          </p>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <DropZone label="CV em PDF" hint={`Arrasta para aqui ou clica · até ${MAX_MB} MB`} file={cv} onFile={setCv} />
            <DropZone label="Perfil do LinkedIn" hint="LinkedIn › Mais › Guardar em PDF" file={linkedin} onFile={setLinkedin} optional />
          </div>
          <Button type="submit" disabled={busy || !cv} className="w-full sm:w-auto">
            {busy && <Loader2Icon className="animate-spin" />}
            {busy ? 'A ler…' : profile ? 'Substituir CV' : 'Enviar CV'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
