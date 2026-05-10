/**
 * Normaliza texto de busca:
 * - lowercase
 * - remove acentos
 * - troca símbolos de multiplicação (×, ✕, ⨯) por "x"
 * - troca vírgula decimal "0,120" por "0.120" e vice-versa? mantemos ambos via tokens separados
 * - remove caracteres que quebram o parser do PostgREST .or() — (), vírgulas, aspas, barras
 */
export function normalizeSearchTerm(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[×✕⨯]/g, 'x')
    .replace(/[(),"'`\\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Quebra texto em tokens significativos (>=2 chars), no máximo 8.
 * Tokens muito curtos (1 char) são descartados pra evitar busca ampla demais.
 */
export function tokenizeSearchTerm(input: string): string[] {
  const normalized = normalizeSearchTerm(input);
  if (!normalized) return [];
  return normalized
    .split(' ')
    .filter((t) => t.length >= 2)
    .slice(0, 8);
}

/**
 * Escapa caracteres com significado especial no PostgREST .or()
 * Tokens podem ainda conter vírgula decimal "0.120" não, já normalizado.
 * Aspas duplas e parênteses já foram removidos pelo normalize.
 */
export function escapePostgrestOrToken(token: string): string {
  // PostgREST: dentro de .or(), vírgulas e parênteses são reservados.
  // Já removidos no normalize. Mas se sobrar algo, removemos por segurança.
  return token.replace(/[(),]/g, '');
}
