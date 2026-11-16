/** Nome legível de cada fonte de ofertas (`job.source` da API). */
export const SOURCE_LABEL: Record<string, string> = {
  itjobs: 'ITJobs',
  landing: 'Landing.jobs',
  netempregos: 'Net-Empregos',
  wwr: 'We Work Remotely',
  jooble: 'Jooble',
};

export const sourceLabel = (source: string) => SOURCE_LABEL[source] ?? source;

/** Fontes presentes numa lista, com quantas ofertas cada uma tem (mais ofertas primeiro). */
export function countBySource(items: { job: { source: string } }[]): { source: string; label: string; count: number }[] {
  const count = new Map<string, number>();
  for (const { job } of items) count.set(job.source, (count.get(job.source) ?? 0) + 1);
  return [...count.entries()]
    .map(([source, n]) => ({ source, label: sourceLabel(source), count: n }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt'));
}
