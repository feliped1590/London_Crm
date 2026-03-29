

# Plano: Corrigir autenticacao nas 7 Edge Functions criticas

## Resumo

Adicionar validacao obrigatoria de JWT em 7 Edge Functions que hoje aceitam requisicoes sem autenticacao. O frontend ja usa `supabase.functions.invoke()` que envia o token automaticamente, entao nenhuma mudanca no frontend e necessaria.

## Padrao de autenticacao

Todas as funcoes receberao o mesmo bloco de autenticacao no inicio do handler:

```typescript
// --- AUTH: validar token JWT ---
const authHeader = req.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
const supabaseAuth = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
  { global: { headers: { Authorization: authHeader } } }
);
const token = authHeader.replace('Bearer ', '');
const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
if (claimsError || !claimsData?.claims) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
const userId = claimsData.claims.sub;
// --- FIM AUTH ---
// Agora sim, criar service client para operacoes privilegiadas
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
```

Para funcoes administrativas, adiciona-se apos o bloco acima:

```typescript
// --- ADMIN CHECK ---
const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
if (!isAdmin) {
  return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), {
    status: 403,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

## Alteracoes por funcao

| # | Funcao | Tipo | Alteracao |
|---|--------|------|-----------|
| 1 | `execute-automation/index.ts` | Authenticated | Inserir bloco auth nas linhas 47-50 (substituir criacao direta do service client) |
| 2 | `import-companies-bulk/index.ts` | Admin-only | Inserir bloco auth + admin check nas linhas 45-49 |
| 3 | `generate-order-pdf/index.ts` | Authenticated | Inserir bloco auth nas linhas 14-17 |
| 4 | `generate-report-pdf/index.ts` | Authenticated | Inserir bloco auth na linha 14 (antes do parse do body) |
| 5 | `import-companies-from-file/index.ts` | Admin-only | Inserir bloco auth + admin check nas linhas 13-17 |
| 6 | `calcular-tributacao/index.ts` | Authenticated | Inserir bloco auth nas linhas 652-655 |
| 7 | `import-ncm-tipi/index.ts` | Admin-only | Inserir bloco auth + admin check nas linhas 14-17 |

## Compatibilidade

O frontend ja passa o token JWT automaticamente via `supabase.functions.invoke()`. Nenhuma alteracao no frontend e necessaria.

## Validacao pos-implementacao

```bash
# Sem token → deve retornar 401
curl -X POST https://lusyhkizwoihixcvcgap.supabase.co/functions/v1/execute-automation \
  -H "Content-Type: application/json" \
  -d '{"deal_id":"test"}'

# Com token valido → deve funcionar normalmente (via interface do CRM)
```

## Secao tecnica

- `getClaims(token)` valida o JWT e retorna claims (sub, email, role, exp) sem round-trip ao banco
- O `SERVICE_ROLE_KEY` so e usado APOS validacao do usuario
- Funcoes de importacao e NCM exigem role `admin` via RPC `has_role`
- `generate-report-pdf` nao usa Supabase client mas passara a validar identidade mesmo assim
- Nenhum CORS header sera alterado — mantemos compatibilidade total

