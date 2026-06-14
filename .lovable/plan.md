# Plano Mínimo — Endpoint/Token de Pedido por Entidade Jurídica

> **Escopo cirúrgico**: apenas `process-order-sync`. Clientes, produtos, atributos, importações e demais integrações **não são tocados**.

---

## 1. Modelo de dados (1 migration enxuta)

Adicionar 3 colunas em `public.legal_entities` (nomes prefixados `order_` para deixar claro que valem **só para pedido** — abre espaço futuro para outros prefixos sem ambiguidade):

| Coluna | Tipo | Default | Função |
|---|---|---|---|
| `order_erp_endpoint` | `text` | `NULL` | URL POST do Iniflex para pedidos desta entidade. `NULL` = usa env `PROJEDATA_API_URL` (fallback Novafix). |
| `order_erp_token_secret_name` | `text` | `NULL` | **Nome** do secret Supabase que contém o Bearer. `NULL` = usa env `PROJEDATA_API_TOKEN`. Nunca armazenamos o token cru. |
| `order_erp_enabled` | `boolean` | `true` | Kill-switch por entidade (auditoria/manutenção). `false` bloqueia sync com mensagem clara. |

`erp_company_code` (já existente) continua sendo a fonte do campo `empresa` do payload — **reaproveitado, não duplicado**.

Nenhuma RLS/grant nova: a tabela já é gerenciada hoje.

---

## 2. Resolver de configuração (novo helper compartilhado)

`supabase/functions/_shared/erp/order-endpoint-resolver.ts`:

```ts
resolveOrderErpConfig(supabase, legalEntityId) → {
  endpoint: string;
  token: string;
  empresa: number;
  source: 'legal_entity' | 'env_fallback';
  legalEntityName: string;
  tokenSecretName: string | null;
}
```

Regras (na ordem):
1. Carrega `legal_entities` pelo id. Erro fatal se inexistente.
2. Se `order_erp_enabled === false` → lança erro de validação `order_erp_disabled`.
3. `empresa = Number(erp_company_code)` — **obrigatório**. NaN/vazio → erro `erp_company_code`.
4. `endpoint = order_erp_endpoint ?? Deno.env.get('PROJEDATA_API_URL')`. Vazio → erro `order_erp_endpoint`.
5. `token`:
   - Se `order_erp_token_secret_name` definido → `Deno.env.get(order_erp_token_secret_name)`. Se vazio → erro `order_erp_token_missing` (secret não cadastrado).
   - Caso contrário → `Deno.env.get('PROJEDATA_API_TOKEN')` (fallback Novafix).
6. `source = 'legal_entity'` se qualquer override usado; `'env_fallback'` se 100% env.

**Não muda** nenhum outro processo nem o env padrão.

---

## 3. Integrar no fluxo de pedidos

### 3.1 `process-order-sync/index.ts`
- Remover leitura global de `apiUrl`/`apiToken` no topo do handler.
- Dentro do loop, **após** carregar `ctx` (que já traz `legalEntity`), chamar `resolveOrderErpConfig(supabase, queueItem.legal_entity_id ?? order.legal_entity_id)`.
- Usar `cfg.endpoint` e `cfg.token` no `fetch` (linha 316).
- O `erp_empresa` injetado no `CRMOrderForSync` passa a vir de `cfg.empresa` (em vez de `Number(legalEntity.erp_company_code)` direto — mantém uma única fonte de verdade).

### 3.2 `validate-order-sync/index.ts` + `_shared/projedata/order-validator.ts`
- Adicionar 3 novos erros estruturados (com `fixHint` + `fixRoute=/settings?tab=legal-entities`):
  - `order_erp_endpoint` — "Entidade jurídica sem endpoint ERP para pedidos."
  - `order_erp_token_missing` — "Secret do token ERP para pedidos não cadastrado: `<nome>`."
  - `order_erp_disabled` — "Integração de pedidos desativada para esta entidade jurídica."
- A validação consulta `legal_entities` (já no loader) — para o secret, só consegue checar existência do nome (presença de env var) dentro da Edge Function; UI pré-validação reporta apenas se o **nome** está cadastrado.
- Mantém o comportamento atual de bloqueio (`status='blocked_validation'`, sem consumir retries).

### 3.3 Log enriquecido
- Em `order_sync_log` (já existente, 10 colunas): adicionar metadados via campo livre se já houver, ou anexar ao `error_message` num formato consistente. Plano default: adicionar uma coluna `endpoint_used text` + `empresa_used integer` + `legal_entity_id uuid` nesta mesma migration. Custo zero, audit completo.
- `console.log` ganha prefixo `[legal_entity=<name> | endpoint=<host> | empresa=<n>]` para rastreio em produção.

### 3.4 `pedido_terceiro`
- Hoje há tabela `quick_quote_sequences`/`erp_sequences` global por tenant. **Risco**: dois endpoints diferentes recebendo o mesmo `pedido_terceiro` é OK (são bases independentes). **Não alterar**.

---

## 4. Cadastro inicial (após migration aprovada)

Via `supabase--insert`:
- Novafix → `order_erp_endpoint=NULL, order_erp_token_secret_name=NULL, order_erp_enabled=true` (continua no fallback env, **zero risco de regressão**).
- Martina → `order_erp_endpoint='https://iniflex.martinapack.com.br/...'`, `order_erp_token_secret_name='PROJEDATA_TOKEN_MARTINAPACK'`, `erp_company_code='1'`.
- Qualyvac Eireli → mesmo endpoint, mesmo secret, `erp_company_code='2'`.
- Embazec → mesmo endpoint, mesmo secret, `erp_company_code=<a definir com você>`.

E pedir via `secrets--add_secret` o `PROJEDATA_TOKEN_MARTINAPACK` (1 único secret cobre as 3 entidades).

---

## 5. UI mínima em `LegalEntityPermissionsManager`

Adicionar 3 campos no diálogo de edição (não no de criação rápida, opcional) — agrupados em seção "Integração de Pedidos (ERP)":
- Input "Endpoint do ERP (pedidos)" — opcional.
- Input "Nome do secret do token" — opcional, com helper `"Cadastre o valor em Configurações → Secrets"`.
- Switch "Integração de pedidos ativa".

Tabela ganha badge sutil: `Endpoint próprio` / `Padrão (Novafix)` / `Desativada`.

Nenhuma outra tela é afetada.

---

## 6. Testes (Deno `*_test.ts` + manuais)

Automatizados em `_shared/erp/order-endpoint-resolver_test.ts`:
1. ✅ Entidade sem overrides → retorna env vars + `source='env_fallback'`.
2. ✅ Entidade com endpoint+secret válidos + env `PROJEDATA_TOKEN_MARTINAPACK` setado → retorna config própria + `source='legal_entity'`.
3. ✅ Entidade com `order_erp_enabled=false` → erro `order_erp_disabled`.
4. ✅ Entidade com `erp_company_code` vazio → erro `erp_company_code`.
5. ✅ Entidade com `order_erp_token_secret_name` apontando para secret inexistente → erro `order_erp_token_missing`.

Manuais (em ambiente real, você dispara):
6. Pedido Novafix → endpoint atual, `empresa=1` (regressão).
7. Pedido Martina → endpoint Martinapack, `empresa=1`.
8. Pedido Qualyvac → endpoint Martinapack, `empresa=2`.
9. Pedido em entidade sem config → `blocked_validation` com mensagem clara no modal.
10. `process-company-sync` / `process-product-sync` / `process-attribute-sync` → checar logs, nada mudou.

---

## 7. Ordem de execução (sem quebrar Novafix)

```
1. Migration            (3 colunas + 3 colunas em order_sync_log)
2. Helper + testes      (deploy não rompe nada — código novo isolado)
3. Refactor process-order-sync para usar o helper
4. Refactor validator + UI de modal de pendências
5. UI: novos campos em LegalEntityPermissionsManager
6. Cadastrar secret PROJEDATA_TOKEN_MARTINAPACK
7. UPDATE em legal_entities (Martina/Qualyvac/Embazec)
8. Smoke test: 1 pedido Novafix + 1 Martina + 1 Qualyvac
```

A Novafix passa pelos passos 1-5 **sem nenhuma mudança de comportamento** (overrides ficam `NULL` → cai no env fallback original). Só os passos 6-8 ativam novas entidades.

---

## 8. O que NÃO será alterado (confirmação)

- `process-company-sync` — intacto.
- `process-product-sync` — intacto.
- `process-attribute-sync` — intacto.
- `tenant_settings.erp_integration` — intacto (continua deprecated implícito).
- Env vars `PROJEDATA_API_URL`/`PROJEDATA_API_TOKEN` — intactas, continuam servindo Novafix.
- Schemas de `companies`, `products`, `orders` (exceto adições em `order_sync_log`) — intactos.
- Regras comerciais, RLS, ownership, ficha técnica — intactos.

---

## 9. Riscos residuais

| Risco | Mitigação |
|---|---|
| Secret `PROJEDATA_TOKEN_MARTINAPACK` digitado errado | Resolver retorna erro `order_erp_token_missing` antes do POST, sem vazar nada no log. |
| Usuário muda endpoint pela UI por engano | Audit log futuro (fora deste escopo); por ora, restringir UI dos novos campos a `admin`/`dev` (já é o padrão da tela). |
| Pedido criado antes do cadastro de Martina/Qualyvac fica órfão | Validator já bloqueia com `fixRoute` apontando para a tela correta. |
| Pedido Novafix legado tem `legal_entity_id=NULL` | Resolver lança erro claro (entidade não encontrada). Caso surja, corrigir o dado pontualmente — mesmo comportamento atual do validator. |

---

Pronto para confirmar e executar os passos 1→8 nessa ordem.
