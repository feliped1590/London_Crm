# Cidade/Estado a partir do mapeamento ERP

## Problema
O erro "Cidade X/UF não mapeada no ERP" ocorre porque hoje o usuário digita cidade e UF como texto livre nos formulários de cliente. Qualquer divergência de grafia (acento, abreviação, espaço) em relação à tabela `erp_cities` quebra a sincronização.

## Solução
Substituir os `<Input>` de Cidade e Estado por dois `<Select>` encadeados, populados a partir de `erp_cities` (tenant atual):

1. **Estado (UF)** — lista única de UFs presentes em `erp_cities` para o tenant, ordenada.
2. **Cidade** — lista de cidades da UF selecionada, ordenada por nome. O valor salvo em `companies.city` é exatamente o `nome` da `erp_cities` (mesma string usada no matcher do ERP).

Assim é impossível salvar uma cidade não mapeada, eliminando a classe inteira de erros.

## Escopo
Aplicar nos dois formulários de cliente:
- `src/pages/CustomerNew.tsx` (cadastro)
- `src/components/customer/CustomerOverviewTab.tsx` (edição)

Mantém o restante do formulário e regras atuais (campos obrigatórios, lookup CNPJ, etc.).

## Detalhes técnicos
- Novo hook `useErpCities()` em `src/hooks/`:
  - Query única: `select uf, nome, codigo_erp from erp_cities order by uf, nome`.
  - Retorna `{ ufs: string[], citiesByUf: Record<string, {nome, codigo_erp}[]> }` memoizado.
  - Cache via React Query (longo `staleTime`, key por tenant).
- Componente reutilizável `CityStateSelect` em `src/components/customer/`:
  - Props: `state`, `city`, `onChange({state, city})`, `disabled`.
  - Ao trocar UF, limpa a cidade.
  - Usa `Select` do shadcn.
- **Preenchimento via BrasilAPI (CNPJ lookup)**: hoje preenche `city`/`state` como texto. Após o lookup, tentar casar a cidade retornada com `erp_cities` (normalização sem acento + uppercase). Se casar, pré-seleciona; se não casar, deixa o campo Cidade vazio com hint "Cidade do CNPJ (X) não está mapeada — selecione a mais próxima ou cadastre em Settings → ERP → Cidades".
- **Compatibilidade com clientes legados**: se o cliente já tem `city`/`state` que não estão em `erp_cities`, exibir o valor atual como item desabilitado no topo da lista com aviso "(não mapeada)", forçando o usuário a escolher uma válida ao editar.
- **Fallback se `erp_cities` estiver vazio para o tenant**: exibir mensagem "Nenhuma cidade mapeada. Cadastre em Settings → ERP → Cidades." e manter inputs livres (somente nesse caso) para não bloquear o cadastro inicial.

## Fora do escopo
- Não altera a tabela `erp_cities` nem o validador `validate-company-sync` (continuam como fonte da verdade).
- Não mexe em formulários de outras entidades (contatos, fornecedores).
- Não importa novas cidades em massa — segue manual em Settings.

## Validação
- Cadastrar novo cliente: UF lista apenas estados com cidades mapeadas; Cidade lista apenas as da UF.
- Editar cliente legado com cidade inválida: campo mostra "(não mapeada)" e exige nova seleção para salvar.
- Lookup por CNPJ com cidade mapeada → preenche automaticamente.
- Lookup por CNPJ com cidade não mapeada → mostra hint, não bloqueia.
- Tentar sincronizar com ERP após salvar → não deve mais dar erro "cidade não mapeada".
