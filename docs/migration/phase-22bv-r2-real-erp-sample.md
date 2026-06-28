# Fase 22BV-R2 — Coleta read-only da amostra Real ERP 01 + normalização mascarada (sem escrita)

## 1. Objetivo

Executar coleta real read-only para o Gate Real ERP 01, normalizar em formato CRM, mascarar artefatos versionáveis e gerar write-plan sem execução.

## 2. Escopo

- pre-check Git e leitura de evidências obrigatórias;
- validação read-only do estado do restore-test;
- tentativa de coleta read-only de fontes ERP/API mapeadas;
- geração de artifacts mascarados de amostra, colisões e write-plan;
- sem escrita em banco e sem execução de write-plan.

## 3. Restrições absolutas

- sem insert/update/upsert/delete;
- sem SQL/RPC de escrita;
- sem migration/seed/cleanup/rollback;
- sem deploy;
- sem commit/push;
- sem alteração do executor.

## 4. Estado inicial Git

- branch: `main`;
- `HEAD`: `e05137fbf3f02f58dc4e7f63ee4527bf418990ee`;
- `origin/main`: `e05137fbf3f02f58dc4e7f63ee4527bf418990ee`;
- divergência: `0 0`;
- pendências esperadas: somente arquivos 22BU não commitados.

## 5. Estado inicial restore-test

Contagens read-only confirmadas:

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

## 6. Fontes ERP/API consultadas

Fontes avaliadas (somente leitura):

- tabelas de suporte no restore-test:
  - `erp_clients_cache`
  - `erp_products_staging`
  - `contact_erp_data`
  - `product_erp_data`
  - `tenant_settings`
- mapeamento de comandos (inspeção de código):
  - `EXP_CLIENTES_V2` (clientes)
  - `EXP_PRODUTOS_V1` (produtos)

Resultado:

- `tenant_settings` sem configuração `erp_integration`;
- caches/staging ERP com `0` linhas;
- sem fonte read-only ativa para coletar amostra real nesta fase.

## 7. Limites aplicados

Limites solicitados:

- `companies=10`
- `contacts=10`
- `products=10`

Limites efetivos aplicados:

- `companies=0`
- `contacts=0`
- `products=0`

## 8. Política de mascaramento

Política aplicada:

- nenhum payload real bruto versionado;
- artifacts versionáveis somente com metadados, contagens e status;
- sem CNPJ/email/telefone em claro em arquivo versionado.

## 9. Amostra real coletada

- empresas: `0`
- contatos: `0`
- produtos: `0`

Motivo: ausência de fonte read-only segura e configurada no contexto atual.

## 10. Normalização

Normalização executada de forma estrutural (sem registros):

- schema alvo de normalização preservado para `companies`, `contacts`, `products`;
- nenhum registro normalizado por falta de amostra real.

## 11. Colisões

Checagem de colisão executada com conjunto normalizado vazio:

- `companies`: `0` colisões;
- `contacts`: `0` colisões;
- `products`: `0` colisões.

Bloqueio principal mantido: `blocked_no_explicit_read_source`.

## 12. Write-plan real sem execução

Write-plan mascarado gerado e **não executado**:

- registros `ready_to_write`: `0`
- limites recomendados para próxima fase: `companies=0`, `contacts=0`, `products=0`
- ordem futura mantida (quando destravar): `companies -> contacts -> products`.

## 13. Registros prontos

- `ready_to_write = 0`.

## 14. Registros bloqueados

- `companies`: `blocked_no_explicit_read_source`
- `contacts`: `blocked_no_explicit_read_source`
- `products`: `blocked_no_explicit_read_source`

## 15. Autorização futura

Não documentada nesta fase, pois não há registros reais prontos para escrita.

## 16. Riscos restantes

- ausência de fonte read-only configurada impede validação de qualidade dos dados reais;
- sem amostra real não há como liberar primeira escrita real com segurança;
- contatos continuam sem fonte explícita de leitura confirmada no gate atual.

## 17. Decisão final GO/PARCIAL/NO-GO

**NO-GO**

Motivo: inexistência de fonte ERP/API read-only segura e disponível para coleta real nesta fase.

## 18. Recomendação da próxima fase

Abrir fase dedicada para habilitar/confirmar fonte read-only segura (sem escrita) e repetir a 22BV com coleta real efetiva antes de qualquer autorização de escrita real.

## 19. Confirmações obrigatórias

- nova escrita em banco: **não**
- SQL de escrita executado: **não**
- ERP/API de escrita executada: **não**
- ERP/API read-only executada: **não**
- payload real bruto commitado: **não**
- migration: **não**
- seed/cleanup: **não**
- rollback: **não**
- filas processadas: **não**
- deploy: **não**
- commit: **não**
- push: **não**
- executor alterado: **não**
- staging/prod alterados: **não**
- executor executou escrita ampliada: **não**
