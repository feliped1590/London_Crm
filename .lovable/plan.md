Plano para adicionar a função de clonar pedido nos detalhes:

1. Adicionar ação “Clonar pedido” nos detalhes do pedido
   - No modal de detalhes/edição do pedido, incluir um botão “Clonar Pedido”.
   - O botão ficará disponível para usuários com permissão de criar pedidos.
   - A ação ficará nos detalhes do pedido, próxima às ações do rodapé, sem alterar o fluxo atual de editar, salvar, bloquear ou gerar PDF.

2. Exibir confirmação antes de clonar
   - Ao clicar em “Clonar Pedido”, abrir uma mensagem de confirmação.
   - A mensagem deixará claro que será criado um novo pedido com os mesmos dados e itens do pedido atual.
   - O usuário poderá cancelar ou confirmar a clonagem.

3. Criar um novo pedido com os mesmos dados comerciais
   - Ao confirmar, o sistema criará outro pedido copiando os principais dados do pedido original:
     - cliente/contato;
     - CNPJ emissor/legal entity;
     - tipo do pedido;
     - modo de IPI;
     - data prevista de entrega;
     - observações do pedido;
     - forma e condições de pagamento;
     - transportadora, frete e endereço de entrega;
     - valores totais calculados.
   - O novo pedido será criado como um pedido novo, em status inicial `pendente`, sem vínculo com sincronização ERP e sem bloqueio.
   - O número continuará sendo gerado pelo fluxo atual do sistema, evitando duplicidade.

4. Copiar todos os itens do pedido
   - Buscar os itens do pedido original e inserir no novo pedido mantendo:
     - produto;
     - descrição;
     - quantidade;
     - preço unitário;
     - subtotal;
     - desconto;
     - IPI;
     - comissão;
     - dimensões;
     - fator/preço calculado quando aplicável;
     - observação geral do item;
     - observação PCP/produção do item;
     - ordem dos itens.
   - Os itens do novo pedido não serão bloqueados, mesmo que o pedido original esteja bloqueado.

5. Registrar e atualizar a tela
   - Registrar um histórico/auditoria no novo pedido informando que ele foi clonado a partir do pedido original.
   - Após a clonagem, atualizar a listagem de pedidos.
   - Exibir mensagem de sucesso com o número do novo pedido quando disponível.
   - Fechar o modal atual ou manter a tela atual estável sem perder dados; a prioridade será evitar alteração no pedido original.

Detalhes técnicos:
- A implementação ficará em `src/components/orders/OrderDialog.tsx`, pois é onde os detalhes do pedido e os itens já estão carregados.
- Adicionar uma prop opcional como `canClone` para o modal receber a permissão de criação a partir de `src/pages/Orders.tsx`.
- Usar `AlertDialog` já existente no componente para a confirmação.
- Criar uma mutation `cloneOrderMutation` que faz `insert` em `orders`, depois `insert` em `order_items`.
- Não copiar campos de integração como `erp_order_id`, `erp_synced_at`, fila de sincronização, lock ou status avançado.
- Invalidar queries de `orders` e `order_items` após sucesso.