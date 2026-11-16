/**
 * Constantes e helpers da UI de preferências / perfil.
 * As áreas devem espelhar `apps/api/src/profile/sectors.ts`.
 */

/** Cidades/concelhos de Portugal mais comuns em ofertas (podes sempre escrever outra). */
export const CITIES = [
  'Lisboa', 'Porto', 'Braga', 'Coimbra', 'Aveiro', 'Faro', 'Leiria', 'Setúbal', 'Viseu', 'Viana do Castelo',
  'Vila Real', 'Bragança', 'Guarda', 'Castelo Branco', 'Portalegre', 'Évora', 'Beja', 'Santarém',
  'Funchal', 'Ponta Delgada', 'Angra do Heroísmo',
  'Vila Nova de Gaia', 'Matosinhos', 'Maia', 'Gondomar', 'Valongo', 'Vila do Conde', 'Póvoa de Varzim',
  'Santo Tirso', 'Trofa', 'Paredes', 'Penafiel', 'Felgueiras', 'Amarante', 'Paços de Ferreira', 'Lousada',
  'Guimarães', 'Barcelos', 'Vila Nova de Famalicão', 'Esposende', 'Fafe', 'Vizela', 'Ponte de Lima',
  'Caminha', 'Valença', 'Chaves', 'Mirandela', 'Peso da Régua', 'Lamego',
  'Santa Maria da Feira', 'Oliveira de Azeméis', 'São João da Madeira', 'Ovar', 'Espinho', 'Ílhavo', 'Águeda',
  'Albergaria-a-Velha', 'Estarreja', 'Vale de Cambra', 'Arouca', 'Anadia', 'Oliveira do Bairro',
  'Figueira da Foz', 'Cantanhede', 'Mealhada', 'Marinha Grande', 'Pombal', 'Caldas da Rainha', 'Alcobaça',
  'Nazaré', 'Óbidos', 'Peniche', 'Ourém', 'Tomar', 'Torres Novas', 'Entroncamento', 'Abrantes',
  'Covilhã', 'Fundão', 'Seia',
  'Amadora', 'Oeiras', 'Sintra', 'Cascais', 'Loures', 'Odivelas', 'Vila Franca de Xira', 'Mafra',
  'Torres Vedras', 'Almada', 'Seixal', 'Barreiro', 'Montijo', 'Palmela', 'Sesimbra', 'Alcochete', 'Moita', 'Sines',
  'Elvas', 'Estremoz', 'Lagos', 'Portimão', 'Albufeira', 'Loulé', 'Olhão', 'Tavira', 'Lagoa', 'Silves',
].sort((a, b) => a.localeCompare(b, 'pt'));

/** Distritos / regiões autónomas (select do formulário). */
export const DISTRICTS = [
  'Aveiro', 'Beja', 'Braga', 'Bragança', 'Castelo Branco', 'Coimbra', 'Évora', 'Faro', 'Guarda',
  'Leiria', 'Lisboa', 'Portalegre', 'Porto', 'Santarém', 'Setúbal', 'Viana do Castelo', 'Vila Real', 'Viseu',
  'Açores', 'Madeira',
];

/** Igual à lista da API (apps/api/src/profile/sectors.ts). */
export const AREAS = [
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

/** @deprecated usar AREAS */
export const SECTORS = AREAS;

/**
 * A pessoa procura Informática?
 * Sem áreas (conta antiga) conta como IT — o Radar começou só para programadores.
 */
export const isTech = (areas: string[] | null | undefined, legacySector?: string | null) => {
  const list = Array.isArray(areas) ? areas : [];
  if (list.length) return list.includes('Informática');
  if (legacySector === 'Tecnologia' || legacySector === 'Informática' || legacySector == null) return true;
  return false;
};

/** Níveis de escolaridade (formulário sem CV): do mais básico ao mais alto. */
export const EDUCATION_LEVELS = [
  'Sem escolaridade completa', '4.º ano', '6.º ano', '9.º ano', '12.º ano', 'Curso profissional',
  'Licenciatura', 'Mestrado', 'Doutoramento',
];

export const SHIFTS = [
  { value: 'manha', label: 'Manhã' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noite', label: 'Noite' },
  { value: 'fins_semana', label: 'Fins de semana' },
] as const;

export const CONTRACT_TYPES = [
  { value: 'termo_certo', label: 'Termo certo' },
  { value: 'sem_termo', label: 'Sem termo' },
  { value: 'recibo_verde', label: 'Recibo verde' },
  { value: 'estagio', label: 'Estágio' },
] as const;

export const WORK_TIMES = [
  { value: 'full_time', label: 'Tempo inteiro' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'ambos', label: 'Ambos' },
] as const;

/** Sugestões de funções por área (aparecem no TagInput). */
export const ROLES_BY_SECTOR: Record<string, string[]> = {
  'Educação/Creche': ['Auxiliar de Ação Educativa', 'Ajudante de Ação Educativa', 'Assistente Operacional', 'Auxiliar de Educação',
    'Educador de Infância', 'Ajudante de Creche', 'Ama', 'Monitor de ATL', 'Professor', 'Explicador', 'Animador Sociocultural'],
  'Saúde/Cuidados': ['Técnico Auxiliar de Saúde', 'Auxiliar de Saúde', 'Enfermeiro', 'Ajudante de Lar', 'Cuidador',
    'Auxiliar de Geriatria', 'Ajudante Familiar', 'Fisioterapeuta', 'Técnico de Farmácia', 'Assistente Dentário'],
  'Restauração/Hotelaria': ['Empregado de Mesa', 'Cozinheiro', 'Ajudante de Cozinha', 'Rececionista', 'Empregado de Bar',
    'Copeiro', 'Empregada de Andares', 'Barista', 'Chefe de Sala', 'Pasteleiro'],
  'Comércio/Vendas': ['Operador de Loja', 'Operador de Caixa', 'Vendedor', 'Repositor', 'Comercial', 'Gerente de Loja',
    'Consultor de Vendas', 'Assistente de Loja'],
  Administrativo: ['Administrativo', 'Assistente Administrativo', 'Rececionista', 'Técnico de Contabilidade',
    'Contabilista', 'Secretária', 'Assistente de Direção', 'Técnico de Faturação'],
  Construção: ['Pedreiro', 'Eletricista', 'Canalizador', 'Carpinteiro', 'Pintor', 'Servente', 'Encarregado de Obra', 'Técnico de AVAC'],
  'Logística/Armazém': ['Motorista', 'Operador de Armazém', 'Operador de Empilhador', 'Fiel de Armazém', 'Estafeta',
    'Gestor de Logística', 'Motorista de Pesados'],
  Limpeza: ['Auxiliar de Limpeza', 'Empregada de Limpeza', 'Jardineiro', 'Porteiro', 'Vigilante'],
  'Indústria/Produção': ['Operador de Produção', 'Operador de Máquinas', 'Técnico de Manutenção', 'Serralheiro', 'Soldador',
    'Controlo de Qualidade', 'Chefe de Linha', 'Costureira', 'Operador de Logística Interna'],
  'Beleza/Bem-estar': ['Cabeleireiro', 'Esteticista', 'Manicure', 'Massagista', 'Personal Trainer', 'Rececionista de Ginásio'],
  Agricultura: ['Trabalhador Agrícola', 'Jardineiro', 'Tratorista', 'Operário Florestal', 'Engenheiro Agrónomo'],
  'Finanças/Contabilidade': ['Contabilista', 'Técnico de Contabilidade', 'Contabilista Certificado', 'Controller Financeiro',
    'Analista Financeiro', 'Auditor', 'Tesoureiro', 'Gestor de Cliente Bancário'],
  'Recursos Humanos': ['Técnico de Recursos Humanos', 'Recrutador', 'Gestor de Recursos Humanos', 'Técnico de Payroll',
    'Técnico de Formação', 'Diretor de Recursos Humanos'],
  'Marketing/Comunicação': ['Marketing Digital', 'Gestor de Marketing', 'Gestor de Redes Sociais', 'Designer Gráfico',
    'Copywriter', 'Técnico de Comunicação', 'Gestor de Produto'],
  'Gestão/Direção': ['Diretor Geral', 'Diretor Financeiro', 'Diretor de Operações', 'Diretor Comercial', 'Gestor de Projeto',
    'Gestor de Equipa', 'Diretor de Loja', 'Administrador'],
  Engenharia: ['Engenheiro Civil', 'Engenheiro Mecânico', 'Engenheiro Eletrotécnico', 'Engenheiro Industrial',
    'Engenheiro de Qualidade', 'Engenheiro do Ambiente', 'Desenhador Projetista'],
  Direito: ['Advogado', 'Advogado Estagiário', 'Jurista', 'Solicitador', 'Assistente Jurídico', 'Oficial de Justiça'],
  Informática: ['Programador', 'Developer', 'Full Stack', 'Frontend', 'Backend', 'Mobile', 'DevOps', 'QA / Testes',
    'Técnico de Informática', 'Administrador de Sistemas', 'Analista de Dados'],
  Outra: [],
  // legado
  Educação: ['Auxiliar de Ação Educativa', 'Educador de Infância', 'Ajudante de Creche'],
  Tecnologia: ['Programador', 'Developer', 'Full Stack'],
};

export const GENERAL_AVOID = ['Turnos noturnos', 'Fins de semana', 'Part-time', 'Comissões', 'Porta a porta', 'Call Center', 'Estágio'];
export const GENERAL_KEYWORDS = ['Estágio', 'Internship', 'Call Center', 'Porta a porta', 'Freelance', 'Voluntariado', 'Part-time'];

export const ROLE_SUGGESTIONS = [
  'Backend', 'Frontend', 'Full Stack', 'Mobile', 'DevOps', 'Cloud', 'QA / Testes', 'Data Science', 'Machine Learning',
  'Backend Java', 'Backend Node.js', 'Backend Python', 'Backend .NET', 'Frontend React', 'Frontend Angular',
  'Mobile Flutter', 'Mobile React Native', 'iOS', 'Android', 'Engenharia de Software', 'Web Developer',
];

export const TECH_SUGGESTIONS = [
  '.NET', 'C#', 'PHP', 'Java', 'Python', 'Ruby', 'Go', 'C++', 'COBOL', 'Delphi', 'VB.NET', 'Angular', 'Vue',
  'React', 'WordPress', 'Magento', 'Salesforce', 'SAP', 'OutSystems', 'Mainframe', 'Power BI',
];

export const KEYWORD_SUGGESTIONS = [
  'SAP', 'ERP', 'Dynamics', 'Helpdesk', 'Service Desk', 'Suporte', 'Support', 'Técnico de Informática', 'HR',
  'Recursos Humanos', 'Sales', 'Comercial', 'Scrum Master', 'Project Manager', 'Network', 'DBA',
  'Database Administrator', 'Data Engineer', 'Data Platform', 'Estágio', 'Internship', 'Call Center', 'Freelance',
];

export const WEEKDAYS = [
  { value: 1, short: 'Seg', long: 'segunda' },
  { value: 2, short: 'Ter', long: 'terça' },
  { value: 3, short: 'Qua', long: 'quarta' },
  { value: 4, short: 'Qui', long: 'quinta' },
  { value: 5, short: 'Sex', long: 'sexta' },
  { value: 6, short: 'Sáb', long: 'sábado' },
  { value: 0, short: 'Dom', long: 'domingo' },
];

export const TIME_SLOTS = Array.from({ length: 48 }, (_, i) =>
  `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`,
);

/** "Oliveira de AZEMÉIS" → "oliveira de azemeis" (comparações sem acentos). */
export const normalize = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** Distância de Levenshtein (quantas letras trocar/inserir/apagar). */
export function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length]!;
}

const tolerance = (len: number) => (len >= 14 ? 3 : len >= 8 ? 2 : len >= 4 ? 1 : 0);

/** Sugestões parecidas com o texto escrito (corrige gralhas tipo "olievira"). */
export function fuzzyMatches(text: string, options: string[]): string[] {
  const q = normalize(text);
  const max = tolerance(q.length);
  if (!max) return [];
  return options
    .map((o) => {
      const n = normalize(o);
      return { o, d: Math.min(editDistance(q, n.slice(0, q.length)), editDistance(q, n)) };
    })
    .filter((x) => x.d <= max)
    .sort((a, b) => a.d - b.d)
    .map((x) => x.o);
}

/** A opção mais próxima do texto, ou `null` se nenhuma for suficientemente parecida. */
export function closestOption(text: string, options: string[]): string | null {
  const q = normalize(text);
  const max = tolerance(q.length);
  let best: { o: string; d: number } | null = null;
  for (const o of options) {
    const d = editDistance(q, normalize(o));
    if (d <= max && (!best || d < best.d)) best = { o, d };
  }
  return best?.o ?? null;
}
