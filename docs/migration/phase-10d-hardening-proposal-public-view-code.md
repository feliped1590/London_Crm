# Fase 10D — Hardening em codigo da `proposal-public-view`

## 1) Objetivo

Aplicar hardening minimo e controlado na Edge Function `proposal-public-view`, sem deploy, sem migration e sem alteracao de configuracao/secrets.

## 2) Arquivos alterados nesta fase

- `supabase/functions/proposal-public-view/index.ts`
- `docs/migration/phase-10d-hardening-proposal-public-view-code.md`

## 3) Confirmacoes de contexto

- `supabase/config.toml` mantido sem alteracao.
- `proposal-public-view` permanece com `verify_jwt=false` (estado atual).
- Nao houve deploy nesta fase.

## 4) Hardening implementado em codigo

1. **Metodo HTTP restrito**
   - Aceita apenas `POST` e `OPTIONS`.
   - Requisicoes com outros metodos retornam `405`.

2. **Preflight/CORS seguro**
   - Cabecalho `Access-Control-Allow-Methods: POST, OPTIONS` adicionado.
   - Mantido retorno adequado para `OPTIONS`.

3. **Validacao de token antes de consultar banco**
   - Token obrigatorio.
   - Sanitizacao com `trim()`.
   - Validacao de tamanho minimo/maximo (`16..180`).
   - Validacao de formato por regex (`[A-Za-z0-9._-]`).
   - Tokens obviamente invalidos sao rejeitados antes da query.

4. **Mensagens anti-enumeracao**
   - Invalido/inexistente/expirado retornam mensagem generica:
     - `Link inválido ou expirado`
   - Evita diferenciacao de erro para ataque de enumeracao.

5. **Rate limit preservado e reforcado**
   - Mantida janela de 1h e limite de 10 falhas por IP.
   - Incluido tratamento de falha no check de rate limit com resposta segura (`503`).

6. **Higiene de logs**
   - Token completo nao e logado.
   - Log usa apenas token mascarado (`xxxx***yy`) e prefixo reduzido para auditoria.
   - Erros logam apenas codigo resumido quando disponivel.

7. **Reducao de payload publico**
   - Removidos campos sensiveis/desnecessarios do select de retorno (ex.: CNPJ, email, telefone, endereco, IDs secundarios).
   - Mantido apenas conjunto minimo para visualizacao publica da proposta.
   - Itens de proposta tambem reduzidos para campos essenciais.

8. **Resposta segura de erro interno**
   - Mantida resposta generica (`Erro interno`) sem exposicao de erro bruto ao cliente.

## 5) Expiracao de token

- Confirmado uso de `approval_token_expires_at` na funcao.
- Confirmado em migrations que o campo existe:
  - `ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS approval_token_expires_at TIMESTAMPTZ;`
- Validacao de expiracao foi mantida no codigo.

## 6) Uso de `SUPABASE_SERVICE_ROLE_KEY`

- **Mantido temporariamente** nesta fase.
- Motivo:
  - remover service role sem revisao de RLS/escopo pode quebrar leitura publica controlada por token.
  - fase atual limita risco por validacao de token + payload minimo + anti-enumeracao + rate limit.
- Pendencia para fase futura:
  - avaliar arquitetura com separacao publica/admin ou modelo com privilegio reduzido.

## 7) Pendencias de seguranca (remanescente)

- Endpoint continua publico (`verify_jwt=false`) por decisao funcional atual.
- Ainda depende de service role para leitura.
- Hardening recomendado para etapa seguinte:
  - token assinado com exp curta e politica de revogacao;
  - revisar necessidade de manter endpoint publico sem JWT;
  - monitoramento ativo de abuso por IP/token.

## 8) Por que ainda nao houve deploy

- Escopo da Fase 10D e exclusivamente alteracao de codigo + documentacao.
- Deploy fica para fase posterior controlada (10E), apos revisao do patch.

## 9) Criterios para liberar deploy futuro (Fase 10E)

1. Revisao de codigo aprovada para hardening aplicado.
2. Validacao de risco residual aceita (Seguranca/Engenharia).
3. Confirmacao de que payload retornado esta no minimo necessario.
4. Checklist operacional de deploy controlado aprovado.
5. Deploy somente desta funcao, sem incluir outras fora do escopo.

