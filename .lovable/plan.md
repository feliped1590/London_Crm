
# Plano: Corrigir "Cliente não encontrado" para Clientes ERP

## Contexto do Problema

A listagem de clientes unifica dados de duas tabelas:
- **companies** → clientes criados manualmente no CRM
- **crm_clients** → clientes sincronizados do ERP Iniflex

Quando você clica em um cliente do ERP, a página de detalhes busca apenas na tabela `companies`, que não encontra o registro.

## Solução Proposta

Modificar a página `CustomerDetail.tsx` para:
1. Tentar buscar primeiro na tabela `companies`
2. Se não encontrar, buscar na tabela `crm_clients`
3. Exibir os dados do cliente ERP de forma adequada

---

## Alterações Técnicas

### Arquivo: `src/pages/CustomerDetail.tsx`

**1. Modificar a query principal para suportar duas fontes**

Implementar lógica de fallback:
```
1º - Buscar em companies
2º - Se não encontrar, buscar em crm_clients + crm_client_addresses
```

**2. Transformar dados do ERP para o formato esperado**

Mapear campos do ERP → formato do CRM:
- `razao_social` → `name`
- `nome_fantasia` → `fantasia`
- `cnpj_cpf` → `cnpj`
- `telefone` / `celular` → `phone`
- `emails[0]` → `email`
- `insc_estadual` → `inscricao_estadual`
- Endereço LOCAL → `address`, `city`, `state`

**3. Adicionar indicador visual de origem**

- Badge "ERP" para clientes sincronizados
- Badge "CRM" para clientes manuais

**4. Modo somente leitura para clientes ERP**

- Desabilitar edição para registros do ERP (dados são gerenciados pelo sistema de origem)
- Mostrar botão "Importar para CRM" se quisermos permitir edição futura

**5. Tratar tabs que dependem de dados CRM**

Para clientes ERP:
- **Contatos**: Mostrar mensagem "Contatos não disponíveis para clientes do ERP"
- **Negócios**: Permitir criar negócios vinculados
- **Timeline/Notas**: Funcionalidade futura (requer adaptação)

---

## Fluxo de Dados

```text
┌─────────────────────────────────────────────────────────────┐
│                      CustomerDetail                         │
├─────────────────────────────────────────────────────────────┤
│  1. Buscar em companies WHERE id = :id                      │
│     ├─ Encontrou? → Exibir dados normalmente                │
│     └─ Não encontrou? → Continua...                         │
│                                                             │
│  2. Buscar em crm_clients WHERE id = :id                    │
│     + JOIN crm_client_addresses                             │
│     ├─ Encontrou? → Transformar e exibir (modo leitura)     │
│     └─ Não encontrou? → "Cliente não encontrado"            │
└─────────────────────────────────────────────────────────────┘
```

---

## Campos Exibidos para Cliente ERP

| Campo | Origem ERP |
|-------|------------|
| Razão Social | `razao_social` |
| Nome Fantasia | `nome_fantasia` |
| CNPJ/CPF | `cnpj_cpf` |
| Inscrição Estadual | `insc_estadual` |
| Telefone | `telefone` ou `celular` |
| Email | `emails[0]` |
| Endereço | `crm_client_addresses` (tipo LOCAL) |
| Região | `regiao` |
| Segmento | `segmento` |
| Tipo Pessoa | `tipo_pessoa` (PJ/PF) |

---

## Comportamento das Tabs

| Tab | Cliente CRM | Cliente ERP |
|-----|-------------|-------------|
| **Dados** | Editável | Somente leitura com badge "Dados do ERP" |
| **Contatos** | Lista de contatos | Mensagem informativa |
| **Negócios** | Lista de deals | Permitir criar deals (futuro) |
| **Timeline** | Histórico de atividades | Não disponível |
| **Notas** | Notas do cliente | Não disponível |

---

## Benefícios

1. **Elimina o erro** - Todos os clientes listados terão página de detalhes funcional
2. **Clareza visual** - Badges indicam origem do dado (ERP vs CRM)
3. **Integridade** - Dados do ERP permanecem somente leitura (gerenciados na origem)
4. **Experiência unificada** - Mesma interface para ambos os tipos de cliente

---

## Arquivos Modificados

1. `src/pages/CustomerDetail.tsx` - Lógica de busca dual + transformação de dados

---

## Estimativa

- **Complexidade**: Média
- **Tempo estimado**: 1 sessão de desenvolvimento
- **Risco**: Baixo (não altera dados existentes)
