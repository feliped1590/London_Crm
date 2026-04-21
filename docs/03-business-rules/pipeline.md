# Regra de Negócio — Pipelines

**Última revisão:** 2026-04-21 · **Owner:** Tech Lead
**Implementação principal:** `src/hooks/usePipelines.ts`, `src/components/settings/UnifiedPipelineManager.tsx`, RPC `public.save_pipeline_with_entities`, trigger `validate_pipeline_legal_entity_match`.

---

## 1. O que é um pipeline

Funil que organiza deals (negócios), orders (pedidos) e proposals (propostas) em etapas (`stages`). Suporta 4 modos:

| `pipeline_mode` | Uso |
|---|---|
| `sales` | Comercial puro (prospecção → fechamento). Aplicam-se regras de pricing, perda, etc. |
| `operational` | Pós-venda (produção, expedição, faturamento). Sem regras comerciais. |
| `support` | Atendimento / RNC / qualidade. |
| `hybrid` | Misto (raro). |

> **Regra crítica:** apenas pipelines `sales` aplicam regras comerciais (preço, motivo de perda, classificação). Pipelines operacionais ignoram essas validações.

---

## 2. Escopo: global vs. restrito (multi-CNPJ)

A Qualyvac opera com 4 CNPJs emissores (`legal_entities`): Qualyvac, Embazec, Martina, Novafix. Pipelines podem ser:

| Escopo | Como se determina | Quem vê |
|---|---|---|
| **Global** | 0 vínculos em `pipeline_legal_entities` | Todos os usuários |
| **Restrito** | 1+ vínculos em `pipeline_legal_entities` | Apenas usuários com vínculo (em `user_legal_entities`) a alguma das empresas vinculadas |

> **`pipelines.pipeline_scope` é DERIVADO**, não editável. A RPC `save_pipeline_with_entities` recalcula automaticamente conforme o array passado.

### Tabela canônica
```sql
pipeline_legal_entities (pipeline_id, legal_entity_id) -- N:N, fonte de verdade
```

`pipelines.legal_entity_id` ainda existe (compatibilidade legacy) e é mantido sincronizado por trigger. **Não escrever direto** — usar a RPC.

---

## 3. Como salvar um pipeline (caminho único)

❌ **Nunca** fazer `INSERT/UPDATE` direto em `pipelines` + `pipeline_legal_entities`.
✅ **Sempre** chamar a RPC:

```ts
await supabase.rpc('save_pipeline_with_entities', {
  _pipeline_id: pipelineId,        // null para criar
  _name: 'OPERAÇÃO QUALYVAC',
  _description: '...',
  _type: 'operational',
  _is_active: true,
  _allowed_roles: ['admin', 'vendedor'],
  _pipeline_mode: 'operational',
  _legal_entity_ids: [qualyvacId], // array vazio/null = global
});
```

**A RPC garante atomicamente:**
1. RBAC: só admin/desenvolvedor podem salvar.
2. Valida que cada `legal_entity_id` existe e está ativa (`active = true` — atenção, ver [KI-0001](../00-overview/known-issues.md#ki-0001--column-leis_active-does-not-exist-ao-salvar-funil)).
3. Valida que o usuário tem acesso a cada CNPJ (a menos que seja admin/dev).
4. Substitui vínculos atomicamente (DELETE + INSERT em `pipeline_legal_entities`).
5. Recalcula `pipeline_scope` (`global` se 0 vínculos, `restricted` se 1+).

---

## 4. Visibilidade (RLS)

Tabela `pipelines`, política SELECT:

```sql
USING ( public.has_pipeline_access(id) )
```

A função `has_pipeline_access(uuid)` (SECURITY DEFINER) implementa:

```text
acesso =
  é admin OU desenvolvedor
  OU pipeline tem 0 vínculos em pipeline_legal_entities
  OU usuário está vinculado em user_legal_entities a alguma das legal_entities do pipeline
```

> **No frontend:** `usePipelines({ legalEntityId })` aplica filtro adicional para evitar mostrar pipelines de outros CNPJs no seletor, mesmo que RLS permita.

---

## 5. Integridade (trigger)

`validate_pipeline_legal_entity_match` roda em `deals`, `orders`, `proposals`:

- **Pipeline global** (sem vínculos) → aceita qualquer `legal_entity_id`.
- **Pipeline restrito** → o `NEW.legal_entity_id` do registro DEVE estar entre os vínculos do pipeline. Caso contrário, INSERT/UPDATE é bloqueado.

Isto impede, por exemplo, mover um deal da Embazec para um pipeline restrito da Qualyvac.

---

## 6. Classificação ortogonal de etapas

Ao editar etapas em `UnifiedPipelineManager`, três dimensões **independentes** descrevem cada stage:

| Campo | Valores | Para quê |
|---|---|---|
| `stage_status` | `open`, `won`, `lost` | Controla fechamento de deal |
| `stage_category` | `commercial`, `operational`, `loss`, `quality` | BI agnóstico de nome |
| `stage_phase` | `pre_sale`, `sale`, `post_sale` | Jornada analítica |

> **Importante:** essas dimensões são ortogonais — uma etapa "Perda Comercial" pode ser `status=lost`, `category=loss`, `phase=sale` simultaneamente.

---

## 7. Casos de uso (exemplos reais)

### 7.1 Pipeline 100% Qualyvac
- Vínculos: `[qualyvac_id]`
- Visível para: admins + usuários com Qualyvac em `user_legal_entities`.
- Aceita deals/orders apenas com `legal_entity_id = qualyvac_id`.

### 7.2 Pipeline Vendas (legacy, global)
- Vínculos: `[]` (vazio)
- `pipeline_scope = 'global'`
- Visível para todos. Aceita deals de qualquer CNPJ.

### 7.3 Pipeline compartilhado Qualyvac + Embazec
- Vínculos: `[qualyvac_id, embazec_id]`
- Aceita deals de qualquer uma das duas empresas.

---

## 8. Como testar manualmente

1. **Login como admin.** Configurações → Funis → criar/editar.
2. Marcar 1 empresa → salvar → conferir badge "Restrito a 1 empresa".
3. Marcar 2+ empresas → salvar → badge "Restrito a 2 empresas".
4. Desmarcar todas → salvar → badge "Global".
5. Tentar criar deal vinculando empresa fora do escopo → erro de trigger.

**Login como vendedor sem vínculo:** o pipeline restrito não deve aparecer no seletor.

---

## 9. NÃO fazer

- ❌ `INSERT/UPDATE` direto em `pipelines` ou `pipeline_legal_entities`.
- ❌ Confiar em `pipelines.legal_entity_id` (legacy, será removido).
- ❌ Setar `pipeline_scope` manualmente — é derivado.
- ❌ Mover deal entre pipelines de CNPJs diferentes sem ajustar `legal_entity_id` antes (a trigger bloqueia).

---

## 10. Roadmap conhecido (Fase 2)

- Remover coluna `pipelines.legal_entity_id` após zero leituras (atualmente mantida para compatibilidade).
- Avaliar restrição rígida "operacional só após comercial" (postergado).
- Avaliar quebra de OPERAÇÃO QUALYVAC em múltiplos pipelines (não escopo atual).
