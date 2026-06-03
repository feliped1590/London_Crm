/**
 * Classificador heurístico CNAE → { setor, segmento }.
 *
 * Devolve NOMES (não IDs) batendo com a taxonomia em `setores`/`segmentos`
 * já cadastrada no tenant. O frontend resolve para IDs.
 */

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function norm(s: string): string {
  return stripAccents(String(s ?? '')).toLowerCase();
}

function extractDivisao(cnae: string): number | null {
  const digits = String(cnae ?? '').replace(/\D/g, '');
  if (digits.length < 2) return null;
  const d = parseInt(digits.slice(0, 2), 10);
  return Number.isFinite(d) ? d : null;
}

function setorPorDivisao(div: number | null): string | null {
  if (div === null) return null;
  if (div >= 1 && div <= 3) return 'Agropecuária';
  if (div >= 5 && div <= 43) return 'Indústria';
  if (div === 46) return 'Distribuidora';
  if (div === 45 || div === 47) return 'Comércio';
  if (div >= 49 && div <= 96) return 'Serviços';
  return null;
}

const SEGMENTO_KEYWORDS: Array<{ kw: RegExp; segmento: string }> = [
  { kw: /\bembalage(m|ns)\b/, segmento: 'Embalagem' },
  { kw: /\bcafe\b/, segmento: 'Café' },
  { kw: /\bcelulose|papel\b/, segmento: 'Celulose' },
  { kw: /\bcereal|graos?\b/, segmento: 'Cerealista' },
  { kw: /\bcosmetic|perfumaria\b/, segmento: 'Cosméticos' },
  { kw: /\bfrigorific|abate\b/, segmento: 'Frigorífico' },
  { kw: /\blaticini|leite|queijo\b/, segmento: 'Laticínios' },
  { kw: /\bmassa|pastifici|panifica\b/, segmento: 'Massas e Pastifícios' },
  { kw: /\bpescad|peixe|aquicultura|psicultura\b/, segmento: 'Pescados e Psicultura' },
  { kw: /\bracao animal|alimento para animais|\bpet\b/, segmento: 'Pet' },
  { kw: /\bquimic|defensiv\b/, segmento: 'Químicos' },
  { kw: /\bsupermercad|hipermercad\b/, segmento: 'Supermercado' },
  { kw: /\bfertilizant|herbicid|adubo\b/, segmento: 'Herbicidas Fertilizantes' },
  { kw: /\bhigiene|limpeza\b/, segmento: 'Higiene e Limpeza' },
  { kw: /\bhortifruti|fruta|hortalica|legume\b/, segmento: 'Hortifruti' },
  { kw: /\bhospital|medic|farmac\b/, segmento: 'Hospitalar' },
  { kw: /\bembutid|defumad|linguica|salsicha\b/, segmento: 'Embutidos' },
  { kw: /\bfumo|tabaco|cigarro\b/, segmento: 'Fumo e Tabaco' },
  { kw: /\borganic|natural\b/, segmento: 'Produtos Naturais' },
  { kw: /\btransport\b/, segmento: 'Transportadoras' },
  { kw: /\bsoftware|tecnologia|informatica|sistemas\b/, segmento: 'Tecnologia' },
  { kw: /\brepresenta\b/, segmento: 'Representação' },
  { kw: /\batacad\b/, segmento: 'Atacado' },
  { kw: /\bvarejo|loja\b/, segmento: 'Varejo' },
  { kw: /\bbebid\b/, segmento: 'Alimentos e Bebidas' },
  { kw: /\baliment\b/, segmento: 'Alimentos' },
  { kw: /\bmanufatura\b/, segmento: 'Manufatura' },
];

export interface CnaeClassificationResult {
  setor_sugerido?: string;
  segmento_sugerido?: string;
}

export function classifyCnae(cnaePrincipal: string | null | undefined): CnaeClassificationResult {
  if (!cnaePrincipal) return {};
  const desc = norm(cnaePrincipal);
  const div = extractDivisao(cnaePrincipal);

  let setor = setorPorDivisao(div);
  if (/distribui/.test(desc)) setor = 'Distribuidora';

  let segmento: string | undefined;
  for (const { kw, segmento: s } of SEGMENTO_KEYWORDS) {
    if (kw.test(desc)) { segmento = s; break; }
  }

  return {
    setor_sugerido: setor ?? undefined,
    segmento_sugerido: segmento,
  };
}
