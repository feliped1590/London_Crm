## Ajustes no formulário de Pedido (`src/components/orders/OrderDialog.tsx`)

### 1. Remover campo "Contato"
Tirar o bloco do select de Contato (linhas ~974-982). A grid `grid-cols-2` que hoje contém Empresa + Contato passa a ter só Empresa, em largura cheia.

### 2. "Vincular ao Negócio" e "Data de Entrega" lado a lado
Mover os dois campos para uma única linha `grid grid-cols-2 gap-4`:
- Coluna esquerda: Vincular ao Negócio (mantém o `{companyId && ...}` — quando não houver empresa selecionada, a coluna fica vazia e a Data de Entrega ocupa apenas a coluna direita).
- Coluna direita: Data de Entrega.
- O texto auxiliar "Vincular ao negócio permite que o pipeline controle..." continua abaixo do select de negócio.

### 3. Calendário fecha ao selecionar a data
Hoje o `Popover` da Data de Entrega fica aberto após escolher o dia. Ajuste:
- Tornar o Popover controlado: novo state `const [deliveryDateOpen, setDeliveryDateOpen] = useState(false)`.
- `<Popover open={deliveryDateOpen} onOpenChange={setDeliveryDateOpen}>`.
- No `Calendar.onSelect`: `(date) => { setDeliveryDate(date); setDeliveryDateOpen(false); }`.

### Arquivos afetados
- `src/components/orders/OrderDialog.tsx` (apenas)

Sem mudanças de backend, validação ou submit — `contactId` permanece no estado interno (apenas deixa de ter UI; será enviado vazio/atual valor existente sem alterar lógica).
