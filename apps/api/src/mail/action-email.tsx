import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from 'react-email';

const BRAND = '#4f46e5';
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Email curto com um botão (confirmar email, redefinir password…). */
export function ActionEmail({ preview, title, intro, button, link, note, footer }: {
  preview: string;
  title: string;
  intro: string;
  button: string;
  link: string;
  note: string;
  footer: string;
}) {
  return (
    <Html lang="pt-PT">
      <Head>
        <meta name="color-scheme" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: '#f4f4f7', fontFamily: FONT, margin: 0, padding: '24px 12px' }}>
        <Container style={{ maxWidth: 520, width: '100%' }}>
          <Text style={{ margin: '0 0 16px 4px', fontSize: 18, fontWeight: 700, color: BRAND }}>◎ Radar</Text>
          <Section style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: '28px 24px' }}>
            <Heading as="h1" style={{ fontSize: 22, lineHeight: '28px', color: '#18181b', margin: '0 0 12px' }}>{title}</Heading>
            <Text style={{ fontSize: 15, lineHeight: '22px', color: '#3f3f46', margin: '0 0 24px' }}>{intro}</Text>
            <Button href={link} style={{
              backgroundColor: BRAND, color: '#ffffff', borderRadius: 10, padding: '12px 22px', fontSize: 15, fontWeight: 600,
            }}>{button}</Button>
            <Text style={{ fontSize: 13, lineHeight: '20px', color: '#71717a', margin: '24px 0 0' }}>{note}</Text>
            <Text style={{ fontSize: 12, lineHeight: '18px', color: '#a1a1aa', margin: '12px 0 0', wordBreak: 'break-all' }}>
              Se o botão não funcionar, copia este link para o browser: {link}
            </Text>
          </Section>
          <Hr style={{ borderColor: '#e4e4e7', margin: '20px 0 12px' }} />
          <Text style={{ fontSize: 12, lineHeight: '18px', color: '#a1a1aa', margin: 0, textAlign: 'center' }}>{footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}
