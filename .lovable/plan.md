

# Fase 4I -- CNPJ no Contexto de Negocios + Vinculo na Edicao de Usuario + CNPJ Padrao

## Resumo

Tres mudancas principais:
1. Mover o vinculo usuario-CNPJ para dentro do modal de edicao/criacao de usuario (removendo da aba CNPJs)
2. Adicionar campo "CNPJ padrao" (headquarters) na gestao de entidades
3. Adicionar `legal_entity_id` em deals e companies, com seletor de CNPJ nos formularios do Pipeline e Cadastro de Clientes

---

## 1. Migracao de Banco de Dados

Adicionar `legal_entity_id` nas tabelas `deals` e `companies`:

```sql
ALTER TABLE deals ADD COLUMN legal_entity_id uuid REFERENCES legal_entities(id);
ALTER TABLE companies ADD COLUMN legal_entity_id uuid REFERENCES legal_entities(id);
```

Nenhuma outra alteracao no banco -- o campo `is_headquarters` da tabela `legal_entities` ja existe e sera usado para marcar o CNPJ padrao.

---

## 2. Vinculo de CNPJs no Modal de Edicao de Usuario

**Arquivo**: `src/pages/Settings.tsx`

Alteracoes no dialog "Editar Usuario" (linhas 870-959):
- Adicionar secao "CNPJs Vinculados" abaixo do campo "Nivel de Acesso"
- Listar os CNPJs ja vinculados ao usuario (badge com botao de remover)
- Botao "Vincular CNPJ" com Select de entidades disponiveis
- INSERT/DELETE em `user_legal_entities` diretamente no modal
- Mesma logica no dialog de criacao de usuario (opcional, pode ser feito apos criacao)

Alteracoes no dialog "Novo Usuario":
- Adicionar secao similar para vincular CNPJs ao criar

**Remover**: a secao de vinculos usuario-CNPJ do `LegalEntityPermissionsManager.tsx` (manter apenas o CRUD de entidades juridicas e a marcacao de CNPJ padrao)

---

## 3. CNPJ Padrao (Headquarters)

**Arquivo**: `src/components/settings/LegalEntityPermissionsManager.tsx`

- Adicionar botao/switch "Padrao" na lista de entidades juridicas
- Ao marcar uma entidade como padrao, executar UPDATE `is_headquarters = true` nela e `is_headquarters = false` em todas as outras do mesmo tenant
- O CNPJ padrao sera pre-selecionado em todos os formularios quando o usuario nao tiver um `active_legal_entity_id` definido

**Arquivo**: `src/hooks/useLegalEntities.ts`

- Adicionar no retorno: `defaultEntity` (a entidade com `is_headquarters = true`)
- Logica de fallback: `activeLegalEntity || defaultEntity || primeira entidade`

---

## 4. Seletor de CNPJ no Pipeline (Deals)

**Arquivo**: `src/pages/Pipeline.tsx`

No formulario de criacao/edicao de negocio:
- Adicionar campo Select "CNPJ Atendimento" apos o campo de empresa/contato
- Pre-selecionar com `activeLegalEntityId` ou CNPJ padrao (via `useLegalEntities`)
- Salvar `legal_entity_id` no INSERT e UPDATE de deals
- Campo oculto se nao houver entidades cadastradas (compatibilidade legado)

---

## 5. Seletor de CNPJ no Cadastro de Clientes

**Arquivo**: `src/pages/CustomerNew.tsx`

No wizard de cadastro:
- Adicionar campo "CNPJ Atendimento" no Step 1 (dados da empresa)
- Pre-selecionar com CNPJ padrao
- Salvar `legal_entity_id` no INSERT de companies
- Campo oculto se nao houver entidades

---

## 6. Fluxo de Dados Atualizado

```text
legal_entities (banco)
       |
       +---> is_headquarters = true (CNPJ padrao do tenant)
       |
       v
useLegalEntities (hook)
       |
       +---> defaultEntity (is_headquarters)
       +---> activeLegalEntity (do perfil do usuario)
       +---> effectiveEntity = active || default || first
       |
       +---> Pipeline.tsx (deals.legal_entity_id)
       +---> CustomerNew.tsx (companies.legal_entity_id)
       +---> OrderDialog.tsx (orders.legal_entity_id) [ja implementado]
       +---> ProposalDialog.tsx (proposals.legal_entity_id) [ja implementado]
       |
       +---> Settings.tsx > Editar Usuario (user_legal_entities)
       +---> Settings.tsx > Novo Usuario (user_legal_entities)
```

---

## Secao Tecnica

### Migracao SQL
- `ALTER TABLE deals ADD COLUMN legal_entity_id uuid REFERENCES legal_entities(id);`
- `ALTER TABLE companies ADD COLUMN legal_entity_id uuid REFERENCES legal_entities(id);`

### Arquivos a modificar
1. **`src/pages/Settings.tsx`** -- Adicionar secao CNPJs nos dialogs de usuario (criar e editar); queries para buscar `legal_entities` e `user_legal_entities`; mutations para INSERT/DELETE vinculos
2. **`src/components/settings/LegalEntityPermissionsManager.tsx`** -- Remover secao de vinculos usuario-CNPJ; adicionar botao "Definir como Padrao" que atualiza `is_headquarters`
3. **`src/hooks/useLegalEntities.ts`** -- Adicionar `defaultEntity` (is_headquarters=true) e `effectiveEntityId` (active || default || first)
4. **`src/pages/Pipeline.tsx`** -- Adicionar campo `legal_entity_id` no formulario de deal; usar `useLegalEntities` para listar opcoes e pre-selecionar
5. **`src/pages/CustomerNew.tsx`** -- Adicionar campo `legal_entity_id` no step 1; usar `useLegalEntities`

### Riscos e Mitigacoes

| Risco | Mitigacao |
|---|---|
| deals/companies sem legal_entity_id historico | Campo nullable, compatibilidade total com registros antigos |
| Troca de CNPJ padrao afeta registros existentes | Apenas define o default para novos registros; existentes mantem o valor original |
| Remocao da secao de vinculos do LegalEntityPermissionsManager | Funcionalidade movida para o modal de usuario; nenhuma perda de funcionalidade |

