# Fase 22D-R — Correção de Target da Migração

## 1. Resumo executivo

Foi confirmado que o projeto Supabase `nazymjfzjadfgovcfivs` (`Qualyvac_Group_CRM`) não pertence à migração atual do Qualyvac.  
Consequentemente, análises 22D/22E baseadas nesse target ficam invalidadas para decisão de carga desta trilha.

## 2. Projetos corretos

Projetos válidos para a migração atual:

- `nsnmlleplpzsefzkuxlb` / `crm-qualyvac-restore-test`
- `cansbrrwrprcycjvgvqm` / `crm-qualyvac-staging`

## 3. Projeto invalidado

Projeto fora de escopo da migração atual:

- `nazymjfzjadfgovcfivs` / `Qualyvac_Group_CRM`
- Motivo: pertence a outro CRM e não deve ser usado como origem, destino, restore-test ou staging desta trilha.

## 4. Impacto

- Fase 22D anterior: invalidada para decisão de carga da migração atual.
- Fase 22E preview: invalidada para decisão de carga da migração atual.
- Fase 22F: não deve ser executada com base em dados/documentos gerados no target invalidado.

## 5. Decisão

- **NO-GO** para usar qualquer dataset baseado em `nazymjfzjadfgovcfivs`.
- **GO** para refazer 22D no target correto `nsnmlleplpzsefzkuxlb` (`crm-qualyvac-restore-test`).
- Staging (`cansbrrwrprcycjvgvqm`) permanece proibido até autorização explícita.

## 6. Próxima fase recomendada

- **Fase 22D-R2 — Reexecutar saneamento/mapeamento read-only no target correto `crm-qualyvac-restore-test`**.
