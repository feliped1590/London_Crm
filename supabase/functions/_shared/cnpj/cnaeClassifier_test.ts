import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { classifyCnae } from './cnaeClassifier.ts';

Deno.test('Indústria + Embalagens (caso do usuário)', () => {
  const r = classifyCnae('22.22-6-00 - Fabricação de embalagens de material plástico');
  assertEquals(r.setor_sugerido, 'Indústria');
  assertEquals(r.segmento_sugerido, 'Embalagem');
});

Deno.test('Comércio varejista', () => {
  const r = classifyCnae('47.11-3-02 - Comércio varejista de mercadorias em geral');
  assertEquals(r.setor_sugerido, 'Comércio');
  assertEquals(r.segmento_sugerido, 'Varejo');
});

Deno.test('Distribuidora por descrição', () => {
  const r = classifyCnae('46.86-9-02 - Distribuição de produtos químicos');
  assertEquals(r.setor_sugerido, 'Distribuidora');
  assertEquals(r.segmento_sugerido, 'Químicos');
});

Deno.test('Serviços de TI', () => {
  const r = classifyCnae('62.01-5-00 - Desenvolvimento de software sob encomenda');
  assertEquals(r.setor_sugerido, 'Serviços');
  assertEquals(r.segmento_sugerido, 'Tecnologia');
});

Deno.test('Agropecuária', () => {
  const r = classifyCnae('01.13-0-00 - Cultivo de cana-de-açúcar');
  assertEquals(r.setor_sugerido, 'Agropecuária');
});

Deno.test('Vazio devolve objeto vazio', () => {
  assertEquals(classifyCnae(''), {});
  assertEquals(classifyCnae(null), {});
});

Deno.test('Frigorífico', () => {
  const r = classifyCnae('10.11-2-01 - Frigorífico - abate de bovinos');
  assertEquals(r.setor_sugerido, 'Indústria');
  assertEquals(r.segmento_sugerido, 'Frigorífico');
});
