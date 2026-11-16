'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type Lang = 'pt' | 'en';

export function CoverLetter({ matchId, initial }: { matchId: string; initial: string | null }) {
  const [letter, setLetter] = useState(initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Lang | null>(null);

  async function generate(language: Lang) {
    setBusy(language);
    const id = toast.loading('A escrever a carta…');
    try {
      const res = await api<{ letter: string }>(`/jobs/matches/${matchId}/cover-letter`, {
        method: 'POST',
        json: { language },
      });
      setLetter(res.letter);
      setOpen(true);
      toast.success('Carta pronta. Revê antes de usar.', { id });
    } catch (err) {
      toast.error((err as Error).message, { id });
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    if (!letter) return;
    await navigator.clipboard.writeText(letter);
    toast.success('Copiada.');
  }

  return (
    <div className="space-y-2 border-t pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Carta:</span>
        <Button variant="outline" size="sm" disabled={!!busy} onClick={() => generate('pt')}>
          {busy === 'pt' ? 'A escrever…' : letter ? 'Nova em PT' : 'Gerar em PT'}
        </Button>
        <Button variant="outline" size="sm" disabled={!!busy} onClick={() => generate('en')}>
          {busy === 'en' ? 'A escrever…' : letter ? 'Nova em EN' : 'Gerar em EN'}
        </Button>
        {letter && (
          <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
            {open ? 'Esconder' : 'Ver carta'}
          </Button>
        )}
      </div>

      {letter && open && (
        <div className="space-y-2">
          {/* podes editar aqui antes de copiar; as alterações não são guardadas */}
          <Textarea rows={12} value={letter} onChange={(e) => setLetter(e.target.value)} />
          <Button size="sm" onClick={copy}>Copiar</Button>
        </div>
      )}
    </div>
  );
}