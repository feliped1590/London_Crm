/**
 * Geração automática de erp_versao para integração ERP Iniflex/Projedata.
 *
 * O perfil de dimensão (full/partial/none) vem da coluna dimension_profile
 * da tabela product_groups — zero hardcode de labels.
 */

// ─── Perfis de dimensão ────────────────────────────────────────────────
export type DimensionProfile = 'full' | 'partial' | 'none';

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

// ─── Sanfona (gusset) ─────────────────────────────────────────────────

export type GussetLocation = 'Lateral' | 'Fundo';

export interface GussetData {
  ativa?: boolean;
  local?: GussetLocation;
  valor?: number;
}

/** Lê o bloco sanfona de um objeto ficha_tecnica e devolve apenas se ativa+válida. */
export function extractGusset(ficha: any): GussetData | undefined {
  const s = ficha?.sanfona;
  if (!s || !s.ativa) return undefined;
  const valor = Number(s.valor);
  if (!s.local || !Number.isFinite(valor) || valor <= 0) return undefined;
  return { ativa: true, local: s.local, valor };
}

function applyGusset(baseFormatted: string, gusset: GussetData | undefined, target: GussetLocation): string {
  if (!gusset || gusset.local !== target || !gusset.valor || gusset.valor <= 0) return baseFormatted;
  return `${baseFormatted}+${formatDimension(gusset.valor, false)}`;
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
 * - full:    "100x150x0,120" (LxCxE) — com sanfona: "100+30x150x0,120" ou "100x150+30x0,120"
 * - partial: "100x0,120"     (LxE)   — com sanfona: "100+30x0,120"
 * - none:    não gera (retorna null — o formulário deve exigir preenchimento manual)
 */
export function generateErpVersion(
  profile: DimensionProfile,
  width: number | undefined,
  length: number | undefined,
  thickness: number | undefined,
  gusset?: GussetData,
): string | null {
  if (profile === 'none') {
    return null;
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
    const wStr = applyGusset(formatDimension(w, false), gusset, 'Lateral');
    const lStr = applyGusset(formatDimension(l, false), gusset, 'Fundo');
    return `${wStr}x${lStr}x${formatDimension(t, true)}`;
  }

  if (profile === 'partial') {
    if (w <= 0 || t <= 0) {
      throw new VersionGenerationError(
        'Para este grupo, Largura e Espessura são obrigatórios para gerar a versão.'
      );
    }
    const wStr = applyGusset(formatDimension(w, false), gusset, 'Lateral');
    return `${wStr}x${formatDimension(t, true)}`;
  }

  return null;
}

/** Versão segura (sem exceção). */
export function tryGenerateErpVersion(
  profile: DimensionProfile,
  width: number | undefined,
  length: number | undefined,
  thickness: number | undefined,
  gusset?: GussetData,
): string {
  try {
    return generateErpVersion(profile, width, length, thickness, gusset) || '';
  } catch {
    return '';
  }
}

export function hasAutoDimensions(profile: DimensionProfile): boolean {
  return profile === 'full' || profile === 'partial';
}
