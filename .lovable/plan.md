# Ajuste no histórico do negócio: mostrar usuário nas alterações de etapa

## Objetivo

No histórico do negócio dentro do Pipeline, exibir o nome do usuário responsável também nas movimentações de etapa, igual já acontece nas alterações de campos.

Hoje:
- Aba **Campos**: mostra data + usuário.
- Aba **Etapas** e item de etapa na aba **Tudo**: mostra data/duração, mas não mostra o usuário.

Depois:
- Aba **Etapas**: mostra data + usuário que moveu a etapa.
- Aba **Tudo**: os eventos de etapa também mostram o usuário.
- Aba **Campos**: permanece como está.

## Implementação proposta

### 1. Ajustar carregamento do histórico de etapas

Arquivo:
- `src/components/pipeline/DealHistoryTab.tsx`

Alterar a query de `deal_stage_history` para também resolver o nome do usuário a partir de `changed_by`.

Como o próprio arquivo já faz isso manualmente para `deal_audit_log`, vou aplicar o mesmo padrão para `deal_stage_history`:

```text
1. Buscar registros em deal_stage_history
2. Buscar profiles: user_id, full_name
3. Montar cada entrada com:
   profiles.full_name = profile correspondente ao changed_by
```

Isso evita depender de relacionamento automático no banco e mantém consistência com o código atual.

### 2. Exibir usuário no componente da etapa

Ainda em:
- `src/components/pipeline/DealHistoryTab.tsx`

Atualizar `StageHistoryEntry` para renderizar:

```text
[ícone relógio] 24/04/2026 às 10:30
[ícone usuário] Nome do usuário
[badge] 2 dias na etapa anterior
```

Se não houver `changed_by` ou se o perfil não for encontrado, o item continua aparecendo normalmente sem quebrar a tela.

### 3. Verificar componente legado de histórico de etapas

Arquivo:
- `src/components/pipeline/StageHistoryTab.tsx`

Existe um componente separado que também busca `deal_stage_history` e hoje também não mostra usuário. Vou atualizar do mesmo modo para manter consistência caso ele ainda seja usado em alguma parte do sistema.

### 4. Não alterar regras de negócio

Não haverá alteração em:
- Hooks de pipeline
- Lógica de movimentação de etapa
- APIs
- Banco de dados
- Permissões/RLS
- Estrutura do histórico

A alteração é apenas de apresentação e enriquecimento de dados já existentes (`changed_by`).

## Arquivos previstos

- `src/components/pipeline/DealHistoryTab.tsx`
- `src/components/pipeline/StageHistoryTab.tsx`

## Resultado esperado

Ao abrir um negócio no Pipeline e acessar o histórico:

- As alterações de campos continuam mostrando o usuário.
- As alterações de etapas passam a mostrar o usuário que moveu o negócio.
- A aba **Tudo** fica completa, com autoria tanto em campos quanto em etapas.
- A aba **Etapas** deixa de mostrar apenas data/duração e passa a mostrar também a autoria.