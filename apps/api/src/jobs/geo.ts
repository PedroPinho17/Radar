/**
 * Geografia de Portugal para o filtro de localização (sem GPS nem APIs externas):
 * os 308 concelhos agrupados por distrito / região autónoma.
 *
 * Porquê: as fontes dão o local com detalhes diferentes ("Porto", "Matosinhos", "Santa Maria da Feira, Aveiro").
 * Quem escolhe o distrito "Aveiro" tem de ver ofertas em Ovar; quem escolhe "Porto" não deve ver "Porto de Mós".
 */
export const CONCELHOS: Record<string, string[]> = {
  Aveiro: ['Águeda', 'Albergaria-a-Velha', 'Anadia', 'Arouca', 'Aveiro', 'Castelo de Paiva', 'Espinho', 'Estarreja',
    'Ílhavo', 'Mealhada', 'Murtosa', 'Oliveira de Azeméis', 'Oliveira do Bairro', 'Ovar', 'Santa Maria da Feira',
    'São João da Madeira', 'Sever do Vouga', 'Vagos', 'Vale de Cambra'],
  Beja: ['Aljustrel', 'Almodôvar', 'Alvito', 'Barrancos', 'Beja', 'Castro Verde', 'Cuba', 'Ferreira do Alentejo',
    'Mértola', 'Moura', 'Odemira', 'Ourique', 'Serpa', 'Vidigueira'],
  Braga: ['Amares', 'Barcelos', 'Braga', 'Cabeceiras de Basto', 'Celorico de Basto', 'Esposende', 'Fafe', 'Guimarães',
    'Póvoa de Lanhoso', 'Terras de Bouro', 'Vieira do Minho', 'Vila Nova de Famalicão', 'Vila Verde', 'Vizela'],
  Bragança: ['Alfândega da Fé', 'Bragança', 'Carrazeda de Ansiães', 'Freixo de Espada à Cinta', 'Macedo de Cavaleiros',
    'Miranda do Douro', 'Mirandela', 'Mogadouro', 'Torre de Moncorvo', 'Vila Flor', 'Vimioso', 'Vinhais'],
  'Castelo Branco': ['Belmonte', 'Castelo Branco', 'Covilhã', 'Fundão', 'Idanha-a-Nova', 'Oleiros', 'Penamacor',
    'Proença-a-Nova', 'Sertã', 'Vila de Rei', 'Vila Velha de Ródão'],
  Coimbra: ['Arganil', 'Cantanhede', 'Coimbra', 'Condeixa-a-Nova', 'Figueira da Foz', 'Góis', 'Lousã', 'Mira',
    'Miranda do Corvo', 'Montemor-o-Velho', 'Oliveira do Hospital', 'Pampilhosa da Serra', 'Penacova', 'Penela',
    'Soure', 'Tábua', 'Vila Nova de Poiares'],
  Évora: ['Alandroal', 'Arraiolos', 'Borba', 'Estremoz', 'Évora', 'Montemor-o-Novo', 'Mora', 'Mourão', 'Portel',
    'Redondo', 'Reguengos de Monsaraz', 'Vendas Novas', 'Viana do Alentejo', 'Vila Viçosa'],
  Faro: ['Albufeira', 'Alcoutim', 'Aljezur', 'Castro Marim', 'Faro', 'Lagoa', 'Lagos', 'Loulé', 'Monchique', 'Olhão',
    'Portimão', 'São Brás de Alportel', 'Silves', 'Tavira', 'Vila do Bispo', 'Vila Real de Santo António'],
  Guarda: ['Aguiar da Beira', 'Almeida', 'Celorico da Beira', 'Figueira de Castelo Rodrigo', 'Fornos de Algodres',
    'Gouveia', 'Guarda', 'Manteigas', 'Mêda', 'Pinhel', 'Sabugal', 'Seia', 'Trancoso', 'Vila Nova de Foz Côa'],
  Leiria: ['Alcobaça', 'Alvaiázere', 'Ansião', 'Batalha', 'Bombarral', 'Caldas da Rainha', 'Castanheira de Pera',
    'Figueiró dos Vinhos', 'Leiria', 'Marinha Grande', 'Nazaré', 'Óbidos', 'Pedrógão Grande', 'Peniche', 'Pombal',
    'Porto de Mós'],
  Lisboa: ['Alenquer', 'Amadora', 'Arruda dos Vinhos', 'Azambuja', 'Cadaval', 'Cascais', 'Lisboa', 'Loures', 'Lourinhã',
    'Mafra', 'Odivelas', 'Oeiras', 'Sintra', 'Sobral de Monte Agraço', 'Torres Vedras', 'Vila Franca de Xira'],
  Portalegre: ['Alter do Chão', 'Arronches', 'Avis', 'Campo Maior', 'Castelo de Vide', 'Crato', 'Elvas', 'Fronteira',
    'Gavião', 'Marvão', 'Monforte', 'Nisa', 'Ponte de Sor', 'Portalegre', 'Sousel'],
  Porto: ['Amarante', 'Baião', 'Felgueiras', 'Gondomar', 'Lousada', 'Maia', 'Marco de Canaveses', 'Matosinhos',
    'Paços de Ferreira', 'Paredes', 'Penafiel', 'Porto', 'Póvoa de Varzim', 'Santo Tirso', 'Trofa', 'Valongo',
    'Vila do Conde', 'Vila Nova de Gaia'],
  Santarém: ['Abrantes', 'Alcanena', 'Almeirim', 'Alpiarça', 'Benavente', 'Cartaxo', 'Chamusca', 'Constância', 'Coruche',
    'Entroncamento', 'Ferreira do Zêzere', 'Golegã', 'Mação', 'Ourém', 'Rio Maior', 'Salvaterra de Magos', 'Santarém',
    'Sardoal', 'Tomar', 'Torres Novas', 'Vila Nova da Barquinha'],
  Setúbal: ['Alcácer do Sal', 'Alcochete', 'Almada', 'Barreiro', 'Grândola', 'Moita', 'Montijo', 'Palmela',
    'Santiago do Cacém', 'Seixal', 'Sesimbra', 'Setúbal', 'Sines'],
  'Viana do Castelo': ['Arcos de Valdevez', 'Caminha', 'Melgaço', 'Monção', 'Paredes de Coura', 'Ponte da Barca',
    'Ponte de Lima', 'Valença', 'Viana do Castelo', 'Vila Nova de Cerveira'],
  'Vila Real': ['Alijó', 'Boticas', 'Chaves', 'Mesão Frio', 'Mondim de Basto', 'Montalegre', 'Murça', 'Peso da Régua',
    'Ribeira de Pena', 'Sabrosa', 'Santa Marta de Penaguião', 'Valpaços', 'Vila Pouca de Aguiar', 'Vila Real'],
  Viseu: ['Armamar', 'Carregal do Sal', 'Castro Daire', 'Cinfães', 'Lamego', 'Mangualde', 'Moimenta da Beira', 'Mortágua',
    'Nelas', 'Oliveira de Frades', 'Penalva do Castelo', 'Penedono', 'Resende', 'Santa Comba Dão',
    'São João da Pesqueira', 'São Pedro do Sul', 'Sátão', 'Sernancelhe', 'Tabuaço', 'Tarouca', 'Tondela',
    'Vila Nova de Paiva', 'Viseu', 'Vouzela'],
  Madeira: ['Calheta', 'Câmara de Lobos', 'Funchal', 'Machico', 'Ponta do Sol', 'Porto Moniz', 'Porto Santo',
    'Ribeira Brava', 'Santa Cruz', 'Santana', 'São Vicente'],
  // Lagoa e Calheta repetem nomes do Algarve/Madeira: o nome sozinho fica com o 1.º distrito
  Açores: ['Angra do Heroísmo', 'Calheta', 'Corvo', 'Horta', 'Lagoa', 'Lajes das Flores', 'Lajes do Pico', 'Madalena', 'Nordeste',
    'Ponta Delgada', 'Povoação', 'Praia da Vitória', 'Ribeira Grande', 'Santa Cruz da Graciosa', 'Santa Cruz das Flores',
    'São Roque do Pico', 'Velas', 'Vila do Porto', 'Vila Franca do Campo'],
};

export const DISTRICTS = Object.keys(CONCELHOS);

/** Zona (distrito) da Net-Empregos (`pesquisa-empregos.asp?zona=`), lida do próprio site. */
export const NET_EMPREGOS_ZONES: Record<string, number> = {
  Lisboa: 1, Porto: 2, Braga: 3, Aveiro: 4, Bragança: 5, 'Vila Real': 6, Guarda: 7, Viseu: 8, Coimbra: 9,
  'Castelo Branco': 10, Leiria: 11, Santarém: 12, Setúbal: 13, Évora: 14, Beja: 15, Portalegre: 16, Faro: 17,
  Açores: 25, Madeira: 26, 'Viana do Castelo': 28,
};

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Concelho (normalizado) → distrito. Nomes repetidos (Lagoa, Calheta) ficam com o 1.º distrito. */
const CONCELHO_TO_DISTRICT = new Map<string, string>();
for (const [district, list] of Object.entries(CONCELHOS)) {
  for (const c of list) if (!CONCELHO_TO_DISTRICT.has(norm(c))) CONCELHO_TO_DISTRICT.set(norm(c), district);
}
const DISTRICT_BY_NORM = new Map(DISTRICTS.map((d) => [norm(d), d]));
/** Mais compridos primeiro: "Porto de Mós" é apanhado antes de "Porto". */
const PLACE_NAMES = [...new Set([...CONCELHO_TO_DISTRICT.keys(), ...DISTRICT_BY_NORM.keys()])].sort((a, b) => b.length - a.length);

/** Distrito de um concelho ou distrito (null se não for um lugar conhecido de Portugal). */
export function districtOf(place: string): string | null {
  const n = norm(place);
  return CONCELHO_TO_DISTRICT.get(n) ?? DISTRICT_BY_NORM.get(n) ?? null;
}

/**
 * Lugares reconhecidos num texto de localização de uma oferta, como chaves:
 *  - "c:<concelho>"  concelho exato
 *  - "d:<distrito>"  distrito onde fica (ou nomeado diretamente)
 *  - "z:<distrito>"  a oferta só diz o distrito (ex.: zonas da Net-Empregos) → vale para todo o distrito
 * Vazio se não houver nenhum lugar português conhecido (ex.: "Remoto (Europe)").
 */
export function placesIn(location: string): Set<string> {
  const keys = new Set<string>();
  let text = ` ${norm(location)} `;
  const whole = norm(location);
  if (DISTRICT_BY_NORM.has(whole)) keys.add(`z:${norm(DISTRICT_BY_NORM.get(whole)!)}`);
  for (const name of PLACE_NAMES) {
    const needle = ` ${name} `;
    if (!text.includes(needle)) continue;
    text = text.replace(needle, ' '); // consome: "Porto de Mós" já não deixa "Porto" para trás
    const district = CONCELHO_TO_DISTRICT.get(name);
    if (district) {
      keys.add(`c:${name}`);
      keys.add(`d:${norm(district)}`);
    }
    if (DISTRICT_BY_NORM.has(name)) keys.add(`d:${name}`);
  }
  return keys;
}

/**
 * Chaves aceites para um lugar escolhido pela pessoa:
 *  - distrito ("Aveiro") → qualquer oferta no distrito;
 *  - concelho ("Ovar") → ofertas em Ovar + ofertas que só indicam o distrito de Ovar (Aveiro).
 * Lugares desconhecidos devolvem null (o chamador usa comparação de texto).
 */
export function acceptedKeys(place: string, kind: 'district' | 'any' = 'any'): Set<string> | null {
  const n = norm(place);
  const district = DISTRICT_BY_NORM.get(n);
  // "Porto"/"Lisboa"… são concelho E distrito: escolhido como distrito = distrito inteiro
  if (district && (kind === 'district' || !CONCELHO_TO_DISTRICT.has(n))) return new Set([`d:${n}`]);
  const of = CONCELHO_TO_DISTRICT.get(n);
  if (of) return new Set([`c:${n}`, `z:${norm(of)}`]);
  return null;
}
