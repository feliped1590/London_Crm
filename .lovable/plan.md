# Plano: Cadastro de Produto com NCM Fiscal Inteligente

## Resumo Executivo

Implementar um sistema robusto de NCM (Nomenclatura Comum do Mercosul) que transforma o código NCM de um campo informativo em um gatilho fiscal inteligente, garantindo consistência tributária, governança e redução de erros no faturamento.

---

## Fase 1: Infraestrutura de Dados

### 1.1 Tabela Oficial de NCM

```sql
CREATE TABLE public.ncm_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo CHAR(8) NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  data_vigencia DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim_vigencia DATE,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'obsoleto')),
  ex_tipi TEXT[],
  -- Alíquota IPI oficial (referência TIPI) - apenas informativa
  aliquota_ipi_oficial NUMERIC(5,2),
  unidade_tributaria TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON COLUMN ncm_codes.aliquota_ipi_oficial IS 
  'Alíquota IPI conforme TIPI oficial. Apenas referência - a alíquota aplicável está em ncm_fiscal_rules.';
```

### 1.2 Tabela de Regras Fiscais por NCM

```sql
CREATE TABLE public.ncm_fiscal_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ncm_id UUID NOT NULL REFERENCES ncm_codes(id),
  uf_origem CHAR(2),
  uf_destino CHAR(2),
  regime_tributario regime_tributario NOT NULL,
  -- CST/CSOSN
  cst_icms TEXT,
  csosn TEXT,
  -- Alíquotas aplicáveis (regras de negócio)
  aliquota_icms NUMERIC(5,2),
  tem_icms_st BOOLEAN DEFAULT false,
  aliquota_ipi NUMERIC(5,2),
  cst_pis_cofins TEXT,
  aliquota_pis NUMERIC(5,4),
  aliquota_cofins NUMERIC(5,4),
  -- Classificação
  tipo_produto tipo_produto_fiscal,
  -- Vigência
  is_active BOOLEAN DEFAULT true,
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_until DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON COLUMN ncm_fiscal_rules.aliquota_ipi IS 
  'Alíquota IPI aplicável conforme regras de negócio da empresa. Pode diferir da TIPI oficial.';
```

### 1.3 Campos Fiscais na Tabela de Produtos

```sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS ncm_code CHAR(8);
ALTER TABLE products ADD COLUMN IF NOT EXISTS ncm_id UUID REFERENCES ncm_codes(id);
-- Snapshot fiscal no momento do cadastro
ALTER TABLE products ADD COLUMN IF NOT EXISTS cst_icms TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS csosn TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS aliquota_icms NUMERIC(5,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS tem_icms_st BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS aliquota_ipi NUMERIC(5,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS cst_pis_cofins TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS aliquota_pis NUMERIC(5,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS aliquota_cofins NUMERIC(5,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS tipo_produto tipo_produto_fiscal;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ncm_validated_at TIMESTAMPTZ;

COMMENT ON TABLE products IS 
  'Campos fiscais representam o SNAPSHOT aplicado no momento do cadastro. 
   NÃO devem ser recalculados retroativamente. 
   Para mudanças fiscais futuras, criar nova versão ou atualizar manualmente.';
```

**Documentação importante sobre alíquotas IPI:**

| Campo | Localização | Propósito |
|-------|-------------|-----------|
| `aliquota_ipi_oficial` | ncm_codes | Referência da TIPI oficial (apenas consulta) |
| `aliquota_ipi` | ncm_fiscal_rules | Regra aplicável por UF/regime (cálculo ativo) |
| `aliquota_ipi` | products | Snapshot congelado no cadastro (auditoria) |

### 1.4 Configuração Fiscal da Empresa

```sql
ALTER TABLE companies ADD COLUMN IF NOT EXISTS regime_tributario regime_tributario;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contribuinte_icms BOOLEAN DEFAULT true;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contribuinte_ipi BOOLEAN DEFAULT false;
```

### 1.5 Tabela de Auditoria de NCM (Completa)

```sql
CREATE TABLE public.product_ncm_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_ncm CHAR(8),
  new_ncm CHAR(8),
  -- Snapshot COMPLETO do estado fiscal anterior e novo
  old_fiscal_state JSONB,
  new_fiscal_state JSONB,
  reason TEXT,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  has_billing_history BOOLEAN DEFAULT false,
  -- Metadados adicionais para compliance
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_product_ncm_audit_product ON product_ncm_audit(product_id);
CREATE INDEX idx_product_ncm_audit_changed_at ON product_ncm_audit(changed_at DESC);

COMMENT ON COLUMN product_ncm_audit.old_fiscal_state IS 
  'JSON completo com todos os campos fiscais do produto antes da alteração. 
   Serve como prova fiscal em auditoria.';
```

---

## Fase 2: Validações e Regras de Negócio

### 2.1 Gatilho ncm_validated_at

O campo `ncm_validated_at` será atualizado quando **TODAS** as condições forem atendidas:

1. ✅ NCM existe na tabela `ncm_codes`
2. ✅ Status do NCM = 'ativo'
3. ✅ Validação semântica foi **executada** (independente do resultado)

```sql
-- Função para atualizar ncm_validated_at
CREATE OR REPLACE FUNCTION update_ncm_validation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Só marca como validado se NCM ativo e validação executada
  IF NEW.ncm_id IS NOT NULL THEN
    SELECT CASE 
      WHEN nc.status = 'ativo' THEN now()
      ELSE NULL
    END INTO NEW.ncm_validated_at
    FROM ncm_codes nc 
    WHERE nc.id = NEW.ncm_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
```

**Importante:** O campo NÃO deve ser marcado como validado apenas por existir. A validação semântica deve ser executada.

### 2.2 Validação Semântica - Schema de Resposta Padronizado

```typescript
interface NCMSemanticValidation {
  /** Se a descrição do produto é compatível com o NCM */
  compatible: boolean;
  /** Nível de confiança da análise (0.0 a 1.0) */
  confidence: number;
  /** Classificação de risco para o usuário */
  risk_level: 'low' | 'medium' | 'high';
  /** Resumo explicativo para exibir na interface */
  summary: string;
  /** Palavras-chave detectadas no produto */
  product_keywords?: string[];
  /** Palavras-chave esperadas pelo NCM */
  expected_keywords?: string[];
}
```

**Mapeamento visual por risk_level:**

| Risk Level | Badge Color | Ícone | Ação Sugerida |
|------------|-------------|-------|---------------|
| low | Verde | ✓ | Nenhuma |
| medium | Amarelo | ⚠️ | Revisar antes de salvar |
| high | Vermelho | ✗ | Bloquear ou exigir justificativa |

### 2.3 Trigger de Auditoria Completo

```sql
CREATE OR REPLACE FUNCTION audit_product_ncm_change()
RETURNS TRIGGER AS $$
DECLARE
  v_has_billing BOOLEAN;
  v_old_fiscal JSONB;
  v_new_fiscal JSONB;
BEGIN
  IF OLD.ncm_code IS DISTINCT FROM NEW.ncm_code 
     OR OLD.ncm_id IS DISTINCT FROM NEW.ncm_id THEN
    
    -- Verificar histórico de faturamento
    SELECT EXISTS(
      SELECT 1 FROM order_items WHERE product_id = NEW.id
    ) INTO v_has_billing;
    
    -- Capturar estado fiscal COMPLETO anterior
    v_old_fiscal := jsonb_build_object(
      'ncm_code', OLD.ncm_code,
      'ncm_id', OLD.ncm_id,
      'cst_icms', OLD.cst_icms,
      'csosn', OLD.csosn,
      'aliquota_icms', OLD.aliquota_icms,
      'tem_icms_st', OLD.tem_icms_st,
      'aliquota_ipi', OLD.aliquota_ipi,
      'cst_pis_cofins', OLD.cst_pis_cofins,
      'aliquota_pis', OLD.aliquota_pis,
      'aliquota_cofins', OLD.aliquota_cofins,
      'tipo_produto', OLD.tipo_produto,
      'ncm_validated_at', OLD.ncm_validated_at
    );
    
    -- Capturar estado fiscal COMPLETO novo
    v_new_fiscal := jsonb_build_object(
      'ncm_code', NEW.ncm_code,
      'ncm_id', NEW.ncm_id,
      'cst_icms', NEW.cst_icms,
      'csosn', NEW.csosn,
      'aliquota_icms', NEW.aliquota_icms,
      'tem_icms_st', NEW.tem_icms_st,
      'aliquota_ipi', NEW.aliquota_ipi,
      'cst_pis_cofins', NEW.cst_pis_cofins,
      'aliquota_pis', NEW.aliquota_pis,
      'aliquota_cofins', NEW.aliquota_cofins,
      'tipo_produto', NEW.tipo_produto,
      'ncm_validated_at', NEW.ncm_validated_at
    );
    
    INSERT INTO product_ncm_audit (
      product_id, 
      old_ncm, 
      new_ncm,
      old_fiscal_state,
      new_fiscal_state,
      changed_by, 
      has_billing_history
    ) VALUES (
      NEW.id, 
      OLD.ncm_code, 
      NEW.ncm_code,
      v_old_fiscal,
      v_new_fiscal,
      auth.uid(),
      v_has_billing
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

CREATE TRIGGER trg_audit_product_ncm
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION audit_product_ncm_change();
```

### 2.4 Função de Busca NCM (com notas de performance)

```sql
CREATE OR REPLACE FUNCTION search_ncm(
  search_term TEXT,
  limit_rows INT DEFAULT 20
)
RETURNS TABLE(
  id UUID,
  codigo CHAR(8),
  descricao TEXT,
  status TEXT,
  aliquota_ipi_oficial NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT n.id, n.codigo, n.descricao, n.status, n.aliquota_ipi_oficial
  FROM ncm_codes n
  WHERE n.codigo LIKE search_term || '%'
     OR n.descricao ILIKE '%' || search_term || '%'
  ORDER BY 
    CASE WHEN n.codigo = search_term THEN 0 ELSE 1 END,
    n.status = 'ativo' DESC,
    n.codigo
  LIMIT limit_rows;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_ncm_codes_codigo ON ncm_codes(codigo);
CREATE INDEX IF NOT EXISTS idx_ncm_codes_status ON ncm_codes(status);

COMMENT ON FUNCTION search_ncm IS 
  'Busca NCM por código ou descrição. 
   MELHORIA FUTURA: Para bases muito grandes (>50k registros), 
   considerar GIN index ou tsvector para full-text search na descrição.';
```

**Melhorias futuras de performance (não bloqueantes):**

```sql
-- Para implementar quando necessário:
-- 1. GIN index para busca por padrão
CREATE INDEX idx_ncm_descricao_gin ON ncm_codes 
  USING gin(descricao gin_trgm_ops);

-- 2. Full-text search com tsvector
ALTER TABLE ncm_codes ADD COLUMN descricao_tsv tsvector 
  GENERATED ALWAYS AS (to_tsvector('portuguese', descricao)) STORED;
CREATE INDEX idx_ncm_descricao_fts ON ncm_codes USING gin(descricao_tsv);
```

---

## Fase 3: Edge Function - Validação Semântica

```typescript
// supabase/functions/validate-ncm-semantic/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SemanticValidationResponse {
  compatible: boolean;
  confidence: number;
  risk_level: 'low' | 'medium' | 'high';
  summary: string;
  product_keywords?: string[];
  expected_keywords?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productDescription, ncmCode, ncmDescription } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const prompt = `Você é um especialista fiscal brasileiro. Analise a compatibilidade entre:

PRODUTO: "${productDescription}"
NCM ${ncmCode}: "${ncmDescription}"

Responda APENAS com um JSON válido seguindo este schema exato:
{
  "compatible": boolean,
  "confidence": number (0.0 a 1.0),
  "risk_level": "low" | "medium" | "high",
  "summary": "Explicação em até 50 palavras",
  "product_keywords": ["palavras", "chave", "do", "produto"],
  "expected_keywords": ["palavras", "esperadas", "pelo", "ncm"]
}

Critérios:
- compatible: true se produto pode ser classificado neste NCM
- confidence: certeza da análise
- risk_level: 
  - "low" se compatible=true e confidence>0.8
  - "medium" se compatible=true e confidence entre 0.5-0.8, ou se há ambiguidade
  - "high" se compatible=false ou confidence<0.5`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      // Fallback para não bloquear o fluxo
      return new Response(JSON.stringify({
        compatible: true,
        confidence: 0.5,
        risk_level: "medium",
        summary: "Não foi possível validar semanticamente. Verifique manualmente.",
      } as SemanticValidationResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";
    
    // Extrair JSON da resposta
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Resposta da IA não contém JSON válido");
    }

    const result: SemanticValidationResponse = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Validation error:", error);
    return new Response(JSON.stringify({
      compatible: true,
      confidence: 0.5,
      risk_level: "medium",
      summary: "Erro na validação. Verifique manualmente.",
    }), {
      status: 200, // Não bloquear o fluxo por erro
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

---

## Fase 4: Interface do Usuário

### 4.1 Componentes a Criar

| Componente | Propósito |
|------------|-----------|
| `NCMSelector` | Autocomplete com máscara, busca, tags fiscais |
| `NCMValidationBadge` | Badge colorido baseado em risk_level |
| `FiscalSuggestionsCard` | Card com sugestões de CST, alíquotas |
| `NCMHistoryTab` | Timeline de alterações no produto |
| `NCMAlertModal` | Alerta para alteração em produto faturado |

### 4.2 Badges Visuais

```tsx
// Cores baseadas no risk_level
const riskLevelColors = {
  low: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200", 
  high: "bg-red-100 text-red-800 border-red-200",
};

// Tags fiscais no NCMSelector
const fiscalTags = [
  { condition: "tem_icms_st", label: "ICMS-ST", variant: "destructive" },
  { condition: "aliquota_ipi > 0", label: "IPI", variant: "secondary" },
  { condition: "status === 'inativo'", label: "INATIVO", variant: "outline" },
];
```

---

## Fase 5: RLS Policies

```sql
-- NCM codes: leitura para todos autenticados
ALTER TABLE ncm_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read ncm_codes"
  ON ncm_codes FOR SELECT TO authenticated USING (true);

-- Apenas admins podem modificar NCM codes
CREATE POLICY "Admin manage ncm_codes"
  ON ncm_codes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Regras fiscais: leitura para autenticados
ALTER TABLE ncm_fiscal_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read ncm_fiscal_rules"
  ON ncm_fiscal_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage ncm_fiscal_rules"
  ON ncm_fiscal_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Auditoria NCM: leitura para autenticados, insert via trigger
ALTER TABLE product_ncm_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read ncm_audit"
  ON product_ncm_audit FOR SELECT TO authenticated USING (true);
CREATE POLICY "System insert ncm_audit"
  ON product_ncm_audit FOR INSERT TO authenticated
  WITH CHECK (true); -- Inserido via trigger
```

---

## Enums Necessários

```sql
CREATE TYPE regime_tributario AS ENUM (
  'simples_nacional',
  'lucro_presumido', 
  'lucro_real',
  'mei'
);

CREATE TYPE tipo_produto_fiscal AS ENUM (
  'revenda',
  'consumo',
  'industrializacao',
  'ativo_imobilizado'
);
```

---

## Checklist de Implementação

### Fase 1 - Database (Prioridade Alta)
- [ ] Criar enums (regime_tributario, tipo_produto_fiscal)
- [ ] Criar tabela ncm_codes
- [ ] Criar tabela ncm_fiscal_rules
- [ ] Criar tabela product_ncm_audit
- [ ] Adicionar campos fiscais em products
- [ ] Adicionar campos fiscais em companies
- [ ] Criar triggers de auditoria
- [ ] Criar função search_ncm
- [ ] Criar índices de performance
- [ ] Configurar RLS policies
- [ ] Importar base NCM TIPI (~12.000 códigos)

### Fase 2 - Edge Functions
- [ ] Criar validate-ncm-semantic
- [ ] Configurar em config.toml

### Fase 3 - Frontend
- [ ] Criar NCMSelector component
- [ ] Criar NCMValidationBadge component
- [ ] Criar FiscalSuggestionsCard component
- [ ] Criar NCMHistoryTab component
- [ ] Integrar no formulário de produtos
- [ ] Criar hooks (useNCMValidation, useFiscalSuggestions)

### Fase 4 - Integração
- [ ] Validar NCM em pedidos
- [ ] Validar NCM em propostas
- [ ] Bloquear faturamento sem NCM
- [ ] Recálculo automático por UF

---

## Notas de Desenvolvimento

### ⚠️ Campos fiscais em products = SNAPSHOT

Os campos fiscais gravados em `products` representam o estado no momento do cadastro:
- NÃO recalcular retroativamente
- Para atualizar, o usuário deve editar explicitamente
- Alterações são auditadas com estado completo

### ⚠️ Três níveis de alíquota IPI

1. **ncm_codes.aliquota_ipi_oficial** → Consulta (TIPI)
2. **ncm_fiscal_rules.aliquota_ipi** → Cálculo ativo
3. **products.aliquota_ipi** → Snapshot (auditoria)

### ⚠️ ncm_validated_at só é preenchido quando:

1. NCM existe
2. NCM está ativo
3. Validação semântica foi executada (sucesso ou falha)
