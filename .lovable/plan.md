Verifiquei o estado atual após a execução anterior.

Resultado da verificação:
- Clientes: foi alterado. `CompanyAuditHistory.tsx` agora busca `created_at/created_by` da empresa e injeta uma linha virtual “Cliente criado” quando não existe registro explícito no audit log.
- Pedidos: ainda não foi alterado nesta última execução. O componente `OrderHistoryTab.tsx` mostra o histórico existente, mas ainda depende do `order_audit_log`; se não houver linha “created”, ele continua mostrando vazio.
- Produtos/itens: não foi alterado. `Products.tsx` ainda não possui aba/área de histórico no diálogo do produto, nem renderização de “Produto criado”.

Plano para completar a solicitação:

1. Pedidos
   - Atualizar `src/components/orders/OrderHistoryTab.tsx` para buscar os dados básicos do pedido (`id`, `number`, `created_at`, `created_by`).
   - Se o `order_audit_log` não tiver uma entrada de criação, inserir uma entrada virtual “Pedido criado” no início cronológico do histórico.
   - Resolver o nome do usuário criador via `profiles`, igual aos demais logs.

2. Produtos / Itens
   - Criar uma visualização de histórico dentro do diálogo de edição do produto em `src/pages/Products.tsx`.
   - Adicionar uma aba “Histórico” visível ao editar produto existente.
   - Exibir no mínimo a entrada inicial “Produto criado”, usando `created_at` e `created_by` do produto, com nome do usuário quando disponível.
   - Se houver histórico fiscal/NCM disponível (`product_ncm_audit`), integrar essas alterações na mesma lista quando aplicável, mantendo a criação como evento inicial.

3. Clientes
   - Revisar o ajuste já presente em `CompanyAuditHistory.tsx` para garantir que a linha “Cliente criado” apareça corretamente com nome do usuário, data, e sem quebrar clientes sincronizados do ERP.
   - Não recriar registros no banco; manter a estratégia de entrada virtual na interface para preservar histórico sem migração desnecessária.

Detalhes técnicos:
- Não haverá alteração de esquema de banco neste plano.
- A lógica seguirá o mesmo padrão já usado no histórico do negócio/pipeline: buscar metadados do registro, resolver `created_by/changed_by` em `profiles`, e injetar uma entrada virtual apenas quando não existir evento de criação registrado.
- Arquivos previstos:
  - `src/components/customers/CompanyAuditHistory.tsx`
  - `src/components/orders/OrderHistoryTab.tsx`
  - `src/pages/Products.tsx`