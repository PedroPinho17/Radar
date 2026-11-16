import Link from 'next/link';
import { BellRingIcon, RadarIcon, SparklesIcon, TargetIcon } from 'lucide-react';

const FEATURES = [
  { icon: TargetIcon, text: 'Ofertas de vários sites de emprego, para qualquer área, filtradas pelo que procuras.' },
  { icon: SparklesIcon, text: 'A IA compara cada oferta com o teu perfil e dá-lhe uma nota.' },
  { icon: BellRingIcon, text: 'Um email com as melhores, nos dias e horas que escolheres.' },
];

/** Layout das páginas sem sessão: painel da marca à esquerda, formulário à direita. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -top-32 -right-32 size-[28rem] rounded-full border-[3rem] border-white/5" />
        <div className="pointer-events-none absolute -top-12 -right-12 size-64 rounded-full border-[2rem] border-white/5" />
        <Link href="/bem-vindo" className="flex w-fit items-center gap-2 text-lg font-semibold">
          <RadarIcon className="size-6" /> Radar
        </Link>
        <div className="relative space-y-8">
          <h2 className="max-w-md text-4xl leading-tight font-semibold tracking-tight">
            Encontra o próximo emprego sem passar o dia a procurar.
          </h2>
          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-primary-foreground/85">
                <span className="mt-0.5 rounded-lg bg-white/10 p-1.5"><Icon className="size-4" /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-primary-foreground/60">Podes descarregar ou apagar os teus dados quando quiseres.</p>
      </aside>

      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <Link href="/bem-vindo" className="mb-6 flex w-fit items-center gap-2 text-lg font-semibold text-primary lg:hidden">
              <RadarIcon className="size-6" /> Radar
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
          <p className="pt-4 text-center text-xs text-muted-foreground">
            <Link href="/termos" className="hover:text-foreground hover:underline">Termos de Utilização</Link>
            {' · '}
            <Link href="/privacidade" className="hover:text-foreground hover:underline">Privacidade</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

/** Mensagem de erro por baixo de um formulário (lida pelos leitores de ecrã). */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}
