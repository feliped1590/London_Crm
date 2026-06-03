/**
 * Normalizadores: payload bruto do provider → NormalizedCnpjResult.
 * Cada provider tem seu próprio normalizador isolado para que mudanças
 * na resposta da API não vazem para o frontend.
 */

import type { NormalizedCnpjResult } from './types.ts';
import { selectInscricaoEstadual } from './ieSelector.ts';
import { classifyCnae } from './cnaeClassifier.ts';

function onlyDigits(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// ─── BrasilAPI v1 ──────────────────────────────────────────────
// Shape de referência: ver supabase/functions/lookup-cnpj/index.ts (versão anterior).
export interface BrasilApiRawResponse {
  razao_social?: string;
  nome_fantasia?: string;
  descricao_situacao_cadastral?: string;
  data_inicio_atividade?: string;
  cnae_fiscal?: number;
  cnae_fiscal_descricao?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  uf?: string;
  municipio?: string;
  ddd_telefone_1?: string;
  porte?: string;
  capital_social?: number;
}

export function fromBrasilApi(raw: BrasilApiRawResponse): NormalizedCnpjResult {
  const cnae = raw.cnae_fiscal && raw.cnae_fiscal_descricao
    ? `${raw.cnae_fiscal} - ${raw.cnae_fiscal_descricao}`
    : asString(raw.cnae_fiscal_descricao);

  return {
    razao_social: asString(raw.razao_social),
    nome_fantasia: asString(raw.nome_fantasia),
    situacao_cadastral: asString(raw.descricao_situacao_cadastral),
    data_inicio_atividade: asString(raw.data_inicio_atividade),
    cnae_principal: cnae,
    endereco: {
      logradouro: asString(raw.logradouro),
      numero: asString(raw.numero),
      complemento: asString(raw.complemento),
      bairro: asString(raw.bairro),
      cidade: asString(raw.municipio),
      uf: asString(raw.uf).toUpperCase(),
      cep: asString(raw.cep),
    },
    telefone: onlyDigits(raw.ddd_telefone_1),
    porte: asString(raw.porte),
    capital_social: asNumber(raw.capital_social),
    // BrasilAPI não fornece IE, tipo Matriz/Filial nem regime tributário.
  };
}

// ─── CNPJ.ws (publica) ─────────────────────────────────────────
// Shape de referência: https://publica.cnpj.ws/cnpj/{cnpj}
// Implementação efetiva do provider será adicionada na Fase 2.
export interface CnpjWsRawResponse {
  razao_social?: string;
  capital_social?: string | number;
  porte?: { descricao?: string };
  simples?: {
    simples?: boolean | string;
    mei?: boolean | string;
  };
  estabelecimento?: {
    tipo?: string;
    nome_fantasia?: string;
    situacao_cadastral?: string;
    data_inicio_atividade?: string;
    atividade_principal?: { id?: string; descricao?: string };
    ddd1?: string;
    telefone1?: string;
    email?: string;
    tipo_logradouro?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cep?: string;
    cidade?: { nome?: string };
    estado?: { sigla?: string };
    inscricoes_estaduais?: Array<{
      inscricao_estadual?: string;
      ativo?: boolean;
      tipo?: string;
      estado?: { sigla?: string };
    }>;
  };
}

export function fromCnpjWs(raw: CnpjWsRawResponse): NormalizedCnpjResult {
  const est = raw.estabelecimento ?? {};
  const ufEstab = asString(est.estado?.sigla).toUpperCase();

  const cnaeId = asString(est.atividade_principal?.id);
  const cnaeDesc = asString(est.atividade_principal?.descricao);
  const cnae = cnaeId && cnaeDesc ? `${cnaeId} - ${cnaeDesc}` : cnaeDesc;

  const ddd = asString(est.ddd1);
  const tel = onlyDigits(est.telefone1);
  const telefone = ddd && tel ? `${onlyDigits(ddd)}${tel}` : tel;

  const ieRaw = (est.inscricoes_estaduais ?? []).map((ie) => ({
    inscricao_estadual: asString(ie.inscricao_estadual),
    ativo: ie.ativo === true,
    estado: asString(ie.estado?.sigla).toUpperCase(),
  }));
  const ieSelected = selectInscricaoEstadual(ieRaw, ufEstab);

  const isMatriz = asString(est.tipo).toLowerCase() === 'matriz';

  const simplesAtivo = raw.simples?.simples === true || raw.simples?.simples === 'Sim';
  const meiAtivo = raw.simples?.mei === true || raw.simples?.mei === 'Sim';
  const regime: NormalizedCnpjResult['regime_tributario'] | undefined =
    simplesAtivo || meiAtivo ? 'simples_nacional' : undefined;

  const logradouroFull = [asString(est.tipo_logradouro), asString(est.logradouro)]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    razao_social: asString(raw.razao_social),
    nome_fantasia: asString(est.nome_fantasia),
    situacao_cadastral: asString(est.situacao_cadastral),
    data_inicio_atividade: asString(est.data_inicio_atividade),
    cnae_principal: cnae,
    endereco: {
      logradouro: logradouroFull,
      numero: asString(est.numero),
      complemento: asString(est.complemento),
      bairro: asString(est.bairro),
      cidade: asString(est.cidade?.nome),
      uf: ufEstab,
      cep: onlyDigits(est.cep),
    },
    telefone,
    porte: asString(raw.porte?.descricao),
    capital_social: asNumber(raw.capital_social),
    inscricao_estadual: ieSelected ?? undefined,
    is_matriz: isMatriz,
    regime_tributario: regime,
  };
}
