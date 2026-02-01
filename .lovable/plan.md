
# Plano: Adicionar Filtro de Data de Alteração na Listagem de Correntistas

## Objetivo

Modificar a edge function `iniflex-list-correntistas` para incluir o parâmetro `data_alteracao` no payload enviado ao ERP Iniflex, trazendo apenas clientes alterados a partir de uma data específica.

---

## Alterações Necessárias

### Arquivo: `supabase/functions/iniflex-list-correntistas/index.ts`

#### 1. Atualizar Interface de Request

Adicionar o parâmetro opcional `data_alteracao`:

```typescript
interface ListRequest {
  baseUrl: string;
  token: string;
  page?: number;
  limit?: number;
  search?: string;
  data_alteracao?: string; // Formato: "DD/MM/YYYY"
}
```

#### 2. Modificar Payload do Comando

Atualizar o payload para incluir `data_alteracao` no nível raiz (conforme estrutura fornecida):

**De:**
```typescript
const payload = {
  tipoComando: 'ASDCOMANDO',
  grupoComando: 'EXP_CLIENTES_V1',
  '#out#p_retorno': 'T',
  json: {
    pagina: page,
    limite: limit,
    filtro: search,
  },
};
```

**Para:**
```typescript
// Obter data atual no formato DD/MM/YYYY
const hoje = new Date();
const dataAlteracao = params.data_alteracao || 
  `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;

const payload = {
  tipoComando: 'ASDCOMANDO',
  grupoComando: 'EXP_CLIENTES_V1',
  data_alteracao: dataAlteracao,
  '#out#p_retorno': 'T',
  json: {
    pagina: page,
    limite: limit,
    filtro: search,
  },
};
```

---

## Comportamento

| Cenário | Valor de `data_alteracao` |
|---------|---------------------------|
| Sem parâmetro informado | Data de hoje (ex: "01/02/2026") |
| Com parâmetro informado | Usa o valor recebido |

---

## Estrutura do Payload Final

```json
{
  "tipoComando": "ASDCOMANDO",
  "grupoComando": "EXP_CLIENTES_V1",
  "data_alteracao": "01/02/2026",
  "#out#p_retorno": "T",
  "json": {
    "pagina": 1,
    "limite": 50,
    "filtro": ""
  }
}
```

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/iniflex-list-correntistas/index.ts` | Adicionar parâmetro `data_alteracao` na interface e no payload |

---

## Resultado Esperado

1. **Por padrão**: Retorna apenas clientes alterados a partir de hoje
2. **Opcional**: Permite informar uma data específica para sincronização incremental
3. **Performance**: Reduz significativamente a quantidade de dados retornados
