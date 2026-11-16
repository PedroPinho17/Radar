/**
 * Mapeamento área Radar ↔ categorias Net-Empregos / keywords Jooble,
 * e helpers para planear o sync por pessoa (zona + localização).
 */
import type { PreferencesData } from '../profile/preferences.service.js';
import { TECH, toArea, type Area } from '../profile/sectors.js';
import { districtOf, NET_EMPREGOS_ZONES } from './geo.js';

/**
 * IDs de categoria do Net-Empregos (`pesquisa-empregos.asp?categoria=`), lidos da lista do próprio site.
 * Uma categoria pertence a uma só área (para etiquetar as ofertas).
 */
export const NET_EMPREGOS_CATEGORIES: Record<Area, number[]> = {
  Limpeza: [58], // Limpezas / Domésticas
  'Restauração/Hotelaria': [42, 9], // Restauração / Bares / Pastelarias; Hotelaria / Turismo
  'Educação/Creche': [11], // Educação / Formação
  'Saúde/Cuidados': [14, 55, 41], // Saúde / Medicina / Enfermagem; Serviços Sociais; Farmácia / Biotecnologia
  'Comércio/Vendas': [53, 30, 12], // Comercial / Vendas; Lojas / Comércio / Balcão; Imobiliário
  'Logística/Armazém': [43], // Transportes / Logística
  Construção: [23], // Construção Civil
  'Indústria/Produção': [6, 51, 52], // Indústria / Produção; Conservação / Manutenção / Técnica; Serviços Técnicos
  'Beleza/Bem-estar': [47, 28], // Beleza / Moda / Bem Estar; Desporto / Ginásios
  Agricultura: [39], // Agricultura / Florestas / Pescas
  Administrativo: [29, 57], // Administração / Secretariado; Call Center / Help Desk
  'Finanças/Contabilidade': [15, 16], // Contabilidade / Finanças; Banca / Seguros / Serviços Financeiros
  'Recursos Humanos': [32], // Gestão RH
  'Marketing/Comunicação': [19, 8, 18, 22, 40], // Publicidade / Marketing; Comunicação Social; Relações Públicas; Arquitectura / Design; Artes
  'Gestão/Direção': [26], // Gestão de Empresas / Economia
  Engenharia: [45, 46, 24, 50, 54], // Engenharia Civil, Eletrotécnica, Mecânica, Química / Biologia, Ambiente
  Direito: [44], // Direito / Justiça
  Informática: [5, 38, 35, 36, 37, 49, 34, 56, 1], // Programação, Análise, Internet, Multimédia, Redes, Hardware, Formação, Comercial IT, Telecomunicações
  Outra: [],
};

/** Palavras-chave Jooble / pesquisa por área (pt-PT como nos anúncios), das mais comuns para as mais específicas. */
export const AREA_KEYWORDS: Record<Area, string[]> = {
  Limpeza: ['Auxiliar de Limpeza', 'Empregada de Limpeza', 'Limpeza', 'Empregada Doméstica'],
  'Restauração/Hotelaria': ['Empregado de Mesa', 'Cozinheiro', 'Ajudante de Cozinha', 'Rececionista Hotel'],
  'Educação/Creche': ['Auxiliar de Ação Educativa', 'Educador de Infância', 'Ajudante de Creche', 'Professor'],
  'Saúde/Cuidados': ['Auxiliar de Saúde', 'Ajudante de Lar', 'Cuidador', 'Enfermeiro'],
  'Comércio/Vendas': ['Operador de Loja', 'Vendedor', 'Operador de Caixa', 'Repositor'],
  'Logística/Armazém': ['Operador de Armazém', 'Motorista', 'Estafeta', 'Operador de Empilhador'],
  Construção: ['Pedreiro', 'Eletricista', 'Canalizador', 'Servente'],
  'Indústria/Produção': ['Operador de Produção', 'Operador de Máquinas', 'Técnico de Manutenção', 'Serralheiro'],
  'Beleza/Bem-estar': ['Cabeleireiro', 'Esteticista', 'Manicure', 'Personal Trainer'],
  Agricultura: ['Trabalhador Agrícola', 'Jardineiro', 'Tratorista', 'Engenheiro Agrónomo'],
  Administrativo: ['Assistente Administrativo', 'Administrativo', 'Rececionista', 'Secretária'],
  'Finanças/Contabilidade': ['Contabilista', 'Técnico de Contabilidade', 'Controller Financeiro', 'Analista Financeiro'],
  'Recursos Humanos': ['Técnico de Recursos Humanos', 'Recrutador', 'Gestor de Recursos Humanos', 'Payroll'],
  'Marketing/Comunicação': ['Marketing Digital', 'Gestor de Marketing', 'Designer Gráfico', 'Social Media'],
  'Gestão/Direção': ['Diretor Geral', 'Diretor Financeiro', 'Gestor de Projeto', 'Diretor de Operações'],
  Engenharia: ['Engenheiro Civil', 'Engenheiro Mecânico', 'Engenheiro Eletrotécnico', 'Engenheiro de Qualidade'],
  Direito: ['Advogado', 'Jurista', 'Solicitador', 'Assistente Jurídico'],
  Informática: ['Programador', 'Developer', 'Full Stack', 'Software Engineer'],
  Outra: [],
};

/** Área Radar a partir de um ID de categoria Net-Empregos. */
export function areaFromNetEmpregosCategory(categoryId: number): Area | null {
  for (const [area, ids] of Object.entries(NET_EMPREGOS_CATEGORIES) as [Area, number[]][]) {
    if (ids.includes(categoryId)) return area;
  }
  return null;
}

/** Categorias Net-Empregos a procurar para um conjunto de áreas (sem duplicados). */
export function netEmpregosCategoriesFor(areas: Area[]): number[] {
  const ids = new Set<number>();
  for (const area of areas) {
    for (const id of NET_EMPREGOS_CATEGORIES[area] ?? []) ids.add(id);
  }
  return [...ids];
}

/** Termos de pesquisa (funções dos users + keywords da área). */
export function keywordsForAreas(areas: Area[], roles: string[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (t: string) => {
    const k = t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(t.trim());
  };
  for (const r of roles) add(r);
  for (const area of areas) {
    for (const kw of AREA_KEYWORDS[area] ?? []) add(kw);
  }
  return out;
}

// ------------------------------------------------------------------ planeamento por pessoa

type PrefsForSources = Pick<PreferencesData, 'areas' | 'sector' | 'roles' | 'district' | 'city' | 'onsiteLocations'>;

/** Áreas de uma pessoa (contas antigas: a do campo "sector"; sem nada: Informática, como o Radar começou). */
export function areasOf(p: PrefsForSources): Area[] {
  if (p.areas.length) return p.areas;
  return [toArea(p.sector) ?? TECH];
}

/** Distrito onde a pessoa procura (o escolhido, ou o da cidade). null = sem zona (país inteiro). */
export function userDistrict(p: PrefsForSources): string | null {
  const candidates = [p.district, p.city, ...p.onsiteLocations].filter((x): x is string => !!x);
  for (const c of candidates) {
    const d = districtOf(c);
    if (d) return d;
  }
  return null;
}

/**
 * Pares (categoria, zona) a pedir à Net-Empregos: as categorias das áreas de cada pessoa NO distrito dela.
 * Sem repetidos, os mais pedidos primeiro, no máximo `max` (cada par = 1–2 pedidos ao site).
 */
export function netEmpregosPairs(prefs: PrefsForSources[], max = 40): { categoryId: number; zoneId: number }[] {
  const count = new Map<string, { categoryId: number; zoneId: number; n: number }>();
  for (const p of prefs) {
    const district = userDistrict(p);
    const zoneId = district ? (NET_EMPREGOS_ZONES[district] ?? 0) : 0;
    for (const categoryId of netEmpregosCategoriesFor(areasOf(p))) {
      const key = `${categoryId}:${zoneId}`;
      const hit = count.get(key) ?? { categoryId, zoneId, n: 0 };
      hit.n++;
      count.set(key, hit);
    }
  }
  return [...count.values()].sort((a, b) => b.n - a.n).slice(0, max).map(({ categoryId, zoneId }) => ({ categoryId, zoneId }));
}

/**
 * Pesquisas para a Jooble agrupadas pela localização de cada pessoa (cidade → distrito → Portugal),
 * com as funções dela e as palavras-chave das suas áreas. No máximo `max` termos no total.
 */
export function joobleQueries(prefs: PrefsForSources[], max = 30): { location: string; terms: string[] }[] {
  const byLocation = new Map<string, PrefsForSources[]>();
  for (const p of prefs) {
    const location = p.city || userDistrict(p) || 'Portugal';
    byLocation.set(location, [...(byLocation.get(location) ?? []), p]);
  }
  // locais com mais pessoas primeiro; os termos repartem-se para todos terem alguma coisa
  const groups = [...byLocation.entries()].sort((a, b) => b[1].length - a[1].length);
  const perGroup = Math.max(2, Math.floor(max / Math.max(groups.length, 1)));
  const out: { location: string; terms: string[] }[] = [];
  let left = max;
  for (const [location, people] of groups) {
    if (left <= 0) break;
    const areas = [...new Set(people.flatMap(areasOf))];
    const terms = keywordsForAreas(areas, people.flatMap((p) => p.roles)).slice(0, Math.min(perGroup, left));
    if (terms.length) {
      out.push({ location, terms });
      left -= terms.length;
    }
  }
  return out;
}
