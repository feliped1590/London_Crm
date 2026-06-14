## Objetivo

Impedir que o campo **Inscrição Estadual** (IE) aceite espaços, pontos, traços ou qualquer caractere não numérico — inclusive ao colar valores copiados de outros sistemas. Isso evita falhas na sincronização com o ERP, que exige apenas dígitos.

## Comportamento esperado

- Digitação: caracteres não numéricos são ignorados em tempo real.
- Colagem (Ctrl+V): o valor colado é limpo automaticamente, mantendo apenas os dígitos. Ex.: `ISE 123.456.789-0` → `1234567890`.
- Limite: 14 dígitos (máximo prático de IE no Brasil).
- Fallback `ISENTO` (aplicado no submit em `CustomerNew` quando o campo está vazio) continua funcionando — a limpeza só atua sobre o que o usuário digita/cola.

## Escopo (somente frontend)

Dois pontos de entrada do campo:

1. `**src/pages/CustomerNew.tsx**` (linha ~707) — Input no cadastro novo.
2. `**src/components/customer/CustomerOverviewTab.tsx**` (linha ~193) — Input na edição do cliente.

Em ambos, substituir o `onChange` atual por uma versão que aplica `value.replace(/\D/g, '').slice(0, 14)` antes de atualizar o estado. Isso cobre digitação e colagem (o evento `onChange` dispara após o paste).

Adicionar também `inputMode="numeric"` e `maxLength={14}` para melhor UX em mobile e feedback visual no desktop.

## Fora de escopo

- Backend / edge functions / validador — já tratam IE como string e não exigem alteração; a limpeza no frontend é suficiente para garantir que nada "sujo" chegue ao banco.
- Importações em massa (`ImportCompanies`, `enrich-companies-batch`) — fluxo separado, com sua própria normalização.
- Campo IE de Carriers / outros cadastros — não mencionados no pedido.

## Validação

- 1440x900, abrir cliente existente, colar `ISE 123.456.789-0` no campo IE → deve aparecer `1234567890`.
- Digitar letras/símbolos → nada é inserido.
- Salvar e confirmar que o valor persistido contém apenas dígitos.