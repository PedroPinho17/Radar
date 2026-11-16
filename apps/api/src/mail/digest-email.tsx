import {
  Body, Button, Column, Container, Head, Heading, Hr, Html, Link, Preview, Row, Section, Text,
} from 'react-email';

export type DigestJob = {
  title: string;
  company: string;
  location: string | null;
  workModel: string | null; // já em português: "Remoto", "Híbrido"…
  salary: string | null;    // já formatado: "25 000 – 30 000 €"
  url: string;
  score: number;
  reasons: string[];
};
export type DigestStale = { title: string; company: string; url: string; status: string; days: number };

/** Links das ofertas vêm de sites externos: só http(s), nunca javascript: e afins. */
const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : '#');

const BRAND = '#4f46e5';
const INK = '#18181b';
const MUTED = '#71717a';
const LINE = '#e4e4e7';
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Cor da nota (igual à do site). */
const scoreStyle = (s: number) =>
  s >= 75 ? { bg: '#dcfce7', fg: '#15803d', label: 'Muito boa' }
  : s >= 60 ? { bg: '#fef3c7', fg: '#b45309', label: 'Boa' }
  : { bg: '#f4f4f5', fg: '#52525b', label: 'Possível' };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function JobCard({ job }: { job: DigestJob }) {
  const s = scoreStyle(job.score);
  const meta = [job.company, job.location, job.workModel, job.salary].filter(Boolean).join('  ·  ');
  return (
    <Section style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: '16px 18px', marginBottom: 12 }}>
      <Row>
        <Column style={{ width: 56, verticalAlign: 'top' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 22, backgroundColor: s.bg, color: s.fg,
            fontSize: 16, fontWeight: 700, lineHeight: '44px', textAlign: 'center',
          }}>{job.score}</div>
        </Column>
        <Column style={{ verticalAlign: 'top' }}>
          <Link href={safeUrl(job.url)} style={{ color: INK, fontSize: 16, fontWeight: 700, lineHeight: '22px', textDecoration: 'none' }}>
            {job.title}
          </Link>
          <Text style={{ color: MUTED, fontSize: 13, lineHeight: '18px', margin: '4px 0 0' }}>{meta}</Text>
        </Column>
      </Row>
      {job.reasons.length > 0 && (
        <Section style={{ marginTop: 12 }}>
          {job.reasons.slice(0, 3).map((r) => (
            <Text key={r} style={{ color: '#3f3f46', fontSize: 14, lineHeight: '20px', margin: '0 0 4px', paddingLeft: 14, textIndent: -14 }}>
              <span style={{ color: BRAND }}>•</span>&nbsp;&nbsp;{r}
            </Text>
          ))}
        </Section>
      )}
      <Text style={{ margin: '10px 0 0', fontSize: 14 }}>
        <Link href={safeUrl(job.url)} style={{ color: BRAND, fontWeight: 600, textDecoration: 'none' }}>Ver oferta →</Link>
      </Text>
    </Section>
  );
}

export function DigestEmail({ jobs, stale, appUrl, more = 0, dateLabel }: {
  jobs: DigestJob[];
  stale: DigestStale[];
  appUrl: string;
  /** Ofertas que ficaram de fora por causa do limite por email. */
  more?: number;
  /** Ex.: "sexta-feira, 13 de novembro" */
  dateLabel: string;
}) {
  const total = jobs.length + more;
  const best = jobs[0]?.score;
  const preview = jobs.length
    ? `${plural(total, 'oferta nova', 'ofertas novas')} para ti${best ? ` · a melhor tem nota ${best}` : ''}`
    : `${plural(stale.length, 'candidatura precisa', 'candidaturas precisam')} de follow-up`;
  const settings = `${appUrl}/perfil#emails`;

  return (
    <Html lang="pt-PT">
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: '#f4f4f7', fontFamily: FONT, margin: 0, padding: '24px 12px' }}>
        <Container style={{ maxWidth: 600, width: '100%' }}>
          {/* cabeçalho */}
          <Section style={{ padding: '0 4px 16px' }}>
            <Row>
              <Column>
                <Text style={{ margin: 0, fontSize: 18, fontWeight: 700, color: BRAND }}>◎ Radar</Text>
              </Column>
              <Column style={{ textAlign: 'right' }}>
                <Text style={{ margin: 0, fontSize: 13, color: MUTED }}>{dateLabel}</Text>
              </Column>
            </Row>
          </Section>

          <Section style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: '28px 24px' }}>
            {jobs.length > 0 && (
              <>
                <Heading as="h1" style={{ fontSize: 22, lineHeight: '28px', color: INK, margin: '0 0 6px' }}>
                  {total === 1 ? 'Encontrámos uma oferta nova para ti' : `Encontrámos ${total} ofertas novas para ti`}
                </Heading>
                <Text style={{ fontSize: 15, color: MUTED, margin: '0 0 20px' }}>
                  Ordenadas pela nota que a IA lhes deu face ao teu perfil.
                </Text>

                {jobs.map((j) => <JobCard key={j.url} job={j} />)}

                {more > 0 && (
                  <Text style={{ color: MUTED, fontSize: 14, textAlign: 'center', margin: '4px 0 16px' }}>
                    E mais {plural(more, 'oferta', 'ofertas')} à tua espera no Radar.
                  </Text>
                )}
                <Section style={{ textAlign: 'center', marginTop: 8 }}>
                  <Button href={appUrl} style={{
                    backgroundColor: BRAND, color: '#ffffff', borderRadius: 10, padding: '12px 22px',
                    fontSize: 15, fontWeight: 600,
                  }}>
                    {more > 0 ? 'Ver todas no Radar' : 'Abrir o Radar'}
                  </Button>
                </Section>
              </>
            )}

            {stale.length > 0 && (
              <Section style={{
                marginTop: jobs.length ? 28 : 0, backgroundColor: '#fffbeb', border: '1px solid #fde68a',
                borderRadius: 12, padding: '16px 18px',
              }}>
                <Heading as="h2" style={{ fontSize: 16, color: '#92400e', margin: '0 0 4px' }}>
                  ⏰ Hora de um follow-up
                </Heading>
                <Text style={{ fontSize: 13, color: '#a16207', margin: '0 0 12px' }}>
                  {stale.length === 1 ? 'Esta candidatura está' : 'Estas candidaturas estão'} sem novidades há mais de 2 semanas.
                  Um email curto a perguntar pelo processo costuma ajudar.
                </Text>
                {stale.map((a) => (
                  <Text key={a.url} style={{ fontSize: 14, lineHeight: '20px', margin: '0 0 8px', color: INK }}>
                    <Link href={safeUrl(a.url)} style={{ color: INK, fontWeight: 600 }}>{a.title}</Link>
                    <br />
                    <span style={{ color: MUTED, fontSize: 13 }}>{a.company} · {a.status} · há {plural(a.days, 'dia', 'dias')}</span>
                  </Text>
                ))}
                <Link href={`${appUrl}/candidaturas`} style={{ fontSize: 14, fontWeight: 600, color: '#92400e' }}>
                  Atualizar candidaturas →
                </Link>
              </Section>
            )}
          </Section>

          {/* rodapé */}
          <Section style={{ padding: '20px 8px 0', textAlign: 'center' }}>
            <Text style={{ color: '#a1a1aa', fontSize: 12, lineHeight: '18px', margin: '0 0 6px' }}>
              A nota (0–100) mostra quão bem cada oferta combina com o teu CV e preferências.
            </Text>
            <Hr style={{ borderColor: LINE, margin: '12px 0' }} />
            <Text style={{ color: '#a1a1aa', fontSize: 12, lineHeight: '18px', margin: 0 }}>
              Recebes este email porque ativaste os resumos do Radar.
              <br />
              <Link href={settings} style={{ color: MUTED }}>Mudar dias, horas e quantidade</Link>
              {'  ·  '}
              <Link href={settings} style={{ color: MUTED }}>Deixar de receber</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
