Você tem razão. Do jeito que está, é pior mostrar um módulo “disponível” que quebra na frente do usuário.

O erro atual foi identificado: a função de anomalias do BI está falhando no banco com:

```text
column all_anomalies.severity does not exist
```

Isso acontece porque a consulta usa `SELECT * FROM (...) all_anomalies` e depois tenta ordenar por `all_anomalies.severity`, mas as colunas internas do `UNION ALL` não receberam aliases explícitos. O banco não consegue enxergar `severity` pelo nome dentro desse bloco.

Plano para resolver definitivamente:

1. Corrigir a função de anomalias no banco
   - Recriar `get_bi_anomalies()` com nomes de coluna explícitos.
   - Trocar o `SELECT *` por uma estrutura segura com aliases como `anomaly_type`, `severity`, `title`, `affected_count`, etc.
   - Manter acesso somente para usuários autenticados.

2. Tornar o BI Avançado tolerante a falhas parciais
   - Hoje, se uma única métrica falha, o módulo inteiro cai.
   - Vou ajustar o frontend para que uma falha em “Anomalias” não derrube “Saúde do Pipeline”, “Performance de Vendedores” e demais indicadores.
   - O usuário verá os dados que carregaram e, se necessário, um aviso discreto apenas na seção com problema.

3. Revisar a lógica de estágios fechados
   - Padronizar a identificação de etapas fechadas por texto normalizado, aceitando variações como:
     - `fechado_ganho`
     - `Fechado Ganho`
     - `ganho`
     - `fechado_perdido`
     - `Fechado Perdido`
     - `perdido`
   - Isso evita que o BI trate negócios encerrados como abertos.

4. Adicionar uma proteção de produto
   - Se o BI Avançado ainda encontrar erro crítico, ele não deve exibir uma tela vermelha assustando o usuário.
   - Em vez disso, exibirá uma mensagem operacional mais limpa, por exemplo: “Algumas métricas estão temporariamente indisponíveis”.
   - O restante da tela continua utilizável.

5. Validar diretamente no banco e no app
   - Testar as 5 funções do BI:
     - `get_pipeline_health`
     - `get_seller_performance`
     - `get_bi_anomalies`
     - `get_stalled_deals_by_seller`
     - `get_conversion_by_stage`
   - Confirmar que o módulo não mostra tela de erro quando uma consulta específica falhar.

Resultado esperado:

- O BI Avançado volta a carregar dados reais.
- Um erro isolado não derruba o módulo inteiro.
- Os usuários deixam de ver uma tela vermelha como a do print.
- Se alguma métrica estiver inconsistente, o sistema degrada com segurança em vez de parecer quebrado.