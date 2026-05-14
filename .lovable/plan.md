
# Ficha Técnica Dinâmica por Grupo de Produto

Cadastro complementar de produto, exibido condicionalmente conforme o grupo selecionado. Tudo armazenado no CRM, sem sincronização com ERP nesta fase.

## Modelo de dados

Adicionar coluna em `products`:
- `ficha_tecnica jsonb NOT NULL DEFAULT '{}'::jsonb` — guarda todos os campos dinâmicos.

Criar tabelas de apoio (lookups gerenciáveis em "Cadastro Básico"):
- `product_ficha_machines` — Máquinas (`id, value, label, sort_order, is_active, tenant_id`)
- `product_ficha_cylinders` — Diâmetros de Cilindro (mesma estrutura)
- `product_ficha_accessories` — Acessórios opcionais (mesma estrutura)

Criar enum/constantes (em código, não no banco) para os valores fixos:
- Embalagem: `Fardo` | `Caixa`
- Tipo de impressão: `Interna` | `Externa`
- Local de impressão: `Frente` | `Frente e Verso` | `Verso`
- Cameron: `Sim` | `Não` | `Duplo`
- Fotocélula: `Sim` | `Não` | `Dupla`
- Cores: 1..8
- Tubete: `PVC` | `Papelão` | `Ferro`
- Diâmetro tubete: `3"` | `6"`
- Sim/Não para "Descontar Tubo"
- Emendas por bobina: 1 | 2 | 3
- Sentido de embobinamento: `Pé Externo` | `Pé Interno` | `Cabeça Externo` | `Cabeça Interno`

Identificação do "perfil de ficha" do grupo: adicionar coluna em `product_groups`:
- `ficha_profile text` com valores: `stand_up_liso`, `stand_up_impresso`, `saco_liso`, `saco_impresso`, `bobina_lisa`, `bobina_impressa`, `none` (default).

A vinculação grupo → perfil é configurada manualmente em "Cadastro Básico" pelo admin (select por grupo). Sem detecção por nome — evita o problema do override "bobina" hardcoded atual.

## Estrutura do JSON `ficha_tecnica`

Schema único (chaves opcionais conforme perfil):

```json
{
  "embalagem": { "tipo": "Fardo|Caixa", "quantidade": 100 },
  "acessorios": [
    { "accessory_id": "uuid", "valor": "texto/numero opcional" }
  ],
  "stand_up": {
    "distancia_picote": 0,
    "distancia_ziper": 0
  },
  "impressao": {
    "tipo": "Interna|Externa",
    "local": "Frente|Frente e Verso|Verso",
    "repeticao_lateral": 0,
    "repeticao_longitudinal": 0,
    "passo": 0,
    "cilindro_id": "uuid",
    "maquina_id": "uuid",
    "cameron": "Sim|Não|Duplo",
    "fotocelula": "Sim|Não|Dupla",
    "qtd_cores": 1
  },
  "bobina": {
    "tubete_tipo": "PVC|Papelão|Ferro",
    "tubete_diametro": "3\"|6\"",
    "descontar_tubo": true,
    "peso_bobina": 0,
    "diametro_bobina": 0,
    "metragem_bobina": 0,
    "emendas_por_bobina": 1,
    "sentido_embobinamento": "Pé Externo|..."
  },
  "observacoes": "texto livre"
}
```

## Matriz de campos por perfil

| Bloco | stand_up_liso | stand_up_impresso | saco_liso | saco_impresso | bobina_lisa | bobina_impressa |
|---|---|---|---|---|---|---|
| Stand Up (picote/zíper) | ✓ | ✓ | — | — | — | — |
| Acessórios (multi) | ✓ | ✓ | ✓ | ✓ | — | — |
| Embalagem (tipo+qtd) | ✓ | ✓ | ✓ | ✓ | — | — |
| Bobina (tubete, peso, etc.) | — | — | — | — | ✓ | ✓ |
| Sentido embobinamento | — | — | — | — | — | ✓ |
| Impressão (bloco completo) | — | ✓ | — | ✓ | — | ✓ |
| Observações | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## Frontend

Novo componente `FichaTecnicaSection.tsx` em `src/components/products/`:
- Recebe `ficha_profile`, `value` (objeto JSON) e `onChange`.
- Renderiza blocos conforme perfil — cada bloco em arquivo próprio para manter o componente legível:
  - `FichaBlocoStandUp.tsx`
  - `FichaBlocoAcessorios.tsx` (multi-select de `product_ficha_accessories`)
  - `FichaBlocoEmbalagem.tsx`
  - `FichaBlocoBobina.tsx`
  - `FichaBlocoImpressao.tsx`
  - `FichaBlocoObservacoes.tsx`
- Validação: campos numéricos > 0 quando preenchidos; observações livres; perfil `none` não renderiza nada.

Hook novo `useFichaLookups.ts` — espelha o padrão de `useProductLookups` para máquinas, cilindros e acessórios.

Em `src/pages/Products.tsx`:
- Após o bloco de Dimensões, renderizar `<FichaTecnicaSection profile={group.ficha_profile} value={formData.ficha_tecnica} onChange={...} />`.
- Persistir `ficha_tecnica` no insert/update de `products`.
- Em "Cadastro Básico", adicionar coluna "Perfil de Ficha" no `ProductLookupManager` da seção Grupos com select dos 7 perfis.
- Adicionar 3 novas seções de lookup (Máquinas, Diâmetros de Cilindro, Acessórios) usando o `LookupSection` já existente.

## Permissões e regras

- `ficha_tecnica` pode ser editada após criação do produto (não é estrutural, não entra em `structure_hash`).
- Apenas Admin/Dev gerenciam os lookups novos e o `ficha_profile` dos grupos.
- Nada é enviado ao ERP — `process-product-sync` e `product-mapper-v2` permanecem intocados.

## Fora de escopo

- Sincronização com ERP Iniflex/Projedata.
- Migração dos campos hardcoded atuais (dimensões, NCM, fiscal) para o JSON — continuam como colunas.
- Geração de SKU/`erp_versao` a partir da ficha técnica.
- Histórico/auditoria de alterações da ficha (pode entrar em iteração futura).

## Detalhes técnicos

Migrations necessárias:
1. `ALTER TABLE products ADD COLUMN ficha_tecnica jsonb NOT NULL DEFAULT '{}'::jsonb;`
2. `ALTER TABLE product_groups ADD COLUMN ficha_profile text DEFAULT 'none';` + `CHECK` nos 7 valores.
3. Criar `product_ficha_machines`, `product_ficha_cylinders`, `product_ficha_accessories` com RLS multi-tenant (mesmo padrão de `product_unit_measures`).
4. Atualizar `useProductLookups` (ou novo hook) para retornar `ficha_profile` em `GroupLookupItem`.
5. Remover o override por nome em `getGroupProfile` (linhas 281-285 de `Products.tsx`) — substituído pela configuração explícita via `dimension_profile` no cadastro do grupo (recomendado, mas pode ficar para outra rodada se preferir).

Memória a atualizar após implementação:
- Nova: `mem://features/product-ficha-tecnica-dinamica` documentando os 7 perfis, o JSON e as 3 novas tabelas de lookup.

