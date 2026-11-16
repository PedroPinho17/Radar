/**
 * Áreas profissionais canónicas do Radar.
 * Definem sugestões de funções, quais fontes de emprego se ligam e o filtro pré-IA.
 */
export const AREAS = [
  // trabalho operacional / atendimento
  'Limpeza',
  'Restauração/Hotelaria',
  'Educação/Creche',
  'Saúde/Cuidados',
  'Comércio/Vendas',
  'Logística/Armazém',
  'Construção',
  'Indústria/Produção',
  'Beleza/Bem-estar',
  'Agricultura',
  // escritório e cargos qualificados / de direção
  'Administrativo',
  'Finanças/Contabilidade',
  'Recursos Humanos',
  'Marketing/Comunicação',
  'Gestão/Direção',
  'Engenharia',
  'Direito',
  'Informática',
  'Outra',
] as const;
export type Area = (typeof AREAS)[number];

/** @deprecated usar AREAS — mantido só para ler dados/migração legada. */
export const SECTORS = AREAS;
export type Sector = Area;

export const TECH: Area = 'Informática';

/** Valores antigos de `sector` → área nova. */
export const LEGACY_SECTOR_TO_AREA: Record<string, Area> = {
  Tecnologia: 'Informática',
  Educação: 'Educação/Creche',
  'Saúde e Apoio Social': 'Saúde/Cuidados',
  'Restauração e Hotelaria': 'Restauração/Hotelaria',
  'Comércio e Vendas': 'Comércio/Vendas',
  'Administrativo e Finanças': 'Administrativo',
  'Indústria e Produção': 'Indústria/Produção',
  Construção: 'Construção',
  'Logística e Transportes': 'Logística/Armazém',
  'Limpeza e Serviços': 'Limpeza',
  'Apoio ao Cliente': 'Administrativo',
  'Marketing e Comunicação': 'Marketing/Comunicação',
  Engenharia: 'Engenharia',
  'Recursos Humanos': 'Recursos Humanos',
  Outra: 'Outra',
  Informática: 'Informática',
  Limpeza: 'Limpeza',
  'Restauração/Hotelaria': 'Restauração/Hotelaria',
  'Educação/Creche': 'Educação/Creche',
  'Saúde/Cuidados': 'Saúde/Cuidados',
  'Comércio/Vendas': 'Comércio/Vendas',
  'Logística/Armazém': 'Logística/Armazém',
  Administrativo: 'Administrativo',
  'Indústria/Produção': 'Indústria/Produção',
  'Beleza/Bem-estar': 'Beleza/Bem-estar',
  Agricultura: 'Agricultura',
  'Finanças/Contabilidade': 'Finanças/Contabilidade',
  'Marketing/Comunicação': 'Marketing/Comunicação',
  'Gestão/Direção': 'Gestão/Direção',
  Direito: 'Direito',
};

/**
 * Converte um valor antigo (`sector`) ou novo para uma {@link Area} canónica.
 * Desconhecido → `"Outra"`; vazio → `null`.
 */
export function toArea(value: string | null | undefined): Area | null {
  if (!value) return null;
  return LEGACY_SECTOR_TO_AREA[value] ?? (AREAS.includes(value as Area) ? (value as Area) : 'Outra');
}

/**
 * true se a pessoa procura Informática.
 * Sem áreas (conta antiga / vazia) = Informática, como o Radar começou só para IT.
 */
export function isTech(areas: string[] | null | undefined, legacySector?: string | null): boolean {
  if (areas?.length) return areas.includes(TECH);
  if (legacySector != null) return toArea(legacySector) === TECH;
  return true; // null/undefined/[] sem sector → conta antiga IT
}

/** Palavras escondidas por omissão para quem é de Informática. */
export const IT_EXCLUDES = [
  'SAP', 'ERP', 'Dynamics', 'Helpdesk', 'Service Desk', 'Suporte', 'Support', 'Técnico de Informática',
  'HR', 'Recursos Humanos', 'Sales', 'Comercial', 'Scrum Master', 'Project Manager', 'Network', 'DBA',
  'Database Administrator', 'Data Engineer', 'Data Platform',
];

/** Turnos que a pessoa aceita (preferências + prompt da IA). */
export const SHIFTS = ['manha', 'tarde', 'noite', 'fins_semana'] as const;
export type Shift = (typeof SHIFTS)[number];

/** Tipos de contrato preferidos. */
export const CONTRACT_TYPES = ['termo_certo', 'sem_termo', 'recibo_verde', 'estagio'] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

/** Tempo inteiro, part-time, ou ambos. */
export const WORK_TIMES = ['full_time', 'part_time', 'ambos'] as const;
export type WorkTime = (typeof WORK_TIMES)[number];
