# Fase 22BU-R2 — Fechamento remoto products + Gate Real ERP 01 (sem escrita)

## 1. Objetivo

Fechar formalmente o marco remoto `products` (22BO-22BS) e abrir o Gate Real ERP 01 para preparar a primeira carga real pequena, controlada e rastreável no `restore-test`, sem executar escrita em banco.

## 2. Escopo

- validação Git pós-push do marco `products`;
- validação read-only do estado consolidado do banco `restore-test`;
- validação do produto piloto pós-push;
- mapeamento documental e técnico de fontes ERP/API Projedata-Iniflex já existentes no repositório;
- definição de candidatos, chaves, limites, bloqueios e política de artifacts para dados reais.

## 3. Restrições absolutas

- sem insert/update/upsert/delete;
- sem SQL de escrita;
- sem migration/seed/cleanup/rollback;
- sem deploy;
- sem commit/push;
- sem alteração de `scripts/migration/phase-22k-r2-baseline-write.mjs`;
- sem execução de sincronização ampla ou rotinas externas com efeito colateral.

## 4. Fechamento remoto do marco products

Pré-check Git:

- branch: `main`;
- working tree: limpa;
- divergência: `0 0`;
- último commit sincronizado: `e05137fb feat(migration): add products pilot write`;
- `HEAD == origin/main`;
- remoto `origin`: `https://github.com/feliped1590/Qualyvac_Migration.git`.

Conclusão: fechamento remoto do bloco `products` confirmado.

## 5. Estado atual do restore-test

Validação read-only de contagens:

- `legal_entities=1`
- `product_types=13`
- `product_groups=22`
- `product_subgroups=54`
- `product_families=7`
- `product_classes=11`
- `companies=5`
- `contacts=5`
- `products=1`
- `sales_reps=0`
- `user_tenants=0`
- `user_legal_entities=0`
- `user_sales_reps=0`
- `deals=0`
- `orders=0`
- `order_items=0`
- `proposals=0`
- `audit_logs=0`
- `notifications=0`

## 6. Produto piloto validado

Cardinalidade por `sku_unique='TMP-SKU-0001-001'`: `1`.

Registro validado:

- `id=01c62ae4-4204-413d-80b5-1054e0dba08d`
- `tenant_id=00000000-0000-0000-0000-000000000001`
- `sku=TMP-SKU-0001`
- `sku_unique=TMP-SKU-0001-001`
- `name=TMP PRODUCT 01`
- `versao_numero=1`
- auxiliares (`tipo_id/grupo_id/subgrupo_id/family_id/class_id`) aderentes;
- `erp_product_code`, `erp_versao` e `legal_entity_id` nulos.

## 7. Objetivo do Gate Real ERP 01

Preparar a primeira carga real controlada com foco cadastral (empresas, contatos e produtos), com teto pequeno, trilha auditável e sem ativar escrita nesta fase.

## 8. Fontes ERP/API disponíveis

Mapeamento por inspeção de código/documentação (sem chamada externa):

- **Clientes**
  - `EXP_CLIENTES_V2` (consulta por CNPJ) em `supabase/functions/_shared/projedata/company-mapper.ts`.
  - `IMP_CLIENTE_V4` (escrita) mapeado, porém fora de escopo da 22BU-R2.
- **Produtos**
  - `EXP_PRODUTOS_V1` (fetch de ERP para staging) em `supabase/functions/erp-import-products-staging/index.ts`.
  - `IMP_ITEM_VERSAO_TESTE` (ou comando configurável) em `supabase/functions/_shared/projedata/product-mapper-v2.ts`.
- **Contatos**
  - `erp-import-contacts` em `supabase/functions/erp-import-contacts/index.ts` com resolução por `cd_empresa` e regras anti-órfão; comando ERP explícito não aparece nesse arquivo.
- **Referência fora de escopo desta carga**
  - pedidos ERP (`IMP_PEDIDO_V3` / `IMP_PEDIDO_ESPECIFICO`) existentes, porém excluídos do Gate Real ERP 01.

## 9. Entidades candidatas

- `companies`: candidata;
- `contacts`: candidata condicional (depende de email/chave válida);
- `products`: candidata;
- `orders`, `proposals`, `deals`: fora do escopo da primeira carga real.

## 10. Campos mínimos por entidade

- **companies**: `tenant_id`, `name`, `cnpj`, `erp_code` (quando existir), `fantasia` (quando existir), vendedor/owner se obrigatório.
- **contacts**: `tenant_id`, `company_id` resolvido, `first_name`, `email`; telefone/cargo/setor opcionais.
- **products**: `tenant_id`, `sku`, `name`, `erp_product_code` (quando existir), `erp_versao` (quando existir), `versao_numero`, classificação (`tipo/grupo/subgrupo/family/class`).

## 11. Chaves de idempotência

- **companies**
  - primária: `(tenant_id, cnpj)`
  - alternativa: `(tenant_id, erp_code)`
- **contacts**
  - primária: `(tenant_id, company_id, email)`
  - sem email: bloqueado até regra alternativa formal
- **products**
  - primária (preferencial com ERP): `(tenant_id, erp_product_code, versao_numero)`
  - alternativa: `sku_unique` (quando previsível e controlado)

## 12. Limites da primeira carga real

Limites definidos:

- `REAL_ERP_01_LIMIT_COMPANIES=10`
- `REAL_ERP_01_LIMIT_CONTACTS=10`
- `REAL_ERP_01_LIMIT_PRODUCTS=10`
- transacionais desabilitados (`orders=0`, `proposals=0`, `deals=0`).

## 13. Critérios de bloqueio

- CNPJ ausente sem fallback ERP confiável;
- nome obrigatório ausente;
- contato sem `company_id` resolvido;
- contato sem email quando email for chave;
- produto sem `sku` e sem código ERP;
- produto sem chave forte de idempotência;
- dependência obrigatória não resolvida;
- colisão divergente;
- qualquer necessidade de escrita em tabela fora do escopo autorizado.

## 14. Política de artifacts com dados reais

Artifacts planejados para próxima fase:

- `real-erp-01-source-sample-YYYYMMDD-HHMMSS.json`
- `real-erp-01-normalized-payload-YYYYMMDD-HHMMSS.json`
- `real-erp-01-collisions-YYYYMMDD-HHMMSS.json`
- `real-erp-01-write-plan-YYYYMMDD-HHMMSS.json`

Política de versionamento:

- não commitar payload real bruto completo;
- mascarar/hashear CNPJ e emails em artifacts versionados;
- restringir conteúdo versionado a resumo, contagens e diagnósticos;
- manter payloads sensíveis completos apenas localmente.

## 15. Riscos restantes

- ausência de amostra real coletada nesta fase para validar qualidade de payload por entidade;
- contatos dependem de qualidade de email para chave primária;
- definição operacional de versionamento sensível deve ser aplicada rigidamente na próxima fase.

## 16. Decisão final GO/PARCIAL/NO-GO

**PARCIAL**.

Motivos:

- fechamento remoto `products` confirmado e estado do restore-test consistente;
- fontes ERP/API mapeáveis identificadas;
- porém ainda sem coleta de amostra real normalizada nesta fase para consolidar prontidão operacional de execução.

## 17. Recomendação da próxima fase

Executar fase dedicada (read-only) para coleta controlada de amostra real ERP (`max 10/10/10`), normalização mascarada, análise de colisões e geração do write-plan real sem execução de escrita.

## 18. Confirmações obrigatórias

- nova escrita em banco: **não**
- SQL de escrita executado: **não**
- migration: **não**
- seed/cleanup: **não**
- rollback: **não**
- ERP/API de escrita executada: **não**
- ERP/API read-only executada: **não**
- filas processadas: **não**
- deploy: **não**
- commit: **não**
- push: **não**
- executor alterado: **não**
- staging/prod alterados: **não**
- executor executou escrita ampliada: **não**
