## Diagnóstico rápido

A instância está saudável em CPU/memória: banco online, memória em ~58%, disco de dados em ~11%, conexões moderadas. O alerta da tela é especificamente **Disk read/write I/O budget**, não falta de espaço nem necessariamente CPU.

O que apareceu agora:
- Não há query longa presa rodando.
- O tráfego de Edge Functions está praticamente zerado na última hora.
- Os crons de ERP ainda rodam a cada 2 minutos, mas em geral retornam rápido.
- O maior consumo histórico de leitura está vindo de `companies`, `contacts`, filas de sync e tabelas pequenas com varreduras repetidas.
- `pg_stat_statements` não está habilitado, então ainda não temos o ranking exato das queries por I/O.

Isso pode ser uma combinação de:
1. gráfico/orçamento de I/O ainda refletindo janela acumulada após o pico anterior;
2. muitas queries curtas de frontend/realtime, não queries longas;
3. crons/checks de fila e realtime ainda gerando pequenas leituras contínuas;
4. falta de visibilidade fina porque `pg_stat_statements` ainda não existe.

## Plano emergencial

### 1. Medir delta real em janela curta
Criar uma leitura comparativa de estatísticas por tabela para diferenciar contador histórico de consumo atual:
- leitura atual de `pg_stat_user_tables`, `pg_statio_user_tables` e saúde do banco;
- aguardar alguns minutos;
- comparar crescimento de leituras/blocos por tabela.

Objetivo: confirmar se o 100% é alerta atrasado/acumulado ou se ainda tem carga ativa.

### 2. Habilitar observabilidade de queries
Aplicar uma migração para habilitar `pg_stat_statements` e, se necessário, uma função segura de leitura administrativa.

Objetivo: listar as queries que mais fazem leitura de disco, em vez de inferir só pela tabela.

### 3. Modo contenção temporária dos jobs de sync
Enquanto estabiliza, reduzir ainda mais a carga automática:
- pausar temporariamente os dispatchers de sync de ERP, ou mover de 2 minutos para 10/15 minutos;
- manter rotinas críticas leves, como limpeza de sessão, se não forem culpadas.

Objetivo: tirar pressão contínua do disco enquanto monitoramos.

### 4. Cortar consumo residual de WhatsApp no banco
Como o módulo ainda não está em uso:
- remover tabelas/canais de WhatsApp de qualquer publicação realtime se existirem;
- manter frontend já bloqueado pelo feature flag;
- confirmar se não há webhook/função ativa ou request recente relacionado a WhatsApp.

Objetivo: garantir consumo zero do módulo.

### 5. Otimizar `companies` e busca/filtros
A tabela `companies` ainda é o maior ponto histórico de leitura. Revisar consultas da tela de clientes/prospecção para:
- evitar `ILIKE '%termo%'` sem índice adequado;
- adicionar índice trigram para busca textual se necessário;
- limitar paginação e agregações automáticas;
- confirmar se RPCs de dashboard não estão rodando fora da aba Relatórios.

Objetivo: reduzir o principal consumidor real quando usuários navegam no CRM.

### 6. Monitorar e decidir sobre custo
Depois da contenção:
- acompanhar o gráfico por 30–60 min;
- se cair, o problema era carga/queries e não precisa subir mais;
- se continuar em 100% com pouca carga ativa, tratar como janela de orçamento ainda saturada ou necessidade de tier com mais I/O.

Sobre custo: a tela de upgrade da Lovable Cloud é a fonte final de preço por tier. Como você já saiu de tiny para mini, eu recomendo **não subir novamente agora** antes de medir o delta real por pelo menos 30–60 minutos após os cortes, porque a métrica pode demorar a refletir alívio.

## Próxima ação ao aprovar

Vou executar em modo seguro:
1. medir delta real de I/O;
2. habilitar `pg_stat_statements`;
3. pausar ou espaçar crons de sync temporariamente;
4. confirmar zero consumo de WhatsApp;
5. voltar com um resumo objetivo: “continua consumindo agora” vs “é resíduo da janela do gráfico”.