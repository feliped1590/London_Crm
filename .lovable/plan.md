# Plano: Adequação à Reforma Tributária EC 132/2023

## Status: ✅ FASE 1 CONCLUÍDA

## Visão Geral

Implementação do suporte ao novo modelo tributário brasileiro (IVA Dual) com coexistência híbrida durante o período de transição 2026-2033.

## Modelo Conceitual Revisado

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REFORMA TRIBUTÁRIA - MODELO CONCEITUAL                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CONCEITOS-CHAVE (NÃO USAR CST COMO BASE CONCEITUAL):                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ REGIME DE INCIDÊNCIA                                                │   │
│  │ normal | aliquota_zero | monofasico | isento | imune | suspensao   │   │
│  │ diferimento | cashback | nao_incidencia                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ TIPO DE GERAÇÃO DE CRÉDITO                                          │   │
│  │ integral | parcial | vedado | presumido                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ IBS COMO IMPOSTO ÚNICO                                              │   │
│  │ - Alíquota única                                                    │   │
│  │ - Repartição interna (65% estadual / 35% municipal)                 │   │
│  │ - Exibição separada apenas para transparência                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Cronograma de Transição (Parametrizado)

| Ano  | Modelo          | ICMS/ISS | IBS | PIS/COFINS | CBS  | Descrição                    |
|------|-----------------|----------|-----|------------|------|------------------------------|
| 2025 | legado          | 100%     | 0%  | 100%       | 0%   | Sistema atual                |
| 2026 | dual_teste      | 100%     | 0%  | 100%       | 0%   | CBS 0.9% + IBS 0.1% (teste)  |
| 2027 | dual_transicao  | 100%     | 0%  | 0%         | 100% | CBS substitui PIS/COFINS     |
| 2028 | dual_transicao  | 100%     | 0%  | 0%         | 100% | Continuidade                 |
| 2029 | dual_transicao  | 90%      | 10% | 0%         | 100% | Início redução ICMS/ISS      |
| 2030 | dual_transicao  | 80%      | 20% | 0%         | 100% | Redução gradual              |
| 2031 | dual_transicao  | 70%      | 30% | 0%         | 100% | Redução gradual              |
| 2032 | dual_transicao  | 60%      | 40% | 0%         | 100% | Redução gradual              |
| 2033 | novo            | 0%       | 100%| 0%         | 100% | Extinção ICMS/ISS            |

## Estrutura Implementada

### 1. Novos ENUMs

- `regime_incidencia_cbs_ibs`: Regime de incidência (substitui conceito de CST)
- `tipo_geracao_credito`: Tipo de geração de crédito
- `modelo_tributario`: Fase da transição
- `classificacao_tributaria_nfe`: Campo técnico NF-e (cClassTrib)
- `split_payment_status`: Status operacional do split payment
- `categoria_imposto_seletivo`: Categorias do IS (não depende de NCM)

### 2. Novas Tabelas

| Tabela | Propósito |
|--------|-----------|
| `transicao_tributaria_parametros` | Percentuais de transição versionados por ano |
| `credito_presumido_regras` | Crédito presumido condicional |
| `split_payment_registros` | Registro operacional de retenções |
| `cadastro_imposto_seletivo` | Cadastro do IS com categorias e exceções |

### 3. Extensão de `regras_tributacao`

Novos campos para CBS, IBS e IS usando regime de incidência e tipo de crédito.

### 4. Funções de Banco

- `get_parametros_transicao(ano)`: Retorna parâmetros de transição do ano
- `get_credito_presumido_aplicavel(...)`: Retorna crédito presumido aplicável

### 5. Tipos TypeScript

- `src/types/fiscal-reforma.ts`: Tipos completos para o novo modelo
- `src/types/fiscal-extended.ts`: Extensão com CBS/IBS/IS

## Próximas Fases

### Fase 2: Motor de Cálculo Híbrido
- [ ] Atualizar `calcular-tributacao` Edge Function
- [ ] Implementar lógica de seleção de modelo por data
- [ ] Calcular CBS com crédito presumido condicional
- [ ] Calcular IBS como imposto único com repartição
- [ ] Calcular IS por categoria (não apenas NCM)
- [ ] Gerar estrutura Split Payment

### Fase 3: Interface de Gestão
- [ ] Tab IVA Dual no formulário de regras
- [ ] Painel de transição tributária
- [ ] Gestão de Imposto Seletivo
- [ ] Gestão de Crédito Presumido

### Fase 4: Integração
- [ ] Snapshot fiscal incluindo novos tributos
- [ ] Simulador de tributação
- [ ] Relatórios de conformidade

## Ajustes Conceituais Implementados

| Ajuste | Status |
|--------|--------|
| CBS/IBS sem dependência de CST | ✅ Implementado |
| Regime de incidência + tipo de crédito | ✅ Implementado |
| Crédito presumido condicional | ✅ Implementado |
| IBS como imposto único | ✅ Implementado |
| Split Payment com estados operacionais | ✅ Implementado |
| Percentuais de transição parametrizáveis | ✅ Implementado |
| IS por categoria + exceções legais | ✅ Implementado |
