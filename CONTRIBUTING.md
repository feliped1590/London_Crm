# Como contribuir — CRM Qualyvac

Guia rápido do fluxo de desenvolvimento. Mantenha-o curto: se virar manual de 30 páginas, ninguém lê.

---

## 1. Antes de começar

- Leia [`docs/README.md`](./docs/README.md) e [`docs/00-overview/architecture.md`](./docs/00-overview/architecture.md).
- Confira [`docs/00-overview/known-issues.md`](./docs/00-overview/known-issues.md) para evitar repetir erros.
- Se for mexer em regra de negócio, leia o doc correspondente em `docs/03-business-rules/`.

---

## 2. Branches

Trunk-based simplificado. `main` é sempre deployável.

```
main
├── feat/order-lock-improvement
├── fix/pipeline-rls
├── chore/upgrade-react
└── docs/add-pricing-rules
```

**Regras:**
- Branch curta — máx. 3 dias. Mais que isso: escopo errado, quebre.
- Nome: `tipo/descricao-curta-em-kebab`.
- Tipos válidos: `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`.

---

## 3. Commits

Use **Conventional Commits**:

```
feat(orders): add lock/unlock workflow
fix(pipeline): correct le.active reference in save_pipeline_with_entities
docs(architecture): add ERP sync sequence diagram
chore(deps): bump react to 18.3
refactor(hooks): split usePipelines into smaller hooks
```

Escopo entre parênteses é o módulo (`orders`, `pipeline`, `pricing`, `fiscal`, `erp-sync`, `auth`, etc.).

---

## 4. Pull Request

- PR pequeno (≤400 linhas de diff). PR grande = review ruim = bug em produção.
- Use o template em [`.github/pull_request_template.md`](./.github/pull_request_template.md) — ele já carrega automaticamente.
- **Doc atualizada faz parte da Definition of Done.** Sem doc, sem merge.

### Checklist de qualidade (resumo do template)
- [ ] Regras de negócio impactadas estão refletidas em `docs/03-business-rules/`
- [ ] Migration (se houver) é reversível mentalmente
- [ ] RLS validada quando criou/alterou tabela
- [ ] Logs/audit cobrem caminho feliz e de erro
- [ ] Sem `console.log` esquecido
- [ ] Sem secret em código (use `secrets`)
- [ ] **Seção "Impacto na documentação" preenchida**

---

## 5. Code review

- Pelo menos 1 aprovação antes do merge (mesmo solo, crie o hábito).
- Revisor verifica: lógica, segurança (RLS!), nomes, doc, testes manuais descritos.
- Comentários acionáveis. "Isso aqui está estranho" não é review — diga o que mudar.

---

## 6. Migrations Supabase

Sempre via tool `supabase--migration` (gera arquivo timestampado em `supabase/migrations/`).

**Regras:**
- Nunca editar migration já aplicada — crie nova.
- Pense no rollback antes de aplicar (não precisa escrever, mas precisa saber como reverter).
- Mexeu em RLS? Rode `supabase--linter` antes de mergear.
- Mexeu em RPC? Teste com payload **não-vazio** (ver [KI-0001](./docs/00-overview/known-issues.md#ki-0001--column-leis_active-does-not-exist-ao-salvar-funil)).

---

## 7. Testes

Não cobrimos 100%. Foco em:

| Tipo | Cobre |
|---|---|
| Manual | Caminho feliz + 1 caminho de erro, descrito no PR |
| Integration (DB) | Triggers, RPCs, RLS — quando o bug seria invisível na UI |
| E2E (futuro) | 3-5 fluxos críticos (criar pedido, aprovar proposta, mover deal) |

UI isolada: não testar (custo > benefício hoje).

---

## 9. Revisão de documentação

Para manter a documentação viva e atualizada:

- **Toda feature relevante** → revisar e atualizar os documentos em `/docs` afetados pelo trabalho
- **A cada 3 meses** → revisão geral de toda a pasta `/docs` para identificar obsolescência

> **Regra:** documentação desatualizada é tratada como bug — cria-se issue e prioriza-se a correção.

---

## 10. Deploy

- Merge em `main` → deploy automático (Lovable).
- Hotfix: branch `fix/`, PR rápido, merge, deploy. Pós-mortem se foi incidente real → entrada em `known-issues.md`.

---

## 9. Quando algo quebra

1. Reproduza localmente se possível.
2. Investigue logs (edge function, `audit_logs`, `order_sync_queue`...).
3. Corrija com PR seguindo este fluxo.
4. **Se consumiu >1h de debug ou impactou produção, registre em [`docs/00-overview/known-issues.md`](./docs/00-overview/known-issues.md).**

---

## 10. Dúvidas

- Algo na arquitetura não bate com o doc? Atualize o doc no mesmo PR.
- Decisão arquitetural relevante? Crie um ADR em `docs/02-architecture/decisions/`.
- Doc faltando? PR `docs/...` é tão bem-vindo quanto código.
