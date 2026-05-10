/**
 * Normalizes a search term for product/SKU lookup.
 * - Lowercase
 * - Strip diacritics (acentos)
 * - Replace Unicode multiplication signs (×, ✕, ⨯) with 'x'
 * - Collapse whitespace
 */
export function normalizeSearchTerm(input: string): string {
  if (!input) return '';
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[×✕⨯╳]/g, 'x')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Escapes characters that have special meaning inside a PostgREST `or()` filter value.
 * Commas and parentheses break the filter syntax, so we strip them out of tokens.
 */
function sanitizeToken(token: string): string {
  return token.replace(/[(),*]/g, '').trim();
}

/**
 * Tokenizes a normalized search term into AND-able tokens.
 * - min length 2 per token
 * - max 8 tokens (safety)
 */
export function tokenizeSearchTerm(input: string): string[] {
  const normalized = normalizeSearchTerm(input);
  if (!normalized) return [];
  const tokens = normalized
    .split(' ')
    .map(sanitizeToken)
    .filter((t) => t.length >= 2);
  return tokens.slice(0, 8);
}

/**
 * Applies a tokenized AND search across `name` and `sku` columns to a Supabase query builder.
 * Each token must match (in `name` OR `sku`); tokens may appear in any order.
 *
 * Returns the (possibly modified) query so the caller can continue chaining.
 */
export function applyProductSearchFilter<Q extends { or: (filter: string) => Q }>(
  query: Q,
  rawText: string | undefined | null,
): Q {
  const tokens = tokenizeSearchTerm(rawText ?? '');
  if (tokens.length === 0) return query;
  let q = query;
  for (const token of tokens) {
    q = q.or(`name.ilike.%${token}%,sku.ilike.%${token}%`);
  }
  return q;
}
