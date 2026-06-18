## Objetivo

Persistir o JSON exato enviado ao Projedata (e a resposta crua) toda vez que `process-order-sync` dispara um pedido, para podermos abrir o body do PED-2026-0268 e identificar o campo que causa o `ORA-06502`.

## Mudança

Apenas em `supabase/functions/process-order-sync/index.ts`, no bloco de envio (em torno das linhas 315–340):

1. Logar em `iniflex_sandbox_logs` antes/depois do fetch:
   - `request_payload`: `JSON.parse(payload)` (o envelope ASDCOMANDO completo, com o `json` interno já string — fica navegável no Supabase).
   - `response_payload`: `responseText` parseado quando possível (fallback para `{ raw: responseText }`).
   - `http_status`: `response.status`.
   - `latency_ms`: medido com `performance.now()` em volta do fetch.
   - `error_message`: preenchido quando `p_retorno` começa com `#ERRO#` ou quando `!response.ok`.
   - `created_by`: `order.created_by` quando disponível.
2. O log roda independente do resultado (sucesso, erro de validação ERP, exceção de rede) usando `try/finally`.
3. Acrescentar também `console.log` com o `payload` inteiro (uma linha) para inspeção imediata via Edge Function logs, prefixado com `[process-order-sync] PAYLOAD ${order.number}:`.

## Não faz parte deste plano

- Nenhuma alteração no `order-mapper.ts`, `order-loader.ts` ou validador.
- Nenhuma mudança em casas decimais, parcelas, followup ou tipos de venda.
- Sem migrations: `iniflex_sandbox_logs` já existe com as colunas necessárias.

## Como usar depois de aplicado

1. Clicar em "Reenviar ao ERP" no PED-2026-0268.
2. Você (ou eu, via `supabase--read_query`) abre o registro mais recente em `iniflex_sandbox_logs` e copia o `request_payload` → cola no suporte Projedata anexado ao `p_retorno`.
3. Com o campo problemático identificado pelo Projedata, abrimos um plano específico de correção (parcela `dias=0`, formatação numérica, etc.).

## Risco

Baixo. Escrita extra em `iniflex_sandbox_logs` por pedido enviado; nenhuma mudança no payload em si.
