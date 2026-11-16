'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { CircleCheckIcon, Loader2Icon, XIcon } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { api } from '@/lib/api';
import { FormError } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';

export type FeedbackType = 'bug' | 'oferta' | 'sugestao' | 'outro';

const TYPES: { value: FeedbackType; label: string }[] = [
  { value: 'bug', label: 'Alguma coisa não funciona' },
  { value: 'oferta', label: 'Uma oferta foi mal avaliada' },
  { value: 'sugestao', label: 'Tenho uma sugestão' },
  { value: 'outro', label: 'Outro assunto' },
];

/**
 * "Reportar um problema": abre um diálogo a partir de qualquer botão/link (`children`).
 * Com `matchId`, fica ligado a uma oferta ("a nota está errada").
 */
export function FeedbackDialog({ children, type = 'bug', matchId, context }: {
  children: React.ReactNode;
  type?: FeedbackType;
  matchId?: string;
  /** Ex.: título da oferta, mostrado no diálogo. */
  context?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackType>(type);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // limpa só depois de fechar (sem saltos visuais)
      setTimeout(() => { setSent(false); setMessage(''); setError(null); setKind(type); }, 200);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (message.trim().length < 10) return setError('Conta-nos um pouco mais (pelo menos 10 caracteres).');
    setBusy(true);
    try {
      await api('/feedback', { method: 'POST', json: { type: kind, message, page: pathname, matchId } });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-popover p-6 text-popover-foreground shadow-2xl ring-1 ring-foreground/10 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <Dialog.Close className="absolute top-4 right-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Fechar">
            <XIcon className="size-4" />
          </Dialog.Close>

          {sent ? (
            <div className="space-y-4 py-2 text-center">
              <CircleCheckIcon className="mx-auto size-10 text-green-600" />
              <Dialog.Title className="text-lg font-semibold">Obrigado!</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                Recebemos a tua mensagem. Se precisarmos de mais detalhes, respondemos para o teu email.
              </Dialog.Description>
              <Button className="w-full" onClick={() => onOpenChange(false)}>Fechar</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1 pr-6">
                <Dialog.Title className="text-lg font-semibold">Reportar um problema</Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground">
                  {context ? <>Sobre: <strong className="text-foreground">{context}</strong></> : 'Diz-nos o que correu mal ou o que podia ser melhor.'}
                </Dialog.Description>
              </div>
              <div className="space-y-2">
                <Label htmlFor="feedback-type">O que se passa?</Label>
                <NativeSelect id="feedback-type" value={kind} onChange={(e) => setKind(e.target.value as FeedbackType)}>
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="feedback-message">Mensagem</Label>
                <Textarea id="feedback-message" rows={5} maxLength={2000} autoFocus value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={kind === 'oferta'
                    ? 'Ex.: a nota está alta mas a oferta pede 5 anos de experiência e eu tenho 1.'
                    : 'Ex.: ao guardar as preferências aparece um erro.'} />
                <p className="text-right text-xs text-muted-foreground">{message.length}/2000</p>
              </div>
              <FormError message={error} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" disabled={busy}>{busy && <Loader2Icon className="animate-spin" />} Enviar</Button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
