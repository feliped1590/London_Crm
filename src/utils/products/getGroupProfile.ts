import type { GroupLookupItem } from '@/hooks/useProductLookups';
import type { DimensionProfile } from '@/utils/products/generateVersion';

/**
 * Resolve o perfil de dimensão de um grupo a partir do `dimension_profile` do banco,
 * com override automático para grupos cujo label contém "bobina" (sempre `partial`).
 */
export function getGroupProfile(
  grupos: GroupLookupItem[],
  grupoId?: string | null,
): DimensionProfile {
  if (!grupoId) return 'none';
  const group = grupos.find((g) => g.id === grupoId);
  const normalized = (group?.label || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (normalized.includes('bobina')) return 'partial';
  return group?.dimension_profile || 'full';
}
