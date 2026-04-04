/**
 * Geração automática de SKU estrutural baseado nos códigos das tabelas de lookup.
 *
 * Formato: TIPO-FAM-GRP-SUB-CLS-W-L-T (ou W-T para perfil partial)
 * Exemplo: PA-LT-SUP-2S-NPMPT-200-300-120
 */

export interface SkuParams {
  tipoCode?: string;
  familyCode?: string;
  groupCode?: string;
  subgroupCode?: string;
  classCode?: string;
  width?: number;
  length?: number;
  thickness?: number;
  dimensionProfile: 'full' | 'partial' | 'none';
}

function formatThicknessForSku(t: number): string {
  // thickness * 1000, padded to 3 digits
  return Math.round(t * 1000).toString().padStart(3, '0');
}

export function generateStructuralSku(params: SkuParams): string {
  const parts = [
    params.tipoCode,
    params.familyCode,
    params.groupCode,
    params.subgroupCode,
    params.classCode,
  ].filter(Boolean);

  const w = params.width || 0;
  const l = params.length || 0;
  const t = params.thickness || 0;

  if (params.dimensionProfile === 'full' && w > 0 && l > 0 && t > 0) {
    parts.push(
      String(Math.round(w)),
      String(Math.round(l)),
      formatThicknessForSku(t),
    );
  } else if (params.dimensionProfile === 'partial' && w > 0 && t > 0) {
    parts.push(
      String(Math.round(w)),
      formatThicknessForSku(t),
    );
  }

  return parts.join('-').toUpperCase();
}

/**
 * Computes the same structure_hash as the database trigger (md5).
 * Used for client-side comparison / findSimilarProducts.
 */
export function computeStructureHash(params: {
  tenantId?: string;
  tipoId?: string;
  familyId?: string;
  grupoId?: string;
  subgrupoId?: string;
  classId?: string;
  width?: number;
  length?: number;
  thickness?: number;
}): string {
  // We don't compute MD5 client-side — we rely on the DB trigger.
  // This function builds the key string for query-based comparison.
  return [
    params.tenantId || '',
    params.tipoId || '',
    params.familyId || '',
    params.grupoId || '',
    params.subgrupoId || '',
    params.classId || '',
    String(params.width || 0),
    String(params.length || 0),
    String(params.thickness || 0),
  ].join('|');
}
