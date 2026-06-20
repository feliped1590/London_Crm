# Fase 08 — Validação de Storage e Buckets no Supabase Staging

## 1. Objetivo da fase

Validar, em modo somente leitura, o estado de Storage no Supabase Staging (buckets, policies e referências de anexos) para garantir base segura antes de qualquer carga real de arquivos.

## 2. Premissas

- A Fase 06 aplicou migrations no Supabase Staging com sucesso.
- A Fase 07 validou o schema do banco.
- Não haverá importação de arquivos reais em massa nesta fase.
- Esta fase é somente inventário, validação e documentação.
- Não serão criados buckets via código nesta etapa.
- Não serão alterados migrations, dados, `.env` ou configurações de produção.

## 3. Inventário de uso de Supabase Storage no projeto

### Pontos de uso no frontend

- `src/lib/storage/lovableProvider.ts`
  - `upload`, `getPublicUrl`, `createSignedUrl`, `remove` via `supabase.storage.from(bucket)`.
- `src/services/attachments.ts`
  - upload lógico em bucket por módulo;
  - persistência de metadados em `public.file_attachments`;
  - leitura de URL pública/signed conforme `is_public`.
- `src/lib/storage/policies.ts`
  - mapeamento `MODULE_BUCKET` por módulo de anexos.

### Pontos de uso em funções

- `supabase/functions/generate-signed-url-secure/index.ts`
  - gera signed URL de arquivo por bucket/path;
  - valida autenticação/autorização antes de devolver URL.

### Uso específico de documentos de crédito

- `src/components/customers/CreditDocumentsTab.tsx`
  - usa bucket `credit-documents`;
  - upload/remoção/listagem com signed URL de curta duração.

## 4. Buckets esperados

Com base no código e migrations atuais, buckets esperados no staging:

- `avatars` (público)
- `produtos` (público)
- `crm` (privado)
- `pedidos` (privado)
- `propostas` (privado)
- `contratos` (privado)
- `documentos` (privado)
- `credit-documents` (privado)
- `legal-entity-logos` (público)

## 5. Tabelas relacionadas a arquivos/anexos

- `public.file_attachments`
  - tabela principal de anexos genéricos por módulo (`crm`, `pedidos`, `produtos`, `propostas`, etc.).
- `public.credit_documents`
  - documentos de crédito vinculados à empresa (`company_id`, `file_path`).
- `public.legal_entities` (campo `logo_url`)
  - referência de logo associada ao bucket `legal-entity-logos`.

Relacionamentos com entidades de negócio:

- Produtos/pedidos/propostas podem aparecer via `file_attachments.entity_type` (`product`, `order`, `proposal`) e `entity_id`.
- PDFs podem aparecer:
  - como `mime_type = 'application/pdf'` em `file_attachments`;
  - em `credit_documents.file_path`.

## 6. Políticas de storage identificadas nas migrations

### Grupo `file_attachments` + buckets por módulo

- Migration principal: `supabase/migrations/20260516012829_8b952039-3290-42c3-9f6e-e308bd0c8c84.sql`
- Policies em `storage.objects`:
  - `public_buckets_select|insert|update|delete` (`avatars`, `produtos`)
  - `private_buckets_select|insert|update|delete` (`crm`, `pedidos`, `propostas`, `contratos`, `documentos`)

### Grupo `credit-documents`

- Criação inicial: `supabase/migrations/20260308201954_be1c95ab-c88e-4156-b99d-31ab66f1d64d.sql`
- Hardening posterior:
  - `supabase/migrations/20260330003419_45e0aaa5-d3aa-46f1-bd36-00420dc80ec5.sql`
  - `supabase/migrations/20260425005758_f8780ee5-4e8a-41db-9a76-073be1a34558.sql`
  - `supabase/migrations/20260425005910_91e89e50-d1f9-4ca8-aecf-e2254eb72043.sql`
- Policies típicas: `credit_docs_select`, `credit_docs_insert`, `credit_docs_delete`.

### Grupo `legal-entity-logos`

- Criação/policies: `supabase/migrations/20260221183313_b438dd6c-7819-4281-9c76-e201631d7cc8.sql`
- Ajustes de segurança posteriores: `supabase/migrations/20260425004851_49dcc0b1-e325-40c9-8653-4d55782ed52b.sql`.

## 7. Queries SQL somente leitura para validação

> Executar no SQL Editor do Supabase Staging.  
> Todas as consultas abaixo são `SELECT`.

### 7.1 Buckets existentes em `storage.buckets`

```sql
SELECT id, name, public, file_size_limit, allowed_mime_types, created_at
FROM storage.buckets
ORDER BY id;
```

### 7.2 Conferência de buckets esperados x existentes

```sql
WITH expected AS (
  SELECT * FROM (VALUES
    ('avatars', true),
    ('produtos', true),
    ('crm', false),
    ('pedidos', false),
    ('propostas', false),
    ('contratos', false),
    ('documentos', false),
    ('credit-documents', false),
    ('legal-entity-logos', true)
  ) AS t(bucket_id, expected_public)
)
SELECT
  e.bucket_id,
  e.expected_public,
  b.id IS NOT NULL AS exists_in_storage,
  b.public AS current_public
FROM expected e
LEFT JOIN storage.buckets b ON b.id = e.bucket_id
ORDER BY e.bucket_id;
```

### 7.3 Policies em `storage.objects`

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname;
```

### 7.4 Policies de storage por categoria (resumo)

```sql
SELECT
  CASE
    WHEN policyname ILIKE 'public_buckets_%' THEN 'public_buckets'
    WHEN policyname ILIKE 'private_buckets_%' THEN 'private_buckets'
    WHEN policyname ILIKE 'credit_docs_%' THEN 'credit_docs'
    WHEN policyname ILIKE '%legal entity logos%' THEN 'legal_entity_logos'
    ELSE 'other'
  END AS policy_group,
  COUNT(*) AS policies_count
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
GROUP BY 1
ORDER BY 1;
```

### 7.5 Registros em tabelas de anexos

```sql
SELECT COUNT(*) AS file_attachments_count
FROM public.file_attachments;
```

```sql
SELECT COUNT(*) AS credit_documents_count
FROM public.credit_documents;
```

### 7.6 Distribuição de anexos por bucket/módulo/mime

```sql
SELECT bucket, module, mime_type, COUNT(*) AS qty
FROM public.file_attachments
GROUP BY bucket, module, mime_type
ORDER BY qty DESC, bucket, module;
```

### 7.7 Referências a imagens/produtos/PDFs

```sql
SELECT
  SUM(CASE WHEN mime_type LIKE 'image/%' THEN 1 ELSE 0 END) AS image_refs,
  SUM(CASE WHEN mime_type = 'application/pdf' THEN 1 ELSE 0 END) AS pdf_refs,
  SUM(CASE WHEN entity_type = 'product' THEN 1 ELSE 0 END) AS product_refs
FROM public.file_attachments;
```

### 7.8 Referências de logo por entidade jurídica

```sql
SELECT
  COUNT(*) FILTER (WHERE logo_url IS NOT NULL AND logo_url <> '') AS legal_entities_with_logo_url,
  COUNT(*) AS legal_entities_total
FROM public.legal_entities;
```

### 7.9 Referência órfã: DB aponta para objeto inexistente em storage

```sql
SELECT
  fa.id,
  fa.bucket,
  fa.object_path,
  fa.entity_type,
  fa.entity_id
FROM public.file_attachments fa
LEFT JOIN storage.objects so
  ON so.bucket_id = fa.bucket
 AND so.name = fa.object_path
WHERE so.id IS NULL
ORDER BY fa.created_at DESC
LIMIT 200;
```

### 7.10 Descoberta de colunas de referência (url/path/file/pdf) no schema public

```sql
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    column_name ILIKE '%url%'
    OR column_name ILIKE '%path%'
    OR column_name ILIKE '%file%'
    OR column_name ILIKE '%pdf%'
    OR column_name ILIKE '%image%'
  )
ORDER BY table_name, column_name;
```

## 8. Riscos

- **Bucket ausente:** operações de upload/download falham por módulo.
- **Policy ausente ou incorreta:** risco de acesso indevido ou bloqueio total.
- **Referência órfã (DB x storage):** registro em `file_attachments` sem objeto físico.
- **Links públicos quebrados:** `logo_url`/public URL inválida, objeto removido ou bucket errado.
- **Diferença Lovable Storage x Supabase Storage:** nomenclatura/paths/policies divergentes durante migração de ambiente.

## 9. Critérios de aceite

- Buckets esperados existem no staging com `public` coerente.
- Policies de `storage.objects` estão presentes para os grupos críticos.
- Tabelas de anexos (`file_attachments`, `credit_documents`) acessíveis e coerentes.
- Não há volume relevante de referências órfãs não explicadas.
- Evidências de validação registradas no documento/fase.

## 10. Próximos passos recomendados

- Executar as queries deste documento e anexar resultados consolidados.
- Classificar achados em `OK`, `Ajuste necessário`, `Risco`.
- Preparar Fase 09 (validação funcional de upload/download/signed URL com massa sintética pequena).
- Só avançar para carga real de arquivos após fechamento formal desta fase.

