import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeftIcon, RadarIcon } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Termos de Utilização',
  description: 'As regras simples para usar o Radar.',
};

const UPDATED = '16 de novembro de 2026';

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 mb-3 text-lg font-semibold tracking-tight">{children}</h2>;
}

export default function TermosPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 md:py-16">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Voltar ao Radar
      </Link>
      <div className="mb-2 flex items-center gap-2 font-semibold text-primary"><RadarIcon className="size-5" /> Radar</div>
      <h1 className="text-3xl font-semibold tracking-tight">Termos de Utilização</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: {UPDATED}</p>

      <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-foreground/90 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-1.5">
        <p>
          Ao criar conta no Radar aceitas estes termos. São curtos de propósito: lê-os, demoram dois minutos.
        </p>

        <H2>O que o Radar faz</H2>
        <p>
          O Radar junta ofertas de emprego publicadas em sites de terceiros, compara-as com o teu perfil usando
          inteligência artificial (IA) e mostra-te as que parecem combinar contigo. Também pode escrever rascunhos de
          cartas de apresentação. O Radar <strong>não é uma agência de emprego</strong>, não representa as empresas
          e não te candidata a nada: és sempre tu que decides e te candidatas.
        </p>

        <H2>As notas e textos da IA são indicativos</H2>
        <ul>
          <li>A nota (0–100), as razões e as cartas são geradas automaticamente e <strong>podem estar erradas ou incompletas</strong>.</li>
          <li>Uma nota alta não garante uma entrevista nem um emprego; uma nota baixa não quer dizer que não te devas candidatar.</li>
          <li>Revê sempre as cartas antes de as usar: és responsável pelo que envias às empresas.</li>
          <li>Os dados das ofertas (salário, local, requisitos) vêm dos sites de origem. Confirma-os sempre no anúncio original.</li>
        </ul>

        <H2>Sem garantias</H2>
        <p>
          O Radar é disponibilizado “tal como está”. Fazemos o possível para que funcione bem, mas não garantimos que
          encontre todas as ofertas, que esteja sempre disponível ou que não tenha erros. Os sites de onde vêm as ofertas
          podem mudar ou deixar de funcionar a qualquer momento. Na medida permitida por lei, não somos responsáveis por
          decisões tomadas com base no Radar nem por perdas daí resultantes.
        </p>

        <H2>A tua conta</H2>
        <ul>
          <li>Usa um email que seja teu e mantém a password segura. És responsável pelo que acontece na tua conta.</li>
          <li>O CV e os dados que envias têm de ser teus (ou teres autorização para os usar).</li>
          <li>Não uses o Radar para enviar spam, recolher dados de outras pessoas, sobrecarregar o serviço ou tentar aceder a contas alheias.</li>
          <li>Podemos suspender contas que violem estas regras.</li>
        </ul>

        <H2>Os teus dados</H2>
        <p>
          O que fazemos com os teus dados está explicado na{' '}
          <Link href="/privacidade" className="font-medium text-primary hover:underline">Política de Privacidade</Link>.
          Podes descarregar ou apagar todos os teus dados a qualquer momento, em Perfil › Segurança.
        </p>

        <H2>Fim e alterações</H2>
        <p>
          Podes deixar de usar o Radar e apagar a conta quando quiseres. Se mudarmos estes termos de forma relevante,
          avisamos por email antes de as alterações produzirem efeito. Estes termos regem-se pela lei portuguesa.
        </p>
      </div>
    </main>
  );
}
