## Objetivo

Trocar o iframe atual por um **formulário dedicado** que carrega apenas os campos editáveis do cliente, exibido no painel lateral (Sheet) sem chrome do CRM (sem sidebar, header, tabs ou botões de ação extras).

## Escopo (confirmado)

Campos exibidos no Sheet:

**Informações do Cliente**
- Razão Social, Nome Fantasia, CNPJ/CPF, Inscrição Estadual (+ toggle Isento)
- Código ERP, Banco Padrão ERP, Contribuinte de IPI (switch)
- Setor, Segmento, Funcionários, Telefone, Email, Website

**Logística Padrão**
- Transportadora padrão (default_carrier_id)
- Tipo de Frete padrão (default_freight_type: CIF/FOB/REDESPACHO)

**Endereço**
- CEP, Logradouro, Número, Complemento, Bairro
- Cidade/UF (via `CityStateSelect` já existente)

Fora de escopo: classificação avançada, owner/vendedor, custom fields, grupo econômico, contatos, anexos, revisão 90d, transferência, enriquecimento, aprovações, sync ERP manual. Esses continuam acessíveis pelo botão "Abrir em nova aba" → `/customers/:id`.

## Arquitetura

### Novo componente: `src/components/orders/CompanyQuickEditForm.tsx`
- Props: `companyId: string`, `onSaved?: () => void`, `onCancel?: () => void`.
- Carrega a empresa via React Query (`['company-quick-edit', companyId]`).
- Estado local de formulário (`useState`) hidratado do registro.
- Reusa lógica de mutation diretamente em `supabase.from('companies').update(...)` — mesmo padrão do `updateCompanyMutation` em `useCustomerDetail`, mas isolado para não arrastar dependências do hook completo (que carrega contatos, deals, group, etc.).
- Validações mínimas iguais às do `CustomerDetail.handleSaveCompany`: Razão Social, CNPJ/CPF e Telefone obrigatórios; CNPJ/CPF normalizado via `cleanDocument`.
- Loading skeleton enquanto carrega; erro com retry.
- Footer fixo: `Cancelar` / `Salvar`.

### Refatorar `src/components/orders/InlineCustomerEditSheet.tsx`
- Remover iframe e estado `loaded`.
- Sheet mantém: header "Editar cliente", link "Abrir em nova aba" (apontando para `/customers/:id`).
- Corpo passa a renderizar `<CompanyQuickEditForm companyId={...} onSaved={...} onCancel={...} />`.
- Largura reduzida (`sm:max-w-[720px]` em vez de 1100, suficiente para os 3 blocos em grid 2 colunas).
- Ao `onSaved`: invalidar queries (`order-company`, `companies`, `company`, `customer-detail`) e fechar Sheet.
- Ao `onCancel`: apenas fechar.

### `OrderDialog.tsx`
- Nenhuma mudança extra além das já feitas (botão "Editar cliente" + state `customerEditOpen`).

## Detalhes técnicos relevantes

- **Tipo do form**: shape leve (Partial<Company> mais os campos de endereço/logística). Não usar `any` — derivar de `Tables<'companies'>` do client gerado.
- **Switch "Isento"** controla `ie_isento`; quando true, IE é desabilitada e enviada como `'ISENTO'` (mesmo comportamento atual do CustomerDetail).
- **Telefone** sem máscara, normalizado via `cleanDocument`/regex de dígitos para persistência consistente com `CustomerDetail`.
- **`CityStateSelect`** já encapsula UF + cidade ERP — reuso direto.
- **Carriers** via `supabase.from('carriers').select('id,name').eq('active', true)`.
- **Setores / Segmentos** via `useClassificacao` (já existe).
- **Permissão de edição**: respeitar `useEffectiveCustomerAccess` ou `usePortfolioProtection` — se o usuário não puder editar a empresa, mostrar form em modo somente leitura + aviso "Sem permissão para editar este cliente".

## Arquivos impactados

- **Novo**: `src/components/orders/CompanyQuickEditForm.tsx`
- **Editado**: `src/components/orders/InlineCustomerEditSheet.tsx` (remove iframe, renderiza form)
- Nenhuma migration de banco. Nenhuma alteração em RLS.

## Riscos

1. **Divergência de validação** com `CustomerDetail` (Razão/CNPJ/Tel obrigatórios + normalização). Mitigação: copiar exatamente as mesmas regras.
2. **Empresa vinda do ERP** com campos read-only: hoje `CustomerDetail` permite editar livremente; manter mesmo comportamento. Apenas `erp_status` e similares ficam ocultos.
3. **Permissão**: usuário sem permissão poderia tentar salvar — bloquear no client (botão disabled) e o RLS já bloqueia no server.
4. **Race com rascunho do pedido**: o draft do OrderDialog continua intacto, pois o pedido permanece montado por trás.

## Testes manuais

1. Abrir novo pedido → selecionar cliente → "Editar cliente" abre Sheet com 3 blocos preenchidos.
2. Editar Razão Social + salvar → toast sucesso → Sheet fecha → cabeçalho do pedido reflete novo nome (após invalidate).
3. Tentar salvar sem Razão Social → erro de validação inline.
4. Editar Logística Padrão (carrier + tipo de frete) → reabrir Sheet → valores persistidos.
5. Cancelar com alterações → form descarta mudanças.
6. Cliente sem permissão de edição → form em modo leitura, botão Salvar disabled.
7. "Abrir em nova aba" continua funcional para acessar o cadastro completo.
8. Rascunho do pedido preservado durante todo o fluxo.

## Não fazer agora

- Editar contatos no Sheet.
- Trazer abas do CustomerDetail.
- Mudar layout/UX de `/customers/:id`.
- Refatorar `useCustomerDetail`.