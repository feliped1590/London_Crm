
# Plano: Testar Conexao com ERP Iniflex

## Problema Identificado

A funcao `iniflex-customer-lookup` esta configurada com `verify_jwt = true`, bloqueando chamadas de teste direto. Todas as outras funcoes do projeto usam `verify_jwt = false`.

## Acao Necessaria

Alterar temporariamente para `verify_jwt = false` para testar a conexao com o ERP:

```toml
[functions.iniflex-customer-lookup]
verify_jwt = false
```

## Sequencia de Teste

1. **Alterar config.toml** - Mudar para `verify_jwt = false`
2. **Deploy da funcao** - Aplicar a mudanca
3. **Testar via curl** - Enviar CNPJ valido para a funcao
4. **Verificar logs** - Confirmar se a requisicao chegou ao ERP
5. **Verificar auditoria** - Confirmar registro em `erp_sync_logs`

## CNPJs para Teste

| CNPJ | Descricao |
|------|-----------|
| `14649675000170` | CNPJ real (P C VIANI VIDROS LTDA) |
| `11222333000181` | CNPJ generico valido (checksum ok) |

## Resultados Esperados

### Se ERP responder:
```json
{
  "success": true,
  "found": true | false,
  "data": { ... },
  "source": "iniflex"
}
```

### Se ERP indisponivel:
```json
{
  "success": false,
  "error": "Servico de consulta temporariamente indisponivel"
}
```

## Nota sobre Seguranca

O padrao do projeto e `verify_jwt = false` para todas as funcoes. A seguranca e implementada via:
- Validacao de CNPJ antes de chamar ERP
- Logs de auditoria em `erp_sync_logs`
- Credenciais Iniflex no vault (nao expostas)

Manter `verify_jwt = false` para consistencia com o resto do projeto.

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/config.toml` | Linha 73: `verify_jwt = false` |
