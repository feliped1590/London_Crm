Plano de implementação

1. Reaproveitar o cadastro de produtos em um componente compartilhado
- Extrair o formulário/modal atual de `src/pages/Products.tsx` para um componente reutilizável, mantendo as mesmas regras já existentes:
  - defaults de Unidade = Milheiro e Tipo = Produto Acabado;
  - preenchimento automático de NCM por grupo;
  - validações de SKU, ERP, dimensões, duplicidade e produtos similares;
  - edição, criação e duplicação quando usado na tela de Produtos.
- A página de Produtos continuará funcionando visualmente como hoje, mas o formulário poderá ser aberto também por outras telas.

2. Criar item diretamente pela aba “Itens vinculados” do cliente
- Em `CustomerProductsTab`, adicionar um botão “Criar item”.
- Ao clicar, abrir o mesmo formulário de cadastro de itens.
- Depois que o item for criado com sucesso, criar automaticamente o vínculo entre o cliente atual e o novo item em `company_products`.
- Atualizar a lista da aba “Itens vinculados” imediatamente, para o item recém-criado aparecer sem precisar recarregar a página.
- Respeitar permissões atuais: o botão só aparece quando o usuário pode editar o cliente e também tem permissão para criar produtos.

3. Adicionar aba “Clientes vinculados” no formulário de item
- No formulário de cadastro/edição de produtos, adicionar uma nova aba chamada “Clientes vinculados”.
- No modo edição de produto, essa aba permitirá:
  - buscar clientes por razão social, nome fantasia ou CNPJ;
  - selecionar o cliente;
  - escolher o tipo de vínculo: Interesse, Homologado, Recorrente, Estratégico ou Bloqueado;
  - adicionar observações;
  - marcar como preferencial;
  - vincular o cliente ao produto;
  - listar os clientes já vinculados ao produto;
  - arquivar/remover vínculo quando permitido.
- No modo criação de produto, a aba ficará disponível com uma mensagem simples explicando que os clientes poderão ser vinculados após salvar o item. Se o formulário tiver sido aberto a partir do cadastro do cliente, o vínculo automático com aquele cliente será feito após salvar.

4. Garantir reflexo nos dois sentidos
- O vínculo continuará usando a tabela existente `company_products`, que já representa a relação cliente-produto.
- Quando vincular um produto dentro do cliente, ele aparecerá na aba “Clientes vinculados” do produto.
- Quando vincular um cliente dentro do produto, ele aparecerá na aba “Itens vinculados” do cliente.
- Invalidar/atualizar os caches de consultas dos dois lados após criar ou arquivar vínculos.

Detalhes técnicos

- Não será necessário criar nova tabela: `company_products` já tem `company_id`, `product_id`, `relationship_type`, `notes`, `is_preferred`, `archived_at` e RLS.
- Criar um hook complementar, por exemplo `useProductCompanies(productId)`, espelhando o comportamento de `useCompanyProducts(companyId)`:
  - buscar vínculos ativos por `product_id` com dados do cliente;
  - buscar clientes disponíveis para vínculo;
  - inserir vínculo em `company_products`;
  - arquivar vínculo.
- Ajustar `useCompanyProducts` para expor uma função de criação de vínculo reutilizável após criação de produto, ou aceitar callback no novo componente de formulário.
- Manter a proteção de vínculo duplicado pelo índice único ativo existente em `company_products`.
- Não alterar os arquivos gerados da integração (`src/integrations/supabase/client.ts` e `types.ts`).

Resultado esperado

Fluxo cliente para item:
```text
Cliente > Itens vinculados > Criar item > Salvar produto
                                      > vínculo automático cliente-produto
                                      > item aparece em Itens vinculados
```

Fluxo item para cliente:
```text
Produto > Editar > Clientes vinculados > Selecionar cliente > Vincular
                                            > cliente aparece no produto
                                            > produto aparece no cliente
```

Arquivos principais previstos
- `src/pages/Products.tsx`: reduzir a duplicação e usar o formulário compartilhado.
- Novo componente em `src/components/products/`, por exemplo `ProductFormDialog.tsx`.
- Novo componente em `src/components/products/`, por exemplo `ProductCompaniesTab.tsx`.
- Novo hook em `src/hooks/useProductCompanies.ts`.
- Ajustes em `src/components/customer/CustomerProductsTab.tsx` para o botão “Criar item” e vínculo automático.