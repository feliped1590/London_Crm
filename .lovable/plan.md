Diagnóstico encontrado:

- A delegação Maria Antonia → Fernanda Massi existe no banco, está ativa e tem todas as permissões marcadas.
- A regra de backend para empresas está correta quando usa o `sales_rep_id` da Fernanda: Maria tem permissão real para gerenciar clientes da Fernanda.
- O problema principal está no frontend: a tela de detalhe do cliente calcula `canEdit` somente por acesso direto ao vendedor (`user_sales_reps`) ou admin, sem considerar `user_portfolio_delegations`.
- Por isso o botão “Editar” não aparece para Maria, mesmo com a delegação ativa.
- Também há pontos de bloqueio no atendimento/notas, pipeline e pedidos usando `usePortfolioProtection`, que hoje só considera vínculo direto com vendedor e ignora delegações.

Plano de correção:

1. Ajustar a resolução de acesso delegado no frontend
   - Reaproveitar `usePortfolioDelegations` para identificar delegações ativas da usuária logada.
   - Resolver o `sales_rep_id` do cliente para o usuário dono da carteira através de `user_sales_reps`.
   - Expor helpers como:
     - pode gerenciar empresa deste vendedor;
     - pode gerenciar contatos;
     - pode gerenciar deals/pipeline;
     - pode gerenciar pedidos.

2. Corrigir a tela de detalhe do cliente
   - Atualizar `CustomerDetail.tsx` para considerar delegação em `canEdit`.
   - Quando Maria acessar cliente da Fernanda com permissão `Empresas`, mostrar o botão “Editar”.
   - Evitar mostrar o alerta “Cliente de outro vendedor” quando houver delegação válida.
   - Manter clientes ERP como somente leitura.

3. Corrigir bloqueios de atendimento/notas
   - Atualizar `usePortfolioProtection` para não bloquear usuário delegado.
   - Assim Maria poderá registrar atendimento/notas em clientes da Fernanda quando a delegação permitir interação operacional.

4. Corrigir ações relacionadas no detalhe do cliente
   - Passar permissões efetivas para abas de contatos, negócios e pedidos.
   - Exibir “Novo Contato”, “Novo Negócio” e “Novo Pedido” somente quando houver permissão direta, admin ou delegação correspondente.
   - Manter o backend como camada final de segurança.

5. Validar com o caso real
   - Confirmar no código que Maria + cliente com `sales_rep_id` da Fernanda resulta em:
     - botão “Editar” visível;
     - notas/atendimento desbloqueados;
     - criação/edição operacional permitida conforme permissões da delegação.

Não pretendo alterar o banco agora, porque a delegação e as regras de backend já estão funcionando para esse vínculo; a falha é a interface não considerar a delegação ao decidir o que mostrar ou bloquear.