# Fase 04 — Plano do Supabase próprio

## 1. Objetivo da fase

Definir um plano técnico seguro e auditável para criar um novo projeto Supabase próprio (fora da Lovable), preparando ambiente, segurança, dados e validação operacional antes do cutover do CRM.

## 2. Premissas confirmadas até agora

- Código já está no GitHub.
- Backup separado existe.
- Repositório de migração existe.
- Frontend já rodou localmente fora da Lovable.
- Supabase atual ainda é o banco real (produção vigente).

## 3. Estratégia recomendada para criação do Supabase próprio

- Criar um novo projeto Supabase isolado, sem alterar o atual inicialmente.
- Reproduzir o backend por camadas: schema/migrations, storage, functions, secrets e integrações.
- Validar segurança primeiro (Auth + RLS + service boundaries), depois funcionalidade.
- Trabalhar com staging completo antes de qualquer troca de ambiente.
- Tratar dependências da Lovable como item explícito de transição (não implícito).

## 4. Ordem segura de implantação

1. Criar projeto Supabase novo.
2. Configurar região.
3. Configurar variáveis.
4. Aplicar migrations.
5. Criar buckets.
6. Configurar Edge Functions.
7. Configurar secrets.
8. Validar RLS.
9. Validar Auth.
10. Validar RPCs.
11. Validar triggers.
12. Validar integrações externas.

## 5. Checklist de preparação do Supabase novo

- [ ] Projeto Supabase novo criado e identificado por ambiente (`staging`/`prod`).
- [ ] Região definida com menor latência para usuários e integrações ERP.
- [ ] Política de acesso administrativo definida (MFA, membros, papéis).
- [ ] Inventário de secrets fechado e classificado por criticidade.
- [ ] Plano de aplicação de migrations congelado (ordem, ponto de restauração, validações).
- [ ] Buckets e políticas de storage mapeados.
- [ ] Mapa de Edge Functions por prioridade de implantação concluído.
- [ ] Plano de testes de Auth/RLS/RPC/Trigger aprovado.
- [ ] Critérios de Go/No-Go alinhados com responsáveis técnicos e negócio.
- [ ] Plano de rollback documentado e viável.

## 6. Matriz de secrets necessária

### Frontend
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID` (metadado de ambiente)

### Edge Functions
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### ERP Projedata/Iniflex
- `PROJEDATA_API_URL`
- `PROJEDATA_API_TOKEN`
- `INIFLEX_API_URL`
- `INIFLEX_API_TOKEN`

### E-mail/Resend
- `RESEND_API_KEY`

### WhatsApp/Z-API
- `ZAPI_CLIENT_TOKEN`

### Google Calendar
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### IA/Lovable AI ou substituto futuro
- `LOVABLE_API_KEY` (temporário enquanto houver dependência)
- Token/URL do provedor substituto (quando definido)

### CNPJ
- `CNPJ_WS_TOKEN`
- `CNPJ_CACHE_TTL_DAYS`

## 7. Estratégia para aplicar migrations

- Aplicar em ambiente novo e vazio, mantendo ordem cronológica dos arquivos.
- Executar em lotes controlados (fundação -> domínio core -> integrações -> BI).
- Após cada lote, validar:
  - criação de tabelas/índices/constraints;
  - funções SQL e grants;
  - triggers ativas;
  - policies RLS habilitadas.
- Registrar checkpoints para permitir retorno ao último estado válido.
- Não alterar migrations históricas; correções devem entrar como novas migrations.

## 8. Estratégia para importar dados posteriormente

- Importar em fase separada da estrutura (schema-first, data-second).
- Priorizar entidades mestre (tenants, usuários base, empresas/clientes) antes de transacionais.
- Preservar integridade referencial e chaves externas por ordem de dependência.
- Executar reconciliação pós-import:
  - contagens por tabela;
  - checksums/amostras;
  - consistência de relacionamentos críticos.
- Congelar janela de escrita no legado próximo ao cutover para evitar divergência.

## 9. Estratégia para testar Edge Functions

- Testes por categorias (auth, ERP, WhatsApp, email, Google, IA, PDFs).
- Validar autenticação de entrada por função (JWT, assinatura ou validação interna).
- Validar comportamento com secrets ausentes/incorretos (falha controlada).
- Verificar respostas, logs e idempotência para funções de processamento/sync.
- Testar timeout, retry e tratamento de erro para integrações externas.

## 10. Estratégia para testar Storage

- Validar buckets públicos e privados com cenários de leitura/escrita/remoção.
- Verificar signed URLs (criação, expiração, acesso indevido).
- Testar políticas de `storage.objects` por papel e tenant.
- Validar upload/download em fluxos reais (anexos, PDFs, documentos).

## 11. Estratégia para testar Auth e usuários

- Validar login/logout/refresh de sessão no novo projeto.
- Testar criação, atualização e remoção de usuários via funções administrativas.
- Confirmar vínculo entre `auth.users`, `profiles`, `user_roles` e entidades de acesso.
- Testar cenários de usuário sem papel, papel insuficiente e papel admin/dev.

## 12. Estratégia para testar permissões/RLS

- Construir matriz de testes por perfil (`admin`, `desenvolvedor`, vendedor etc.).
- Validar escopo por tenant e entidade legal em consultas e mutações.
- Confirmar bloqueio de acesso cruzado entre tenants.
- Testar RLS em tabelas de alta criticidade: clientes, pedidos, pipeline, BI e storage.
- Validar políticas em Edge Functions (quando usam `anon` vs `service_role`).

## 13. Plano de staging

- Criar staging espelhando o desenho de produção (schema, functions, buckets, secrets de teste).
- Subir frontend contra staging para testes integrados ponta a ponta.
- Executar suite de regressão funcional mínima:
  - autenticação;
  - cadastro/consulta de clientes;
  - pipeline;
  - pedidos;
  - integrações;
  - relatórios.
- Aprovar staging somente com critérios objetivos e evidências registradas.

## 14. Critérios de Go / No-Go

### Go
- Migrations aplicadas integralmente sem erro.
- RLS/Auth validados para perfis críticos.
- Edge Functions prioritárias estáveis em staging.
- Integrações externas essenciais funcionando.
- Logs sem erros críticos recorrentes.
- Plano de rollback pronto e testado.

### No-Go
- Falhas em RLS/Auth com risco de exposição de dados.
- Inconsistência de dados em entidades críticas.
- Funções de ERP/sync instáveis.
- Dependências críticas sem segredo/configuração válida.
- Ausência de rollback executável.

## 15. Plano de rollback

- Manter Supabase atual como fonte primária até estabilização do novo ambiente.
- Em caso de incidente no cutover:
  - reverter frontend para credenciais do Supabase atual;
  - pausar chamadas ao novo backend;
  - restaurar operação no ambiente legado;
  - registrar divergências de dados para reconciliação posterior.
- Definir janela de rollback e responsáveis por decisão (técnico + negócio).

## 16. Riscos principais

- Drift de configuração entre `config.toml` e funções reais.
- Superfície de risco por funções com `verify_jwt=false`.
- Dependência de `service_role` em grande número de funções.
- Dependências externas (ERP, Z-API, Google, Resend, IA) com alta sensibilidade a secrets.
- Dependência parcial de Lovable AI ainda presente.
- Complexidade alta de RLS e funções SQL em conjunto com volume de migrations.

## 17. Próximas fases recomendadas

- **Fase 05 — Hardening de segurança do backend**
  - revisão de `verify_jwt`, autenticação por função e política de secrets.
- **Fase 06 — Provisionamento do Supabase staging próprio**
  - criação do projeto, aplicação de migrations e configuração inicial.
- **Fase 07 — Validação integrada em staging**
  - testes E2E de Auth, RLS, Storage, Edge Functions e integrações.
- **Fase 08 — Plano de migração de dados e cutover**
  - carga, reconciliação, Go/No-Go e rollback operacional.

