
# Correcao de Visibilidade das Abas CNPJs e Intervencoes para Desenvolvedores

## Problema

As abas "CNPJs" e "Intervencoes" na pagina de Configuracoes estao visiveis apenas para usuarios com role `admin`. Usuarios com role `desenvolvedor` -- que possuem acesso equivalente ao admin conforme definido na arquitetura -- nao conseguem visualizar essas abas.

A aba "Fiscal" ja esta correta: usa `(isAdmin || isDeveloper)`.

## Correcao

Alterar 4 trechos no arquivo `src/pages/Settings.tsx`:

| Linha | De | Para |
|---|---|---|
| 475 | `{isAdmin && (` | `{(isAdmin \|\| isDeveloper) && (` |
| 481 | `{isAdmin && (` | `{(isAdmin \|\| isDeveloper) && (` |
| 988 | `{isAdmin && (` | `{(isAdmin \|\| isDeveloper) && (` |
| 994 | `{isAdmin && (` | `{(isAdmin \|\| isDeveloper) && (` |

## Impacto

- Nenhuma alteracao no banco de dados
- Nenhuma alteracao em Edge Functions
- Apenas ajuste de visibilidade na UI, alinhando com o padrao ja existente na aba Fiscal
- Desenvolvedores passarao a ver as abas CNPJs e Intervencoes

## Secao Tecnica

### Arquivo modificado
- `src/pages/Settings.tsx` -- 4 alteracoes de condicional

### Detalhes das alteracoes

**TabsTrigger "cnpjs" (linha 475-480):**
Trocar `{isAdmin && (` por `{(isAdmin || isDeveloper) && (`

**TabsTrigger "interventions" (linha 481-485):**
Trocar `{isAdmin && (` por `{(isAdmin || isDeveloper) && (`

**TabsContent "cnpjs" (linha 988-992):**
Trocar `{isAdmin && (` por `{(isAdmin || isDeveloper) && (`

**TabsContent "interventions" (linha 994-998):**
Trocar `{isAdmin && (` por `{(isAdmin || isDeveloper) && (`
