
Diagnóstico encontrado

- Pelo último envio capturado no preview, o backend não retornou falha para esse cliente: a chamada de reprocessamento respondeu `success: true` com status `waiting_propagation`.
- Em outras palavras: neste momento o sistema provavelmente não está “errando de novo”; a UI está mantendo um estado vermelho antigo como se ainda fosse erro.
- Hoje o painel usa `companies.integration_status` como verdade principal. Esse campo é marcado como `sync_error` quando há falha, mas não é limpo/atualizado corretamente quando a retentativa entra em `pending / waiting_propagation`.
- O modal atual também só lê `company_sync_queue.error_message`. Se a linha mais recente não tiver mensagem útil, ele cai em “Erro desconhecido”.
- Há outro ponto frágil na fila: o código assume 1 registro por empresa em `company_sync_queue`, mas a migration lida não mostra constraint única por `company_id`. Isso pode gerar leitura de linha errada ou stale.

Plano de implementação

1. Corrigir a origem do status no painel de validação
- Ajustar `IntegrationValidationPanel` para combinar:
  - `companies.integration_status`
  - último item da `company_sync_queue` (`status`, `error_message`, `next_retry_at`, `processed_at`)
- Exibir estados mais fiéis:
  - Pronto
  - Não sincronizado
  - Dados incompletos
  - Processando
  - Aguardando ERP
  - Erro técnico
- Quando houver retentativa manual bem-sucedida, o badge deve sair do vermelho imediatamente.

2. Melhorar o diagnóstico do erro
- Trocar o modal simples por um diagnóstico mais completo:
  - status real da fila
  - tentativas
  - próxima retentativa
  - mensagem técnica
  - payload enviado
  - resposta devolvida pelo ERP
- Se o caso for `waiting_propagation`, mostrar isso explicitamente em vez de “Erro desconhecido”.

3. Adicionar um simulador de payload de cliente
- Criar um `CustomerPayloadSimulator` na aba ERP, visualmente no mesmo padrão do simulador de pedidos.
- Permitir selecionar o cliente por nome/CNPJ.
- Mostrar a resolução CRM → ERP campo a campo, incluindo:
  - documento
  - `tipo_pessoa` inferido automaticamente (11 dígitos = PF, senão PJ)
  - cidade ERP
  - usuário ERP
  - vendedor ERP
  - empresa emissora
  - endereço / número / bairro / CEP
- Exibir:
  - erros bloqueantes
  - envelope completo `IMP_CLIENTE_V3`
  - JSON interno deserializado
  - botões de copiar

4. Garantir que o simulador use a mesma lógica do envio real
- Em vez de duplicar regras soltas no front, criar uma simulação baseada na mesma lógica do backend atual de clientes.
- Reaproveitar o mapper/validator existente:
  - `company-mapper.ts`
  - `company-validator.ts`
- Assim, o que aparecer no simulador será o mesmo que seria enviado de verdade.

5. Endurecer a fila de sincronização
- Criar migration para:
  - deduplicar registros antigos da `company_sync_queue`
  - adicionar unicidade por `company_id`
- Ajustar `process-company-sync` para:
  - limpar estado antigo ao reprocessar
  - não deixar `integration_status = sync_error` quando o cliente estiver só aguardando propagação
  - registrar sempre payload/resposta/erro de forma consistente para debug

6. Validação final
- Testar com o cliente do print para confirmar:
  - badge muda de “Erro” para “Aguardando ERP” ou “Processando” quando aplicável
  - o modal mostra causa real
  - o novo simulador aponta exatamente qual campo/mapeamento bloqueia o envio quando houver falha real

Detalhes técnicos

- Arquivos mais prováveis:
  - `src/components/integrations/IntegrationValidationPanel.tsx`
  - `src/components/integrations/CustomerPayloadSimulator.tsx` (novo)
  - `src/pages/Integrations.tsx`
  - `supabase/functions/process-company-sync/index.ts`
  - `supabase/functions/_shared/projedata/company-mapper.ts`
  - `supabase/functions/_shared/projedata/company-validator.ts`
  - nova migration em `supabase/migrations/`
- Observação importante: hoje o problema mais visível parece ser de diagnóstico/estado stale da UI, não necessariamente de rejeição atual do ERP.
