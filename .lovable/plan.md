

# Plano Revisado: Integrações WhatsApp + Perfil Desenvolvedor

## Estado Atual Identificado

A página de integrações **já existe** (`src/pages/InflexIntegration.tsx`) na rota `/integracao-iniflex`, mas está **oculta no menu lateral** (comentada na linha 55 do AppSidebar).

---

## 1. Reorganizar Página de Integrações

### Abordagem

Ao invés de criar uma nova página, vamos **expandir a página existente** para incluir múltiplas integrações em abas:

| Aba | Conteúdo |
|-----|----------|
| WhatsApp | InstanceManager + QR Code |
| Iniflex | Conteúdo atual da página |

### Alterações

**Renomear e Atualizar `InflexIntegration.tsx` → Conteúdo Interno**
- Extrair conteúdo atual para um componente `InflexTab`
- Transformar página em container com Tabs

**Nova estrutura da página:**
```
src/pages/InflexIntegration.tsx (renomear para Integrations.tsx)
├── Tabs
│   ├── "WhatsApp" → <InstanceManager /> + QR Code Modal
│   └── "Iniflex" → Conteúdo atual extraído
```

**Atualizar Rota e Menu:**
- `App.tsx`: Alterar rota de `/integracao-iniflex` para `/integrations`
- `AppSidebar.tsx`: Descomentar e renomear menu para "Integrações"

---

## 2. Implementar Conexão WhatsApp via QR Code

### Nova Edge Function: `zapi-get-qrcode`

Busca a imagem do QR Code da Z-API:

```
GET /functions/v1/zapi-get-qrcode?instanceId=xxx

Fluxo:
1. Validar autenticação do usuário
2. Buscar dados da instância no banco (instance_id, instance_token)
3. Chamar Z-API: GET /instances/{instanceId}/token/{token}/qr-code/image
4. Retornar base64 da imagem
```

### Novo Componente: `QRCodeConnectionModal`

Modal para exibir QR Code com:
- Imagem base64 do QR Code
- Auto-refresh a cada 30 segundos (QR expira)
- Polling de status a cada 5 segundos
- Instruções passo a passo
- Fechamento automático ao conectar

### Atualizar `InstanceManager.tsx`

Adicionar botão "Conectar via QR" em instâncias desconectadas.

### Atualizar `useWhatsApp.ts`

Adicionar hook `useGetQRCode(instanceId)` para buscar QR Code.

---

## 3. Remover Aba "Instâncias" do WhatsApp

**Modificar `WhatsApp.tsx`:**
- Remover TabsTrigger de "Instâncias" (linha 224-227)
- Remover TabsContent de "instances" (linha 313-315)
- Manter apenas abas: Conversas | Métricas

A gestão de instâncias passa a ser exclusiva da página de Integrações.

---

## 4. Criar Perfil "Desenvolvedor"

### Alterações no Banco de Dados

**4.1. Adicionar valor ao enum `app_role`:**
```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'desenvolvedor';
```

**4.2. Atualizar função `has_role`:**

O desenvolvedor deve ter todas as permissões de admin:

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
        AND (
          role = _role 
          OR (role = 'desenvolvedor' AND _role = 'admin')
        )
    )
$$;
```

**4.3. Atualizar função `get_license_status`:**

Excluir desenvolvedores da contagem de usuários:

```sql
CREATE OR REPLACE FUNCTION public.get_license_status()
RETURNS TABLE(...)
LANGUAGE sql
...
AS $$
    SELECT 
        (SELECT COUNT(*)::INTEGER 
         FROM auth.users u
         WHERE NOT EXISTS (
           SELECT 1 FROM public.user_roles ur 
           WHERE ur.user_id = u.id AND ur.role = 'desenvolvedor'
         )) as current_users,
        ...
$$;
```

**4.4. Atribuir role ao seu usuário:**
```sql
UPDATE public.user_roles 
SET role = 'desenvolvedor' 
WHERE user_id = 'a3d2d266-1d82-437f-b05c-4136fe9441a6';
```

### Alterações no Frontend

**Modificar `Settings.tsx`:**
- Filtrar usuários com role `desenvolvedor` da listagem
- Aplicar filtro: `userRoles?.filter(ur => ur.role !== 'desenvolvedor')`

---

## Resumo de Arquivos

### Criar

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/zapi-get-qrcode/index.ts` | Edge function para buscar QR Code |
| `src/components/whatsapp/QRCodeConnectionModal.tsx` | Modal de conexão via QR |

### Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/InflexIntegration.tsx` | Expandir com abas WhatsApp + Iniflex |
| `src/App.tsx` | Alterar rota para `/integrations` |
| `src/components/layout/AppSidebar.tsx` | Descomentar/renomear menu Integrações |
| `src/pages/WhatsApp.tsx` | Remover aba Instâncias |
| `src/components/whatsapp/InstanceManager.tsx` | Adicionar botão QR Code |
| `src/hooks/useWhatsApp.ts` | Adicionar hook useGetQRCode |
| `src/pages/Settings.tsx` | Filtrar desenvolvedores da lista |

### Migrations SQL

1. Adicionar 'desenvolvedor' ao enum `app_role`
2. Atualizar função `has_role` para tratar desenvolvedor como admin
3. Atualizar função `get_license_status` para excluir desenvolvedores
4. Atribuir role 'desenvolvedor' ao usuário fdkdigital2@gmail.com

---

## Fluxo Final

```
┌─────────────────────────────────────────────────────────────┐
│ Menu Lateral                                                │
├─────────────────────────────────────────────────────────────┤
│ ...                                                         │
│ WhatsApp → Conversas | Métricas (sem Instâncias)            │
│ ...                                                         │
│ Integrações → [WhatsApp] [Iniflex]                          │
│                    │                                        │
│                    ▼                                        │
│   ┌────────────────────────────────────────┐                │
│   │ Instâncias WhatsApp                    │                │
│   │ ┌──────────┐ ┌──────────┐              │                │
│   │ │ Vendas   │ │ Suporte  │              │                │
│   │ │ ✓ Conect │ │ ✗ Descon │              │                │
│   │ │          │ │[QR Code] │              │                │
│   │ └──────────┘ └──────────┘              │                │
│   └────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

**Perfil Desenvolvedor:**
- Não aparece na listagem de usuários
- Não contabiliza no limite de licenças
- Tem permissões completas de admin
- Você (fdkdigital2@gmail.com) será o desenvolvedor

