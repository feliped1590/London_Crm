# Ajustes no cadastro de cliente (CNPJ.ws + inferência de classificação)

Diagnóstico dos 4 pontos levantados na tela `/customers/new`.

## 1. "BrasilAPI" ainda aparece no banner verde
**Causa:** o texto está hard-coded em `src/pages/CustomerNew.tsx` (linha 591):
> "Dados obtidos da Receita Federal via BrasilAPI. Confira antes de salvar."

O backend já devolve `response.data.source` (`cnpjws` | `brasilapi` | `cache`) e `fallback_used`, mas o frontend ignora.

**Correção:** guardar `source` no state e renderizar dinamicamente:
- `cnpjws` → "Dados obtidos da Receita Federal via CNPJ.ws."
- `brasilapi` → "Dados obtidos da Receita Federal via BrasilAPI."
- `cache` → "Dados obtidos do cache (consulta recente)."
- Se `fallback_used = true` → acrescentar "(fallback aplicado)".

## 2. Inscrição Estadual não foi preenchida
**Causas combinadas:**
- A consulta exibida na tela foi atendida pelo **cache** populado em testes anteriores quando o CnpjWsProvider ainda não estava em produção — o registro em `cnpj_lookup_cache` veio da BrasilAPI, que não devolve IE.
- O frontend **não lê** `data.inscricao_estadual` mesmo quando presente.

**Correção:**
1. Mapear `data.inscricao_estadual` no `setCompanyForm` (respeitando regra "não sobrescrever se já preenchido").
2. Forçar **invalidação do cache** desse CNPJ uma única vez (script de migração ou flag `force_refresh=true` no primeiro lookup pós-deploy, apenas para entradas com `source='brasilapi'` antigas) — opcional, discutir antes de executar.
3. Quando o IE Selector devolve `null` (ambiguidade / sem IE ativa), manter campo vazio — comportamento atual já é seguro.

## 3. Inferir Setor + Segmento a partir do CNAE
A CNPJ.ws devolve `cnae_principal` como `"22.22-6-00 - Fabricação de embalagens de material plástico"`. Dá para inferir via heurística usando a taxonomia já existente em `setores` / `segmentos`.

### Estratégia (regra determinística, sem IA)
Criar `supabase/functions/_shared/cnpj/cnaeClassifier.ts` com duas camadas:

**Camada 1 — Setor pelo prefixo CNAE (Divisão, 2 dígitos):**
```text
01–03 → Agropecuária
05–33 → Indústria
35–43 → Indústria (utilities/construção tratadas como Indústria)
45–47 → Comércio   (47 = varejo, 46 = atacado → ver camada 2)
49–96 → Serviços
```
Fallback: se a descrição contém "distribui", "atacad" → **Distribuidora**.

**Camada 2 — Segmento por palavras-chave na descrição** (case/acentos insensíveis), batendo contra os nomes já cadastrados em `segmentos` daquele setor:

| Palavra-chave na descrição CNAE | Segmento candidato |
|---|---|
| embalagem, embalagens | Embalagem / Embalagens |
| café | Café |
| celulose, papel | Celulose |
| cereal, grão | Cerealista |
| cosmético, perfumaria | Cosméticos |
| frigorífico, abate | Frigorífico |
| laticínio, leite, queijo | Laticínios |
| massa, pastifício, panificação | Massas e Pastifícios |
| pescado, peixe, frutos do mar | Pescados e Psicultura |
| pet, ração animal | Pet |
| químico, defensivo | Químicos |
| supermercado | Supermercado |
| varejo, loja | Varejo |
| atacado | Atacado |
| representação | Representação |
| transporte | Transportadoras |
| software, ti, tecnologia | Tecnologia |
| hospital, médico, farmac | Hospitalar |
| alimento, bebida | Alimentos / Alimentos e Bebidas |
| fertilizante, herbicida | Herbicidas Fertilizantes |
| higiene, limpeza | Higiene e Limpeza |
| hortifruti, fruta, hortaliça | Hortifruti |
| natural, orgânic | Produtos Naturais |
| embutido, defumado | Embutidos |
| fumo, tabaco | Fumo e Tabaco |
| manufatura | Manufatura |

**Resolução:** o backend devolve `setor_sugerido` + `segmento_sugerido` como **strings (nomes)**. O frontend resolve para IDs consultando `setores` e `segmentos` do tenant. Se não houver match exato, devolve apenas o setor.

**Regra de aplicação no frontend:** preencher Setor/Segmento somente se ambos estiverem vazios (não sobrescrever escolha do usuário) e exibir badge "🤖 Sugerido pelo CNAE" ao lado.

**Exemplo solicitado:** CNAE `22.22-6-00 - Fabricação de embalagens de material plástico` → Divisão 22 → **Indústria** + palavra "embalagens" → segmento **Embalagens**. ✓

## 4. Email
**Causa:** o normalizer da CNPJ.ws não está expondo `estabelecimento.email` (já está no `CnpjWsRawResponse` mas não é mapeado).

**Correção:**
1. Adicionar `email?: string` em `NormalizedCnpjResult` (`types.ts`).
2. Em `fromCnpjWs`: `email: asString(est.email).toLowerCase()`.
3. Em `fromBrasilApi`: BrasilAPI também devolve `email` em alguns casos — mapear igual.
4. Frontend: `email: prev.email || data.email || ''`.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/_shared/cnpj/types.ts` | + `email?`, + `setor_sugerido?`, + `segmento_sugerido?` em `NormalizedCnpjResult` |
| `supabase/functions/_shared/cnpj/normalizer.ts` | mapear `email` em ambos os providers; chamar classifier |
| `supabase/functions/_shared/cnpj/cnaeClassifier.ts` | **novo** — heurística CNAE → setor/segmento |
| `supabase/functions/_shared/cnpj/cnaeClassifier_test.ts` | **novo** — testes de classificação |
| `src/pages/CustomerNew.tsx` | banner dinâmico por `source`; mapear IE, email, setor/segmento sugeridos |

## Arquivos NÃO alterados
- `supabase/functions/_shared/projedata/company-mapper.ts` ✅
- payload `IMP_CLIENTE_V4` ✅
- schema da tabela `companies` ✅
- `supabase/functions/enrich-company-single/index.ts`, `enrich-companies-batch/index.ts`, `prospecting-search/index.ts` (continuam em BrasilAPI conforme combinado)
- `lookup-cnpj/index.ts` (orquestração já correta)

## Fora deste escopo (perguntar antes)
- Limpar entradas antigas do `cnpj_lookup_cache` que vieram da BrasilAPI para que a próxima consulta puxe IE via CNPJ.ws — posso fazer via SQL ou via botão "🔄 Atualizar" no banner do frontend (passando `force_refresh=true`).
