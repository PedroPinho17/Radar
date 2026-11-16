/**
 * Filtros baratos (sem IA) aplicados a cada oferta antes da avaliação:
 * localização (distrito/concelho), senioridade e área/funções.
 */
import type { Job } from './job.entity.js';
import type { PreferencesData } from '../profile/preferences.service.js';
import { isTech, TECH } from '../profile/sectors.js';
import { acceptedKeys, placesIn } from './geo.js';

const TOO_SENIOR = /\b(senior|sénior|sr\.?|lead|principal|staff|architect|arquitet[oa]|manager|head|director|diretor|diretora|expert|chefe)\b/i;
/** Títulos de programação: rede de segurança para quem é de Informática. */
const DEV = /develop|programad|engineer|engenheir|full ?stack|front ?end|back ?end|software|web|mobile|android|node|react|angular|\.net|java|python/i;

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function hasAnyWord(text: string, words: string[]): boolean {
  if (!words.length) return false;
  const parts = words.map((w) => {
    const e = esc(norm(w));
    return /^[a-z0-9]/.test(norm(w)) ? `(?<![a-z0-9])${e}` : e;
  });
  const re = new RegExp(`(${parts.join('|')})(?![a-z0-9])`);
  return re.test(norm(text));
}

const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'para', 'a', 'o', 'as', 'os', 'com',
  'the', 'of', 'and', 'for', 'in', 'm', 'f', 'mf']);

const words = (s: string) =>
  norm(s)
    .replace(/c(?=[ct])/g, '')
    .replace(/[^a-z0-9+#]+/g, ' ')
    .split(' ')
    .filter((w) => w && !STOP.has(w));

const stem = (w: string) => (w.length > 5 ? w.replace(/(as|os|es|a|o|s|l)$/, '') : w);

/**
 * O título da oferta corresponde a alguma das funções pedidas?
 * Ignora acentos/plurais e aceita "Fullstack" ≈ "Full Stack".
 */
export function matchesRole(title: string, roles: string[]): boolean {
  const titleWords = words(title);
  const titleCompact = titleWords.join('');
  return roles.some((role) => {
    const rw = words(role);
    if (!rw.length) return false;
    if (titleCompact.includes(rw.join(''))) return true;
    return rw.every((w) => titleWords.some((t) => t.startsWith(stem(w))));
  });
}

type Place = { name: string; kind: 'district' | 'any' };

/**
 * A localização da oferta está num dos lugares escolhidos?
 * Usa a geografia de Portugal (concelho ↔ distrito): o distrito "Aveiro" apanha Ovar,
 * "Porto" não apanha "Porto de Mós". Lugares desconhecidos (estrangeiro…) comparam por texto.
 */
function inPlaces(location: string, places: Place[]): boolean {
  const jobKeys = placesIn(location);
  return places.some(({ name, kind }) => {
    const accepted = acceptedKeys(name, kind);
    if (accepted && jobKeys.size) return [...accepted].some((k) => jobKeys.has(k));
    return norm(location).includes(norm(name));
  });
}

/**
 * Localização (distrito/cidade/concelhos), sem GPS.
 * Ofertas presenciais/híbridas fora dos lugares escolhidos são rejeitadas.
 */
export function fitsLocation(job: Job, p: PreferencesData): boolean {
  const loc = job.location ?? '';
  const onsite: Place[] = [
    ...p.onsiteLocations.map((name) => ({ name, kind: 'any' as const })),
    ...(p.city ? [{ name: p.city, kind: 'any' as const }] : []),
    ...(p.district ? [{ name: p.district, kind: 'district' as const }] : []),
  ];
  const hybrid: Place[] = p.hybridLocations.map((name) => ({ name, kind: 'any' as const }));
  const anyPlace = [...onsite, ...hybrid];

  if (job.workModel === 'remote' && p.remoteAnywhere) return true;
  if (!loc && job.workModel !== 'onsite') return true;
  if (!anyPlace.length) return job.workModel !== 'remote' || p.remoteAnywhere;

  if (job.workModel === 'remote') return inPlaces(loc, anyPlace);

  // presencial / híbrido / desconhecido: onsite (cidade/distrito) aceita tudo; hybrid só híbrido
  if (onsite.length && inPlaces(loc, onsite)) return true;
  return hybrid.length > 0 && job.workModel !== 'onsite' && inPlaces(loc, hybrid);
}

/**
 * Esconde cargos de chefia/sénior a quem tem pouca experiência.
 * Conta o máximo entre a preferência e os anos reais do perfil: quem tem 15 anos vê cargos de direção
 * mesmo que nunca tenha mexido na preferência.
 */
export function fitsSeniority(job: Job, p: PreferencesData, yearsExperience = 0): boolean {
  return Math.max(p.maxYears, yearsExperience) >= 5 || !TOO_SENIOR.test(job.title);
}

/** A oferta encaixa na(s) área(s) da pessoa? */
export function fitsArea(job: Job, p: PreferencesData): boolean {
  if (hasAnyWord(job.title, [...p.excludeKeywords, ...p.avoid])) return false;

  if (job.area && p.areas.length && !p.areas.includes(job.area as PreferencesData['areas'][number])) {
    // oferta etiquetada noutra área: só passa se o título bater numa função pedida
    if (!p.roles.length || !matchesRole(job.title, p.roles)) return false;
  }

  const tech = isTech(p.areas, p.sector);
  if (tech) return DEV.test(job.title) || matchesRole(job.title, p.roles) || job.area === TECH;
  return !p.roles.length || matchesRole(job.title, p.roles);
}

/** `yearsExperience` = anos do perfil (opcional): sobe o limite da senioridade para quem tem mais experiência. */
export function passesFilters(job: Job, p: PreferencesData, yearsExperience = 0): boolean {
  return fitsLocation(job, p) && fitsSeniority(job, p, yearsExperience) && fitsArea(job, p);
}
