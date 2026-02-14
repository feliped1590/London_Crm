
# Fase 3 -- ETL Inicial (Importacao ERP para CRM)

## Resumo

Criar a Edge Function `erp-import-companies` que recebe um array de registros do ERP (CIGAM/Iniflex), normaliza os dados, e faz merge inteligente no CRM usando a regra composta `(tenant_id, cnpj)` com fallback `(tenant_id, erp_code)`. Processamento em batches de 100, com registro de conflitos na tabela `import_conflict_log`.

## O que sera feito

### 1. Edge Function `erp-import-companies`

Uma nova funcao backend que recebe dados do ERP e importa para o CRM. Fluxo:

1. Recebe array de registros ERP via POST
2. Processa em batches de 100 registros
3. Para cada registro:
   - Normaliza CNPJ (remove pontuacao, valida 14 digitos)
   - Normaliza CEP (remove pontuacao, valida 8 digitos)
   - Normaliza datas (converte formatos ERP para ISO)
   - Normaliza booleanos (S/N, SIM/NAO, 1/0 para true/false)
   - Normaliza tipo_pessoa (PF/PJ)
4. Faz merge composto:
   - Busca por `(tenant_id, cnpj)` -- prioridade
   - Se nao encontrou, busca por `(tenant_id, erp_code)` -- fallback
   - Se encontrou: UPDATE (com deteccao de conflitos)
   - Se nao encontrou: INSERT
5. Popula `company_erp_fiscal` e `company_erp_financial` quando dados disponiveis
6. Registra conflitos na `import_conflict_log`
7. Retorna sumario: total, inseridos, atualizados, erros, conflitos

### 2. Normalizacoes implementadas

| Campo | Regra |
|-------|-------|
| CNPJ | Remove `./- `, valida 14 digitos |
| CEP | Remove `- `, valida 8 digitos |
| Datas | Aceita `DD/MM/YYYY`, `YYYY-MM-DD`, timestamp ERP |
| Booleanos | `S/SIM/1/TRUE` = true, demais = false |
| Tipo pessoa | Normaliza para `PF` ou `PJ` |
| Textos | Trim, null se vazio |

### 3. Deteccao de conflitos

Quando um registro ja existe no CRM e os dados divergem do ERP, os campos conflitantes sao registrados na tabela `import_conflict_log` com:
- `crm_value`: valor atual no CRM
- `erp_value`: valor vindo do ERP
- `resolution`: pendente (para revisao manual) ou auto-resolvida (campos vazios no CRM)

Regra de auto-resolucao: se o campo no CRM esta vazio/null e o ERP tem valor, atualiza automaticamente e marca como `auto_resolved = true`.

### 4. Resposta da funcao

```text
{
  "success": true,
  "summary": {
    "total_received": 500,
    "total_processed": 500,
    "inserted": 320,
    "updated": 175,
    "skipped": 5,
    "conflicts_detected": 42,
    "conflicts_auto_resolved": 30,
    "errors": []
  }
}
```

---

## Secao Tecnica

### Arquivos criados/modificados

| Arquivo | Acao |
|---------|------|
| `supabase/functions/erp-import-companies/index.ts` | Criar -- Edge Function principal |
| `supabase/config.toml` | Adicionar `[functions.erp-import-companies]` com `verify_jwt = false` |

### Estrutura do payload de entrada

```text
POST /erp-import-companies
{
  "tenant_id": "uuid",
  "records": [
    {
      "erp_code": "12345",
      "cnpj_cpf": "12.345.678/0001-90",
      "tipo_pessoa": "PJ",
      "nome": "Empresa X Ltda",
      "fantasia": "Empresa X",
      "email": "contato@x.com",
      "fone": "(11) 1234-5678",
      "endereco": "Rua ABC",
      "numero": "123",
      "complemento": "Sala 4",
      "bairro": "Centro",
      "cidade": "Sao Paulo",
      "uf": "SP",
      "cep": "01234-567",
      "inscricao_estadual": "123456789",
      "inscricao_municipal": "987654",
      "data_cadastro": "15/03/2020",
      "data_ultima_atualizacao": "10/01/2025",
      "regime_tributario": "LUCRO_REAL",
      "contribuinte_icms": "S",
      "limite_credito": 50000.00,
      "condicao_pagamento": "30/60/90",
      "observacoes": "Cliente desde 2020"
    }
  ]
}
```

### Logica de merge (pseudocodigo)

```text
Para cada registro:
  1. normalizar(registro)
  2. existing = buscar por (tenant_id, cnpj) 
     || buscar por (tenant_id, erp_code)
  3. Se existing:
     - detectar_conflitos(existing, registro)
     - aplicar auto-resolucao (campos CRM vazios)
     - UPDATE companies + upsert fiscal/financial
     - resultado = "updated"
  4. Se nao existing:
     - INSERT companies + insert fiscal/financial
     - resultado = "inserted"
```

### Batch processing

- Registros sao processados em grupos de 100
- Cada batch usa transacao implicita (upserts individuais)
- Erros em um registro nao interrompem o batch
- Todos os erros sao coletados e retornados no sumario

### Seguranca

- Funcao usa `SUPABASE_SERVICE_ROLE_KEY` para bypass de RLS (importacao administrativa)
- `verify_jwt = false` no config.toml (chamada interna/administrativa)
- Valida `tenant_id` obrigatorio no payload
- Nao aceita SQL arbitrario -- apenas operacoes tipadas via SDK
