Identifiquei o motivo principal: a tabela de apoio dos “recentes” (`user_recent_interactions`) não existe no backend atual. Como a listagem só exibe os recentes quando há registros nessa tabela, nada aparece mesmo após abrir/alterar clientes.

Também há um ajuste complementar importante: a listagem de clientes usa uma função de busca paginada que não retorna `tenant_id`, então a gravação pode depender de uma consulta extra ou falhar silenciosamente em alguns fluxos.

Plano de correção:

1. Criar/aplicar a estrutura de banco dos recentes
   - Criar a tabela `user_recent_interactions` no backend.
   - Campos principais: usuário, tenant, tipo da entidade (`company`/`product`), id da entidade, tipo de interação, data da última interação e contador.
   - Criar índice para buscar rapidamente os últimos 5 por usuário e tipo.

2. Corrigir as permissões de acesso
   - Ativar segurança por linha na tabela.
   - Permitir que cada usuário veja, insira e atualize apenas os próprios recentes.
   - Respeitar o tenant do usuário, sem abrir dados entre empresas/tenants.

3. Garantir que clientes gravem corretamente
   - Ajustar a função/listagem de clientes para retornar `tenant_id`, ou garantir que o hook resolva o tenant de forma confiável antes de gravar.
   - Manter gravação ao abrir/consultar cliente e ao salvar alterações.

4. Melhorar robustez do hook de recentes
   - Evitar falha silenciosa quando a gravação não acontecer.
   - Invalidar a consulta correta após gravar, para o bloco “Clientes recentes” aparecer/atualizar ao voltar para a listagem.
   - Manter o limite de 5 itens mais recentes.

5. Validar o fluxo esperado
   - Abrir um cliente na listagem.
   - Salvar alteração no cliente.
   - Voltar para `/customers` e confirmar que “Clientes recentes” aparece.
   - Repetir o mesmo comportamento para produtos, já que usam a mesma estrutura.