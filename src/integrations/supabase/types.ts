export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          company_id: string | null
          contact_id: string | null
          content: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          id: string
          metadata: Json | null
          subject: string | null
          type: string
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          id?: string
          metadata?: Json | null
          subject?: string | null
          type: string
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          id?: string
          metadata?: Json | null
          subject?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          context: Json
          created_at: string
          id: string
          messages: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          context?: Json
          created_at?: string
          id?: string
          messages?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          context?: Json
          created_at?: string
          id?: string
          messages?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bot_flow_edges: {
        Row: {
          created_at: string
          edge_id: string
          flow_id: string
          id: string
          label: string | null
          source_handle: string | null
          source_node_id: string
          target_node_id: string
        }
        Insert: {
          created_at?: string
          edge_id: string
          flow_id: string
          id?: string
          label?: string | null
          source_handle?: string | null
          source_node_id: string
          target_node_id: string
        }
        Update: {
          created_at?: string
          edge_id?: string
          flow_id?: string
          id?: string
          label?: string | null
          source_handle?: string | null
          source_node_id?: string
          target_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_flow_edges_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "bot_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_flow_nodes: {
        Row: {
          config: Json
          created_at: string
          flow_id: string
          id: string
          node_id: string
          node_type: string
          position_x: number
          position_y: number
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          flow_id: string
          id?: string
          node_id: string
          node_type: string
          position_x?: number
          position_y?: number
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          flow_id?: string
          id?: string
          node_id?: string
          node_type?: string
          position_x?: number
          position_y?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_flow_nodes_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "bot_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_flows: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          trigger_config: Json | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      bot_session_data: {
        Row: {
          collected_at: string
          field_name: string
          field_value: string | null
          id: string
          session_id: string
        }
        Insert: {
          collected_at?: string
          field_name: string
          field_value?: string | null
          id?: string
          session_id: string
        }
        Update: {
          collected_at?: string
          field_name?: string
          field_value?: string | null
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_session_data_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "bot_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_sessions: {
        Row: {
          company_id: string | null
          completed_at: string | null
          contact_id: string | null
          current_node_id: string | null
          flow_id: string
          id: string
          instance_id: string | null
          last_activity_at: string
          phone: string
          started_at: string
          status: string
          timeout_at: string | null
          transferred_to: string | null
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          current_node_id?: string | null
          flow_id: string
          id?: string
          instance_id?: string | null
          last_activity_at?: string
          phone: string
          started_at?: string
          status?: string
          timeout_at?: string | null
          transferred_to?: string | null
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          current_node_id?: string | null
          flow_id?: string
          id?: string
          instance_id?: string | null
          last_activity_at?: string
          phone?: string
          started_at?: string
          status?: string
          timeout_at?: string | null
          transferred_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_sessions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_sessions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "bot_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_sessions_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          annual_revenue: string | null
          city: string | null
          cnpj: string | null
          country: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          domain: string | null
          email: string | null
          employee_count: string | null
          fantasia: string | null
          id: string
          industry: string | null
          iniflex_id: string | null
          iniflex_synced_at: string | null
          inscricao_estadual: string | null
          name: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          state: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          annual_revenue?: string | null
          city?: string | null
          cnpj?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          domain?: string | null
          email?: string | null
          employee_count?: string | null
          fantasia?: string | null
          id?: string
          industry?: string | null
          iniflex_id?: string | null
          iniflex_synced_at?: string | null
          inscricao_estadual?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          annual_revenue?: string | null
          city?: string | null
          cnpj?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          domain?: string | null
          email?: string | null
          employee_count?: string | null
          fantasia?: string | null
          id?: string
          industry?: string | null
          iniflex_id?: string | null
          iniflex_synced_at?: string | null
          inscricao_estadual?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company_id: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          department: string | null
          email: string | null
          first_name: string
          id: string
          iniflex_id: string | null
          iniflex_synced_at: string | null
          job_title: string | null
          last_name: string | null
          linkedin_url: string | null
          mobile: string | null
          notes: string | null
          owner_id: string | null
          phone: string | null
          tipo_pessoa: Database["public"]["Enums"]["tipo_pessoa"] | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          department?: string | null
          email?: string | null
          first_name: string
          id?: string
          iniflex_id?: string | null
          iniflex_synced_at?: string | null
          job_title?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          mobile?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          tipo_pessoa?: Database["public"]["Enums"]["tipo_pessoa"] | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          department?: string | null
          email?: string | null
          first_name?: string
          id?: string
          iniflex_id?: string | null
          iniflex_synced_at?: string | null
          job_title?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          mobile?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          tipo_pessoa?: Database["public"]["Enums"]["tipo_pessoa"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_client_addresses: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          client_id: string
          codigo_cidade: string | null
          complemento: string | null
          created_at: string
          endereco: string | null
          id: string
          numero: string | null
          tipo: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          client_id: string
          codigo_cidade?: string | null
          complemento?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          numero?: string | null
          tipo: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          client_id?: string
          codigo_cidade?: string | null
          complemento?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          numero?: string | null
          tipo?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_client_addresses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_clients: {
        Row: {
          celular: string | null
          cnpj_cpf: string | null
          contribui_icms: boolean | null
          created_at: string
          data_alteracao_erp: string | null
          destino_mercadoria: string | null
          emails: string[] | null
          external_id: string
          id: string
          insc_estadual: string | null
          nome_fantasia: string | null
          possui_titulos: boolean | null
          raw_data: Json | null
          razao_social: string | null
          regiao: string | null
          rg: string | null
          segmento: string | null
          subregiao: string | null
          subsegmento: string | null
          synced_at: string
          telefone: string | null
          tipo_cliente: string | null
          tipo_fornecedor: string | null
          tipo_pessoa: string | null
          tipo_representante: string | null
          tipo_transportador: string | null
          updated_at: string
          usuario_alteracao_erp: string | null
        }
        Insert: {
          celular?: string | null
          cnpj_cpf?: string | null
          contribui_icms?: boolean | null
          created_at?: string
          data_alteracao_erp?: string | null
          destino_mercadoria?: string | null
          emails?: string[] | null
          external_id: string
          id?: string
          insc_estadual?: string | null
          nome_fantasia?: string | null
          possui_titulos?: boolean | null
          raw_data?: Json | null
          razao_social?: string | null
          regiao?: string | null
          rg?: string | null
          segmento?: string | null
          subregiao?: string | null
          subsegmento?: string | null
          synced_at?: string
          telefone?: string | null
          tipo_cliente?: string | null
          tipo_fornecedor?: string | null
          tipo_pessoa?: string | null
          tipo_representante?: string | null
          tipo_transportador?: string | null
          updated_at?: string
          usuario_alteracao_erp?: string | null
        }
        Update: {
          celular?: string | null
          cnpj_cpf?: string | null
          contribui_icms?: boolean | null
          created_at?: string
          data_alteracao_erp?: string | null
          destino_mercadoria?: string | null
          emails?: string[] | null
          external_id?: string
          id?: string
          insc_estadual?: string | null
          nome_fantasia?: string | null
          possui_titulos?: boolean | null
          raw_data?: Json | null
          razao_social?: string | null
          regiao?: string | null
          rg?: string | null
          segmento?: string | null
          subregiao?: string | null
          subsegmento?: string | null
          synced_at?: string
          telefone?: string | null
          tipo_cliente?: string | null
          tipo_fornecedor?: string | null
          tipo_pessoa?: string | null
          tipo_representante?: string | null
          tipo_transportador?: string | null
          updated_at?: string
          usuario_alteracao_erp?: string | null
        }
        Relationships: []
      }
      crm_products: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          custo_medio: number | null
          data_alteracao_erp: string | null
          descricao: string | null
          descricao_completa: string | null
          descricao_simples: string | null
          external_id: string
          gera_estoque: boolean | null
          grupo: string | null
          id: string
          ncm: string | null
          preco_venda: number | null
          produto_codigo: string | null
          raw_data: Json | null
          sku: string | null
          subgrupo: string | null
          synced_at: string | null
          tipo_item: string | null
          unidade: string | null
          updated_at: string | null
          usuario_alteracao_erp: string | null
          versao: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          custo_medio?: number | null
          data_alteracao_erp?: string | null
          descricao?: string | null
          descricao_completa?: string | null
          descricao_simples?: string | null
          external_id: string
          gera_estoque?: boolean | null
          grupo?: string | null
          id?: string
          ncm?: string | null
          preco_venda?: number | null
          produto_codigo?: string | null
          raw_data?: Json | null
          sku?: string | null
          subgrupo?: string | null
          synced_at?: string | null
          tipo_item?: string | null
          unidade?: string | null
          updated_at?: string | null
          usuario_alteracao_erp?: string | null
          versao?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          custo_medio?: number | null
          data_alteracao_erp?: string | null
          descricao?: string | null
          descricao_completa?: string | null
          descricao_simples?: string | null
          external_id?: string
          gera_estoque?: boolean | null
          grupo?: string | null
          id?: string
          ncm?: string | null
          preco_venda?: number | null
          produto_codigo?: string | null
          raw_data?: Json | null
          sku?: string | null
          subgrupo?: string | null
          synced_at?: string | null
          tipo_item?: string | null
          unidade?: string | null
          updated_at?: string | null
          usuario_alteracao_erp?: string | null
          versao?: string | null
        }
        Relationships: []
      }
      custom_fields: {
        Row: {
          created_at: string
          created_by: string | null
          entity: Database["public"]["Enums"]["custom_field_entity"]
          field_type: Database["public"]["Enums"]["custom_field_type"]
          id: string
          is_required: boolean | null
          label: string
          name: string
          options: Json | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity: Database["public"]["Enums"]["custom_field_entity"]
          field_type?: Database["public"]["Enums"]["custom_field_type"]
          id?: string
          is_required?: boolean | null
          label: string
          name: string
          options?: Json | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity?: Database["public"]["Enums"]["custom_field_entity"]
          field_type?: Database["public"]["Enums"]["custom_field_type"]
          id?: string
          is_required?: boolean | null
          label?: string
          name?: string
          options?: Json | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      deal_audit_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          deal_id: string
          field_label: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          deal_id: string
          field_label: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          deal_id?: string
          field_label?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_audit_log_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_checklist_completions: {
        Row: {
          checklist_item_id: string
          completed_at: string | null
          completed_by: string | null
          deal_id: string
          id: string
          notes: string | null
        }
        Insert: {
          checklist_item_id: string
          completed_at?: string | null
          completed_by?: string | null
          deal_id: string
          id?: string
          notes?: string | null
        }
        Update: {
          checklist_item_id?: string
          completed_at?: string | null
          completed_by?: string | null
          deal_id?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_checklist_completions_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "stage_checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_checklist_completions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_participants: {
        Row: {
          added_by: string | null
          created_at: string
          deal_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          deal_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          deal_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_participants_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          created_at: string
          deal_id: string
          duration_seconds: number | null
          from_stage: Database["public"]["Enums"]["deal_stage"] | null
          id: string
          to_stage: Database["public"]["Enums"]["deal_stage"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          deal_id: string
          duration_seconds?: number | null
          from_stage?: Database["public"]["Enums"]["deal_stage"] | null
          id?: string
          to_stage: Database["public"]["Enums"]["deal_stage"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          deal_id?: string
          duration_seconds?: number | null
          from_stage?: Database["public"]["Enums"]["deal_stage"] | null
          id?: string
          to_stage?: Database["public"]["Enums"]["deal_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "deal_stage_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          closed_at: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          expected_close_date: string | null
          id: string
          lost_reason: string | null
          name: string
          notes: string | null
          owner_id: string | null
          pipeline_id: string | null
          probability: number | null
          stage: Database["public"]["Enums"]["deal_stage"]
          updated_at: string
          value: number | null
        }
        Insert: {
          closed_at?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          expected_close_date?: string | null
          id?: string
          lost_reason?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          pipeline_id?: string | null
          probability?: number | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          updated_at?: string
          value?: number | null
        }
        Update: {
          closed_at?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          expected_close_date?: string | null
          id?: string
          lost_reason?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          pipeline_id?: string | null
          probability?: number | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          body: string
          contact_id: string | null
          deal_id: string | null
          from_email: string | null
          id: string
          metadata: Json | null
          opened_at: string | null
          scheduled_for: string | null
          sent_at: string | null
          sent_by: string | null
          status: string | null
          subject: string
          template_id: string | null
          to_email: string
        }
        Insert: {
          body: string
          contact_id?: string | null
          deal_id?: string | null
          from_email?: string | null
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          subject: string
          template_id?: string | null
          to_email: string
        }
        Update: {
          body?: string
          contact_id?: string | null
          deal_id?: string | null
          from_email?: string | null
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          subject?: string
          template_id?: string | null
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_shared: boolean | null
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_shared?: boolean | null
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_shared?: boolean | null
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      entity_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      erp_sync_control: {
        Row: {
          created_at: string
          entity: string
          id: string
          last_sync_at: string
          last_sync_count: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity: string
          id?: string
          last_sync_at?: string
          last_sync_count?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity?: string
          id?: string
          last_sync_at?: string
          last_sync_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      erp_sync_logs: {
        Row: {
          created_at: string | null
          direction: string
          entity_id: string
          entity_type: string
          error_message: string | null
          external_id: string | null
          id: string
          request_payload: Json | null
          response_payload: Json | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          direction?: string
          entity_id: string
          entity_type: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          direction?: string
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      iniflex_sandbox_logs: {
        Row: {
          created_at: string
          created_by: string | null
          error_message: string | null
          http_status: number | null
          id: string
          latency_ms: number | null
          request_payload: Json
          response_payload: Json | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          latency_ms?: number | null
          request_payload: Json
          response_payload?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          latency_ms?: number | null
          request_payload?: Json
          response_payload?: Json | null
        }
        Relationships: []
      }
      license_settings: {
        Row: {
          created_at: string
          features: Json | null
          id: string
          max_users: number
          plan_name: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          features?: Json | null
          id?: string
          max_users?: number
          plan_name?: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          features?: Json | null
          id?: string
          max_users?: number
          plan_name?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          daily_summary_email: boolean | null
          deal_stagnant_alert: boolean | null
          deal_stagnant_days: number | null
          id: string
          proposal_expiring_alert: boolean | null
          proposal_expiring_days: number | null
          task_reminder_email: boolean | null
          task_reminder_hours: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_summary_email?: boolean | null
          deal_stagnant_alert?: boolean | null
          deal_stagnant_days?: number | null
          id?: string
          proposal_expiring_alert?: boolean | null
          proposal_expiring_days?: number | null
          task_reminder_email?: boolean | null
          task_reminder_hours?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_summary_email?: boolean | null
          deal_stagnant_alert?: boolean | null
          deal_stagnant_days?: number | null
          id?: string
          proposal_expiring_alert?: boolean | null
          proposal_expiring_days?: number | null
          task_reminder_email?: boolean | null
          task_reminder_hours?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      order_audit_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          field_label: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          order_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          field_label: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          order_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          field_label?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_audit_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          description: string
          discount_percent: number | null
          id: string
          length: number | null
          order_id: string
          product_id: string | null
          quantity: number
          sort_order: number | null
          subtotal: number
          thickness: number | null
          unit_price: number
          width: number | null
        }
        Insert: {
          created_at?: string
          description: string
          discount_percent?: number | null
          id?: string
          length?: number | null
          order_id: string
          product_id?: string | null
          quantity?: number
          sort_order?: number | null
          subtotal?: number
          thickness?: number | null
          unit_price?: number
          width?: number | null
        }
        Update: {
          created_at?: string
          description?: string
          discount_percent?: number | null
          id?: string
          length?: number | null
          order_id?: string
          product_id?: string | null
          quantity?: number
          sort_order?: number | null
          subtotal?: number
          thickness?: number | null
          unit_price?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          delivery_date: string | null
          id: string
          number: string
          observations: string | null
          proposal_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          total_value: number | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_date?: string | null
          id?: string
          number: string
          observations?: string | null
          proposal_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_value?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_date?: string | null
          id?: string
          number?: string
          observations?: string | null
          proposal_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_automations: {
        Row: {
          action_config: Json
          action_type: Database["public"]["Enums"]["automation_action"]
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          trigger_stage: Database["public"]["Enums"]["deal_stage"]
          trigger_type: Database["public"]["Enums"]["automation_trigger"]
          updated_at: string
        }
        Insert: {
          action_config?: Json
          action_type: Database["public"]["Enums"]["automation_action"]
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          trigger_stage: Database["public"]["Enums"]["deal_stage"]
          trigger_type: Database["public"]["Enums"]["automation_trigger"]
          updated_at?: string
        }
        Update: {
          action_config?: Json
          action_type?: Database["public"]["Enums"]["automation_action"]
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          trigger_stage?: Database["public"]["Enums"]["deal_stage"]
          trigger_type?: Database["public"]["Enums"]["automation_trigger"]
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          color: string | null
          created_at: string
          default_owner_id: string | null
          id: string
          name: string
          pipeline_id: string | null
          probability: number | null
          sla_hours: number | null
          sla_warning_hours: number | null
          sort_order: number
          stage: Database["public"]["Enums"]["deal_stage"]
        }
        Insert: {
          color?: string | null
          created_at?: string
          default_owner_id?: string | null
          id?: string
          name: string
          pipeline_id?: string | null
          probability?: number | null
          sla_hours?: number | null
          sla_warning_hours?: number | null
          sort_order: number
          stage: Database["public"]["Enums"]["deal_stage"]
        }
        Update: {
          color?: string | null
          created_at?: string
          default_owner_id?: string | null
          id?: string
          name?: string
          pipeline_id?: string | null
          probability?: number | null
          sla_hours?: number | null
          sla_warning_hours?: number | null
          sort_order?: number
          stage?: Database["public"]["Enums"]["deal_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      portfolio_transfers: {
        Row: {
          created_at: string | null
          entity_id: string
          entity_name: string
          entity_type: string
          from_user_id: string | null
          id: string
          notes: string | null
          to_user_id: string
          transferred_at: string | null
          transferred_by: string
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          entity_name: string
          entity_type: string
          from_user_id?: string | null
          id?: string
          notes?: string | null
          to_user_id: string
          transferred_at?: string | null
          transferred_by: string
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          entity_name?: string
          entity_type?: string
          from_user_id?: string | null
          id?: string
          notes?: string | null
          to_user_id?: string
          transferred_at?: string | null
          transferred_by?: string
        }
        Relationships: []
      }
      pricing_rules: {
        Row: {
          category: string | null
          created_at: string
          discount_percent: number | null
          fixed_price: number | null
          id: string
          max_quantity: number | null
          min_quantity: number
          price_per_unit: number | null
          pricing_table_id: string
          product_id: string | null
          sort_order: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          discount_percent?: number | null
          fixed_price?: number | null
          id?: string
          max_quantity?: number | null
          min_quantity?: number
          price_per_unit?: number | null
          pricing_table_id: string
          product_id?: string | null
          sort_order?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          discount_percent?: number | null
          fixed_price?: number | null
          id?: string
          max_quantity?: number | null
          min_quantity?: number
          price_per_unit?: number | null
          pricing_table_id?: string
          product_id?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_pricing_table_id_fkey"
            columns: ["pricing_table_id"]
            isOneToOne: false
            referencedRelation: "pricing_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_table_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          pricing_table_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          pricing_table_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          pricing_table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_table_assignments_pricing_table_id_fkey"
            columns: ["pricing_table_id"]
            isOneToOne: false
            referencedRelation: "pricing_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_tables: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean | null
          category: string | null
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          length: number | null
          material: string | null
          name: string
          sku: string
          thickness: number | null
          unit_measure: string | null
          unit_price: number | null
          updated_at: string
          width: number | null
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          length?: number | null
          material?: string | null
          name: string
          sku: string
          thickness?: number | null
          unit_measure?: string | null
          unit_price?: number | null
          updated_at?: string
          width?: number | null
        }
        Update: {
          active?: boolean | null
          category?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          length?: number | null
          material?: string | null
          name?: string
          sku?: string
          thickness?: number | null
          unit_measure?: string | null
          unit_price?: number | null
          updated_at?: string
          width?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proposal_access_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string
          proposal_id: string | null
          success: boolean
          token_prefix: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address: string
          proposal_id?: string | null
          success?: boolean
          token_prefix?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string
          proposal_id?: string | null
          success?: boolean
          token_prefix?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_access_logs_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_items: {
        Row: {
          created_at: string
          description: string
          discount_percent: number | null
          id: string
          length: number | null
          product_id: string | null
          proposal_id: string
          quantity: number
          sort_order: number | null
          subtotal: number
          thickness: number | null
          unit_price: number
          width: number | null
        }
        Insert: {
          created_at?: string
          description: string
          discount_percent?: number | null
          id?: string
          length?: number | null
          product_id?: string | null
          proposal_id: string
          quantity?: number
          sort_order?: number | null
          subtotal?: number
          thickness?: number | null
          unit_price?: number
          width?: number | null
        }
        Update: {
          created_at?: string
          description?: string
          discount_percent?: number | null
          id?: string
          length?: number | null
          product_id?: string | null
          proposal_id?: string
          quantity?: number
          sort_order?: number | null
          subtotal?: number
          thickness?: number | null
          unit_price?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          approval_token: string | null
          approval_token_expires_at: string | null
          approved_at: string | null
          approved_by_ip: string | null
          approved_by_name: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string
          delivery_terms: string | null
          id: string
          number: string
          observations: string | null
          payment_terms: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["proposal_status"]
          total_value: number | null
          updated_at: string
          validity_date: string | null
        }
        Insert: {
          approval_token?: string | null
          approval_token_expires_at?: string | null
          approved_at?: string | null
          approved_by_ip?: string | null
          approved_by_name?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id: string
          delivery_terms?: string | null
          id?: string
          number: string
          observations?: string | null
          payment_terms?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          total_value?: number | null
          updated_at?: string
          validity_date?: string | null
        }
        Update: {
          approval_token?: string | null
          approval_token_expires_at?: string | null
          approved_at?: string | null
          approved_by_ip?: string | null
          approved_by_name?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string
          delivery_terms?: string | null
          id?: string
          number?: string
          observations?: string | null
          payment_terms?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          total_value?: number | null
          updated_at?: string
          validity_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      role_module_permissions: {
        Row: {
          access_type: Database["public"]["Enums"]["access_level"] | null
          can_access: boolean | null
          created_at: string | null
          id: string
          module_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
        }
        Insert: {
          access_type?: Database["public"]["Enums"]["access_level"] | null
          can_access?: boolean | null
          created_at?: string | null
          id?: string
          module_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Update: {
          access_type?: Database["public"]["Enums"]["access_level"] | null
          can_access?: boolean | null
          created_at?: string | null
          id?: string
          module_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_module_permissions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "system_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_goals: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          period_end: string
          period_start: string
          period_type: string
          target_deals: number | null
          target_value: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          period_end: string
          period_start: string
          period_type?: string
          target_deals?: number | null
          target_value?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          period_end?: string
          period_start?: string
          period_type?: string
          target_deals?: number | null
          target_value?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      stage_checklist_items: {
        Row: {
          auto_condition: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_required: boolean | null
          pipeline_id: string | null
          sort_order: number | null
          stage: Database["public"]["Enums"]["deal_stage"]
          title: string
          validation_type: string | null
        }
        Insert: {
          auto_condition?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_required?: boolean | null
          pipeline_id?: string | null
          sort_order?: number | null
          stage: Database["public"]["Enums"]["deal_stage"]
          title: string
          validation_type?: string | null
        }
        Update: {
          auto_condition?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_required?: boolean | null
          pipeline_id?: string | null
          sort_order?: number | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          title?: string
          validation_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stage_checklist_items_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      system_modules: {
        Row: {
          created_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          key: string
          name: string
          path: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          key: string
          name: string
          path: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          key?: string
          name?: string
          path?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      task_reminders: {
        Row: {
          created_at: string
          id: string
          reminder_type: string
          sent_at: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reminder_type?: string
          sent_at?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reminder_type?: string
          sent_at?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_reminders_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          company_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          description: string | null
          due_date: string | null
          due_time: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dashboard_configs: {
        Row: {
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
          user_id: string
          widgets: Json
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
          user_id: string
          widgets?: Json
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
          widgets?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_contacts: {
        Row: {
          contact_id: string | null
          created_at: string
          id: string
          phone_number: string
          profile_name: string | null
          profile_picture_url: string | null
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          id?: string
          phone_number: string
          profile_name?: string | null
          profile_picture_url?: string | null
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          id?: string
          phone_number?: string
          profile_name?: string | null
          profile_picture_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversation_summaries: {
        Row: {
          analyzed_at: string | null
          contact_id: string | null
          created_at: string | null
          customer_intent: string | null
          id: string
          message_count: number | null
          next_steps: string[] | null
          phone: string
          sentiment: string | null
          summary: string
          updated_at: string | null
        }
        Insert: {
          analyzed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          customer_intent?: string | null
          id?: string
          message_count?: number | null
          next_steps?: string[] | null
          phone: string
          sentiment?: string | null
          summary: string
          updated_at?: string | null
        }
        Update: {
          analyzed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          customer_intent?: string | null
          id?: string
          message_count?: number | null
          next_steps?: string[] | null
          phone?: string
          sentiment?: string | null
          summary?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversation_summaries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          connected_at: string | null
          created_at: string
          id: string
          instance_id: string
          instance_token: string
          name: string
          phone_number: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          id?: string
          instance_id: string
          instance_token: string
          name: string
          phone_number?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          id?: string
          instance_id?: string
          instance_token?: string
          name?: string
          phone_number?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          company_id: string | null
          contact_id: string | null
          content: string | null
          created_at: string
          direction: string
          id: string
          instance_id: string | null
          is_read: boolean
          media_url: string | null
          message_type: string
          phone: string
          status: string
          zapi_message_id: string | null
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          content?: string | null
          created_at?: string
          direction: string
          id?: string
          instance_id?: string | null
          is_read?: boolean
          media_url?: string | null
          message_type?: string
          phone: string
          status?: string
          zapi_message_id?: string | null
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          content?: string | null
          created_at?: string
          direction?: string
          id?: string
          instance_id?: string | null
          is_read?: boolean
          media_url?: string | null
          message_type?: string
          phone?: string
          status?: string
          zapi_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_objections: {
        Row: {
          contact_id: string | null
          created_at: string | null
          description: string
          detected_at: string | null
          id: string
          message_excerpt: string | null
          phone: string
          resolution: string | null
          status: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          description: string
          detected_at?: string | null
          id?: string
          message_excerpt?: string | null
          phone: string
          resolution?: string | null
          status?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          description?: string
          detected_at?: string | null
          id?: string
          message_excerpt?: string | null
          phone?: string
          resolution?: string | null
          status?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_objections_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          category: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_shared: boolean | null
          name: string
          updated_at: string
          variables: Json | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_shared?: boolean | null
          name: string
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_shared?: boolean | null
          name?: string
          updated_at?: string
          variables?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_license_status: {
        Args: never
        Returns: {
          can_add_user: boolean
          current_users: number
          max_users: number
          plan_name: string
          usage_percentage: number
          valid_until: string
        }[]
      }
      get_module_access_type: {
        Args: { _module_key: string; _user_id: string }
        Returns: string
      }
      get_user_modules: {
        Args: { _user_id: string }
        Returns: {
          access_type: string
          module_icon: string
          module_key: string
          module_name: string
          module_path: string
        }[]
      }
      has_module_access: {
        Args: { _module_key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated: { Args: never; Returns: boolean }
    }
    Enums: {
      access_level: "restrito" | "total"
      app_role: "admin" | "vendedor" | "atendente" | "desenvolvedor"
      automation_action:
        | "send_whatsapp"
        | "create_task"
        | "add_tag"
        | "send_email"
      automation_trigger: "stage_enter" | "stage_exit"
      custom_field_entity: "company" | "contact" | "deal"
      custom_field_type:
        | "text"
        | "number"
        | "date"
        | "select"
        | "multiselect"
        | "checkbox"
        | "url"
        | "email"
        | "phone"
        | "currency"
      deal_stage:
        | "prospeccao"
        | "qualificacao"
        | "proposta"
        | "negociacao"
        | "fechado_ganho"
        | "fechado_perdido"
      order_status:
        | "pendente"
        | "em_producao"
        | "produzido"
        | "faturado"
        | "entregue"
        | "cancelado"
      proposal_status:
        | "rascunho"
        | "enviada"
        | "em_analise"
        | "aprovada"
        | "recusada"
        | "expirada"
      task_priority: "baixa" | "media" | "alta" | "urgente"
      task_status: "pendente" | "em_andamento" | "concluida" | "cancelada"
      tipo_pessoa: "PF" | "PJ"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      access_level: ["restrito", "total"],
      app_role: ["admin", "vendedor", "atendente", "desenvolvedor"],
      automation_action: [
        "send_whatsapp",
        "create_task",
        "add_tag",
        "send_email",
      ],
      automation_trigger: ["stage_enter", "stage_exit"],
      custom_field_entity: ["company", "contact", "deal"],
      custom_field_type: [
        "text",
        "number",
        "date",
        "select",
        "multiselect",
        "checkbox",
        "url",
        "email",
        "phone",
        "currency",
      ],
      deal_stage: [
        "prospeccao",
        "qualificacao",
        "proposta",
        "negociacao",
        "fechado_ganho",
        "fechado_perdido",
      ],
      order_status: [
        "pendente",
        "em_producao",
        "produzido",
        "faturado",
        "entregue",
        "cancelado",
      ],
      proposal_status: [
        "rascunho",
        "enviada",
        "em_analise",
        "aprovada",
        "recusada",
        "expirada",
      ],
      task_priority: ["baixa", "media", "alta", "urgente"],
      task_status: ["pendente", "em_andamento", "concluida", "cancelada"],
      tipo_pessoa: ["PF", "PJ"],
    },
  },
} as const
