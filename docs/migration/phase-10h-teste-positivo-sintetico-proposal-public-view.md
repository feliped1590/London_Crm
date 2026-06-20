# Fase 10H — Teste positivo sintetico da `proposal-public-view`

## 1) Objetivo da fase

Validar o fluxo positivo da funcao `proposal-public-view` usando apenas dados sinteticos no Supabase Staging, sem dados reais e sem integracoes externas.

## 2) Ambiente e project ref

- Projeto staging confirmado: `cansbrrwrprcycjvgvqm`
- URL da funcao: `https://cansbrrwrprcycjvgvqm.supabase.co/functions/v1/proposal-public-view`
- Funcao alvo: `proposal-public-view`

## 3) Pre-checks executados

1. Branch inicial confirmada: `main`.
2. `main` limpa e atualizada: confirmado.
3. Project ref staging esperado: `cansbrrwrprcycjvgvqm` (confirmado).
4. `proposal-public-view` em `ACTIVE` (confirmado em `npx supabase functions list --project-ref cansbrrwrprcycjvgvqm`).
5. Sem alteracoes locais de codigo antes da fase.
6. Inspecao do codigo da funcao realizada para mapear:
   - tabela principal consultada: `public.proposals`,
   - relacoes esperadas: `companies`, `contacts`, `legal_entities`,
   - itens: `proposal_items`,
   - validacao de token e expiracao: `approval_token_expires_at`.

## 4) Inspecao de schema (somente leitura)

Consultas somente leitura executadas contra staging para mapear colunas/tabelas e validar viabilidade do teste positivo.

### Resultado critico

Ao validar diretamente a tabela principal esperada pela funcao:

- `select count(*) as total from public.proposals;`

retornou erro:

- `ERROR: relation "public.proposals" does not exist`

Tambem nao foram encontradas colunas para `proposals`, `proposal_items` e `contacts` nas consultas de `information_schema.columns` realizadas nesta fase.

## 5) Criterio de parada aplicado

Conforme regra da fase:

- **Parar se o schema for complexo ou incerto antes de inserir dados.**

Como a tabela central `public.proposals` nao existe no staging atual consultado, o teste positivo com massa sintetica **nao e viavel** nesta fase sem correcoes estruturais fora do escopo.

## 6) Etapas que NAO foram executadas (por seguranca)

- Nao foi criado plano SQL de insercao com execucao.
- Nao foram inseridos dados sinteticos.
- Nao foi executada chamada `POST` positiva para a funcao.
- Nao foi feita limpeza (pois nenhum dado foi criado).
- Nao houve alteracao de codigo, migrations, config ou secrets.

## 7) IDs/tokens sinteticos

- Nenhum ID sintetico criado.
- Nenhum token sintetico gerado para execucao positiva (fase interrompida antes).

## 8) Riscos remanescentes

1. Inconsistencia entre funcao deployada e schema disponivel no staging atual.
2. Risco de falso positivo operacional se tentar forcar teste sem tabela-base.
3. Necessidade de validar pipeline de migrations/schema do ambiente antes de testes positivos.

## 9) Decisao da fase

- **Fase 10H interrompida com bloqueio tecnico de schema.**
- **Nao aprovada para teste positivo nesta etapa** ate regularizar a existencia das tabelas esperadas (`proposals` e relacionadas) no staging alvo.

## 10) Proximos passos recomendados

1. Abrir subfase de diagnostico de schema do staging (`cansbrrwrprcycjvgvqm`) para reconciliar o estado real do banco com o inventario das fases anteriores.
2. Confirmar em leitura:
   - existencia de `public.proposals`, `public.proposal_items`, `public.contacts`, `public.companies`, `public.legal_entities`;
   - constraints e relacoes necessarias para o select da funcao.
3. Somente apos schema confirmado, reabrir a fase de teste positivo sintetico com massa minima controlada.

