/**
 * Testes unitários do IE Selector.
 *
 * Roda com: deno test supabase/functions/_shared/cnpj/ieSelector_test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { selectInscricaoEstadual } from './ieSelector.ts';

Deno.test('IE: retorna null quando lista vazia', () => {
  assertEquals(selectInscricaoEstadual([], 'SP'), null);
  assertEquals(selectInscricaoEstadual(null, 'SP'), null);
});

Deno.test('IE: ignora inscrições inativas', () => {
  const r = selectInscricaoEstadual(
    [
      { inscricao_estadual: '111111111', ativo: false, estado: 'SP' },
      { inscricao_estadual: '222222222', ativo: false, estado: 'SP' },
    ],
    'SP',
  );
  assertEquals(r, null);
});

Deno.test('IE: escolhe única ativa do mesmo estado', () => {
  const r = selectInscricaoEstadual(
    [
      { inscricao_estadual: '111111111', ativo: true, estado: 'SP' },
      { inscricao_estadual: '222222222', ativo: true, estado: 'RJ' },
    ],
    'SP',
  );
  assertEquals(r, '111111111');
});

Deno.test('IE: ambíguo no mesmo estado → null (não preenche)', () => {
  const r = selectInscricaoEstadual(
    [
      { inscricao_estadual: '111111111', ativo: true, estado: 'SP' },
      { inscricao_estadual: '222222222', ativo: true, estado: 'SP' },
    ],
    'SP',
  );
  assertEquals(r, null);
});

Deno.test('IE: única ativa no Brasil quando UF não bate → escolhe', () => {
  const r = selectInscricaoEstadual(
    [{ inscricao_estadual: '333333333', ativo: true, estado: 'MG' }],
    'SP',
  );
  assertEquals(r, '333333333');
});

Deno.test('IE: várias UFs distintas, nenhuma local → null', () => {
  const r = selectInscricaoEstadual(
    [
      { inscricao_estadual: '111111111', ativo: true, estado: 'MG' },
      { inscricao_estadual: '222222222', ativo: true, estado: 'RJ' },
    ],
    'SP',
  );
  assertEquals(r, null);
});

Deno.test('IE: ignora strings vazias', () => {
  const r = selectInscricaoEstadual(
    [
      { inscricao_estadual: '   ', ativo: true, estado: 'SP' },
      { inscricao_estadual: '444444444', ativo: true, estado: 'SP' },
    ],
    'SP',
  );
  assertEquals(r, '444444444');
});

Deno.test('IE: UF vazia + única ativa → escolhe', () => {
  const r = selectInscricaoEstadual(
    [{ inscricao_estadual: '555555555', ativo: true, estado: 'SP' }],
    '',
  );
  assertEquals(r, '555555555');
});
