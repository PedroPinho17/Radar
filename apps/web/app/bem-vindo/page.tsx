import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRightIcon, BellRingIcon, BuildingIcon, FileTextIcon, MapPinIcon, PenLineIcon, RadarIcon, SendIcon,
  ShieldCheckIcon, SlidersHorizontalIcon, UploadCloudIcon, WalletIcon,
} from 'lucide-react';
import { ScoreRing } from '@/components/match-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: { absolute: 'Radar — o emprego certo vem ter contigo' },
  description:
    'Escolhe a tua área, cria o perfil (com ou sem CV). O Radar procura ofertas, a IA dá uma nota e recebes as melhores por email. Para qualquer profissão.',
  robots: { index: true, follow: true },
};

const PROFESSIONS = [
  'Programador', 'Auxiliar de Ação Educativa', 'Cozinheiro', 'Motorista', 'Enfermeira', 'Administrativa',
  'Operador de Armazém', 'Rececionista', 'Eletricista', 'Empregada de Limpeza', 'Contabilista', 'Educadora de Infância',
];

const STEPS = [
  { icon: SlidersHorizontalIcon, title: 'Escolhe a tua área', text: 'Limpeza, restauração, creche, saúde, comércio, logística, construção, escritório ou informática.' },
  { icon: UploadCloudIcon, title: 'CV ou formulário', text: 'Envia um PDF ou preenche experiência, escolaridade e onde podes trabalhar. Demora um minuto.' },
  { icon: BellRingIcon, title: 'Recebe as melhores', text: 'A IA avalia as ofertas. Recebes as melhores por email, só quando há novidades.' },
];

const FEATURES = [
  { icon: MapPinIcon, title: 'Onde queres', text: 'Distrito, cidade e remoto. Ofertas longe ficam de fora.' },
  { icon: WalletIcon, title: 'Salário', text: 'Salário mínimo opcional: ofertas que pagam menos perdem pontos.' },
  { icon: SlidersHorizontalIcon, title: 'Aprende contigo', text: 'Marca “gosto” ou “não gosto” e as notas seguintes ajustam-se.' },
  { icon: PenLineIcon, title: 'Cartas de apresentação', text: 'Um rascunho curto e simples, adaptado à tua profissão, pronto a rever.' },
  { icon: SendIcon, title: 'Candidaturas', text: 'Acompanha cada candidatura e recebe um lembrete para fazer follow-up.' },
  { icon: ShieldCheckIcon, title: 'Os teus dados', text: 'Sem publicidade. Nada é enviado automaticamente. Descarrega ou apaga tudo quando quiseres.' },
];

/** Exemplo ilustrativo (não é uma oferta real). */
function ExampleOffer() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-primary/20 via-primary/5 to-transparent blur-2xl" />
      <div className="space-y-4 rounded-2xl bg-card p-5 shadow-xl ring-1 ring-foreground/10">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-lg leading-snug font-semibold">Auxiliar de Ação Educativa</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><BuildingIcon className="size-3.5" />Colégio Exemplo</span>
              <span className="flex items-center gap-1"><MapPinIcon className="size-3.5" />Porto · Presencial</span>
            </div>
          </div>
          <ScoreRing score={86} />
        </div>
        <ul className="space-y-1.5 text-sm">
          {['3 anos de experiência em creche, como pedem', 'Fica a 15 minutos de casa', 'Horário de manhã, como preferes'].map((r) => (
            <li key={r} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" />{r}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">Net-Empregos</Badge>
          <Badge variant="destructive">Falta: Primeiros Socorros</Badge>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">Exemplo ilustrativo</p>
    </div>
  );
}

export default function BemVindoPage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 md:px-8">
          <span className="flex items-center gap-2 font-semibold text-primary"><RadarIcon className="size-5" /> Radar</span>
          <nav className="ml-auto flex items-center gap-1 text-sm">
            <a href="#como-funciona" className="hidden rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground sm:block">Como funciona</a>
            <Button variant="ghost" asChild><Link href="/login">Entrar</Link></Button>
            <Button asChild><Link href="/login?modo=registo">Criar conta</Link></Button>
          </nav>
        </div>
      </header>

      <main>
        {/* hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-6">
            <Badge variant="secondary" className="h-6 px-3">Grátis · para qualquer profissão</Badge>
            <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
              O emprego certo vem <span className="text-primary">ter contigo</span>.
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Diz a tua área e o que procuras. O Radar junta ofertas de vários sites, a IA diz-te quais combinam
              contigo e recebes as melhores por email. CV opcional.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="h-11 px-5 text-base" asChild>
                <Link href="/login?modo=registo">Criar conta grátis <ArrowRightIcon /></Link>
              </Button>
              <Button size="lg" variant="outline" className="h-11 px-5 text-base" asChild>
                <a href="#como-funciona">Ver como funciona</a>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Sem cartão. Apagas a conta quando quiseres.</p>
          </div>
          <ExampleOffer />
        </section>

        {/* profissões */}
        <section className="border-y bg-muted/40 py-10">
          <div className="mx-auto max-w-6xl space-y-4 px-4 text-center md:px-8">
            <p className="text-sm font-medium text-muted-foreground">Funciona para quem procura emprego como…</p>
            <div className="flex flex-wrap justify-center gap-2">
              {PROFESSIONS.map((p) => (
                <span key={p} className="rounded-full bg-background px-3 py-1 text-sm ring-1 ring-foreground/10">{p}</span>
              ))}
              <span className="rounded-full px-3 py-1 text-sm text-muted-foreground">e muito mais</span>
            </div>
          </div>
        </section>

        {/* como funciona */}
        <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20 md:px-8">
          <h2 className="text-center text-3xl font-semibold tracking-tight">Como funciona</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">Três passos. Depois o Radar trabalha sozinho.</p>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="relative space-y-3 rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
                <span className="absolute top-6 right-6 text-4xl font-semibold text-primary/15">{i + 1}</span>
                <span className="inline-flex rounded-xl bg-primary/10 p-2.5 text-primary"><Icon className="size-5" /></span>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* funcionalidades */}
        <section className="bg-muted/40 py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <h2 className="text-center text-3xl font-semibold tracking-tight">Tudo o que precisas para a procura</h2>
            <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex gap-4">
                  <span className="h-fit rounded-xl bg-background p-2.5 text-primary ring-1 ring-foreground/10"><Icon className="size-5" /></span>
                  <div className="space-y-1">
                    <h3 className="font-semibold">{title}</h3>
                    <p className="text-sm text-muted-foreground">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* honestidade */}
        <section className="mx-auto max-w-3xl px-4 py-20 text-center md:px-8">
          <FileTextIcon className="mx-auto size-8 text-primary" />
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">Sem promessas que não podemos cumprir</h2>
          <p className="mt-3 text-muted-foreground">
            As notas da IA ajudam-te a escolher onde gastar tempo, mas são indicativas: confirma sempre o anúncio
            original. O Radar não é uma agência e não se candidata por ti: tu é que decides.
          </p>
        </section>

        {/* CTA final */}
        <section className="px-4 pb-20 md:px-8">
          <div className="mx-auto max-w-6xl rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground">
            <h2 className="text-3xl font-semibold tracking-tight">Começa hoje. Demora um minuto.</h2>
            <p className="mx-auto mt-3 max-w-lg text-primary-foreground/80">Cria conta, escolhe a área e o perfil (com ou sem CV). Amanhã de manhã já podes ter as primeiras ofertas no email.</p>
            <Button size="lg" variant="secondary" className="mt-8 h-11 px-6 text-base" asChild>
              <Link href="/login?modo=registo">Criar conta grátis</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground md:px-8">
          <span className="flex items-center gap-2"><RadarIcon className="size-4" /> Radar</span>
          <nav className="flex gap-4">
            <Link href="/termos" className="hover:text-foreground hover:underline">Termos</Link>
            <Link href="/privacidade" className="hover:text-foreground hover:underline">Privacidade</Link>
            <Link href="/login" className="hover:text-foreground hover:underline">Entrar</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
