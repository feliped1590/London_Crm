Plano aprovado para implementar a melhoria no pedido:

1. Ajustar a busca de produtos do pedido
   - Quando houver cliente selecionado no pedido, o campo “Adicionar Produto” passará a carregar primeiro os produtos já vinculados àquele cliente.
   - A listagem principal ficará focada nesses produtos vinculados, em vez de abrir apenas a lista geral de produtos.
   - Se o usuário digitar no campo de busca, a busca será aplicada dentro dos produtos vinculados ao cliente.

2. Manter acesso à busca geral
   - O botão de pesquisa avançada continuará disponível para procurar qualquer produto ativo fora da carteira/vínculo do cliente.
   - Assim o fluxo principal fica rápido para produtos recorrentes/homologados do cliente, mas ainda permite adicionar um produto novo quando necessário.

3. Melhorar a identificação visual
   - No seletor do pedido, os produtos vinculados serão exibidos com SKU e nome, e poderão trazer informações auxiliares como tipo de vínculo/preferencial quando disponíveis.
   - A mensagem vazia será contextualizada: se o cliente não tiver produtos vinculados, indicar que não há produtos vinculados e orientar a usar a pesquisa avançada.

4. Garantir cálculo e persistência iguais ao fluxo atual
   - Ao selecionar um produto vinculado, o pedido continuará usando a mesma regra atual de preço, tabela de preço, fator KG, IPI e subtotal.
   - O item adicionado continuará abrindo com as observações individuais do item disponíveis, conforme a última evolução.

Detalhes técnicos:
- Alterar `OrderDialog.tsx` para buscar `company_products` quando `companyId` estiver preenchido.
- A consulta deve trazer os dados completos do produto necessários para `resolveProductPricing`: `id`, `sku`, `name`, `tipo_id`, `unit_price`, dimensões, `aliquota_ipi` e `fator_kg`.
- Substituir as opções do `SearchableSelect` do pedido por uma lista derivada dos vínculos do cliente quando houver cliente selecionado.
- Manter `useProductSimpleSearch` como fallback apenas quando não houver cliente selecionado ou quando for necessário buscar geral.
- Validar que `addProductById` consiga localizar o produto tanto na lista vinculada quanto na lista geral/avançada.