# Memory: features/reforma-tributaria-2026

## Módulo Fiscal: Adequação à Reforma Tributária EC 132/2023

### Visão Geral

O sistema foi preparado para o novo modelo tributário brasileiro (IVA Dual) com suporte à coexistência híbrida durante o período de transição 2026-2033. A implementação segue os conceitos oficiais da reforma, evitando dependência conceitual de CST para os novos tributos.

### Conceitos-Chave Implementados

1. **Regime de Incidência (substitui CST)**: normal, aliquota_zero, monofasico, isento, imune, suspensao, diferimento, cashback, nao_incidencia
2. **Tipo de Geração de Crédito**: integral, parcial, vedado, presumido
3. **IBS como Imposto Único**: Alíquota única com repartição interna (65% estadual / 35% municipal)
4. **Crédito Presumido Condicional**: Aplicação por adquirente, operação, NCM ou região
5. **Split Payment**: Estados operacionais (estimado, retido, liquidado, ajustado, estornado)
6. **Imposto Seletivo por Categoria**: Não depende exclusivamente de NCM

### Estrutura de Dados

| Tabela | Propósito |
|--------|-----------|
| `transicao_tributaria_parametros` | Percentuais de transição versionados por ano |
| `credito_presumido_regras` | Crédito presumido com aplicação condicional |
| `split_payment_registros` | Registro operacional de retenções |
| `cadastro_imposto_seletivo` | IS com categorias e exceções legais |
| `regras_tributacao` (extensão) | Campos CBS/IBS/IS usando regime de incidência |

### Tipos TypeScript

- `src/types/fiscal-reforma.ts`: Tipos completos para o novo modelo
- `src/types/fiscal-extended.ts`: Extensão com CBS/IBS/IS no enum TributoAfetado

### Hooks Disponíveis

- `useTransicaoTributaria`: Parâmetros de transição e determinação de modelo
- `useCreditoPresumido`: Gestão de regras de crédito presumido
- `useImpostoSeletivo`: Cadastro e verificação de aplicabilidade do IS

### Cronograma de Transição (Parametrizado em Tabela)

Os percentuais de transição são armazenados na tabela `transicao_tributaria_parametros`, não hardcoded no código, permitindo ajustes conforme regulamentação.

### Próximos Passos

- Atualizar Edge Function `calcular-tributacao` com lógica híbrida
- Criar interface de gestão na aba Fiscal
- Integrar com snapshot de documentos fiscais
