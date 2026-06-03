/**
 * Testes unitários dos normalizadores BrasilAPI e CNPJ.ws.
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { fromBrasilApi, fromCnpjWs, type CnpjWsRawResponse } from './normalizer.ts';

Deno.test('Normalizer BrasilAPI: shape mínimo', () => {
  const out = fromBrasilApi({
    razao_social: 'EMPRESA TESTE LTDA',
    nome_fantasia: 'TESTE',
    descricao_situacao_cadastral: 'ATIVA',
    data_inicio_atividade: '2010-01-15',
    cnae_fiscal: 4751201,
    cnae_fiscal_descricao: 'Comércio varejista de produtos diversos',
    logradouro: 'RUA A',
    numero: '100',
    complemento: 'SALA 1',
    bairro: 'CENTRO',
    cep: '01001000',
    uf: 'sp',
    municipio: 'SAO PAULO',
    ddd_telefone_1: '11 3333-4444',
    porte: 'DEMAIS',
    capital_social: 100000,
  });

  assertEquals(out.razao_social, 'EMPRESA TESTE LTDA');
  assertEquals(out.nome_fantasia, 'TESTE');
  assertEquals(out.cnae_principal, '4751201 - Comércio varejista de produtos diversos');
  assertEquals(out.endereco.uf, 'SP');
  assertEquals(out.endereco.cidade, 'SAO PAULO');
  assertEquals(out.telefone, '113333444');  // só dígitos
  assertEquals(out.capital_social, 100000);
  assertEquals(out.inscricao_estadual, undefined);  // BrasilAPI não fornece
  assertEquals(out.is_matriz, undefined);
  assertEquals(out.regime_tributario, undefined);
});

Deno.test('Normalizer BrasilAPI: campos nulos viram strings vazias', () => {
  const out = fromBrasilApi({});
  assertEquals(out.razao_social, '');
  assertEquals(out.endereco.uf, '');
  assertEquals(out.capital_social, 0);
});

Deno.test('Normalizer CNPJ.ws: payload completo com IE única em mesma UF', () => {
  const raw: CnpjWsRawResponse = {
    razao_social: 'INDÚSTRIA EXEMPLO S.A.',
    capital_social: '500000.00',
    porte: { descricao: 'Demais' },
    simples: { simples: false, mei: false },
    estabelecimento: {
      tipo: 'Matriz',
      nome_fantasia: 'EXEMPLO',
      situacao_cadastral: 'Ativa',
      data_inicio_atividade: '2005-03-10',
      atividade_principal: { id: '2222901', descricao: 'Fabricação de embalagens' },
      ddd1: '11',
      telefone1: '33334444',
      tipo_logradouro: 'AVENIDA',
      logradouro: 'PAULISTA',
      numero: '1000',
      complemento: 'ANDAR 5',
      bairro: 'BELA VISTA',
      cep: '01310-100',
      cidade: { nome: 'São Paulo' },
      estado: { sigla: 'SP' },
      inscricoes_estaduais: [
        { inscricao_estadual: '123456789012', ativo: true, estado: { sigla: 'SP' } },
        { inscricao_estadual: '987654321', ativo: false, estado: { sigla: 'RJ' } },
      ],
    },
  };

  const out = fromCnpjWs(raw);

  assertEquals(out.razao_social, 'INDÚSTRIA EXEMPLO S.A.');
  assertEquals(out.nome_fantasia, 'EXEMPLO');
  assertEquals(out.situacao_cadastral, 'Ativa');
  assertEquals(out.cnae_principal, '2222901 - Fabricação de embalagens');
  assertEquals(out.endereco.logradouro, 'AVENIDA PAULISTA');
  assertEquals(out.endereco.numero, '1000');
  assertEquals(out.endereco.complemento, 'ANDAR 5');
  assertEquals(out.endereco.bairro, 'BELA VISTA');
  assertEquals(out.endereco.cidade, 'São Paulo');
  assertEquals(out.endereco.uf, 'SP');
  assertEquals(out.endereco.cep, '01310100');
  assertEquals(out.telefone, '1133334444');
  assertEquals(out.porte, 'Demais');
  assertEquals(out.capital_social, 500000);
  assertEquals(out.inscricao_estadual, '123456789012');
  assertEquals(out.is_matriz, true);
  assertEquals(out.regime_tributario, undefined);
});

Deno.test('Normalizer CNPJ.ws: Simples Nacional → regime_tributario preenchido', () => {
  const raw: CnpjWsRawResponse = {
    razao_social: 'MEI EXEMPLO',
    simples: { simples: true, mei: false },
    estabelecimento: {
      tipo: 'Matriz',
      estado: { sigla: 'MG' },
      cidade: { nome: 'Belo Horizonte' },
    },
  };
  const out = fromCnpjWs(raw);
  assertEquals(out.regime_tributario, 'simples_nacional');
});

Deno.test('Normalizer CNPJ.ws: tipo Filial → is_matriz=false', () => {
  const raw: CnpjWsRawResponse = {
    razao_social: 'FILIAL X',
    estabelecimento: { tipo: 'Filial', estado: { sigla: 'SP' } },
  };
  const out = fromCnpjWs(raw);
  assertEquals(out.is_matriz, false);
});

Deno.test('Normalizer CNPJ.ws: IE ambígua (2 ativas mesma UF) → undefined', () => {
  const raw: CnpjWsRawResponse = {
    razao_social: 'AMBIGUA',
    estabelecimento: {
      tipo: 'Matriz',
      estado: { sigla: 'SP' },
      inscricoes_estaduais: [
        { inscricao_estadual: '111', ativo: true, estado: { sigla: 'SP' } },
        { inscricao_estadual: '222', ativo: true, estado: { sigla: 'SP' } },
      ],
    },
  };
  const out = fromCnpjWs(raw);
  assertEquals(out.inscricao_estadual, undefined);
});

Deno.test('Normalizer CNPJ.ws: campos opcionais ausentes → defaults seguros', () => {
  const out = fromCnpjWs({ estabelecimento: {} });
  assertExists(out);
  assertEquals(out.razao_social, '');
  assertEquals(out.endereco.uf, '');
  assertEquals(out.capital_social, 0);
  assertEquals(out.is_matriz, false);
});
