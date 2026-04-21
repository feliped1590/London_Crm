# Erros Conhecidos — Aprendizado Contínuo

**Propósito:** todo erro relevante que chegar a produção (ou que custou tempo de debug) vira entrada aqui. Causa, solução e — o mais importante — **prevenção**.

> **Regra:** se um bug consumiu mais de 1h de investigação, ele merece estar aqui.

**Formato de cada entrada:**
- **ID:** sequencial (`KI-0001`, `KI-0002`...)
- **Data:** quando ocorreu
- **Severidade:** baixa / média / alta / crítica
- **Status:** resolvido / mitigado / em aberto

---

## KI-0001 — `column le.is_active does not exist` ao salvar funil

- **Data:** 2026-04-20
- **Severidade:** alta (bloqueava vínculo CNPJ↔pipeline)
- **Status:** ✅ resolvido

### Sintoma
Ao editar um funil em **Configurações → Funis** e marcar pelo menos uma empresa emissora (ex: QUALYVAC EMBALAGENS EIRELI no funil OPERAÇÃO QUALYVAC), o salvamento falhava com:

```
ERROR: column le.is_active does not exist
```

### Causa raiz
A RPC `public.save_pipeline_with_entities` validava as empresas com:

```sql
WHERE le.id = eid AND le.is_active = true
```

Mas a coluna real em `public.legal_entities` se chama **`active`** (não `is_active`). O erro só aparecia quando o array `_legal_entity_ids` tinha pelo menos 1 elemento — por isso passou despercebido em testes "vazios".

### Solução
Migration `20260420154853_*.sql` recriou a função trocando `le.is_active` por `le.active`. Nenhuma outra alteração de assinatura/lógica.

### Prevenção
1. **Convenção de nomes**: este projeto usa `active` (sem prefixo `is_`) para flags booleanas em tabelas de cadastro (`legal_entities`, `carriers`, `companies`, `sales_reps`). Outras tabelas usam `is_active` (`atividades`, `bot_flows`, `beneficios_fiscais`). **Sempre conferir o schema antes de escrever SQL** — `src/integrations/supabase/types.ts` é a fonte de verdade.
2. **Testar RPC com payload não-vazio** antes de marcar como concluída. Caminho feliz E caminho com array preenchido.
3. **Considerar padronizar** todas as flags booleanas para `is_active` em uma migration futura (ADR pendente — avaliar custo vs. benefício).

### Arquivos relacionados
- `supabase/migrations/20260420154853_*.sql` (correção)
- `supabase/migrations/20260418175153_*.sql` (introdução do bug)
- `src/components/settings/UnifiedPipelineManager.tsx` (chamador)

---

## Template para próximas entradas

Copie e cole o bloco abaixo:

```markdown
## KI-XXXX — [Título curto e descritivo]

- **Data:** YYYY-MM-DD
- **Severidade:** baixa | média | alta | crítica
- **Status:** ✅ resolvido | ⚠️ mitigado | 🔴 em aberto

### Sintoma
O que o usuário viu / o que quebrou.

### Causa raiz
Por que aconteceu (não apenas o que aconteceu).

### Solução
O que foi feito para corrigir. Link para PR/migration/commit.

### Prevenção
Como evitar que aconteça de novo:
1. Mudança de processo
2. Validação automatizada
3. Item para checklist de PR / code review

### Arquivos relacionados
- arquivo 1
- arquivo 2
```
