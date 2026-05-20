## Problema

A coluna `tasks.due_date` é `timestamp with time zone`. Quando o usuário escolhe "25/05/2026" no input, o valor `2026-05-25` é gravado como `2026-05-25 00:00:00 UTC`. No fuso de Brasília (UTC-3) isso vira **24/05 às 21:00**, e o calendário (FullCalendar) renderiza no dia 24. O mesmo ocorre em qualquer leitura que use `new Date(due_date)` ou `parseISO`.

A correção precisa ser feita tanto na gravação (para não depender do fuso de quem grava) quanto na leitura (para não depender do fuso de quem lê). A ideia é tratar `due_date` como **data pura**, normalizando para o meio-dia UTC ao salvar e usando apenas a parte `YYYY-MM-DD` ao exibir.

## Mudanças

### 1. `src/pages/Tasks.tsx`
- **`handleSubmit`**: ao montar `sanitizedData.due_date`, se houver data, enviar `${formData.due_date}T12:00:00Z` (meio-dia UTC garante que o dia não muda em nenhum fuso entre -11 e +11).
- **`handleCreateFromCalendar`**: substituir `date.toISOString().split('T')[0]` por `format(date, 'yyyy-MM-dd')` (date-fns) para usar a data local do clique, evitando shift quando o clique ocorre à noite.
- **Cálculo de "atrasada" na lista** (linha ~660): comparar apenas as datas (`yyyy-MM-dd`) em vez de `new Date(task.due_date) < new Date()`.

### 2. `src/components/tasks/TaskCalendar.tsx`
- **Montagem do `startStr`** (linha 111): usar `task.due_date.split('T')[0]` como base, sempre. Quando houver `due_time`, concatenar; quando não, passar somente `YYYY-MM-DD` (FullCalendar trata como all-day local, sem shift).
- **`isOverdue`** (linha 99): comparar `due_date.split('T')[0]` com `format(new Date(), 'yyyy-MM-dd')` em vez de `parseISO` + `isBefore(..., startOfToday())`.
- **`handleEventDrop`**: enviar `format(event.start, 'yyyy-MM-dd')` como `newDate` (em vez de `event.start.toISOString()`), e a mutation `rescheduleTask` recebe a data pura.

### 3. `src/hooks/useTaskCalendar.ts`
- **`rescheduleTask.mutationFn`**: ao gravar `due_date`, aplicar a mesma normalização `${newDate}T12:00:00Z`.
- **Range da query** (`gte/lte` em `due_date`): manter como está — `rangeStart`/`rangeEnd` já cobrem um mês antes/depois, então a margem de 3h não causa perda de eventos.

## Por que meio-dia UTC

Garante que, ao converter para qualquer fuso entre UTC-11 e UTC+11, o componente "dia" do timestamp continua sendo o mesmo escolhido pelo usuário. É o padrão usado quando se quer armazenar uma "data civil" em coluna `timestamptz` sem migrar o schema.

## Fora de escopo

- Não migrar a coluna para `date` (impactaria outras telas e relatórios).
- Não alterar `due_time` (continua armazenado como `time` puro).
- Não mexer em outras telas que leem `due_date` fora do módulo de Tarefas neste passo — se aparecer o mesmo sintoma em Today/Dashboard, tratamos em seguida.