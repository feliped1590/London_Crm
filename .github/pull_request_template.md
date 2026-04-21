<!--
Obrigado por contribuir! Preencha as seções abaixo.
PRs sem o checklist preenchido serão devolvidos.
-->

## O que muda
<!-- 2-3 linhas descrevendo a mudança em linguagem de negócio. -->

## Por que
<!-- Contexto: bug, feature, refactor, decisão. Link para issue/conversa se houver. -->

## Como testar
<!-- Passo a passo manual. Inclua caminho feliz E pelo menos 1 caminho de erro. -->
1.
2.
3.

---

## Impacto na documentação

> ⚠️ **Obrigatório.** Documentação evolui junto com o código. Se você mexeu em regra de negócio, fluxo crítico, integração ou decisão arquitetural, atualize `/docs`.

- [ ] Nenhuma alteração relevante (apenas ajuste local, sem impacto em regra/fluxo)
- [ ] Documentação atualizada em `/docs` (cite o arquivo abaixo)
- [ ] Novo fluxo/regra documentado (cite o arquivo criado abaixo)
- [ ] Erro relevante registrado em `docs/00-overview/known-issues.md`

**Arquivos de doc tocados:**
<!-- Liste aqui. Ex: docs/03-business-rules/pipeline.md -->

**Se NÃO atualizou docs, explique por quê:**
<!-- Ex: "Refactor interno de hook, sem mudança de comportamento observável" -->

---

## Checklist de qualidade

- [ ] Branch nomeada conforme `tipo/descricao-curta` (`feat/`, `fix/`, `chore/`, `docs/`, `refactor/`)
- [ ] Commits seguem Conventional Commits
- [ ] Diff ≤ 400 linhas (PR maior precisa de justificativa)
- [ ] Sem `console.log` / código comentado / TODOs órfãos
- [ ] Sem secret/API key hardcoded (usar `secrets`)
- [ ] Migration (se houver) é mentalmente reversível
- [ ] RLS validada se criou/alterou tabela (`supabase--linter` rodou limpo)
- [ ] RPCs testadas com payload **não-vazio** (lição do [KI-0001](../docs/00-overview/known-issues.md))
- [ ] Logs/audit cobrem caminho feliz E de erro
- [ ] Acessibilidade básica preservada (labels, contraste, foco)

---

## Notas para o revisor
<!-- Algo específico que você quer atenção? Trade-off conhecido? -->
