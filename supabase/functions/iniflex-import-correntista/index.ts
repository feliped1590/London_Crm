import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportRequest {
  correntista: {
    id: string;
    cnpj_cpf: string;
    nome: string;
    fantasia?: string;
    email?: string;
    fone?: string;
    pfpj: string;
    cidade?: string;
    estado?: string;
    endereco?: string;
    bairro?: string;
    cep?: string;
    insc_estadual?: string;
    obs_geral?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { correntista } = await req.json() as ImportRequest;

    if (!correntista || !correntista.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Dados do correntista são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[iniflex-import-correntista] Importando correntista: ${correntista.id} - ${correntista.nome}`);

    const isPJ = correntista.pfpj === 'PJ' || (correntista.cnpj_cpf?.length > 11);
    const documento = correntista.cnpj_cpf?.replace(/\D/g, '') || '';

    if (isPJ) {
      // Importar como empresa
      // Verificar se já existe
      let existingCompany = null;
      
      if (documento) {
        const { data } = await supabase
          .from('companies')
          .select('id')
          .eq('cnpj', documento)
          .maybeSingle();
        existingCompany = data;
      }

      if (!existingCompany) {
        const { data: byInflexId } = await supabase
          .from('companies')
          .select('id')
          .eq('iniflex_id', String(correntista.id))
          .maybeSingle();
        existingCompany = byInflexId;
      }

      const companyData = {
        name: correntista.nome,
        fantasia: correntista.fantasia || null,
        cnpj: documento || null,
        email: correntista.email || null,
        phone: correntista.fone || null,
        address: correntista.endereco || null,
        city: correntista.cidade || null,
        state: correntista.estado || null,
        inscricao_estadual: correntista.insc_estadual || null,
        notes: correntista.obs_geral || null,
        iniflex_id: String(correntista.id),
        iniflex_synced_at: new Date().toISOString(),
      };

      if (existingCompany) {
        // Atualizar empresa existente
        const { error } = await supabase
          .from('companies')
          .update(companyData)
          .eq('id', existingCompany.id);

        if (error) {
          console.error('[iniflex-import-correntista] Erro ao atualizar empresa:', error);
          throw error;
        }

        console.log(`[iniflex-import-correntista] Empresa atualizada: ${existingCompany.id}`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            type: 'company',
            action: 'updated',
            id: existingCompany.id,
            message: 'Empresa atualizada com sucesso'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Criar nova empresa
        const { data: newCompany, error } = await supabase
          .from('companies')
          .insert(companyData)
          .select('id')
          .single();

        if (error) {
          console.error('[iniflex-import-correntista] Erro ao criar empresa:', error);
          throw error;
        }

        console.log(`[iniflex-import-correntista] Empresa criada: ${newCompany.id}`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            type: 'company',
            action: 'created',
            id: newCompany.id,
            message: 'Empresa criada com sucesso'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Importar como contato (PF)
      // Verificar se já existe
      let existingContact = null;
      
      if (documento) {
        const { data } = await supabase
          .from('contacts')
          .select('id')
          .eq('cpf', documento)
          .maybeSingle();
        existingContact = data;
      }

      if (!existingContact) {
        const { data: byInflexId } = await supabase
          .from('contacts')
          .select('id')
          .eq('iniflex_id', String(correntista.id))
          .maybeSingle();
        existingContact = byInflexId;
      }

      // Separar nome em first_name e last_name
      const nomeParts = correntista.nome.trim().split(' ');
      const firstName = nomeParts[0] || correntista.nome;
      const lastName = nomeParts.slice(1).join(' ') || null;

      const contactData = {
        first_name: firstName,
        last_name: lastName,
        cpf: documento || null,
        tipo_pessoa: 'PF' as const,
        email: correntista.email || null,
        phone: correntista.fone || null,
        mobile: correntista.fone || null,
        notes: correntista.obs_geral || null,
        iniflex_id: String(correntista.id),
        iniflex_synced_at: new Date().toISOString(),
      };

      if (existingContact) {
        // Atualizar contato existente
        const { error } = await supabase
          .from('contacts')
          .update(contactData)
          .eq('id', existingContact.id);

        if (error) {
          console.error('[iniflex-import-correntista] Erro ao atualizar contato:', error);
          throw error;
        }

        console.log(`[iniflex-import-correntista] Contato atualizado: ${existingContact.id}`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            type: 'contact',
            action: 'updated',
            id: existingContact.id,
            message: 'Contato atualizado com sucesso'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Criar novo contato
        const { data: newContact, error } = await supabase
          .from('contacts')
          .insert(contactData)
          .select('id')
          .single();

        if (error) {
          console.error('[iniflex-import-correntista] Erro ao criar contato:', error);
          throw error;
        }

        console.log(`[iniflex-import-correntista] Contato criado: ${newContact.id}`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            type: 'contact',
            action: 'created',
            id: newContact.id,
            message: 'Contato criado com sucesso'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

  } catch (error) {
    console.error('[iniflex-import-correntista] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
