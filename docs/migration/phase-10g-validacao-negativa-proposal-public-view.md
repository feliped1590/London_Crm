# Fase 10G — Validacao funcional negativa da `proposal-public-view`

## 1) Objetivo da fase

Executar validacoes negativas controladas da funcao `proposal-public-view` em staging, sem token real, sem dados reais e sem teste positivo.

## 2) Ambiente usado

- Repositorio: `Qualyvac_Migration`
- Projeto Supabase (staging): `cansbrrwrprcycjvgvqm`
- URL da funcao: `https://cansbrrwrprcycjvgvqm.supabase.co/functions/v1/proposal-public-view`
- Funcao testada: `proposal-public-view`

## 3) Pre-checks obrigatorios

1. Branch inicial confirmada: `main`.
2. `main` limpa e atualizada: confirmado.
3. Project ref esperado: `cansbrrwrprcycjvgvqm` (confirmado).
4. Funcao `proposal-public-view` em `ACTIVE`: confirmado em `npx supabase functions list --project-ref cansbrrwrprcycjvgvqm`.
5. Nenhuma alteracao local de codigo antes dos testes: confirmado.

## 4) Branch da fase

- Branch criada: `phase-10g-validacao-negativa-proposal-public-view`

## 5) Testes negativos executados

Foram executadas exatamente as 5 chamadas permitidas:

1. `OPTIONS` preflight
2. `GET` sem body
3. `POST` sem token (`{}`)
4. `POST` com token malformado (`abc`)
5. `POST` com token sintetico em formato aceitavel (inexistente)

## 6) Resultado HTTP por teste

1. **OPTIONS preflight**
   - Status: `200`
   - Resumo de resposta: corpo vazio (esperado para preflight)

2. **GET method indevido**
   - Status: `405`
   - Resumo de resposta: corpo vazio

3. **POST sem token**
   - Status: `404`
   - Resumo de resposta: `{"error":"Link invalido ou expirado"}`

4. **POST token malformado (`abc`)**
   - Status: `404`
   - Resumo de resposta: `{"error":"Link invalido ou expirado"}`

5. **POST token sintetico (formato valido, inexistente)**
   - Status: `404`
   - Resumo de resposta: `{"error":"Link invalido ou expirado"}`

## 7) Evidencias de seguranca observadas

- Nao houve stack trace retornado ao cliente.
- Nao houve erro bruto de banco retornado ao cliente.
- Nao houve vazamento de dados sensiveis de proposta.
- Mensagem anti-enumeracao funcionou (mesma resposta generica para ausencia/malformacao/inexistencia de token).
- Nao houve evidencia de acionamento de rate limit nesta rodada curta (esperado).

## 8) Integracoes e escopo

- Nao houve chamada de WhatsApp/Z-API.
- Nao houve chamada de Resend/e-mail.
- Nao houve chamada de Google Calendar.
- Nao houve chamada de IA/Lovable AI.
- Nao houve chamada de ERP/Projedata/Iniflex.
- Nao houve qualquer teste positivo.

## 9) Riscos remanescentes

1. Endpoint permanece publico (`verify_jwt=false`).
2. Funcao ainda depende de `SUPABASE_SERVICE_ROLE_KEY`.
3. Rate limit segue basico (controle inicial, nao avancado).

## 10) Decisao da fase

- **Aprovada para proxima fase de teste positivo controlado com dados sinteticos** (sem dados reais), pois:
  - comportamento negativo foi consistente e seguro,
  - anti-enumeracao respondeu conforme esperado,
  - nao houve vazamento de informacao sensivel nas chamadas negativas.

## 11) Proximos passos

1. Iniciar fase de teste positivo controlado com massa sintetica dedicada.
2. Definir checklist de observabilidade para tokens invalidos/expirados e eventos `429`.
3. Manter bloqueio de uso de dados reais ate validacao funcional completa.

