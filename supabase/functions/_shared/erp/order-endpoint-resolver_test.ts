/**
 * Testes do resolver de configuração ERP de pedidos.
 * Cobre o fallback Novafix (env vars) e os overrides por entidade jurídica.
 */
import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { resolveOrderErpConfig, isOrderErpConfigError } from './order-endpoint-resolver.ts';

function makeSupabase(row: any | null, error: any = null) {
  return {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({ data: row, error }),
      };
    },
  };
}

function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void>) {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) {
    prev[k] = Deno.env.get(k);
    if (vars[k] === undefined) Deno.env.delete(k);
    else Deno.env.set(k, vars[k]!);
  }
  return fn().finally(() => {
    for (const k of Object.keys(prev)) {
      const v = prev[k];
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  });
}

Deno.test('fallback puro (Novafix): sem overrides usa env vars', async () => {
  const sb = makeSupabase({
    id: 'le-novafix', name: 'Novafix',
    erp_company_code: '1',
    order_erp_endpoint: null,
    order_erp_token_secret_name: null,
    order_erp_enabled: true,
  });
  await withEnv(
    { PROJEDATA_API_URL: 'https://novafix.example/erp', PROJEDATA_API_TOKEN: 'token-nf' },
    async () => {
      const cfg = await resolveOrderErpConfig(sb, 'le-novafix');
      assertEquals(cfg.endpoint, 'https://novafix.example/erp');
      assertEquals(cfg.token, 'token-nf');
      assertEquals(cfg.empresa, 1);
      assertEquals(cfg.source, 'env_fallback');
      assertEquals(cfg.tokenSecretName, null);
    },
  );
});

Deno.test('override completo (Martina): endpoint + secret próprios', async () => {
  const sb = makeSupabase({
    id: 'le-mart', name: 'Martina',
    erp_company_code: '1',
    order_erp_endpoint: 'https://iniflex.martinapack.com.br/api/v1/runtime/endpoint/integracao/iniflex/json',
    order_erp_token_secret_name: 'PROJEDATA_TOKEN_MARTINAPACK',
    order_erp_enabled: true,
  });
  await withEnv(
    { PROJEDATA_TOKEN_MARTINAPACK: 'tok-mart', PROJEDATA_API_URL: 'x', PROJEDATA_API_TOKEN: 'y' },
    async () => {
      const cfg = await resolveOrderErpConfig(sb, 'le-mart');
      assertEquals(cfg.endpoint, 'https://iniflex.martinapack.com.br/api/v1/runtime/endpoint/integracao/iniflex/json');
      assertEquals(cfg.token, 'tok-mart');
      assertEquals(cfg.empresa, 1);
      assertEquals(cfg.source, 'legal_entity');
      assertEquals(cfg.tokenSecretName, 'PROJEDATA_TOKEN_MARTINAPACK');
    },
  );
});

Deno.test('integração desativada → erro order_erp_disabled', async () => {
  const sb = makeSupabase({
    id: 'le-x', name: 'X',
    erp_company_code: '1',
    order_erp_endpoint: null, order_erp_token_secret_name: null,
    order_erp_enabled: false,
  });
  await assertRejects(
    () => resolveOrderErpConfig(sb, 'le-x'),
    Error,
    'desativada',
  );
});

Deno.test('código ERP vazio → erro erp_company_code', async () => {
  const sb = makeSupabase({
    id: 'le-y', name: 'Y',
    erp_company_code: null,
    order_erp_endpoint: null, order_erp_token_secret_name: null,
    order_erp_enabled: true,
  });
  await withEnv(
    { PROJEDATA_API_URL: 'u', PROJEDATA_API_TOKEN: 't' },
    async () => {
      const err = await assertRejects(() => resolveOrderErpConfig(sb, 'le-y'), Error);
      if (isOrderErpConfigError(err)) assertEquals(err.field, 'erp_company_code');
    },
  );
});

Deno.test('secret nomeado mas inexistente → erro order_erp_token_missing', async () => {
  const sb = makeSupabase({
    id: 'le-z', name: 'Z',
    erp_company_code: '2',
    order_erp_endpoint: 'https://endpoint',
    order_erp_token_secret_name: 'SECRET_QUE_NAO_EXISTE',
    order_erp_enabled: true,
  });
  await withEnv(
    { SECRET_QUE_NAO_EXISTE: undefined, PROJEDATA_API_URL: 'u', PROJEDATA_API_TOKEN: 't' },
    async () => {
      const err = await assertRejects(() => resolveOrderErpConfig(sb, 'le-z'), Error);
      if (isOrderErpConfigError(err)) assertEquals(err.field, 'order_erp_token_missing');
    },
  );
});

Deno.test('entidade não encontrada → erro legal_entity', async () => {
  const sb = makeSupabase(null);
  await assertRejects(() => resolveOrderErpConfig(sb, 'inexistente'), Error, 'não encontrada');
});

Deno.test('legal_entity_id nulo → erro legal_entity', async () => {
  const sb = makeSupabase(null);
  await assertRejects(() => resolveOrderErpConfig(sb, null), Error, 'sem entidade jurídica');
});
