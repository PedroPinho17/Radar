import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeftIcon, RadarIcon } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacidade',
  description: 'Que dados o Radar guarda, para quê, com quem os partilha e como os apagas.',
};

/** Contacto do responsável pelo tratamento (definido no deploy). */
const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
const UPDATED = '16 de novembro de 2026';

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 mb-3 text-lg font-semibold tracking-tight">{children}</h2>;
}

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 md:py-16">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Voltar ao Radar
      </Link>
      <div className="mb-2 flex items-center gap-2 font-semibold text-primary"><RadarIcon className="size-5" /> Radar</div>
      <h1 className="text-3xl font-semibold tracking-tight">Privacidade e dados pessoais</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: {UPDATED}</p>

      <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-foreground/90 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-1.5">
        <p>
          O Radar ajuda-te a encontrar emprego: lê o teu CV, compara-o com ofertas publicadas em sites de emprego e
          envia-te as que combinam contigo. Esta página explica, em linguagem simples, o que fazemos com os teus dados,
          de acordo com o Regulamento Geral sobre a Proteção de Dados (RGPD).
        </p>

        <H2>Quem é responsável</H2>
        <p>
          O responsável pelo tratamento dos dados é quem gere o Radar.{' '}
          {CONTACT
            ? <>Para qualquer questão sobre os teus dados escreve para <a className="font-medium text-primary hover:underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.</>
            : <>Para qualquer questão sobre os teus dados responde a um dos emails que recebes do Radar.</>}
        </p>

        <H2>Que dados guardamos</H2>
        <ul>
          <li><strong>Conta:</strong> email, password (guardada só como hash, nunca em texto), data de criação, data em que confirmaste o email e em que aceitaste esta política.</li>
          <li><strong>Perfil:</strong> o resumo que a IA extrai do teu CV (função, anos de experiência, competências, línguas, localidade, área). <strong>O PDF do CV não é guardado</strong>: é usado para criar o resumo e descartado.</li>
          <li><strong>Preferências:</strong> funções, cidades, salário atual e pretendido, notas para a IA, utilizador do GitHub (opcional) e definições dos emails.</li>
          <li><strong>Atividade:</strong> notas da IA para cada oferta, o que marcaste (gostei, não gostei, candidatei-me), cartas de apresentação geradas e o histórico das tuas candidaturas.</li>
          <li><strong>Sessão:</strong> um cookie técnico necessário para te manter com sessão iniciada. Não usamos cookies de publicidade nem de análise.</li>
        </ul>

        <H2>Para que os usamos</H2>
        <ul>
          <li>Procurar ofertas e dar-lhes uma nota de compatibilidade com o teu perfil.</li>
          <li>Enviar-te os resumos por email nos dias e horas que escolheres (podes desligá-los a qualquer momento).</li>
          <li>Escrever cartas de apresentação quando o pedes.</li>
          <li>Manter a tua conta segura (por exemplo, limitar tentativas de login).</li>
        </ul>
        <p>
          A base legal é a execução do serviço que pediste ao criar conta (art. 6.º, n.º 1, alínea b) do RGPD).
          Não vendemos dados, não fazemos publicidade e não partilhamos o teu perfil com empresas que publicam ofertas.
        </p>

        <H2>Com quem são partilhados</H2>
        <p>Para funcionar, o Radar usa estes serviços externos, que tratam dados por nossa conta:</p>
        <ul>
          <li><strong>Google (Gemini)</strong> e <strong>Groq</strong>: modelos de inteligência artificial. Recebem o PDF do CV (só o Gemini, ao criar o perfil), o resumo do perfil, as preferências relevantes e o texto das ofertas, para devolverem a nota ou a carta.</li>
          <li><strong>Google (Gmail)</strong>: envio dos emails.</li>
          <li><strong>GitHub</strong>: só se indicares o teu utilizador, para ler os teus repositórios públicos.</li>
          <li><strong>Alojamento</strong>: o servidor e a base de dados onde o Radar corre.</li>
        </ul>
        <p>Alguns destes fornecedores podem tratar dados fora da União Europeia, ao abrigo das garantias previstas no RGPD.</p>

        <H2>Durante quanto tempo</H2>
        <ul>
          <li>Enquanto tiveres conta. Ao apagá-la, tudo é apagado de imediato e de forma definitiva.</li>
          <li>Contas que nunca confirmaram o email: apagadas automaticamente ao fim de 7 dias.</li>
          <li>Sessões: 30 dias. Links de recuperação de password: 30 minutos.</li>
          <li>Ofertas de emprego que ninguém marcou: apagadas ao fim de 60 dias.</li>
        </ul>

        <H2>Os teus direitos</H2>
        <p>Podes, a qualquer momento e sem custos:</p>
        <ul>
          <li><strong>Aceder e levar os teus dados</strong>: em Perfil › Segurança › “Descarregar os meus dados” (ficheiro JSON).</li>
          <li><strong>Corrigir</strong>: edita o perfil e as preferências, ou envia um CV novo.</li>
          <li><strong>Apagar</strong>: em Perfil › Segurança › “Apagar conta”.</li>
          <li><strong>Opor-te aos emails</strong>: desliga-os em Perfil › Emails.</li>
          <li>
            <strong>Apresentar queixa</strong> à Comissão Nacional de Proteção de Dados (CNPD), em{' '}
            <a className="text-primary hover:underline" href="https://www.cnpd.pt" target="_blank" rel="noopener noreferrer">cnpd.pt</a>.
          </li>
        </ul>

        <H2>Segurança</H2>
        <p>
          Passwords guardadas com scrypt, sessões em cookies httpOnly, ligações cifradas (HTTPS), limites contra tentativas
          repetidas e acesso aos dados restrito à tua conta. Nenhum sistema é infalível: se detetarmos uma falha que afete
          os teus dados, avisamos-te e à CNPD nos prazos legais.
        </p>

        <H2>Termos</H2>
        <p>
          As regras de utilização do serviço estão nos{' '}
          <Link href="/termos" className="font-medium text-primary hover:underline">Termos de Utilização</Link>.
        </p>

        <H2>Alterações</H2>
        <p>Se esta política mudar de forma relevante, avisamos por email antes de as alterações produzirem efeito.</p>
      </div>
    </main>
  );
}
