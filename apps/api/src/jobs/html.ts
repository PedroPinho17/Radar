/** Converte HTML (ou entidades) num texto limpo para descrições de ofertas. */
export function htmlToText(html: string | null | undefined): string {
  return (html ?? '')
    .replace(/<\/(p|li|div|h\d)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
