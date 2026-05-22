## Diagnóstico

A cidade **ARAPONGAS/PR** está sim cadastrada (`codigo_erp = 3929`), e **Florianópolis/SC** provavelmente nem foi tentada ainda. O motivo do erro "não mapeada" não é a ausência do registro — é como o sistema procura.

Em `validate-company-sync/index.ts` e `process-company-sync/index.ts` a busca é:

```ts
.from('erp_cities')
.eq('nome', company.city)   // ← match EXATO
.eq('uf', company.state)
```

Como `erp_cities.nome` está em **CAIXA ALTA** (`ARAPONGAS`) e o `companies.city` está como o usuário digitou (`Arapongas`, `arapongas`, `Florianópolis`), o `eq` falha — daí "não mapeada". O mesmo problema acontece com acentos (`Florianópolis` vs `FLORIANOPOLIS`) e espaços extras.

E ao tentar cadastrar manualmente, o índice único `idx_erp_cities_tenant_nome_uf` bloqueia porque já existe (com outra grafia).

## Plano

### 1. Normalização no banco
- Habilitar extensão `unaccent` (se ainda não estiver).
- Criar função `public.normalize_city_name(text)` que faz `lower(unaccent(trim(...)))`.
- Substituir o índice único atual por um **índice único funcional** sobre `(tenant_id, normalize_city_name(nome), upper(uf))` — assim "Arapongas", "ARAPONGAS" e "arapongas " são considerados a mesma cidade e o cadastro duplicado é bloqueado antes de gerar erro feio.
- Criar função `public.lookup_erp_city(p_tenant uuid, p_nome text, p_uf text) returns int` que retorna o `codigo_erp` usando a mesma normalização.

### 2. Edge functions
- `validate-company-sync/index.ts`: trocar o `.from('erp_cities').eq(...)` por `supabase.rpc('lookup_erp_city', { p_tenant, p_nome: company.city, p_uf: company.state })`.
- `process-company-sync/index.ts`: mesma substituição na seção de lookup de cidade (linha ~329).

### 3. UI — `ErpCitiesManager.tsx`
- Ao salvar, padronizar `nome` para Title Case com `trim()` (e `uf` já é uppercased) só para apresentação — a unicidade real fica garantida pelo índice normalizado.
- Mensagem de erro amigável quando o índice único disparar: "Esta cidade já está mapeada (verifique grafias/acentos)" em vez do erro cru do Postgres.

### 4. Validação retroativa (opcional, mesmo PR)
- Rodar um `SELECT` no `companies` cruzando com `erp_cities` via a nova função para listar quantos clientes "destravam" sozinhos depois do fix — só para confirmar o impacto.

## Resultado esperado

- LUSETH (Arapongas/PR) e MERCADO FLORIPA (Florianópolis/SC) passam a casar com os registros existentes em `erp_cities` e seguem para a fila de sync sem precisar de novo cadastro.
- Cadastros manuais com grafias diferentes são bloqueados com mensagem clara em vez do erro de constraint.

## Fora de escopo

- Reescrita do UI da tela de Cidades.
- Importação em massa de cidades do IBGE.
- Mudanças no padrão de armazenamento de `companies.city` (continua como o usuário digitou).
