/**
 * Feature flags do projeto.
 *
 * WHATSAPP_ENABLED: quando `false`, todo o módulo de WhatsApp é desativado
 * (rota, sidebar, queries, realtime, polling). Decisão tomada na auditoria
 * de performance 2026-05 para reduzir Disk IO e processamento. Reativar
 * trocando para `true` e nada mais precisa ser alterado.
 */
export const WHATSAPP_ENABLED = false;
