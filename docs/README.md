# Documentação Técnica — CRM Qualyvac

Bem-vindo. Esta pasta concentra **toda a documentação técnica viva** do CRM. Doc fora deste repositório envelhece em semanas — aqui ela é versionada junto com o código e revisada via Pull Request.

> **Princípio:** documentamos o que dói esquecer. Código bem nomeado já é documentação.

---

## ⚡ Start rápido (obrigatório)

Se você vai mexer no sistema, leia nesta ordem:

1. [`00-overview/architecture.md`](./00-overview/architecture.md) — stack, integrações, multi-CNPJ
2. [`00-overview/known-issues.md`](./00-overview/known-issues.md) — erros que já aconteceram e como evitar
3. [`03-business-rules/pipeline.md`](./03-business-rules/pipeline.md) — se envolver pipeline
4. [`04-workflows/critical-flows/order-erp-sync.md`](./04-workflows/critical-flows/order-erp-sync.md) — se envolver ERP

**Tempo total: ~30 minutos**

> Isso elimina o clássico: *"não sabia que isso existia"*

---

## Por onde começar

### 👶 Primeira vez no projeto
1. [`00-overview/architecture.md`](./00-overview/architecture.md) — visão geral do sistema (10 min)
2. [`00-overview/known-issues.md`](./00-overview/known-issues.md) — erros conhecidos e como evitá-los
3. [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — como abrir PR e padrões do time

### 🛠️ Vou mexer em uma regra de negócio
- Pipeline / etapas / vínculo CNPJ → [`03-business-rules/pipeline.md`](./03-business-rules/pipeline.md)
- Outras regras → consultar memórias `mem://` (migração para `/docs` em andamento)

### 🔌 Vou mexer em integração ERP
- [`04-workflows/critical-flows/order-erp-sync.md`](./04-workflows/critical-flows/order-erp-sync.md)
- [`00-overview/known-issues.md`](./00-overview/known-issues.md) — falhas conhecidas de sync

### 📋 Vou tomar uma decisão arquitetural
- Leia ADRs existentes em `02-architecture/decisions/` (se houver)
- Crie um novo ADR para registrar a decisão

---

## Estrutura

```text
docs/
├── README.md                              ← você está aqui
├── 00-overview/
│   ├── architecture.md                    ← visão do sistema + integrações
│   └── known-issues.md                    ← erros conhecidos (causa, solução, prevenção)
├── 03-business-rules/
│   └── pipeline.md                        ← regras de pipeline multi-CNPJ
└── 04-workflows/
    └── critical-flows/
        └── order-erp-sync.md              ← sincronização de pedidos com ERP Projedata
```

> Pastas vazias (`01-onboarding`, `02-architecture/decisions`, `05-playbooks`) serão preenchidas conforme necessidade real. Não criamos doc por antecipação.

---

## Regras de manutenção

1. **Doc vive no repo.** Notion só para coisas não-técnicas.
2. **PR que muda regra de negócio sem atualizar doc é PR rejeitado.** Ver checklist em [`.github/pull_request_template.md`](../.github/pull_request_template.md).
3. **Erro relevante em produção vira entrada em `known-issues.md`.** Causa + solução + prevenção.
4. **Documento desatualizado = bug.** Abra issue, priorize.
5. **Revisão trimestral:** 1h por trimestre, abre cada arquivo, valida se ainda é verdade.

---

## Próximos documentos (roadmap)

Não escrever antes de precisar:

- `03-business-rules/orders.md` — lock/unlock, snapshot, aprovações
- `03-business-rules/pricing.md` — hierarquia de preços
- `03-business-rules/fiscal.md` — IPI, NCM, reforma tributária 2026
- `04-workflows/critical-flows/proposal-approval.md` — aprovação pública → criação de pedido
- `02-architecture/decisions/ADR-0001-*` — primeiro ADR retroativo (ownership via `sales_rep_id`)
- `05-playbooks/how-to-debug-erp-sync.md`
