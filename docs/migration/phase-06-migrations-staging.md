# Fase 06 — Aplicação controlada das migrations no Supabase Staging

## Objetivo

Preparar e executar a aplicação das migrations do projeto no ambiente Supabase staging próprio, sem impactar o banco atual da Lovable.

## Premissas

- O CRM atual continua operando normalmente.
- O Supabase staging foi criado na Fase 05.
- O banco staging deve estar vazio antes da aplicação das migrations.
- Nenhum usuário final utilizará o ambiente staging nesta fase.
- Nenhuma variável do frontend será trocada ainda.
- O ambiente local continua apontando para o Supabase atual até validação posterior.

## Riscos

- Migrations antigas podem depender de ordem específica.
- Algumas migrations podem assumir dados existentes.
- Algumas funções podem depender de extensões não habilitadas.
- Policies RLS podem depender de funções auxiliares.
- Triggers podem falhar se tabelas ou funções forem criadas fora de ordem.
- O `supabase/config.toml` pode conter funções antigas ou driftadas.

## Ordem segura

1. Confirmar que o Supabase staging está vazio.
2. Instalar ou validar Supabase CLI.
3. Fazer login na Supabase CLI.
4. Linkar o projeto local ao Supabase staging.
5. Verificar migrations disponíveis.
6. Aplicar migrations em staging.
7. Registrar erros, se houver.
8. Corrigir apenas em branch controlada, se necessário.
9. Validar tabelas, funções, triggers e policies.
10. Não importar dados reais ainda.

## Critérios de aceite

- Migrations aplicadas no Supabase staging.
- Schema criado sem erro crítico.
- Tabelas principais visíveis no dashboard.
- Funções/RPCs principais criadas.
- RLS/policies presentes.
- Nenhuma alteração feita no banco atual.
- Nenhuma alteração feita no CRM em produção.

## Status

Pendente de execução.

@'

## Evidência — Dry-run das migrations

Data: 20/06/2026

Comando executado:

```powershell
npx supabase db push --dry-run