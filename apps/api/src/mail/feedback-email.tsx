import { Body, Button, Column, Container, Head, Heading, Hr, Html, Link, Preview, Row, Section, Text } from 'react-email';

const BRAND = '#4f46e5';
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Cor de cada tipo de reporte (fundo, texto). */
const TYPE_STYLE: Record<string, { bg: string; fg: string }> = {
  bug: { bg: '#fee2e2', fg: '#b91c1c' },
  oferta: { bg: '#fef3c7', fg: '#b45309' },
  sugestao: { bg: '#dcfce7', fg: '#15803d' },
  outro: { bg: '#e0e7ff', fg: '#4338ca' },
};

const scoreColor = (s: number) => (s >= 75 ? '#16a34a' : s >= 50 ? '#d97706' : '#dc2626');

export interface FeedbackEmailProps {
  type: string;
  typeLabel: string;
  message: string;
  from: string;
  /** página onde a pessoa estava, já com nome legível (ex.: "Ofertas") */
  page?: { label: string; url: string };
  when: string;
  statusUrl: string;
  offer?: {
    title: string;
    company: string;
    location?: string | null;
    score: number;
    reasons: string[];
    missing: string[];
    url?: string | null;
  };
}

const label = { fontSize: 12, lineHeight: '18px', color: '#71717a', margin: 0, width: 72 } as const;
const value = { fontSize: 14, lineHeight: '20px', color: '#18181b', margin: 0 } as const;

/** Aviso para quem gere o Radar: alguém usou "Reportar um problema" ou "A nota está errada?". */
export function FeedbackEmail({ type, typeLabel, message, from, page, when, statusUrl, offer }: FeedbackEmailProps) {
  const tone = TYPE_STYLE[type] ?? TYPE_STYLE.outro!;
  return (
    <Html lang="pt-PT">
      <Head>
        <meta name="color-scheme" content="light" />
      </Head>
      <Preview>{`${typeLabel} — ${message.slice(0, 90)}`}</Preview>
      <Body style={{ backgroundColor: '#f4f4f7', fontFamily: FONT, margin: 0, padding: '24px 12px' }}>
        <Container style={{ maxWidth: 560, width: '100%' }}>
          <Text style={{ margin: '0 0 16px 4px', fontSize: 18, fontWeight: 700, color: BRAND }}>◎ Radar</Text>

          <Section style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: '28px 24px' }}>
            <Text style={{
              display: 'inline-block', margin: '0 0 12px', padding: '4px 10px', borderRadius: 999,
              backgroundColor: tone.bg, color: tone.fg, fontSize: 12, fontWeight: 600,
            }}>{typeLabel}</Text>
            <Heading as="h1" style={{ fontSize: 20, lineHeight: '26px', color: '#18181b', margin: '0 0 16px' }}>
              Novo reporte de um utilizador
            </Heading>

            {/* a mensagem da pessoa */}
            <Section style={{ borderLeft: `4px solid ${BRAND}`, backgroundColor: '#f5f5ff', borderRadius: 8, padding: '12px 16px' }}>
              <Text style={{ fontSize: 15, lineHeight: '22px', color: '#18181b', margin: 0, whiteSpace: 'pre-wrap' }}>{message}</Text>
            </Section>

            <Section style={{ margin: '20px 0 0' }}>
              <Row style={{ marginBottom: 6 }}>
                <Column style={label}>De</Column>
                <Column><Link href={`mailto:${from}`} style={{ ...value, color: BRAND }}>{from}</Link></Column>
              </Row>
              {page && (
                <Row style={{ marginBottom: 6 }}>
                  <Column style={label}>Página</Column>
                  <Column><Link href={page.url} style={{ ...value, color: BRAND }}>{page.label}</Link></Column>
                </Row>
              )}
              <Row>
                <Column style={label}>Quando</Column>
                <Column><Text style={value}>{when}</Text></Column>
              </Row>
            </Section>

            {offer && (
              <Section style={{ border: '1px solid #e4e4e7', borderRadius: 12, padding: '16px', margin: '24px 0 0' }}>
                <Row>
                  <Column>
                    <Text style={{ fontSize: 16, lineHeight: '22px', fontWeight: 700, color: '#18181b', margin: 0 }}>{offer.title}</Text>
                    <Text style={{ fontSize: 13, lineHeight: '20px', color: '#71717a', margin: '2px 0 0' }}>
                      {offer.company}{offer.location ? ` · ${offer.location}` : ''}
                    </Text>
                  </Column>
                  <Column style={{ width: 56, textAlign: 'right', verticalAlign: 'top' }}>
                    <Text style={{
                      display: 'inline-block', margin: 0, padding: '6px 10px', borderRadius: 999,
                      border: `2px solid ${scoreColor(offer.score)}`, color: scoreColor(offer.score), fontSize: 15, fontWeight: 700,
                    }}>{offer.score}</Text>
                  </Column>
                </Row>
                <Text style={{ fontSize: 12, fontWeight: 600, color: '#71717a', margin: '14px 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Razões da IA
                </Text>
                {offer.reasons.map((r) => (
                  <Text key={r} style={{ fontSize: 14, lineHeight: '20px', color: '#3f3f46', margin: '0 0 4px' }}>• {r}</Text>
                ))}
                {offer.missing.length > 0 && (
                  <Text style={{ fontSize: 13, lineHeight: '20px', color: '#b91c1c', margin: '10px 0 0' }}>
                    Falta: {offer.missing.join(', ')}
                  </Text>
                )}
                {offer.url && (
                  <Link href={offer.url} style={{ display: 'inline-block', fontSize: 14, color: BRAND, margin: '12px 0 0' }}>Ver oferta original →</Link>
                )}
              </Section>
            )}

            <Section style={{ margin: '28px 0 0' }}>
              <Button href={`mailto:${from}?subject=${encodeURIComponent(`Re: ${typeLabel} no Radar`)}`} style={{
                backgroundColor: BRAND, color: '#ffffff', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 600, marginRight: 8,
              }}>Responder</Button>
              <Button href={statusUrl} style={{
                backgroundColor: '#ffffff', color: '#18181b', border: '1px solid #d4d4d8', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 600,
              }}>Abrir página de estado</Button>
            </Section>
          </Section>

          <Hr style={{ borderColor: '#e4e4e7', margin: '20px 0 12px' }} />
          <Text style={{ fontSize: 12, lineHeight: '18px', color: '#a1a1aa', margin: 0, textAlign: 'center' }}>
            Recebeste isto por seres o ALERT_EMAIL do Radar. Responder a este email responde diretamente à pessoa.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
