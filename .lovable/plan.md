Plano para alinhar as observações dos itens do pedido ao payload `IMP_PEDIDOS` / `IMP_PEDIDO_V3`:

1. Banco de dados
   - Adicionar em `order_items` dois campos por item:
     - `observations`: observação geral do item.
     - `observations_pcp`: observação do item direcionada à produção/PCP.
   - Usar campos texto opcionais, para não quebrar pedidos existentes.

2. Formulário do pedido no CRM
   - Ao adicionar um produto ao pedido, o item já nasce com os dois campos vazios.
   - No modal “Detalhes do Item”, exibir dois campos separados:
     - “Observação do item”
     - “Observação PCP / Produção”
   - Salvar essas observações individualmente em cada item.
   - Ao editar pedido existente, carregar esses campos de `order_items`.
   - Ao salvar/criar pedido, persistir os dois campos em cada item.

3. Validação e segurança de entrada
   - Validar no frontend tamanho máximo e normalização das observações antes de salvar.
   - Limitar cada observação a um tamanho seguro, por exemplo 1000 caracteres.
   - Não enviar HTML ou conteúdo sem limpeza: armazenar como texto simples.

4. Integração ERP
   - Ajustar o carregamento dos itens para trazer `observations` e `observations_pcp`.
   - Ajustar o payload para enviar:
     - `observacao`: vindo de `order_items.observations`.
     - `observacao_pcp`: vindo de `order_items.observations_pcp`.
   - Remover o uso incorreto da descrição do item como observação geral do payload.
   - Manter a descrição do produto apenas como descrição interna do item, não como observação enviada ao ERP.

5. Compatibilidade
   - Pedidos antigos continuarão abrindo normalmente com observações vazias nos itens.
   - A observação geral do pedido (`orders.observations`) pode continuar existindo para observações do pedido como um todo, mas não será usada para preencher observações específicas de item.