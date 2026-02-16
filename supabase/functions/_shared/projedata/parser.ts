/**
 * Parser de código/versão para ERP Projedata
 * 
 * O ERP espera codigo e versao como campos separados.
 * O CRM armazena no formato "800432/1".
 * Este módulo converte entre os dois formatos.
 */

import type { CodigoVersaoParsed } from './types.ts';

/**
 * Separa "800432/1" em { codigo: "800432", versao: "1" }
 * 
 * Regras:
 * - codigo deve conter APENAS dígitos
 * - versao deve conter APENAS dígitos
 * - Se não houver "/", assume versao = "1"
 * - Espaços são removidos
 * 
 * @throws Error se codigo ou versao contiver caracteres não numéricos
 */
export function parseCodigoVersao(codigoCompleto: string): CodigoVersaoParsed {
  if (!codigoCompleto || !codigoCompleto.trim()) {
    throw new Error('Código do produto não pode ser vazio');
  }

  const trimmed = codigoCompleto.trim();
  let codigo: string;
  let versao: string;

  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length !== 2) {
      throw new Error(`Formato inválido: "${codigoCompleto}". Esperado "codigo/versao" (ex: "800432/1")`);
    }
    codigo = parts[0].trim();
    versao = parts[1].trim();
  } else {
    codigo = trimmed;
    versao = '1';
  }

  // Validar que ambos são numéricos puros
  if (!/^\d+$/.test(codigo)) {
    throw new Error(`Código "${codigo}" contém caracteres não numéricos. Deve conter apenas dígitos.`);
  }
  if (!/^\d+$/.test(versao)) {
    throw new Error(`Versão "${versao}" contém caracteres não numéricos. Deve conter apenas dígitos.`);
  }

  return { codigo, versao };
}

/**
 * Monta o formato completo "codigo/versao" a partir dos componentes
 */
export function formatCodigoVersao(codigo: string, versao: string): string {
  return `${codigo}/${versao}`;
}
