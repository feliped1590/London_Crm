## Objetivo

Tornar os campos estruturais do produto (tipo, família, grupo, subgrupo, classe, dimensões e nome do impresso) editáveis no formulário de edição **somente enquanto o produto ainda não tiver `erp_product_code` preenchido**. Ao salvar alterações que mudem o SKU, abrir modal de confirmação com três caminhos: **Sim, alterar SKU** / **Não, cancelar** / **Duplicar item**.

## Regras de negócio

1. **Travamento por ERP**: se `erp_product_code` está preenchido, o comportamento atual permanece — todos os campos estruturais ficam `disabled` e o banner "estrutura não pode ser alterada" continua. A justificativa exibida muda para deixar claro: "Produto já sincronizado com o ERP".
2. **Produto ainda não no ERP** (`erp_product_code` nulo): os campos estruturais ficam editáveis.
3. Ao clicar em **Salvar**, comparar valores atuais vs. originais. Se algum campo estrutural mudou (ou seja, o SKU recomputado é diferente do atual), interromper o submit e abrir o `ConfirmStructuralChangeDialog`.
4. O modal mostra: SKU atual → SKU novo (preview), descrição atual → nova, e os 3 botões:
   - **Sim, alterar SKU** → prossegue com o `UPDATE`. SKU/`sku_unique`/`structure_hash`/`erp_versao` são regerados pelos triggers do banco.
   - **Não, cancelar** → fecha o modal, mantém o formulário aberto com as edições, nada é persistido.
   - **Duplicar item** → fecha o modal de edição e chama o fluxo de duplicação atual (mesmo handler do botão "Duplicar Produto" da lista), pré-preenchido com os novos valores.
5. Pedidos históricos: **fora de escopo nesta entrega**. Snapshots de `order_items` já congelam SKU/descrição, então pedidos antigos seguem inalterados. (Sem mudança de comportamento.)

## Mudança no banco

O trigger `protect_product_structure` hoje bloqueia qualquer alteração estrutural feita por usuário (origem `CRM`). Substituir por:

```text
IF origem_alteracao IN ('ERP','SYNC') THEN RETURN NEW;
IF OLD.erp_product_code IS NOT NULL AND OLD.erp_product_code <> ''
   AND (campos estruturais mudaram) THEN
     RAISE EXCEPTION 'Produto já sincronizado com o ERP não pode ter campos estruturais alterados. Utilize Duplicar Produto.';
END IF;
RETURN NEW;
```

Ou seja: a proteção passa a depender de **estar sincronizado com o ERP**, não apenas de ser um UPDATE.

Também é preciso garantir que `sku_unique` seja **recomputado quando o `sku` muda em UPDATE**. Hoje a função `generate_sku_unique` só age em INSERT ou quando `sku_unique IS NULL`. Ajustar para também regerar quando `NEW.sku IS DISTINCT FROM OLD.sku` (mantendo o mesmo algoritmo de sufixo `-NNN`).

Os triggers de `structure_hash` e `erp_versao` (já existentes em BEFORE INSERT OR UPDATE) continuam funcionando sem alteração.

## Mudanças no frontend (`src/pages/Products.tsx`)

- Substituir todos os `disabled={isEditing}` dos campos estruturais por `disabled={isEditing && hasErpCode}` onde `hasErpCode = !!editingProduct?.erp_product_code`.
- Atualizar o banner condicional (linhas ~1291–1297): só exibir quando `hasErpCode` for verdadeiro; texto novo deixando claro que o bloqueio é por já estar no ERP.
- No `onSubmit` do update: calcular `newSku` via a função já existente de recálculo (linha ~372) e comparar com `editingProduct.sku`. Se diferentes, abrir o novo dialog em vez de chamar `updateMutation`.
- Tratar a mensagem de erro `'Campos estruturais não podem ser alterados'` (linha ~342) → texto novo alinhado à nova regra (ERP).

## Novo componente

`src/components/products/ConfirmStructuralChangeDialog.tsx` — AlertDialog com:
- Resumo "De → Para" de SKU e descrição compilada.
- Lista dos campos estruturais que mudaram.
- Três ações: `onConfirm`, `onCancel`, `onDuplicate`.

## Memória do projeto

Atualizar dois pontos no `mem://index.md` (Core) e a memória detalhada `mem://features/product-structural-immutability-and-sku-architecture`:

- Core: "Product tech fields & dimensions are immutable" → **"Product tech fields & dimensions are immutable once `erp_product_code` is set. While not yet synced to ERP, edits are allowed with explicit SKU-change confirmation."**
- Memória detalhada: descrever o novo modal e o gatilho condicional ao `erp_product_code`.

## Validação após implementar

1. Editar um produto **sem** `erp_product_code`, mudar largura → modal abre, mostra novo SKU, "Sim, alterar SKU" persiste e a lista mostra o novo SKU.
2. Mesmo produto, mudar só nome do impresso (não muda SKU) → salva direto sem modal.
3. Editar um produto **com** `erp_product_code` → campos estruturais continuam `disabled`, banner exibido.
4. Tentar via SQL um UPDATE estrutural num produto com `erp_product_code` → trigger lança a nova mensagem.
5. Confirmar que `sku_unique` foi regerado e não colide com produtos existentes que compartilham o novo `sku`.

## Fora de escopo

- Recalcular pedidos/propostas históricos com o novo SKU.
- Re-sincronizar com ERP produtos cujo SKU mudou (não se aplica, regra impede a edição quando há ERP).
- Auditoria/log específico da mudança de SKU (pode entrar numa etapa futura via `audit_logs`).
