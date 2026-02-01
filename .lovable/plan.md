
# Plano: Correção da Verificação de Status com IDs Distintos

## Problema Identificado

Existe uma **incompatibilidade de IDs** entre os dois fluxos de importação:

| Tabela | Campo | Valor Exemplo | Fonte do ID |
|--------|-------|---------------|-------------|
| `crm_clients` | `external_id` | `"451"` | `codigo_erp` |
| `companies` | `iniflex_id` | `"5378317000180"` | CNPJ |

A última alteração fez o mapeamento da listagem usar `codigo_erp` como `id`, o que funciona para `crm_clients`, mas quebra a verificação de `companies` (que usa CNPJ).

**Dados atuais:**
- `crm_clients`: 192 registros (sincronização - potencialmente indesejada)
- `companies` com `iniflex_id`: 4 registros (importação manual - **os reais importados**)

---

## Solução

Manter a listagem retornando `codigo_erp` como `id`, e ajustar a verificação de status para considerar ambos os cenários:

1. **Para `crm_clients`**: comparar com `external_id` (codigo_erp)
2. **Para `companies`/`contacts`**: comparar com CNPJ/CPF do correntista

---

## Alterações Necessárias

### 1. InflexTab.tsx - Verificação de Status

**Arquivo**: `src/components/integrations/InflexTab.tsx`

Modificar a função `isImported()` para verificar `companies` e `contacts` usando o **CNPJ/CPF** (não o `id`):

```typescript
// Buscar empresas já importadas com seu CNPJ
const { data: existingCompanies } = useQuery({
  queryKey: ['companies-iniflex-ids'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('companies')
      .select('iniflex_id, cnpj');
    if (error) throw error;
    // Criar Set com ambos: iniflex_id e cnpj (limpos)
    const ids = new Set<string>();
    data.forEach(c => {
      if (c.iniflex_id) ids.add(String(c.iniflex_id));
      if (c.cnpj) ids.add(c.cnpj.replace(/\D/g, ''));
    });
    return ids;
  },
});

// Função isImported atualizada
const isImported = (correntista: Correntista) => {
  // Verificar crm_clients por codigo_erp
  if (syncedClients?.has(correntista.id)) return true;
  
  // Verificar companies/contacts por CNPJ/CPF
  const cleanDoc = correntista.cnpj_cpf?.replace(/\D/g, '') || '';
  const isPJ = correntista.pfpj === 'PJ' || cleanDoc.length > 11;
  
  if (isPJ) {
    return existingCompanies?.has(cleanDoc) || existingCompanies?.has(correntista.id);
  }
  return existingContacts?.has(cleanDoc) || existingContacts?.has(correntista.id);
};
```

### 2. Limpar Dados Errados (Opcional)

Os 192 registros em `crm_clients` foram importados pela sincronização anterior. Se esses não deveriam estar lá, você pode:

**Opção A**: Manter os dados (a sincronização funciona corretamente)

**Opção B**: Limpar a tabela `crm_clients` e re-sincronizar apenas os desejados

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/integrations/InflexTab.tsx` | Atualizar queries para incluir CNPJ/CPF nos Sets e ajustar `isImported()` |

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────┐
│              VERIFICAÇÃO DE STATUS                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Correntista do ERP:                                        │
│    id: "451" (codigo_erp)                                   │
│    cnpj_cpf: "05378317000180"                               │
│                                                             │
│  Verificação:                                               │
│    1. crm_clients.external_id = "451" ?                     │
│       → Sim = Importado (sincronização)                     │
│                                                             │
│    2. companies.iniflex_id = "5378317000180" ?              │
│       ou companies.cnpj = "5378317000180" ?                 │
│       → Sim = Importado (manual)                            │
│                                                             │
│    3. Nenhum → Pendente                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

Após a correção:

1. **4 registros** serão marcados como "Importado" (os que estão em `companies`)
2. Registros sincronizados em `crm_clients` também serão identificados
3. Contadores refletirão a realidade: ~4 importados, ~4368 pendentes
