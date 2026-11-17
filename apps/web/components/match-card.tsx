'use client';

import { useState } from 'react';
import {
  BriefcaseIcon, BuildingIcon, CheckCircle2Icon, ClockIcon, ExternalLinkIcon, MapPinIcon,
  ThumbsDownIcon, ThumbsUpIcon, WalletIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { safeUrl } from '@/lib/url';
import type { Decision, Match } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CoverLetter } from '@/components/cover-letter';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { sourceLabel } from '@/lib/sources';
const MODEL: Record<string, string> = { remote: 'Remoto', hybrid: 'Híbrido', onsite: 'Presencial' };
const fmt = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 });

/** Anel com a nota, colorido por faixa. */
export function ScoreRing({ score }: { score: number }) {
  const color = score >= 75 ? 'text-green-600 dark:text-green-400' : score >= 60 ? 'text-amber-500' : 'text-muted-foreground';
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn('relative size-14 shrink-0', color)} title={`Nota ${score}/100`} aria-label={`Nota ${score} em 100`}>
      <svg viewBox="0 0 48 48" className="size-full -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="4" className="stroke-muted" />
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="4" stroke="currentColor" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums">{score}</span>
    </div>
  );
}

export function MatchCard({ match, onChange }: { match: Match; onChange: (m: Match) => void }) {
  const { job } = match;
  const [asking, setAsking] = useState<'like' | 'dislike' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [changing, setChanging] = useState(false); // a mudar uma decisão já tomada
  const url = safeUrl(job.url);

  async function decide(decision: Decision, why?: string) {
    setBusy(true);
    try {
      if (decision === 'applied') {
        await api('/applications', { method: 'POST', json: { jobId: job.id } });
        onChange({ ...match, decision: 'applied', decisionReason: null });
        toast.success('Candidatura registada. Acompanha-a em Candidaturas.');
      } else {
        const saved = await api<Match>(`/jobs/matches/${match.id}/decision`, {
          method: 'POST',
          json: { decision, reason: why || undefined },
        });
        onChange({ ...match, decision: saved.decision, decisionReason: saved.decisionReason });
      }
      setAsking(null);
      setReason('');
      setChanging(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const salary =
    job.salaryMin || job.salaryMax
      ? `${job.salaryMin ? fmt.format(job.salaryMin) : '?'} – ${job.salaryMax ? fmt.format(job.salaryMax) : '?'} €`
      : match.estimatedSalary
        ? `≈ ${fmt.format(match.estimatedSalary)} €/ano (estimado)`
        : null;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <CardTitle className="text-lg leading-snug font-semibold">
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer" className="group inline-flex items-start gap-1.5 hover:text-primary">
                {job.title}
                <ExternalLinkIcon className="mt-1 size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
              </a>
            ) : job.title}
          </CardTitle>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><BuildingIcon className="size-3.5" />{job.company}</span>
            {salary && <span className="flex items-center gap-1"><WalletIcon className="size-3.5" />{salary}</span>}
          </div>
          <div className="flex flex-wrap gap-2 pt-1 text-sm">
            {(job.location || job.workModel) && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 font-medium">
                <MapPinIcon className="size-3.5 shrink-0" />
                {[job.location, job.workModel && MODEL[job.workModel]].filter(Boolean).join(' · ')}
              </span>
            )}
            {match.schedule && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 font-medium">
                <ClockIcon className="size-3.5 shrink-0" />{match.schedule}
              </span>
            )}
            {match.contractType && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 font-medium">
                <BriefcaseIcon className="size-3.5 shrink-0" />{match.contractType}
              </span>
            )}
          </div>
        </div>
        <ScoreRing score={match.score} />
      </CardHeader>

      <CardContent className="space-y-4">
        {url && (
          <Button asChild className="w-full sm:w-auto">
            <a href={url} target="_blank" rel="noopener noreferrer">
              Ver oferta <ExternalLinkIcon />
            </a>
          </Button>
        )}
        <ul className="space-y-1.5 text-sm">
          {match.reasons.map((r) => (
            <li key={r} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" />{r}</li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{sourceLabel(job.source)}</Badge>
          {job.area && <Badge variant="outline">{job.area}</Badge>}
          {match.minYears !== null && <Badge variant="outline">{match.minYears}+ anos</Badge>}
          {match.englishRequired && <Badge variant="outline">Inglês</Badge>}
          {match.missingSkills.map((s) => <Badge key={s} variant="destructive">Falta: {s}</Badge>)}
        </div>

        {match.decision && !changing ? (
          <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
            {match.decision === 'like' && <><ThumbsUpIcon className="size-4 text-green-600" /> Gostaste</>}
            {match.decision === 'dislike' && <><ThumbsDownIcon className="size-4 text-red-500" /> Não gostaste</>}
            {match.decision === 'applied' && <><CheckCircle2Icon className="size-4 text-primary" /> Candidataste-te</>}
            {match.decisionReason && <span className="text-muted-foreground">— {match.decisionReason}</span>}
            {/* uma candidatura acompanha-se em Candidaturas; gosto/não gosto pode mudar-se aqui */}
            {match.decision !== 'applied' && (
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setChanging(true)}>Mudar</Button>
            )}
          </div>
        ) : asking ? (
          <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void decide(asking, reason); }}>
            <Input
              autoFocus
              className="h-9 min-w-48 flex-1"
              placeholder={asking === 'like' ? 'Porque gostaste? (opcional, ajuda a IA)' : 'Porque não? (opcional, ajuda a IA)'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
            />
            <Button type="submit" size="lg" disabled={busy}>Guardar</Button>
            <Button type="button" size="lg" variant="ghost" onClick={() => setAsking(null)}>Cancelar</Button>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setAsking('like')}><ThumbsUpIcon /> Gosto</Button>
            <Button variant="outline" disabled={busy} onClick={() => setAsking('dislike')}><ThumbsDownIcon /> Não gosto</Button>
            <Button disabled={busy} onClick={() => decide('applied')}><CheckCircle2Icon /> Candidatei-me</Button>
            {changing && <Button variant="ghost" disabled={busy} onClick={() => setChanging(false)}>Cancelar</Button>}
          </div>
        )}
        <CoverLetter matchId={match.id} initial={match.coverLetter} />
        <div className="flex justify-end">
          <FeedbackDialog type="oferta" matchId={match.id} context={`${job.title} · nota ${match.score}`}>
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground hover:underline">A nota está errada?</button>
          </FeedbackDialog>
        </div>
      </CardContent>
    </Card>
  );
}
