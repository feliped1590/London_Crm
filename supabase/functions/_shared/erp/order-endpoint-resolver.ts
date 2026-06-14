/**
 * Resolver de configuração ERP **somente para pedidos**.
 *
 * Lê os campos `order_erp_endpoint`, `order_erp_token_secret_name`, `order_erp_enabled`
 * e `erp_company_code` da entidade jurídica vinculada ao pedido e devolve o trio
 * (endpoint, token, empresa) usado para POSTar o IMP_PEDIDO_V3 no ERP.
 *
 * Quando `order_erp_endpoint` e `order_erp_token_secret_name` estão nulos, o
 * resolver cai no fallback global (PROJEDATA_API_URL / PROJEDATA_API_TOKEN) — é o
 * caminho histórico da Novafix e garante zero regressão.
 *
 * Este resolver **não** é usado por clientes, produtos, atributos ou qualquer
 * outra integração — escopo cirúrgico para o fluxo de pedidos.
 */

export interface OrderErpConfigError extends Error {
  field: 'legal_entity' | 'order_erp_disabled' | 'erp_company_code' | 'order_erp_endpoint' | 'order_erp_token_missing';
  fixHint?: string;
  fixRoute?: string;
}

export interface ResolvedOrderErpConfig {
  endpoint: string;
  token: string;
  empresa: number;
  source: 'legal_entity' | 'env_fallback' | 'mixed';
  legalEntityId: string;
  legalEntityName: string;
  tokenSecretName: string | null;
}

function makeError(
  field: OrderErpConfigError['field'],
  message: string,
  fixHint?: string,
  fixRoute?: string,
): OrderErpConfigError {
  const err = new Error(message) as OrderErpConfigError;
  err.field = field;
  err.fixHint = fixHint;
  err.fixRoute = fixRoute;
  return err;
}

export async function resolveOrderErpConfig(
  supabase: any,
  legalEntityId: string | null | undefined,
): Promise<ResolvedOrderErpConfig> {
  if (!legalEntityId) {
    throw makeError(
      'legal_entity',
      'Pedido sem entidade jurídica vinculada.',
      'Defina a entidade jurídica (CNPJ emissor) do pedido antes de sincronizar.',
    );
  }

  const { data: entity, error } = await supabase
    .from('legal_entities')
    .select('id, name, erp_company_code, order_erp_endpoint, order_erp_token_secret_name, order_erp_enabled')
    .eq('id', legalEntityId)
    .maybeSingle();

  if (error) {
    throw makeError('legal_entity', `Erro ao carregar entidade jurídica: ${error.message}`);
  }
  if (!entity) {
    throw makeError('legal_entity', `Entidade jurídica não encontrada: ${legalEntityId}`);
  }

  if (entity.order_erp_enabled === false) {
    throw makeError(
      'order_erp_disabled',
      `Integração de pedidos desativada para a entidade jurídica "${entity.name}".`,
      'Ative a integração de pedidos na configuração da entidade jurídica.',
      '/settings?tab=legal-entities',
    );
  }

  const empresa = Number(entity.erp_company_code);
  if (!entity.erp_company_code || !Number.isFinite(empresa) || empresa <= 0) {
    throw makeError(
      'erp_company_code',
      `Entidade jurídica "${entity.name}" sem código ERP da empresa configurado.`,
      'Preencha o "Código ERP" da entidade jurídica.',
      '/settings?tab=legal-entities',
    );
  }

  const overrideEndpoint = (entity.order_erp_endpoint ?? '').trim();
  const overrideSecretName = (entity.order_erp_token_secret_name ?? '').trim();

  const fallbackEndpoint = Deno.env.get('PROJEDATA_API_URL') ?? '';
  const fallbackToken = Deno.env.get('PROJEDATA_API_TOKEN') ?? '';

  const endpoint = overrideEndpoint || fallbackEndpoint;
  if (!endpoint) {
    throw makeError(
      'order_erp_endpoint',
      `Entidade jurídica "${entity.name}" sem endpoint ERP de pedidos configurado e sem fallback global (PROJEDATA_API_URL).`,
      'Configure o endpoint ERP de pedidos na entidade jurídica.',
      '/settings?tab=legal-entities',
    );
  }

  let token: string;
  let tokenSecretName: string | null = null;
  if (overrideSecretName) {
    tokenSecretName = overrideSecretName;
    const t = Deno.env.get(overrideSecretName) ?? '';
    if (!t) {
      throw makeError(
        'order_erp_token_missing',
        `Secret "${overrideSecretName}" não cadastrado para a entidade jurídica "${entity.name}".`,
        `Cadastre o token em Configurações → Secrets com o nome "${overrideSecretName}".`,
        '/settings?tab=legal-entities',
      );
    }
    token = t;
  } else {
    if (!fallbackToken) {
      throw makeError(
        'order_erp_token_missing',
        `Sem token ERP de pedidos: nem a entidade jurídica "${entity.name}" tem secret próprio nem há fallback global (PROJEDATA_API_TOKEN).`,
        'Cadastre o secret PROJEDATA_API_TOKEN ou defina um secret específico na entidade jurídica.',
        '/settings?tab=legal-entities',
      );
    }
    token = fallbackToken;
  }

  const usedOverrideEndpoint = !!overrideEndpoint;
  const usedOverrideToken = !!overrideSecretName;
  let source: ResolvedOrderErpConfig['source'];
  if (usedOverrideEndpoint && usedOverrideToken) source = 'legal_entity';
  else if (!usedOverrideEndpoint && !usedOverrideToken) source = 'env_fallback';
  else source = 'mixed';

  return {
    endpoint,
    token,
    empresa,
    source,
    legalEntityId: entity.id,
    legalEntityName: entity.name,
    tokenSecretName,
  };
}

export function isOrderErpConfigError(err: unknown): err is OrderErpConfigError {
  return !!err && typeof err === 'object' && 'field' in err && err instanceof Error;
}
