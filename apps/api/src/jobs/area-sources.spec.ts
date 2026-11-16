import { DEFAULT_PREFERENCES, type PreferencesData } from '../profile/preferences.service.js';
import { AREAS } from '../profile/sectors.js';
import {
  AREA_KEYWORDS, NET_EMPREGOS_CATEGORIES, areaFromNetEmpregosCategory, areasOf, joobleQueries, keywordsForAreas,
  netEmpregosCategoriesFor, netEmpregosPairs, userDistrict,
} from './area-sources.js';
import { acceptedKeys, CONCELHOS, districtOf, NET_EMPREGOS_ZONES, placesIn } from './geo.js';

const prefs = (p: Partial<PreferencesData> = {}): PreferencesData => ({ ...DEFAULT_PREFERENCES, ...p });

describe('áreas → categorias da Net-Empregos', () => {
  it('todas as áreas (menos "Outra") têm categorias; nenhuma categoria está em duas áreas', () => {
    const seen = new Map<number, string>();
    for (const area of AREAS) {
      const ids = NET_EMPREGOS_CATEGORIES[area];
      if (area === 'Outra') expect(ids).toEqual([]);
      else expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        expect(seen.get(id), `categoria ${id} em ${seen.get(id)} e ${area}`).toBeUndefined();
        seen.set(id, area);
      }
      if (area !== 'Outra') expect(AREA_KEYWORDS[area].length).toBeGreaterThan(0);
    }
  });

  it('cobre do trabalho operacional à direção', () => {
    expect(NET_EMPREGOS_CATEGORIES.Limpeza).toEqual([58]);
    expect(NET_EMPREGOS_CATEGORIES['Indústria/Produção']).toContain(6);
    expect(NET_EMPREGOS_CATEGORIES['Gestão/Direção']).toEqual([26]);
    expect(NET_EMPREGOS_CATEGORIES.Engenharia).toEqual(expect.arrayContaining([45, 46, 24]));
    expect(NET_EMPREGOS_CATEGORIES.Informática).toEqual(expect.arrayContaining([5, 38, 35]));
  });

  it('une categorias sem duplicados e etiqueta ofertas pela categoria', () => {
    expect(netEmpregosCategoriesFor(['Administrativo', 'Administrativo', 'Direito']).sort((a, b) => a - b)).toEqual([29, 44, 57]);
    expect(areaFromNetEmpregosCategory(26)).toBe('Gestão/Direção');
    expect(areaFromNetEmpregosCategory(999)).toBeNull();
  });

  it('palavras-chave: funções primeiro, sem repetidos', () => {
    expect(keywordsForAreas(['Educação/Creche'], ['Ama', 'ama'])).toEqual(['Ama', ...AREA_KEYWORDS['Educação/Creche']]);
  });
});

describe('geografia', () => {
  it('308 concelhos, cada distrito tem zona na Net-Empregos', () => {
    expect(Object.values(CONCELHOS).flat()).toHaveLength(308);
    for (const d of Object.keys(CONCELHOS)) expect(NET_EMPREGOS_ZONES[d], d).toBeGreaterThan(0);
  });

  it('distrito de um concelho', () => {
    expect(districtOf('Ovar')).toBe('Aveiro');
    expect(districtOf('santa maria da feira')).toBe('Aveiro');
    expect(districtOf('Évora')).toBe('Évora');
    expect(districtOf('Madrid')).toBeNull();
  });

  it('lê lugares do texto da oferta (o nome mais comprido ganha)', () => {
    expect(placesIn('Porto de Mós')).toEqual(new Set(['c:porto de mos', 'd:leiria']));
    expect(placesIn('Matosinhos, Porto')).toEqual(new Set(['c:matosinhos', 'd:porto', 'c:porto']));
    expect(placesIn('Santarem')).toEqual(new Set(['z:santarem', 'c:santarem', 'd:santarem'])); // zona da Net-Empregos
    expect(placesIn('Remoto (Europe)').size).toBe(0);
  });

  it('o que cada escolha aceita', () => {
    expect(acceptedKeys('Aveiro', 'district')).toEqual(new Set(['d:aveiro']));
    expect(acceptedKeys('Ovar')).toEqual(new Set(['c:ovar', 'z:aveiro']));
    expect(acceptedKeys('Açores')).toEqual(new Set(['d:acores'])); // região sem concelho com o mesmo nome
    expect(acceptedKeys('Arrifana')).toBeNull();
  });
});

describe('planeamento das fontes por pessoa', () => {
  it('áreas e distrito de cada pessoa', () => {
    expect(areasOf(prefs({ areas: [], sector: 'Indústria e Produção' }))).toEqual(['Indústria/Produção']);
    expect(areasOf(prefs({ areas: [], sector: null }))).toEqual(['Informática']);
    expect(userDistrict(prefs({ city: 'Ovar' }))).toBe('Aveiro');
    expect(userDistrict(prefs({ district: 'Faro', city: 'Ovar' }))).toBe('Faro');
    expect(userDistrict(prefs({ onsiteLocations: ['Arrifana', 'Viseu'] }))).toBe('Viseu');
    expect(userDistrict(prefs())).toBeNull();
  });

  it('Net-Empregos: categorias de cada pessoa no distrito dela, as mais pedidas primeiro', () => {
    const pairs = netEmpregosPairs([
      prefs({ areas: ['Limpeza'], district: 'Faro' }),
      prefs({ areas: ['Limpeza'], city: 'Loulé' }),
      prefs({ areas: ['Direito'] }), // sem zona: país todo
    ]);
    expect(pairs[0]).toEqual({ categoryId: 58, zoneId: 17 }); // 2 pessoas
    expect(pairs).toContainEqual({ categoryId: 44, zoneId: 0 });
    expect(netEmpregosPairs([prefs({ areas: ['Informática'] })], 3)).toHaveLength(3);
  });

  it('Jooble: uma pesquisa por zona, com as funções e áreas de quem lá está', () => {
    const q = joobleQueries([
      prefs({ areas: ['Limpeza'], city: 'Ovar', roles: ['Empregada de Limpeza'] }),
      prefs({ areas: ['Gestão/Direção'], district: 'Lisboa' }),
      prefs({ areas: ['Gestão/Direção'], district: 'Lisboa' }),
    ], 10);
    expect(q.map((x) => x.location)).toEqual(['Lisboa', 'Ovar']); // mais pessoas primeiro
    expect(q[0]!.terms).toContain('Diretor Geral');
    expect(q[1]!.terms[0]).toBe('Empregada de Limpeza');
    expect(q.flatMap((x) => x.terms).length).toBeLessThanOrEqual(10);
    expect(joobleQueries([prefs({ areas: ['Outra'] })])).toEqual([]); // nada para pesquisar
  });
});
