

# Plano: Permitir Configuração Manual de URL e Token no Sandbox

## Problema Identificado
Os campos de URL e Token na aba Sandbox estão desabilitados (`disabled`), impedindo a entrada manual de dados. O design atual assume que os valores vêm das variáveis de ambiente, mas para testes práticos é necessário poder inserir valores diretamente.

## Solução Proposta

### 1. Tornar Campos Editáveis
Modificar o componente `InflexSandboxTab.tsx` para:
- Remover `disabled` dos campos de URL e Token
- Adicionar estado local para armazenar URL e Token digitados pelo usuário
- Enviar esses valores para a Edge Function junto com o payload

### 2. Atualizar Edge Function
Modificar `iniflex-sandbox-test` para:
- Aceitar parâmetros opcionais `api_url` e `api_token`
- Usar os valores enviados pela UI quando fornecidos
- Usar variáveis de ambiente como fallback

### 3. Indicador de Origem
Mostrar visualmente se o valor está sendo:
- Digitado manualmente (editável)
- Carregado do Vault (fallback)

---

## Detalhes Técnicos

### Alterações no Frontend (`InflexSandboxTab.tsx`)

Adicionar estados:
```typescript
const [apiUrl, setApiUrl] = useState('');
const [apiToken, setApiToken] = useState('');
```

Modificar campos para serem editáveis:
```tsx
<Input 
  value={apiUrl}
  onChange={(e) => setApiUrl(e.target.value)}
  placeholder="https://iniflex.novafix.ind.br/api/v1/..."
  className="font-mono text-xs"
/>

<Input 
  type="password"
  value={apiToken}
  onChange={(e) => setApiToken(e.target.value)}
  placeholder="Cole o token aqui..."
  className="font-mono text-xs"
/>
```

Enviar na mutation:
```typescript
body: { 
  payload, 
  timeout_ms: timeoutMs,
  api_url: apiUrl || undefined,  // undefined = usar variável de ambiente
  api_token: apiToken || undefined,
  save_log: true 
}
```

### Alterações na Edge Function (`iniflex-sandbox-test/index.ts`)

Receber parâmetros opcionais:
```typescript
const { payload, timeout_ms, save_log, api_url, api_token } = await req.json();

// Usar valor da UI ou fallback para variável de ambiente
const finalUrl = api_url || Deno.env.get('INIFLEX_SANDBOX_API_URL');
const finalToken = api_token || Deno.env.get('INIFLEX_SANDBOX_API_TOKEN');
```

### UX Adicional
- Adicionar tooltip explicando que deixar vazio usa o valor do Vault
- Mostrar contagem de caracteres do token enquanto digita
- Botão para limpar campos e voltar ao fallback

---

## Arquivos a Modificar
1. `src/components/integrations/InflexSandboxTab.tsx` - Campos editáveis e estados
2. `supabase/functions/iniflex-sandbox-test/index.ts` - Aceitar parâmetros opcionais

