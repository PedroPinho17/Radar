import type { Job } from './job.entity.js';
import { DEFAULT_PREFERENCES, type PreferencesData } from '../profile/preferences.service.js';
import { fitsArea, fitsLocation, fitsSeniority, matchesRole, passesFilters } from './job-filters.js';

const job = (title: string, location: string | null = 'Porto', workModel: Job['workModel'] = null) =>
  ({ title, location, workModel }) as Job;
const prefs = (p: Partial<PreferencesData> = {}): PreferencesData => ({ ...DEFAULT_PREFERENCES, ...p });

describe('matchesRole', () => {
  it.each([
    ['Auxiliar de Ação Educativa para IPSS - Sintra', 'Auxiliar de Ação Educativa'],
    ['Contrata-se Auxiliar de Acção Educativa (m/f)', 'Auxiliar de Ação Educativa'], // grafia antiga
    ['Educador(a) de Infância', 'Educadora de Infância'], // género
    ['Assistentes Operacionais - Escola', 'Assistente Operacional'], // plural em -ais
    ['Empregada de Mesa', 'Empregado de Mesa'],
    ['Back-End Developer - Java', 'Backend Developer'], // hífen
    ['Fullstack Developer Funchal/Madeira', 'Full Stack Developer'], // junto vs separado
    ['Motorista Pesados (C+E)', 'Motorista'],
  ])('"%s" corresponde a "%s"', (title, role) => {
    expect(matchesRole(title, [role])).toBe(true);
  });

  it.each([
    ['Cozinheiro(a) de 2ª', 'Auxiliar de Ação Educativa'],
    ['Gerente de Loja', 'Operador de Loja'],
    ['Project Manager', 'Programador'],
  ])('"%s" NÃO corresponde a "%s"', (title, role) => {
    expect(matchesRole(title, [role])).toBe(false);
  });

  it('sem funções não corresponde a nada', () => {
    expect(matchesRole('Qualquer coisa', [])).toBe(false);
  });
});

describe('fitsArea', () => {
  it('IT (e contas antigas sem área) aceita títulos de programação mesmo sem funções', () => {
    expect(fitsArea(job('Java Developer'), prefs({ areas: ['Informática'] }))).toBe(true);
    expect(fitsArea(job('Java Developer'), prefs({ areas: [], sector: null }))).toBe(true);
    expect(fitsArea(job('Ajudante de Cozinha'), prefs({ areas: ['Informática'] }))).toBe(false);
  });

  it('outras áreas só aceitam as suas funções (nunca ofertas de IT)', () => {
    const educ = prefs({ areas: ['Educação/Creche'], roles: ['Auxiliar de Ação Educativa'] });
    expect(fitsArea(job('Auxiliar de Ação Educativa'), educ)).toBe(true);
    expect(fitsArea(job('Java Developer'), educ)).toBe(false);
  });

  it('outras áreas sem funções deixam passar (a IA decide)', () => {
    expect(fitsArea(job('Qualquer coisa'), prefs({ areas: ['Educação/Creche'], roles: [] }))).toBe(true);
  });

  it('rejeita oferta com area diferente sem função a bater', () => {
    const j = Object.assign(job('Empregada de Limpeza'), { area: 'Limpeza' });
    expect(fitsArea(j as never, prefs({ areas: ['Educação/Creche'], roles: ['Auxiliar de Ação Educativa'] }))).toBe(false);
  });

  it('palavras a esconder ganham sempre', () => {
    const p = prefs({ areas: ['Informática'], excludeKeywords: ['SAP'], avoid: ['.NET'] });
    expect(fitsArea(job('Consultor SAP Developer'), p)).toBe(false);
    expect(fitsArea(job('ASP.NET Developer'), p)).toBe(false);
    expect(fitsArea(job('ASAP Java Developer'), p)).toBe(true);
  });
});

describe('fitsLocation', () => {
  it('aceita a cidade com acentos diferentes', () => {
    const p = prefs({ onsiteLocations: ['Oliveira de Azeméis'], remoteAnywhere: false });
    expect(fitsLocation(job('x', 'Oliveira de Azemeis'), p)).toBe(true);
    expect(fitsLocation(job('x', 'Lisboa'), p)).toBe(false);
  });

  it('filtra por distrito/cidade antes da IA (não remoto)', () => {
    const p = prefs({ district: 'Porto', city: 'Maia', remoteAnywhere: false, onsiteLocations: [] });
    expect(fitsLocation(job('x', 'Maia'), p)).toBe(true);
    expect(fitsLocation(job('x', 'Lisboa', 'onsite'), p)).toBe(false);
    expect(fitsLocation(job('x', 'Berlim', 'remote'), prefs({ ...p, remoteAnywhere: true }))).toBe(true);
  });

  it('cidades só-híbrido recusam presencial', () => {
    const p = prefs({ hybridLocations: ['Porto'], remoteAnywhere: false, onsiteLocations: [], district: null, city: null });
    expect(fitsLocation(job('x', 'Porto', 'hybrid'), p)).toBe(true);
    expect(fitsLocation(job('x', 'Porto', 'onsite'), p)).toBe(false);
  });

  it('remoto passa em qualquer sítio só se a pessoa aceitar', () => {
    expect(fitsLocation(job('x', 'Berlim', 'remote'), prefs({ onsiteLocations: ['Porto'], remoteAnywhere: true }))).toBe(true);
    expect(fitsLocation(job('x', 'Berlim', 'remote'), prefs({ onsiteLocations: ['Porto'], remoteAnywhere: false }))).toBe(false);
  });

  it('sem cidades escolhidas aceita todas', () => {
    expect(fitsLocation(job('x', 'Faro', 'onsite'), prefs({ remoteAnywhere: false }))).toBe(true);
  });
});

describe('fitsSeniority', () => {
  it('esconde cargos sénior a quem quer até 3 anos, mostra a quem tem 5+', () => {
    expect(fitsSeniority(job('Senior Java Developer'), prefs({ maxYears: 3 }))).toBe(false);
    expect(fitsSeniority(job('Chefe de Cozinha'), prefs({ maxYears: 2 }))).toBe(false);
    expect(fitsSeniority(job('Senior Java Developer'), prefs({ maxYears: 5 }))).toBe(true);
  });
});

it('passesFilters junta tudo', () => {
  const p = prefs({ areas: ['Educação/Creche'], roles: ['Ajudante de Ação Educativa'], onsiteLocations: ['Porto'], remoteAnywhere: false });
  expect(passesFilters(job('Ajudante de Ação Educativa (M/F)', 'Porto'), p)).toBe(true);
  expect(passesFilters(job('Ajudante de Ação Educativa (M/F)', 'Faro', 'onsite'), p)).toBe(false);
});

describe('localização com a geografia de Portugal', () => {
  const p = (x: Partial<PreferencesData>) => prefs({ remoteAnywhere: false, ...x });

  it('o distrito apanha todos os concelhos dele (Aveiro → Ovar, Santa Maria da Feira)', () => {
    const aveiro = p({ district: 'Aveiro' });
    expect(fitsLocation(job('x', 'Ovar', 'onsite'), aveiro)).toBe(true);
    expect(fitsLocation(job('x', 'Santa Maria da Feira, Aveiro', 'onsite'), aveiro)).toBe(true);
    expect(fitsLocation(job('x', 'Coimbra', 'onsite'), aveiro)).toBe(false);
  });

  it('"Porto" não apanha "Porto de Mós" (Leiria)', () => {
    expect(fitsLocation(job('x', 'Porto de Mós', 'onsite'), p({ district: 'Porto' }))).toBe(false);
    expect(fitsLocation(job('x', 'Matosinhos', 'onsite'), p({ district: 'Porto' }))).toBe(true);
  });

  it('a cidade aceita ofertas da própria cidade e as que só indicam o distrito dela', () => {
    const ovar = p({ city: 'Ovar' });
    expect(fitsLocation(job('x', 'Ovar', 'onsite'), ovar)).toBe(true);
    expect(fitsLocation(job('x', 'Aveiro', 'onsite'), ovar)).toBe(true); // zona "Aveiro" da Net-Empregos
    expect(fitsLocation(job('x', 'Espinho', 'onsite'), ovar)).toBe(false);
  });

  it('lugares fora de Portugal comparam por texto', () => {
    expect(fitsLocation(job('x', 'Madrid, Espanha', 'onsite'), p({ onsiteLocations: ['Madrid'] }))).toBe(true);
    expect(fitsLocation(job('x', 'Remote (Europe)', 'remote'), p({ hybridLocations: ['Europe'] }))).toBe(true);
  });
});

describe('senioridade pela experiência do perfil', () => {
  it('15 anos de experiência veem cargos de direção mesmo com a preferência por omissão', () => {
    const diretor = job('Diretor Financeiro', 'Lisboa');
    expect(fitsSeniority(diretor, prefs({ maxYears: 3 }))).toBe(false);
    expect(fitsSeniority(diretor, prefs({ maxYears: 3 }), 15)).toBe(true);
    expect(passesFilters(diretor, prefs({ maxYears: 3, areas: ['Gestão/Direção'], district: 'Lisboa' }), 15)).toBe(true);
  });
});
