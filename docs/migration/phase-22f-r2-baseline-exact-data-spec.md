# Fase 22F-R2 — Especificacao dos Dados Exatos da Baseline Minima

## 1. Resumo executivo

Esta fase define os dados exatos (propostos) da baseline cadastral minima para o target correto `crm-qualyvac-restore-test`, mantendo escopo estritamente documental e read-only.

Objetivo desta especificacao:

- detalhar registros minimos por entidade;
- explicitar chaves temporarias e vinculos;
- preparar criterio para liberar apenas a proxima fase de dry-run sem escrita.

Fora de escopo nesta fase:

- qualquer `insert/update/delete`;
- qualquer SQL executavel de carga;
- qualquer alteracao de schema;
- qualquer sync ERP ou chamada externa.

## 2. Target confirmado

- Projeto autorizado: `nsnmlleplpzsefzkuxlb`
- Nome: `crm-qualyvac-restore-test`
- Ambiente proibido: `cansbrrwrprcycjvgvqm` (`crm-qualyvac-staging`) sem autorizacao explicita
- Ambiente invalidado para esta trilha: `nazymjfzjadfgovcfivs` (`Qualyvac_Group_CRM`)

## 3. Principios da baseline

- Baseline minima, controlada e rastreavel.
- Dados sinteticamente identificaveis como baseline de homologacao.
- Chaves temporarias com prefixo `TMP-22F-R2-`.
- Escopo apenas cadastral (sem transacionais).
- Compatibilidade futura com vinculacao ERP (sem executar sync agora).

## 4. Identificador de lote proposto

- `baseline_22f_r2_restore_test_qualyvac_v1`

Uso previsto do identificador:

- rastreabilidade futura de carga/rollback;
- evidencias de pre e pos-check;
- auditoria de quais registros pertencem ao lote de baseline.

## 5. Legal Entity exata

| Campo logico | Valor proposto | Obrigatorio? | Observacao |
|---|---|---:|---|
| `temp_key` | `TMP-22F-R2-LE-001` | Sim | chave tecnica temporaria para mapeamento |
| `tenant_ref` | `TENANT_EXISTENTE_001` | Sim | resolver para `tenants.id` ja existente no restore-test |
| `code` | `LE_QV_RESTORE_001` | Sim | codigo operacional da entidade |
| `name` | `Qualyvac Operacao Brasil LTDA` | Sim | razao social base |
| `trade_name` | `Qualyvac Brasil` | Nao | nome fantasia para uso CRM |
| `document_cnpj` | `12.345.678/0001-90` | Sim | validar DV antes de escrita futura |
| `status` | `active` | Sim | entidade ativa para escopo da baseline |
| `country` | `BR` | Sim | padrao fiscal/localizacao |
| `state` | `SP` | Nao | complementar para cadastro |
| `city` | `Campinas` | Nao | complementar para cadastro |

## 6. Profiles / Usuarios exatos

| Perfil logico | Nome proposto | Email proposto | Papel | Precisa ERP code? | Observacao |
|---|---|---|---|---:|---|
| `TMP-22F-R2-PROF-001` | `Administrador Baseline` | `admin.baseline@qualyvac.local` | `admin` | Nao | perfil de governanca e validacao |
| `TMP-22F-R2-PROF-002` | `Operador Comercial 01` | `operador.comercial01@qualyvac.local` | `sales_ops` | Nao | suporte a empresas/contatos/produtos |
| `TMP-22F-R2-PROF-003` | `Representante Comercial 01` | `rep.comercial01@qualyvac.local` | `sales_rep` | Sim | sugerido `erp_user_code` futuro: `USR-ERP-001` |

## 7. Sales reps exatos

| Vendedor logico | Nome proposto | ERP code | Vincular a qual profile? | Obrigatorio? | Observacao |
|---|---|---|---|---:|---|
| `TMP-22F-R2-SREP-001` | `Vendedor Interno 01` | `SR-ERP-001` | `TMP-22F-R2-PROF-003` | Sim | owner comercial principal |
| `TMP-22F-R2-SREP-002` | `Vendedor Interno 02` | `SR-ERP-002` | `TMP-22F-R2-PROF-002` | Nao | cobertura secundaria para teste de ownership |

## 8. Companies / Clientes exatos

| Cliente logico | Nome proposto | document/cnpj | Owner/Sales rep | Tipo | Status | Observacao |
|---|---|---|---|---|---|---|
| `TMP-22F-R2-COMP-001` | `Cliente Alfa Industria` | `31.111.111/0001-10` | `TMP-22F-R2-SREP-001` | `customer` | `active` | cliente ancora da baseline |
| `TMP-22F-R2-COMP-002` | `Cliente Beta Servicos` | `42.222.222/0001-20` | `TMP-22F-R2-SREP-001` | `customer` | `active` | cliente para validar duplicidade de ownership |
| `TMP-22F-R2-COMP-003` | `Cliente Gama Distribuicao` | `53.333.333/0001-30` | `TMP-22F-R2-SREP-002` | `customer` | `active` | cliente com owner alternativo |
| `TMP-22F-R2-COMP-004` | `Cliente Delta Manutencao` | `64.444.444/0001-40` | `TMP-22F-R2-SREP-001` | `prospect` | `active` | valida tipo diferente sem transacional |
| `TMP-22F-R2-COMP-005` | `Cliente Epsilon Engenharia` | `75.555.555/0001-50` | `TMP-22F-R2-SREP-002` | `customer` | `inactive` | valida status cadastral sem pipeline |

## 9. Contacts / Company contacts exatos

| Contato logico | Nome proposto | Email | Telefone | Empresa vinculada | Obrigatorio? | Observacao |
|---|---|---|---|---|---:|---|
| `TMP-22F-R2-CON-001` | `Ana Souza` | `ana.souza@clientealfa.local` | `+55 19 90000-0001` | `TMP-22F-R2-COMP-001` | Sim | contato principal |
| `TMP-22F-R2-CON-002` | `Bruno Lima` | `bruno.lima@clientebeta.local` | `+55 11 90000-0002` | `TMP-22F-R2-COMP-002` | Sim | contato principal |
| `TMP-22F-R2-CON-003` | `Carla Dias` | `carla.dias@clientegama.local` | `+55 31 90000-0003` | `TMP-22F-R2-COMP-003` | Nao | contato tecnico |
| `TMP-22F-R2-CON-004` | `Diego Rocha` | `diego.rocha@clientedelta.local` | `+55 41 90000-0004` | `TMP-22F-R2-COMP-004` | Nao | contato financeiro |
| `TMP-22F-R2-CON-005` | `Erica Ramos` | `erica.ramos@clienteepsilon.local` | `+55 51 90000-0005` | `TMP-22F-R2-COMP-005` | Nao | contato de homologacao |

## 10. Auxiliares de produto exatos

| Entidade | Nome proposto | Codigo proposto | Obrigatorio? | Produtos dependentes |
|---|---|---|---:|---|
| `product_types` | `Filtro` | `PT-FILTRO` | Sim | `TMP-22F-R2-PROD-001`, `TMP-22F-R2-PROD-002` |
| `product_groups` | `Linha HVAC` | `PG-HVAC` | Sim | `TMP-22F-R2-PROD-001`, `TMP-22F-R2-PROD-003` |
| `product_subgroups` | `Filtracao Industrial` | `PSG-FILT-IND` | Sim | `TMP-22F-R2-PROD-001` |
| `product_families` | `Cartucho` | `PF-CARTUCHO` | Sim | `TMP-22F-R2-PROD-001`, `TMP-22F-R2-PROD-004` |
| `product_classes` | `Classe A` | `PC-A` | Sim | `TMP-22F-R2-PROD-001`, `TMP-22F-R2-PROD-005` |

## 11. Products / Produtos exatos

| Produto logico | SKU proposto | Nome proposto | Classificacao | ERP code | Status | Observacao |
|---|---|---|---|---|---|---|
| `TMP-22F-R2-PROD-001` | `SKU-QV-0001` | `Filtro Cartucho 10in` | `PT-FILTRO > PG-HVAC > PSG-FILT-IND > PF-CARTUCHO > PC-A` | `PRD-ERP-0001` | `active` | produto referencia principal |
| `TMP-22F-R2-PROD-002` | `SKU-QV-0002` | `Elemento Filtrante 20in` | `PT-FILTRO > PG-HVAC > PSG-FILT-IND > PF-CARTUCHO > PC-A` | `` | `active` | sem ERP code permitido para baseline cadastral |
| `TMP-22F-R2-PROD-003` | `SKU-QV-0003` | `Filtro Manga Industrial` | `PT-FILTRO > PG-HVAC > PSG-FILT-IND > PF-CARTUCHO > PC-A` | `PRD-ERP-0003` | `active` | cobertura de classificacao repetivel |
| `TMP-22F-R2-PROD-004` | `SKU-QV-0004` | `Suporte de Cartucho` | `PT-FILTRO > PG-HVAC > PSG-FILT-IND > PF-CARTUCHO > PC-A` | `` | `inactive` | valida status diferente em cadastro |
| `TMP-22F-R2-PROD-005` | `SKU-QV-0005` | `Kit Vedacao Classe A` | `PT-FILTRO > PG-HVAC > PSG-FILT-IND > PF-CARTUCHO > PC-A` | `PRD-ERP-0005` | `active` | item auxiliar de homologacao |

## 12. Vinculos minimos

| Origem | Destino | Regra | Obrigatorio? | Observacao |
|---|---|---|---:|---|
| `TMP-22F-R2-LE-001` | `TENANT_EXISTENTE_001` | `legal_entity.tenant_id` deve apontar para tenant valido | Sim | dependencia raiz da baseline |
| `TMP-22F-R2-PROF-001..003` | `TMP-22F-R2-LE-001` | definir escopo ativo por legal entity | Sim | remove ressalva apontada na 22D-R2 |
| `TMP-22F-R2-PROF-001..003` | `TENANT_EXISTENTE_001` | definir escopo ativo por tenant | Sim | governanca multi-tenant |
| `TMP-22F-R2-SREP-001..002` | `TMP-22F-R2-PROF-002/003` | vendedor deve ter profile responsavel | Sim | via `user_sales_reps` quando exigido |
| `TMP-22F-R2-COMP-001..005` | `TMP-22F-R2-LE-001` | company no mesmo escopo juridico | Sim | evita orfandade |
| `TMP-22F-R2-COMP-001..005` | `TMP-22F-R2-SREP-001/002` | owner/sales_rep valido | Condicional | obrigatorio se schema exigir |
| `TMP-22F-R2-CON-001..005` | `TMP-22F-R2-COMP-001..005` | contato deve estar vinculado a empresa valida | Sim | via `contacts` ou tabela de ligacao vigente |
| `TMP-22F-R2-PROD-001..005` | auxiliares de produto | tipo/grupo/subgrupo/familia/classe validos | Sim | sem classificacao nao entra |

## 13. Campos pendentes de confirmacao

| Pendencia | Impacto | Bloqueia script dry-run? | Bloqueia escrita futura? |
|---|---|---:|---:|
| confirmar coluna oficial de documento em `companies` (`document` vs `cnpj`) | mapeamento de chave de negocio | Nao | Sim |
| confirmar tabela de vinculacao de contato (`contacts` direto vs `company_contacts`) | regra de relacionamento contato-empresa | Nao | Sim |
| confirmar obrigatoriedade de `owner_id` e/ou `sales_rep_id` em `companies` | integridade comercial | Nao | Sim |
| confirmar conjunto minimo de colunas obrigatorias em `sales_reps` | viabilidade de criacao de vendedor | Nao | Sim |
| validar formato definitivo de status (enum/texto) para entidades cadastrais | compatibilidade com schema real | Nao | Sim |
| validar DVs de CNPJ/documentos propostos | consistencia fiscal | Nao | Sim |
| confirmar se `erp_user_code` e obrigatorio para todos perfis ou apenas perfis ERP | estrategia de integracao futura | Nao | Nao |

## 14. Entidades explicitamente fora do escopo

- `deals`
- `deal_stage_history`
- `proposals` / `proposal_items`
- `orders` / `order_items`
- `product_sync_queue` / `order_sync_queue`
- qualquer rotina de sync ERP
- historico, anexos e logs operacionais

## 15. Validacoes futuras antes de qualquer escrita

- Reconfirmar target: `nsnmlleplpzsefzkuxlb`.
- Conferir se `main` esta limpa e alinhada com `origin/main`.
- Executar pre-check de schema para campos obrigatorios reais.
- Validar que todos os vinculos desta especificacao apontam para registros existentes ou planejados no mesmo lote.
- Validar unicidade de email, sku, document/cnpj e codigos ERP propostos.
- Validar ausencia de transacionais no pacote de baseline.
- Garantir queues de sync zeradas/controladas e sem workers ativos para baseline.
- Registrar evidencia de antes/depois e plano de rollback por `baseline_batch_id`.

## 16. Criterio para liberar a proxima fase

Liberar proxima fase (`22F-R2 dry-run tecnico, sem escrita`) somente se:

- todas as pendencias bloqueadoras da secao 13 estiverem resolvidas ou explicitamente aceitas como nao bloqueantes para dry-run;
- mapeamento de campos obrigatorios estiver fechado por entidade;
- ordem de dependencia estiver fechada (`legal_entity -> profiles -> sales_reps -> products -> companies -> contacts`);
- identificador de lote estiver aprovado (`baseline_22f_r2_restore_test_qualyvac_v1`);
- permanecer proibido qualquer SQL de escrita, qualquer carga real e qualquer sync ERP.

Decisao esperada para liberar dry-run:

- **GO**: checklist acima completo.
- **PARCIAL**: dry-run limitado apenas a validacao estrutural sem validar todos os campos de negocio.
- **NO-GO**: pendencias de schema/vinculos impedem montar dry-run confiavel.
