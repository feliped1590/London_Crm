Plano de implementação:

1. Simplificar as abas do cadastro de produtos
- Remover a aba “ERP Projedata” do modal de produto.
- Remover a aba “Fiscal / NCM” do modal.
- Manter a aba “Histórico” apenas quando estiver editando produto, como já acontece hoje.
- A estrutura final do modal ficará:
  - Novo produto: somente “Geral”
  - Editar produto: “Geral” + “Histórico”

2. Mover o Código ERP para a aba Geral
- Levar o campo “Código ERP” para o formulário geral.
- Mantê-lo obrigatório, como já é hoje.
- Ajustar a validação para, se faltar Código ERP, manter o usuário na aba “Geral” em vez de tentar abrir a aba ERP removida.
- Não exibir no formulário geral os demais campos da antiga aba ERP: Grupo ERP, Subgrupo ERP, Tipo Ficha, Empresa ERP, Roteiro, Situação e Detalhes.

3. Remover a poluição fiscal visual
- Remover o conteúdo da antiga aba Fiscal.
- Manter o seletor de NCM onde ele já está hoje, no topo da aba Geral.
- Remover do formulário a exibição do card de sugestões fiscais, já que a ideia é manter somente NCM como informação fiscal visível no cadastro do item.
- Preservar internamente os campos fiscais existentes para não quebrar dados antigos, mas eles não ficarão mais expostos no cadastro do produto.

4. NCM automático por grupo
- Ao selecionar um grupo no cadastro de produto novo, o sistema analisará a descrição/label do grupo:
  - se contiver “saco”, preencher NCM `39232990` automaticamente;
  - se contiver “bobina”, preencher NCM `39173290` automaticamente.
- Já confirmei que os dois NCMs existem na base.
- O preenchimento será automático e continuará editável, ou seja, o usuário poderá trocar manualmente se algum produto específico precisar de outro NCM.
- Para evitar sobrescrever escolhas manuais, a automação será aplicada principalmente quando o NCM estiver vazio ou quando o usuário trocar o grupo durante o cadastro de um item novo.

5. Defaults para novos produtos
- Unidade padrão para novo produto: `Milheiro` (`value = mil`).
- Tipo padrão para novo produto: `Produto Acabado` (`value = PA`).
- Já confirmei que ambos existem nas tabelas de cadastro básico.
- O reset do formulário e abertura de novo produto também passarão a usar esses defaults.
- Ao duplicar produto, manterei o comportamento atual de herdar unidade/tipo do produto original, porque duplicação normalmente deve preservar a estrutura original.

6. Ajustes técnicos esperados
- A alteração principal será em `src/pages/Products.tsx`.
- O import do card fiscal deixará de ser usado e será removido.
- A lógica de `TabsList` será ajustada para não deixar abas vazias/inexistentes.
- Será criada uma função auxiliar para localizar defaults de lookup por `value`/`label`, sem hardcode de UUID.
- Será criada uma função auxiliar para aplicar NCM automático a partir do grupo selecionado.
- Não será necessário alterar estrutura do banco de dados.

Resultado esperado:
- Cadastro de produto mais limpo.
- Código ERP visível na aba Geral.
- NCM permanece acessível na aba Geral.
- Sem abas ERP e Fiscal.
- Novo produto já abre com Unidade = Milheiro e Tipo = Produto Acabado.
- Grupo “saco” e “bobina” sugerem/preenchem automaticamente o NCM correto.