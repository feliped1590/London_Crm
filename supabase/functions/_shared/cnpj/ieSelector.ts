/**
 * Seleção segura de UMA Inscrição Estadual.
 *
 * Regra (conservadora):
 *  1. Filtra IEs ativas.
 *  2. Se há exatamente 1 IE ativa do mesmo estado do estabelecimento → escolhe.
 *  3. Se há mais de uma IE ativa do mesmo estado → ambíguo, devolve null.
 *  4. Se há exatamente 1 IE ativa no Brasil inteiro → escolhe.
 *  5. Caso contrário → null (usuário preenche manualmente).
 *
 * Ambiguidade NUNCA preenche, para não escrever IE errada no ERP.
 */

export interface InscricaoEstadualInput {
  inscricao_estadual: string;
  ativo: boolean;
  estado: string;
}

export function selectInscricaoEstadual(
  inscricoes: InscricaoEstadualInput[] | null | undefined,
  ufEstabelecimento: string | null | undefined,
): string | null {
  if (!inscricoes || inscricoes.length === 0) return null;

  const ativas = inscricoes.filter(
    (ie) => ie.ativo === true && ie.inscricao_estadual?.trim(),
  );
  if (ativas.length === 0) return null;

  const uf = (ufEstabelecimento ?? '').toUpperCase().trim();

  if (uf) {
    const mesmaUF = ativas.filter((ie) => ie.estado === uf);
    if (mesmaUF.length === 1) return mesmaUF[0].inscricao_estadual.trim();
    if (mesmaUF.length > 1) return null;
  }

  if (ativas.length === 1) return ativas[0].inscricao_estadual.trim();

  return null;
}
