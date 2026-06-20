# Fase 05 — Criação do Supabase Staging próprio

## Objetivo

Criar um ambiente Supabase próprio de staging para validar a migração do CRM fora da infraestrutura atual da Lovable.

## Premissas

- O CRM atual continua operando normalmente na Lovable.
- O banco atual ainda é o banco real.
- O ambiente staging não será usado por usuários finais.
- Nenhum dado real será alterado nesta fase.
- O frontend já foi validado localmente fora da Lovable na Fase 02.
- O inventário técnico do Supabase foi registrado na Fase 03.
- O plano de criação do Supabase próprio foi registrado na Fase 04.

## Projeto Supabase Staging

Nome sugerido:

`crm-qualyvac-staging`

## Dados a registrar após criação

- Project ID:cansbrrwrprcycjvgvqm
- Project URL:https://cansbrrwrprcycjvgvqm.supabase.co
- Região:sa-east-1
- Plano:pro
- Data de criação:20/06/2026
- Responsável:Felipe Duarte
- Observações:Projeto criado exclusivamente para staging da migração do CRM Qualyvac. Não utilizar em produção nesta fase.

## Variáveis frontend esperadas

```env
VITE_SUPABASE_PROJECT_ID=cansbrrwrprcycjvgvqm
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_tnE2m6hoa7zmuUkT3HIATQ_0YaPzHuS
VITE_SUPABASE_URL=https://cansbrrwrprcycjvgvqm.supabase.co
```

