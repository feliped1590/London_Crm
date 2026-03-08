

# Diagnóstico Técnico — Layout de Proposta e Pedido de Venda

## 1. Arquivos Envolvidos

| Função | Arquivo |
|--------|---------|
| PDF Proposta | `supabase/functions/generate-proposal-pdf/index.ts` |
| PDF Pedido | `supabase/functions/generate-order-pdf/index.ts` |
| Dialog Proposta (CRUD) | `src/components/proposals/ProposalDialog.tsx` |
| Dialog Pedido (CRUD) | `src/components/orders/OrderDialog.tsx` |
| Lista de Propostas | `src/components/proposals/ProposalsList.tsx` |
| Página de Pedidos | `src/pages/Orders.tsx` |
| Aprovação Pública | `src/pages/ProposalPublic.tsx` |
| Aprovação Backend | `supabase/functions/proposal-approve/index.ts` |
| Visualização Pública | `supabase/functions/proposal-public-view/index.ts` |

## 2. Método de Geração de PDF

Ambos usam **HTML inline gerado no backend** (Edge Function). O HTML é retornado como JSON (`{ html: "..." }`), aberto numa nova aba no navegador, e o usuário usa **Ctrl+P → Salvar como PDF**. Não há biblioteca de PDF (como jsPDF, Puppeteer, etc.) — é puramente **HTML → Print do navegador**.

## 3. Estrutura do Layout — PROPOSTA (`generate-proposal-pdf`)

```text
┌─────────────────────────────────────────────────┐
│ CABEÇALHO                                       │
│  [Logo da legal_entity]    [Número da proposta]  │
│  [CNPJ da legal_entity]   [Data de criação]     │
│                            [Válida até: data]    │
│                            [Badge IPI mode]      │
├─────────────────────────────────────────────────┤
│ DADOS DO CLIENTE                                │
│  ┌──────────────┐  ┌──────────────┐             │
│  │ Empresa      │  │ Contato      │             │
│  │ Nome         │  │ Nome         │             │
│  │ CNPJ         │  │ Email        │             │
│  │ Endereço     │  │ Telefone     │             │
│  │ Cidade-UF    │  │              │             │
│  └──────────────┘  └──────────────┘             │
│  ┌──────────────────────────────┐               │
│  │ Vendedor Responsável (Rep)  │               │
│  │ Nome / Email / Telefone     │               │
│  └──────────────────────────────┘               │
├─────────────────────────────────────────────────┤
│ ITENS DA PROPOSTA (tabela)                      │
│  # | SKU | Descrição | Medidas | Qtd |          │
│  Preço Unit. | Desc.% | Subtotal |              │
│  [IPI% | IPI R$] (condicional) | Total          │
├─────────────────────────────────────────────────┤
│ TOTAIS (caixa à direita)                        │
│  Subtotal Produtos: R$                          │
│  IPI Total: R$ (condicional)                    │
│  VALOR TOTAL: R$                                │
├─────────────────────────────────────────────────┤
│ CONDIÇÕES COMERCIAIS (condicional)              │
│  Pagamento / Prazo de Entrega / Observações     │
├─────────────────────────────────────────────────┤
│ VENDEDOR (criador do registro)                  │
│  Nome do perfil (profiles.full_name)            │
├─────────────────────────────────────────────────┤
│ RODAPÉ                                          │
│  Nome da legal_entity / CNPJ / Tel / Email      │
│  "Para dúvidas, entre em contato conosco."      │
└─────────────────────────────────────────────────┘
```

### Colunas da Tabela de Itens (Proposta)
| # | SKU | Descrição | Medidas (LxCxE) | Qtd | Preço Unit. | Desc.% | Subtotal | IPI% | IPI R$ | Total |

### Totais exibidos (Proposta)
- Subtotal Produtos
- IPI Total (condicional, com label "informativo" se incluso)
- **VALOR TOTAL**

### Campos NÃO presentes (Proposta)
- Inscrição Estadual do cliente
- Transportadora / Endereço de entrega / Tipo de frete
- Desconto global (só por item)
- Frete
- Parcelas
- Campo de aceite/assinatura

---

## 4. Estrutura do Layout — PEDIDO (`generate-order-pdf`)

```text
┌─────────────────────────────────────────────────┐
│ CABEÇALHO                                       │
│  [Logo legal_entity]       [Número do pedido]   │
│  [CNPJ legal_entity]      [Data de hoje]        │
│                            [Badge Status]        │
│                            [Data Entrega]        │
├─────────────────────────────────────────────────┤
│ PROPOSTA DE ORIGEM (condicional)                │
│  Número da proposta vinculada                   │
├─────────────────────────────────────────────────┤
│ DADOS DO CLIENTE                                │
│  ┌──────────────┐  ┌──────────────┐             │
│  │ Empresa      │  │ Contato      │             │
│  │ Nome         │  │ Nome         │             │
│  │ CNPJ         │  │ Email        │             │
│  │ Endereço     │  │ Telefone     │             │
│  │ Bairro       │  │              │             │
│  │ Cidade-UF-CEP│  │              │             │
│  │ Tel / Email  │  │              │             │
│  └──────────────┘  └──────────────┘             │
├─────────────────────────────────────────────────┤
│ ITENS DO PEDIDO (tabela)                        │
│  # | SKU | Descrição | Medidas | Qtd |          │
│  Preço Unit. | Subtotal |                       │
│  [IPI% | IPI R$] (condicional)                  │
│  --- linha de subtotais (condicional) ---        │
│  VALOR TOTAL                                    │
├─────────────────────────────────────────────────┤
│ OBSERVAÇÕES (condicional)                       │
├─────────────────────────────────────────────────┤
│ VENDEDOR RESPONSÁVEL (sales_rep da empresa)     │
│  Nome / Email / Telefone                        │
├─────────────────────────────────────────────────┤
│ RODAPÉ                                          │
│  Nome da legal_entity / Tel / Email             │
│  "Documento gerado em DD/MM/AAAA"              │
└─────────────────────────────────────────────────┘
```

### Colunas da Tabela de Itens (Pedido)
| # | SKU | Descrição | Medidas (LxCxE) | Qtd | Preço Unit. | Subtotal | IPI% | IPI R$ |

**Diferença**: Pedido NÃO tem coluna "Desc.%" nem coluna "Total" por item.

### Totais exibidos (Pedido)
- Subtotal Produtos (condicional, só se IPI)
- IPI Total (condicional)
- **VALOR TOTAL** (usa `order.total_value`)

### Campos NÃO presentes (Pedido)
- Inscrição Estadual do cliente
- Transportadora / Endereço de entrega / Tipo de frete
- Condição de pagamento / Parcelas
- Desconto global
- Frete
- Campo de aceite/assinatura

---

## 5. Diferenças entre Proposta e Pedido

| Aspecto | Proposta | Pedido |
|---------|----------|--------|
| Coluna Desc.% | Sim | Não |
| Coluna Total por item | Sim | Não |
| Badge de Status | Não | Sim (com cor) |
| Data de Entrega | Não | Sim |
| Validade | Sim | Não |
| Proposta de origem | N/A | Sim (condicional) |
| Condições comerciais | Pagamento + Entrega + Obs | Apenas Obs |
| Vendedor (1) | sales_rep da empresa | sales_rep da empresa |
| Vendedor (2) | profiles.full_name (criador) | Não tem segundo |
| Dados do cliente | Nome, CNPJ, Endereço, Cidade-UF | + Bairro, CEP, Tel, Email |
| Rodapé | + CNPJ da entity | Sem CNPJ |

---

## 6. Origem dos Dados por Bloco

| Bloco | Tabela(s) | Campos principais |
|-------|-----------|-------------------|
| Logo/Emitente | `legal_entities` | name, cnpj, logo_url, phone, email |
| Número/Data | `proposals` / `orders` | number, created_at, validity_date, status, delivery_date |
| Empresa | `companies` | name, cnpj, address, address_number, neighborhood, city, state, zip_code, phone, email |
| Contato | `contacts` | first_name, last_name, email, phone |
| Vendedor Rep | `sales_reps` (via companies.sales_rep) | name, phone, email |
| Vendedor Criador | `profiles` | full_name (só proposta) |
| Itens | `proposal_items` / `order_items` | description, quantity, unit_price, discount_percent, subtotal, ipi_rate, ipi_value, width, length, thickness, sort_order |
| Produto | `products` | sku, name |
| Proposta origem | `proposals` (via orders.proposal_id) | number |
| IPI Mode | `proposals.ipi_mode` / `orders.ipi_mode` | — |

---

## 7. Resumo Estrutural

```text
PROPOSTA PDF:
  CABEÇALHO (logo + número + data + validade + badge IPI)
  CLIENTE (empresa + contato + vendedor rep)
  ITENS (11 colunas com IPI / 9 sem)
  TOTAIS (subtotal + IPI + total)
  CONDIÇÕES COMERCIAIS (pagamento + entrega + observações)
  VENDEDOR CRIADOR
  RODAPÉ

PEDIDO PDF:
  CABEÇALHO (logo + número + data + status + entrega)
  PROPOSTA ORIGEM (condicional)
  CLIENTE (empresa + contato)
  ITENS (9 colunas com IPI / 7 sem)
  TOTAIS (subtotal + IPI + total)
  OBSERVAÇÕES
  VENDEDOR REP
  RODAPÉ
```

Este diagnóstico mapeia toda a arquitetura atual. Com base nele, podemos redesenhar os layouts sem quebrar a estrutura existente — mantendo as Edge Functions como motor de geração HTML e ajustando o template inline.

