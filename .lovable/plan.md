## Mudanças no `OrderDialog`

### 1. Logística — manter apenas "Tipo de Frete"
No formulário de criação/edição de Pedido, a seção LOGÍSTICA (`DocumentLogisticsSection`) hoje exibe Transportadora, Tipo de Frete, Endereço de Entrega e Contato. Como a API do ERP não recebe transportadora nem endereço de entrega, esses campos não fazem sentido aqui.

- Substituir o uso de `DocumentLogisticsSection` em `src/components/orders/OrderDialog.tsx` (linhas 1222–1228) por um bloco simples contendo **somente** o select "Tipo de Frete" (CIF / FOB / REDESPACHO / etc.), reaproveitando o estado `freightType` / `setFreightType` já existente.
- Limpar/zerar no submit os campos não usados: `carrierId = null`, `deliverySameAsCompany = true`, `deliveryFields = EMPTY_DELIVERY_FIELDS`, para não persistir lixo no banco.
- Remover a validação "Transportadora obrigatória quando frete é CIF/FOB" (linha 936-938), já que transportadora deixa de existir no formulário.
- Manter `DocumentLogisticsSection` como está — outros documentos (propostas, etc.) continuam usando a versão completa. A simplificação fica isolada no `OrderDialog`.

### 2. Botão "Cancelar" não fecha o modal
Em `src/components/orders/OrderDialog.tsx` linha 1333 o botão chama `handleDialogClose(true)`. O parâmetro `true` significa "abrir o dialog", então o handler retorna sem fazer nada (linhas 913-917). Por isso o clique não faz efeito.

- Trocar `onClick={() => handleDialogClose(true)}` por `onClick={() => handleDialogClose(false)}`, que é exatamente o mesmo caminho disparado pelo "X" de fechar (`onOpenChange`), incluindo o alerta de alterações não salvas quando aplicável.

### Arquivos afetados
- `src/components/orders/OrderDialog.tsx` (apenas)
