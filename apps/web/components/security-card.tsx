'use client';

import { useState } from 'react';
import { DownloadIcon, KeyRoundIcon, Loader2Icon, MonitorSmartphoneIcon, ShieldCheckIcon, Trash2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { FormError } from '@/components/auth-shell';
import { PasswordInput, PasswordStrength } from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

export function SecurityCard() {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function exportData() {
    setExporting(true);
    try {
      const data = await api<unknown>('/account/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: 'radar-os-meus-dados.json' });
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Ficheiro descarregado.');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteError(null);
    setDeleting(true);
    try {
      await api('/auth/account', { method: 'DELETE', json: { password: deletePassword } });
      toast.success('Conta apagada. Obrigado por teres usado o Radar.');
      router.replace('/login');
      router.refresh();
    } catch (err) {
      setDeleteError((err as Error).message);
      setDeleting(false);
    }
  }

  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mismatch = confirm.length > 0 && confirm !== next;

  function reset() {
    setOpen(false);
    setCurrent('');
    setNext('');
    setConfirm('');
    setError(null);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 8) return setError('A nova password tem de ter pelo menos 8 caracteres.');
    if (next !== confirm) return setError('As passwords novas não coincidem.');
    setBusy(true);
    try {
      await api('/auth/change-password', { method: 'POST', json: { currentPassword: current, newPassword: next } });
      toast.success('Password alterada. As outras sessões foram terminadas.');
      reset();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function logoutOthers() {
    setClosing(true);
    try {
      const { closed } = await api<{ closed: number }>('/auth/logout-others', { method: 'POST' });
      toast.success(closed ? `${closed} sess${closed === 1 ? 'ão terminada' : 'ões terminadas'}.` : 'Não havia outras sessões abertas.');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setClosing(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3">
        <span className="rounded-lg bg-primary/10 p-2 text-primary"><ShieldCheckIcon className="size-5" /></span>
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">Segurança</CardTitle>
          <CardDescription>Password, sessões e os teus dados pessoais.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {open ? (
          <form onSubmit={changePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Password atual</Label>
              <PasswordInput id="current-password" autoComplete="current-password" required autoFocus
                value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova password</Label>
                <PasswordInput id="new-password" autoComplete="new-password" required minLength={8} maxLength={200}
                  value={next} onChange={(e) => setNext(e.target.value)} />
                <PasswordStrength password={next} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Repete a nova password</Label>
                <PasswordInput id="confirm-password" autoComplete="new-password" required maxLength={200}
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch || undefined} />
                {mismatch && <p className="text-xs text-destructive">As passwords não coincidem.</p>}
              </div>
            </div>
            <FormError message={error} />
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                {busy && <Loader2Icon className="animate-spin" />} Guardar nova password
              </Button>
              <Button type="button" variant="ghost" onClick={reset}>Cancelar</Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-sm">
              <KeyRoundIcon className="size-4 text-muted-foreground" />
              <span>Password</span>
            </div>
            <Button variant="outline" onClick={() => setOpen(true)}>Mudar password</Button>
          </div>
        )}
        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm">
            <MonitorSmartphoneIcon className="size-4 text-muted-foreground" />
            <span>Terminar sessão em todos os outros dispositivos</span>
          </div>
          <Button variant="outline" onClick={logoutOthers} disabled={closing}>
            {closing && <Loader2Icon className="animate-spin" />} Terminar outras sessões
          </Button>
        </div>
        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm">
            <DownloadIcon className="size-4 text-muted-foreground" />
            <span>Descarregar uma cópia de todos os teus dados</span>
          </div>
          <Button variant="outline" onClick={exportData} disabled={exporting}>
            {exporting && <Loader2Icon className="animate-spin" />} Descarregar os meus dados
          </Button>
        </div>
        <Separator />
        {deleteOpen ? (
          <form onSubmit={deleteAccount} className="space-y-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="space-y-1">
              <p className="font-medium text-destructive">Apagar a conta de vez</p>
              <p className="text-sm text-muted-foreground">
                Apagamos já o teu perfil, preferências, notas, cartas e candidaturas. Não dá para desfazer.
                Se quiseres guardar alguma coisa, descarrega primeiro os teus dados.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="delete-password">A tua password</Label>
                <PasswordInput id="delete-password" autoComplete="current-password" required
                  value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delete-confirm">Escreve APAGAR para confirmar</Label>
                <Input id="delete-confirm" className="h-10" autoComplete="off" value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)} />
              </div>
            </div>
            <FormError message={deleteError} />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="destructive"
                disabled={deleting || !deletePassword || deleteConfirm.trim().toUpperCase() !== 'APAGAR'}>
                {deleting ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />} Apagar a minha conta
              </Button>
              <Button type="button" variant="ghost" onClick={() => { setDeleteOpen(false); setDeletePassword(''); setDeleteConfirm(''); setDeleteError(null); }}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-sm">
              <Trash2Icon className="size-4 text-destructive" />
              <span>Apagar a conta e todos os dados</span>
            </div>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>Apagar conta</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
