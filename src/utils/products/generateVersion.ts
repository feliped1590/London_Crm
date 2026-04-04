/**
 * Geração automática de erp_versao para integração ERP Iniflex/Projedata.
 *
 * Usa mapeamento controlado de grupos para determinar quais dimensões são
 * obrigatórias, evitando dependência de texto livre (.includes).
 */

// ─── Perfis de dimensão ────────────────────────────────────────────────
export type DimensionProfile = 'full' | 'partial' | 'none';

/**
 * Mapeamento controlado: label exato do grupo → perfil de dimensão.
 * Para adicionar novos grupos basta incluir aqui.
 *
 * full    = Largura × Comprimento × Espessura  (Saco)
 * partial = Largura × Espessura                 (Bobina)
 * none    = sem dimensões obrigatórias
 */
const GROUP_DIMENSION_MAP: Record<string, DimensionProfile> = {
  'Impresso Saco': 'full',
  'Liso Saco': 'full',
  'Impresso Bobina': 'partial',
  'Liso Bobina': 'partial',
};

/**
 * Retorna o perfil de dimensão para um dado label de grupo.
 * Comparação case-insensitive com trim para resiliência.
 */
export function getProductDimensionProfile(grupoLabel: string | undefined): DimensionProfile {
  if (!grupoLabel) return 'none';
  const normalized = grupoLabel.trim();

  // Busca exata primeiro (mais rápido)
  if (GROUP_DIMENSION_MAP[normalized]) {
    return GROUP_DIMENSION_MAP[normalized];
  }

  // Busca case-insensitive como fallback
  const key = Object.keys(GROUP_DIMENSION_MAP).find(
    (k) => k.toLowerCase() === normalized.toLowerCase()
  );
  return key ? GROUP_DIMENSION_MAP[key] : 'none';
}

// ─── Campos obrigatórios por perfil ────────────────────────────────────

export interface RequiredFieldDef {
  field: string;
  label: string;
}

const BASE_REQUIRED_FIELDS: RequiredFieldDef[] = [
  { field: 'tipo_id', label: 'Tipo' },
  { field: 'grupo_id', label: 'Grupo' },
  { field: 'subgrupo_id', label: 'Subgrupo' },
  { field: 'family_id', label: 'Família' },
  { field: 'class_id', label: 'Classe' },
  { field: 'unit_measure', label: 'Unidade de Medida' },
  { field: 'ncm_code', label: 'NCM' },
];

const DIMENSION_FIELDS_FULL: RequiredFieldDef[] = [
  { field: 'width', label: 'Largura' },
  { field: 'length', label: 'Comprimento' },
  { field: 'thickness', label: 'Espessura' },
];

const DIMENSION_FIELDS_PARTIAL: RequiredFieldDef[] = [
  { field: 'width', label: 'Largura' },
  { field: 'thickness', label: 'Espessura' },
];

/**
 * Retorna a lista de campos obrigatórios conforme perfil de dimensão.
 */
export function getRequiredFieldsForProfile(profile: DimensionProfile): RequiredFieldDef[] {
  switch (profile) {
    case 'full':
      return [...BASE_REQUIRED_FIELDS, ...DIMENSION_FIELDS_FULL];
    case 'partial':
      return [...BASE_REQUIRED_FIELDS, ...DIMENSION_FIELDS_PARTIAL];
    case 'none':
      return [{ field: 'tipo_id', label: 'Tipo' }];
  }
}

// ─── Validação de campos ───────────────────────────────────────────────

/**
 * Valida os campos obrigatórios do formulário conforme perfil.
 * Retorna lista de labels dos campos faltantes (vazia = OK).
 */
export function validateRequiredFields(
  formData: Record<string, any>,
  profile: DimensionProfile
): string[] {
  const required = getRequiredFieldsForProfile(profile);
  const missing: string[] = [];

  for (const { field, label } of required) {
    const value = formData[field];

    // Campos numéricos de dimensão: devem ser > 0
    if (['width', 'length', 'thickness'].includes(field)) {
      if (!value || Number(value) <= 0) {
        missing.push(label);
      }
    }
    // Demais campos: não podem ser vazio/undefined/null
    else if (!value || (typeof value === 'string' && value.trim() === '')) {
      missing.push(label);
    }
  }

  return missing;
}

// ─── Formatação de dimensão ────────────────────────────────────────────

/**
 * Formata um valor numérico de dimensão.
 * - Espessura: sempre 3 casas decimais com vírgula (0,120)
 * - Largura/Comprimento: inteiro sem casas decimais desnecessárias
 */
function formatDimension(value: number, isThickness: boolean): string {
  if (isThickness) {
    return value.toFixed(3).replace('.', ',');
  }
  // Remover ".0" desnecessário (100.0 → 100)
  return Number.isInteger(value) ? value.toString() : value.toString().replace('.', ',');
}

// ─── Geração da versão ────────────────────────────────────────────────

export class VersionGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VersionGenerationError';
  }
}

/**
 * Gera o erp_versao automaticamente a partir das dimensões.
 *
 * - full:    "100x150x0,120" (LxCxE)
 * - partial: "100x0,120"     (LxE)
 * - none:    não gera (retorna null — o formulário deve exigir preenchimento manual)
 *
 * @throws VersionGenerationError se dimensões obrigatórias estiverem ausentes
 */
export function generateErpVersion(
  profile: DimensionProfile,
  width: number | undefined,
  length: number | undefined,
  thickness: number | undefined
): string | null {
  if (profile === 'none') {
    return null; // Versão manual — formulário valida separadamente
  }

  const w = Number(width) || 0;
  const l = Number(length) || 0;
  const t = Number(thickness) || 0;

  if (profile === 'full') {
    if (w <= 0 || l <= 0 || t <= 0) {
      throw new VersionGenerationError(
        'Para este grupo, Largura, Comprimento e Espessura são obrigatórios para gerar a versão.'
      );
    }
    return `${formatDimension(w, false)}x${formatDimension(l, false)}x${formatDimension(t, true)}`;
  }

  if (profile === 'partial') {
    if (w <= 0 || t <= 0) {
      throw new VersionGenerationError(
        'Para este grupo, Largura e Espessura são obrigatórios para gerar a versão.'
      );
    }
    return `${formatDimension(w, false)}x${formatDimension(t, true)}`;
  }

  return null;
}

/**
 * Tenta gerar a versão de forma segura (sem lançar exceção).
 * Retorna a string gerada ou string vazia se impossível.
 * Usado nos onChange para preview em tempo real.
 */
export function tryGenerateErpVersion(
  profile: DimensionProfile,
  width: number | undefined,
  length: number | undefined,
  thickness: number | undefined
): string {
  try {
    return generateErpVersion(profile, width, length, thickness) || '';
  } catch {
    return '';
  }
}

/**
 * Verifica se um perfil possui dimensões auto-geradas.
 */
export function hasAutoDimensions(profile: DimensionProfile): boolean {
  return profile === 'full' || profile === 'partial';
}
