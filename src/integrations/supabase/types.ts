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
      access_violation_log: {
        Row: {
          action: string
          attempted_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          target_owner_id: string
          target_owner_name: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          attempted_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          target_owner_id: string
          target_owner_name?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          attempted_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          target_owner_id?: string
          target_owner_name?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
            foreignKeyName: "activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_activity_summary"
            referencedColumns: ["company_id"]
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
          {
            foreignKeyName: "activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_intervention_log: {
        Row: {
          action_type: string
          admin_user_id: string
          client_id: string | null
          client_name: string | null
          client_owner_id: string | null
          client_owner_name: string | null
          created_at: string
          details: Json | null
          entity_id: string
          entity_name: string | null
          entity_type: string
          id: string
          justification: string
        }
        Insert: {
          action_type: string
          admin_user_id: string
          client_id?: string | null
          client_name?: string | null
          client_owner_id?: string | null
          client_owner_name?: string | null
          created_at?: string
          details?: Json | null
          entity_id: string
          entity_name?: string | null
          entity_type: string
          id?: string
          justification: string
        }
        Update: {
          action_type?: string
          admin_user_id?: string
          client_id?: string | null
          client_name?: string | null
          client_owner_id?: string | null
          client_owner_name?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string
          entity_name?: string | null
          entity_type?: string
          id?: string
          justification?: string
        }
        Relationships: []
      }
      ai_assistant_configs: {
        Row: {
          created_at: string
          id: string
          name: string
          prompt: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          prompt?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          prompt?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
      app_sessions: {
        Row: {
          device_info: string | null
          expires_at: string
          id: string
          invalidated_at: string | null
          invalidated_reason: string | null
          ip_address: string | null
          is_valid: boolean
          last_activity_at: string
          started_at: string
          tenant_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          device_info?: string | null
          expires_at: string
          id?: string
          invalidated_at?: string | null
          invalidated_reason?: string | null
          ip_address?: string | null
          is_valid?: boolean
          last_activity_at?: string
          started_at?: string
          tenant_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          device_info?: string | null
          expires_at?: string
          id?: string
          invalidated_at?: string | null
          invalidated_reason?: string | null
          ip_address?: string | null
          is_valid?: boolean
          last_activity_at?: string
          started_at?: string
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      atividades: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          is_active: boolean | null
          nome: string
          nome_legado: string | null
          segmento_id: string
          sort_order: number | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean | null
          nome: string
          nome_legado?: string | null
          segmento_id: string
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean | null
          nome?: string
          nome_legado?: string | null
          segmento_id?: string
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atividades_segmento_id_fkey"
            columns: ["segmento_id"]
            isOneToOne: false
            referencedRelation: "segmentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      beneficios_fiscais: {
        Row: {
          aliquota_resultante: number | null
          codigo: string | null
          created_at: string | null
          created_by: string | null
          data_documento: string | null
          documento_nome: string | null
          documento_url: string | null
          id: string
          is_active: boolean | null
          ncms_aplicaveis: string[] | null
          nome: string
          notes: string | null
          numero_documento: string
          orgao_emissor: string | null
          percentual_reducao: number | null
          tipo: Database["public"]["Enums"]["tipo_beneficio_fiscal"]
          tributo: Database["public"]["Enums"]["tributo_afetado"]
          updated_at: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          aliquota_resultante?: number | null
          codigo?: string | null
          created_at?: string | null
          created_by?: string | null
          data_documento?: string | null
          documento_nome?: string | null
          documento_url?: string | null
          id?: string
          is_active?: boolean | null
          ncms_aplicaveis?: string[] | null
          nome: string
          notes?: string | null
          numero_documento: string
          orgao_emissor?: string | null
          percentual_reducao?: number | null
          tipo: Database["public"]["Enums"]["tipo_beneficio_fiscal"]
          tributo: Database["public"]["Enums"]["tributo_afetado"]
          updated_at?: string | null
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          aliquota_resultante?: number | null
          codigo?: string | null
          created_at?: string | null
          created_by?: string | null
          data_documento?: string | null
          documento_nome?: string | null
          documento_url?: string | null
          id?: string
          is_active?: boolean | null
          ncms_aplicaveis?: string[] | null
          nome?: string
          notes?: string | null
          numero_documento?: string
          orgao_emissor?: string | null
          percentual_reducao?: number | null
          tipo?: Database["public"]["Enums"]["tipo_beneficio_fiscal"]
          tributo?: Database["public"]["Enums"]["tributo_afetado"]
          updated_at?: string | null
          valid_from?: string
          valid_until?: string | null
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
            foreignKeyName: "bot_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_activity_summary"
            referencedColumns: ["company_id"]
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
      cadastro_cfop: {
        Row: {
          aplicacao: string | null
          codigo: string
          created_at: string | null
          descricao: string
          id: string
          is_active: boolean | null
          observacoes: string | null
          tipo_operacao: string | null
        }
        Insert: {
          aplicacao?: string | null
          codigo: string
          created_at?: string | null
          descricao: string
          id?: string
          is_active?: boolean | null
          observacoes?: string | null
          tipo_operacao?: string | null
        }
        Update: {
          aplicacao?: string | null
          codigo?: string
          created_at?: string | null
          descricao?: string
          id?: string
          is_active?: boolean | null
          observacoes?: string | null
          tipo_operacao?: string | null
        }
        Relationships: []
      }
      cadastro_cst: {
        Row: {
          codigo: string
          created_at: string | null
          descricao: string
          id: string
          is_active: boolean | null
          observacoes: string | null
          tipo: string
          tributo: string
        }
        Insert: {
          codigo: string
          created_at?: string | null
          descricao: string
          id?: string
          is_active?: boolean | null
          observacoes?: string | null
          tipo: string
          tributo: string
        }
        Update: {
          codigo?: string
          created_at?: string | null
          descricao?: string
          id?: string
          is_active?: boolean | null
          observacoes?: string | null
          tipo?: string
          tributo?: string
        }
        Relationships: []
      }
      cadastro_enquadramento_ipi: {
        Row: {
          codigo: string
          created_at: string | null
          descricao: string
          id: string
          is_active: boolean | null
          tipo: string | null
        }
        Insert: {
          codigo: string
          created_at?: string | null
          descricao: string
          id?: string
          is_active?: boolean | null
          tipo?: string | null
        }
        Update: {
          codigo?: string
          created_at?: string | null
          descricao?: string
          id?: string
          is_active?: boolean | null
          tipo?: string | null
        }
        Relationships: []
      }
      cadastro_imposto_seletivo: {
        Row: {
          aliquota_maxima: number | null
          aliquota_padrao: number
          base_legal: string | null
          categoria: Database["public"]["Enums"]["categoria_imposto_seletivo"]
          codigo: string
          created_at: string | null
          created_by: string | null
          criterios_adicionais: Json | null
          descricao: string
          excecoes_legais: string[] | null
          id: string
          incide_importacao: boolean | null
          incide_produto_final: boolean | null
          is_active: boolean | null
          ncms_aplicaveis: string[] | null
          produtos_especificos: string[] | null
          updated_at: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          aliquota_maxima?: number | null
          aliquota_padrao: number
          base_legal?: string | null
          categoria: Database["public"]["Enums"]["categoria_imposto_seletivo"]
          codigo: string
          created_at?: string | null
          created_by?: string | null
          criterios_adicionais?: Json | null
          descricao: string
          excecoes_legais?: string[] | null
          id?: string
          incide_importacao?: boolean | null
          incide_produto_final?: boolean | null
          is_active?: boolean | null
          ncms_aplicaveis?: string[] | null
          produtos_especificos?: string[] | null
          updated_at?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          aliquota_maxima?: number | null
          aliquota_padrao?: number
          base_legal?: string | null
          categoria?: Database["public"]["Enums"]["categoria_imposto_seletivo"]
          codigo?: string
          created_at?: string | null
          created_by?: string | null
          criterios_adicionais?: Json | null
          descricao?: string
          excecoes_legais?: string[] | null
          id?: string
          incide_importacao?: boolean | null
          incide_produto_final?: boolean | null
          is_active?: boolean | null
          ncms_aplicaveis?: string[] | null
          produtos_especificos?: string[] | null
          updated_at?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      carriers: {
        Row: {
          active: boolean | null
          address: string | null
          address_number: string | null
          city: string | null
          cnpj: string | null
          created_at: string | null
          email: string | null
          id: string
          ie: string | null
          name: string
          neighborhood: string | null
          phone: string | null
          state: string | null
          tenant_id: string | null
          trade_name: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          address_number?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          ie?: string | null
          name: string
          neighborhood?: string | null
          phone?: string | null
          state?: string | null
          tenant_id?: string | null
          trade_name?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          address_number?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          ie?: string | null
          name?: string
          neighborhood?: string | null
          phone?: string | null
          state?: string | null
          tenant_id?: string | null
          trade_name?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carriers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_beneficios_fiscais: {
        Row: {
          beneficio_id: string
          company_id: string
          created_at: string | null
          created_by: string | null
          documento_cliente_nome: string | null
          documento_cliente_url: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          numero_documento_cliente: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          beneficio_id: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          documento_cliente_nome?: string | null
          documento_cliente_url?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          numero_documento_cliente?: string | null
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          beneficio_id?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          documento_cliente_nome?: string | null
          documento_cliente_url?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          numero_documento_cliente?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_beneficios_fiscais_beneficio_id_fkey"
            columns: ["beneficio_id"]
            isOneToOne: false
            referencedRelation: "beneficios_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_beneficios_fiscais_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_beneficios_fiscais_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_activity_summary"
            referencedColumns: ["company_id"]
          },
        ]
      }
      companies: {
        Row: {
          active: boolean | null
          address: string | null
          address_complement: string | null
          address_number: string | null
          annual_revenue: string | null
          atividade_id: string | null
          city: string | null
          cnpj: string | null
          cnpj_root: string | null
          contact_name: string | null
          contribuinte_icms: boolean | null
          contribuinte_ipi: boolean | null
          country: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          default_carrier_id: string | null
          default_freight_type: string | null
          domain: string | null
          economic_group_id: string | null
          email: string | null
          employee_count: string | null
          erp_code: string | null
          erp_last_movement_date: string | null
          erp_last_update_date: string | null
          erp_registration_date: string | null
          erp_synced_at: string | null
          fantasia: string | null
          fax: string | null
          id: string
          iniflex_id: string | null
          iniflex_synced_at: string | null
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          is_matriz: boolean | null
          last_reviewed_at: string | null
          legal_entity_id: string | null
          lifecycle_stage: Database["public"]["Enums"]["lifecycle_stage"] | null
          name: string
          neighborhood: string | null
          notes: string | null
          origin: string | null
          owner_id: string | null
          parent_company_id: string | null
          phone: string | null
          phone2: string | null
          regime_tributario:
            | Database["public"]["Enums"]["regime_tributario"]
            | null
          sales_rep_id: string | null
          segmento_id: string | null
          setor_id: string | null
          state: string | null
          suframa: string | null
          tenant_id: string
          tipo_pessoa: string | null
          updated_at: string
          website: string | null
          zip_code: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          annual_revenue?: string | null
          atividade_id?: string | null
          city?: string | null
          cnpj?: string | null
          cnpj_root?: string | null
          contact_name?: string | null
          contribuinte_icms?: boolean | null
          contribuinte_ipi?: boolean | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          default_carrier_id?: string | null
          default_freight_type?: string | null
          domain?: string | null
          economic_group_id?: string | null
          email?: string | null
          employee_count?: string | null
          erp_code?: string | null
          erp_last_movement_date?: string | null
          erp_last_update_date?: string | null
          erp_registration_date?: string | null
          erp_synced_at?: string | null
          fantasia?: string | null
          fax?: string | null
          id?: string
          iniflex_id?: string | null
          iniflex_synced_at?: string | null
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          is_matriz?: boolean | null
          last_reviewed_at?: string | null
          legal_entity_id?: string | null
          lifecycle_stage?:
            | Database["public"]["Enums"]["lifecycle_stage"]
            | null
          name: string
          neighborhood?: string | null
          notes?: string | null
          origin?: string | null
          owner_id?: string | null
          parent_company_id?: string | null
          phone?: string | null
          phone2?: string | null
          regime_tributario?:
            | Database["public"]["Enums"]["regime_tributario"]
            | null
          sales_rep_id?: string | null
          segmento_id?: string | null
          setor_id?: string | null
          state?: string | null
          suframa?: string | null
          tenant_id?: string
          tipo_pessoa?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          annual_revenue?: string | null
          atividade_id?: string | null
          city?: string | null
          cnpj?: string | null
          cnpj_root?: string | null
          contact_name?: string | null
          contribuinte_icms?: boolean | null
          contribuinte_ipi?: boolean | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          default_carrier_id?: string | null
          default_freight_type?: string | null
          domain?: string | null
          economic_group_id?: string | null
          email?: string | null
          employee_count?: string | null
          erp_code?: string | null
          erp_last_movement_date?: string | null
          erp_last_update_date?: string | null
          erp_registration_date?: string | null
          erp_synced_at?: string | null
          fantasia?: string | null
          fax?: string | null
          id?: string
          iniflex_id?: string | null
          iniflex_synced_at?: string | null
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          is_matriz?: boolean | null
          last_reviewed_at?: string | null
          legal_entity_id?: string | null
          lifecycle_stage?:
            | Database["public"]["Enums"]["lifecycle_stage"]
            | null
          name?: string
          neighborhood?: string | null
          notes?: string | null
          origin?: string | null
          owner_id?: string | null
          parent_company_id?: string | null
          phone?: string | null
          phone2?: string | null
          regime_tributario?:
            | Database["public"]["Enums"]["regime_tributario"]
            | null
          sales_rep_id?: string | null
          segmento_id?: string | null
          setor_id?: string | null
          state?: string | null
          suframa?: string | null
          tenant_id?: string
          tipo_pessoa?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_default_carrier_id_fkey"
            columns: ["default_carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_economic_group_id_fkey"
            columns: ["economic_group_id"]
            isOneToOne: false
            referencedRelation: "economic_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_parent_company_id_fkey"
            columns: ["parent_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_parent_company_id_fkey"
            columns: ["parent_company_id"]
            isOneToOne: false
            referencedRelation: "company_activity_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "companies_sales_rep_id_fkey"
            columns: ["sales_rep_id"]
            isOneToOne: false
            referencedRelation: "sales_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_segmento_id_fkey"
            columns: ["segmento_id"]
            isOneToOne: false
            referencedRelation: "segmentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      companies_classification_backup: {
        Row: {
          created_at: string | null
          id: string | null
          industry: string | null
          name: string | null
          segmento_legado: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          industry?: string | null
          name?: string | null
          segmento_legado?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          industry?: string | null
          name?: string | null
          segmento_legado?: string | null
        }
        Relationships: []
      }
      company_audit_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          company_id: string
          field_label: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          company_id: string
          field_label: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          company_id?: string
          field_label?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_activity_summary"
            referencedColumns: ["company_id"]
          },
        ]
      }
      company_erp_financial: {
        Row: {
          agencia: string | null
          banco_preferencial: string | null
          company_id: string
          condicao_pagamento: string | null
          conta: string | null
          created_at: string
          credit_approved_at: string | null
          credit_approved_by: string | null
          credit_risk_level: string | null
          credit_score: number | null
          credit_validity_date: string | null
          data_ultimo_pagamento: string | null
          erp_financial_data: Json | null
          forma_pagamento: string | null
          id: string
          limite_credito: number | null
          possui_titulos_abertos: boolean | null
          possui_titulos_vencidos: boolean | null
          prazo_medio_pagamento: number | null
          saldo_devedor: number | null
          tenant_id: string
          updated_at: string
          valor_titulos_abertos: number | null
          valor_titulos_vencidos: number | null
        }
        Insert: {
          agencia?: string | null
          banco_preferencial?: string | null
          company_id: string
          condicao_pagamento?: string | null
          conta?: string | null
          created_at?: string
          credit_approved_at?: string | null
          credit_approved_by?: string | null
          credit_risk_level?: string | null
          credit_score?: number | null
          credit_validity_date?: string | null
          data_ultimo_pagamento?: string | null
          erp_financial_data?: Json | null
          forma_pagamento?: string | null
          id?: string
          limite_credito?: number | null
          possui_titulos_abertos?: boolean | null
          possui_titulos_vencidos?: boolean | null
          prazo_medio_pagamento?: number | null
          saldo_devedor?: number | null
          tenant_id: string
          updated_at?: string
          valor_titulos_abertos?: number | null
          valor_titulos_vencidos?: number | null
        }
        Update: {
          agencia?: string | null
          banco_preferencial?: string | null
          company_id?: string
          condicao_pagamento?: string | null
          conta?: string | null
          created_at?: string
          credit_approved_at?: string | null
          credit_approved_by?: string | null
          credit_risk_level?: string | null
          credit_score?: number | null
          credit_validity_date?: string | null
          data_ultimo_pagamento?: string | null
          erp_financial_data?: Json | null
          forma_pagamento?: string | null
          id?: string
          limite_credito?: number | null
          possui_titulos_abertos?: boolean | null
          possui_titulos_vencidos?: boolean | null
          prazo_medio_pagamento?: number | null
          saldo_devedor?: number | null
          tenant_id?: string
          updated_at?: string
          valor_titulos_abertos?: number | null
          valor_titulos_vencidos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_erp_financial_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_erp_financial_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_activity_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_erp_financial_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      company_erp_fiscal: {
        Row: {
          aliquota_cofins: number | null
          aliquota_icms: number | null
          aliquota_ipi: number | null
          aliquota_pis: number | null
          cfop_padrao: string | null
          company_id: string
          contribuinte_icms: boolean | null
          contribuinte_ipi: boolean | null
          created_at: string
          cst_cofins: string | null
          cst_icms: string | null
          cst_ipi: string | null
          cst_pis: string | null
          destino_mercadoria: string | null
          erp_fiscal_data: Json | null
          finalidade_operacao: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          optante_simples: boolean | null
          reducao_base_icms: number | null
          regime_tributario: string | null
          suframa: string | null
          tenant_id: string
          tipo_contribuinte: string | null
          updated_at: string
        }
        Insert: {
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_ipi?: number | null
          aliquota_pis?: number | null
          cfop_padrao?: string | null
          company_id: string
          contribuinte_icms?: boolean | null
          contribuinte_ipi?: boolean | null
          created_at?: string
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_ipi?: string | null
          cst_pis?: string | null
          destino_mercadoria?: string | null
          erp_fiscal_data?: Json | null
          finalidade_operacao?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          optante_simples?: boolean | null
          reducao_base_icms?: number | null
          regime_tributario?: string | null
          suframa?: string | null
          tenant_id: string
          tipo_contribuinte?: string | null
          updated_at?: string
        }
        Update: {
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_ipi?: number | null
          aliquota_pis?: number | null
          cfop_padrao?: string | null
          company_id?: string
          contribuinte_icms?: boolean | null
          contribuinte_ipi?: boolean | null
          created_at?: string
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_ipi?: string | null
          cst_pis?: string | null
          destino_mercadoria?: string | null
          erp_fiscal_data?: Json | null
          finalidade_operacao?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          optante_simples?: boolean | null
          reducao_base_icms?: number | null
          regime_tributario?: string | null
          suframa?: string | null
          tenant_id?: string
          tipo_contribuinte?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_erp_fiscal_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_erp_fiscal_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_activity_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_erp_fiscal_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      company_products: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          company_id: string
          created_at: string
          created_by: string
          id: string
          is_preferred: boolean
          last_interaction_at: string | null
          metadata: Json
          notes: string | null
          product_id: string
          relationship_type: Database["public"]["Enums"]["company_product_relationship_type"]
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          is_preferred?: boolean
          last_interaction_at?: string | null
          metadata?: Json
          notes?: string | null
          product_id: string
          relationship_type?: Database["public"]["Enums"]["company_product_relationship_type"]
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          is_preferred?: boolean
          last_interaction_at?: string | null
          metadata?: Json
          notes?: string | null
          product_id?: string
          relationship_type?: Database["public"]["Enums"]["company_product_relationship_type"]
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_activity_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      company_sync_queue: {
        Row: {
          attempts: number
          company_id: string
          created_at: string
          error_message: string | null
          id: string
          max_attempts: number
          next_retry_at: string | null
          payload: Json | null
          processed_at: string | null
          response: Json | null
          scheduled_at: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          company_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          next_retry_at?: string | null
          payload?: Json | null
          processed_at?: string | null
          response?: Json | null
          scheduled_at?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          company_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          next_retry_at?: string | null
          payload?: Json | null
          processed_at?: string | null
          response?: Json | null
          scheduled_at?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_sync_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_sync_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_activity_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_sync_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_erp_data: {
        Row: {
          contact_id: string
          created_at: string
          credential_expiry: string | null
          erp_modified_at: string | null
          erp_notes: string | null
          erp_sequence: number | null
          erp_updated_at: string | null
          extra_data: Json | null
          homepage: string | null
          id: string
          notify_sale: boolean | null
          participates: boolean | null
          person_code: string | null
          photo_path: string | null
          receives_billing_email: boolean | null
          receives_email: boolean | null
          receives_payment_email: boolean | null
          relationship_code: string | null
          superior_seq: number | null
          tenant_id: string
          treatment: string | null
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          credential_expiry?: string | null
          erp_modified_at?: string | null
          erp_notes?: string | null
          erp_sequence?: number | null
          erp_updated_at?: string | null
          extra_data?: Json | null
          homepage?: string | null
          id?: string
          notify_sale?: boolean | null
          participates?: boolean | null
          person_code?: string | null
          photo_path?: string | null
          receives_billing_email?: boolean | null
          receives_email?: boolean | null
          receives_payment_email?: boolean | null
          relationship_code?: string | null
          superior_seq?: number | null
          tenant_id: string
          treatment?: string | null
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          credential_expiry?: string | null
          erp_modified_at?: string | null
          erp_notes?: string | null
          erp_sequence?: number | null
          erp_updated_at?: string | null
          extra_data?: Json | null
          homepage?: string | null
          id?: string
          notify_sale?: boolean | null
          participates?: boolean | null
          person_code?: string | null
          photo_path?: string | null
          receives_billing_email?: boolean | null
          receives_email?: boolean | null
          receives_payment_email?: boolean | null
          relationship_code?: string | null
          superior_seq?: number | null
          tenant_id?: string
          treatment?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_erp_data_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_erp_data_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          birth_date: string | null
          company_id: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          department: string | null
          email: string | null
          erp_contact_code: string | null
          erp_last_update_date: string | null
          erp_synced_at: string | null
          first_name: string
          gender: string | null
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
          phone_extension: string | null
          tenant_id: string
          tipo_pessoa: Database["public"]["Enums"]["tipo_pessoa"] | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          company_id?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          department?: string | null
          email?: string | null
          erp_contact_code?: string | null
          erp_last_update_date?: string | null
          erp_synced_at?: string | null
          first_name: string
          gender?: string | null
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
          phone_extension?: string | null
          tenant_id?: string
          tipo_pessoa?: Database["public"]["Enums"]["tipo_pessoa"] | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          company_id?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          department?: string | null
          email?: string | null
          erp_contact_code?: string | null
          erp_last_update_date?: string | null
          erp_synced_at?: string | null
          first_name?: string
          gender?: string | null
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
          phone_extension?: string | null
          tenant_id?: string
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
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_activity_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_analyses: {
        Row: {
          analysis_date: string
          api_provider: string | null
          cadastral_status: string | null
          cnpj: string
          company_id: string
          consultation_reason: string
          consulted_by: string | null
          created_at: string
          credit_score: number | null
          id: string
          raw_response_hash: string | null
          restrictions_summary: string | null
          risk_classification: string | null
          updated_at: string
        }
        Insert: {
          analysis_date?: string
          api_provider?: string | null
          cadastral_status?: string | null
          cnpj: string
          company_id: string
          consultation_reason: string
          consulted_by?: string | null
          created_at?: string
          credit_score?: number | null
          id?: string
          raw_response_hash?: string | null
          restrictions_summary?: string | null
          risk_classification?: string | null
          updated_at?: string
        }
        Update: {
          analysis_date?: string
          api_provider?: string | null
          cadastral_status?: string | null
          cnpj?: string
          company_id?: string
          consultation_reason?: string
          consulted_by?: string | null
          created_at?: string
          credit_score?: number | null
          id?: string
          raw_response_hash?: string | null
          restrictions_summary?: string | null
          risk_classification?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_analyses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_analyses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "company_activity_summary"
            referencedColumns: ["company_id"]
          },
        ]
      }
      credit_analysis_audit: {
        Row: {
          action: string
          cnpj: string
          company_id: string
          company_name: string
          created_at: string
          id: string
          reason: string
          result_summary: Json
          user_id: string
          user_name: string
        }
        Insert: {
          action?: string
          cnpj: string
          company_id: string
          company_name: string
          created_at?: string
          id?: string
          reason: string
          result_summary: Json
          user_id: string
          user_name: string
        }
        Update: {
          action?: string
          cnpj?: string
          company_id?: string
          company_name?: string
          created_at?: string
          id?: string
          reason?: string
          result_summary?: Json
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_analysis_audit_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_analysis_audit_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_activity_summary"
            referencedColumns: ["company_id"]
          },
        ]
      }
      credit_documents: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          uploaded_by: string | null
          uploaded_by_name: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_activity_summary"
            referencedColumns: ["company_id"]
          },
        ]
      }
      credito_presumido_regras: {
        Row: {
          aplica_por_adquirente: boolean | null
          aplica_por_ncm: boolean | null
          aplica_por_operacao: boolean | null
          aplica_por_regiao: boolean | null
          base_legal: string | null
          codigo: string
          created_at: string | null
          created_by: string | null
          descricao: string | null
          id: string
          is_active: boolean | null
          ncms_aplicaveis: string[] | null
          nome: string
          percentual_credito: number
          tipos_adquirente: string[] | null
          tipos_operacao: string[] | null
          tributo: string
          ufs_aplicaveis: string[] | null
          updated_at: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          aplica_por_adquirente?: boolean | null
          aplica_por_ncm?: boolean | null
          aplica_por_operacao?: boolean | null
          aplica_por_regiao?: boolean | null
          base_legal?: string | null
          codigo: string
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean | null
          ncms_aplicaveis?: string[] | null
          nome: string
          percentual_credito: number
          tipos_adquirente?: string[] | null
          tipos_operacao?: string[] | null
          tributo: string
          ufs_aplicaveis?: string[] | null
          updated_at?: string | null
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          aplica_por_adquirente?: boolean | null
          aplica_por_ncm?: boolean | null
          aplica_por_operacao?: boolean | null
          aplica_por_regiao?: boolean | null
          base_legal?: string | null
          codigo?: string
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean | null
          ncms_aplicaveis?: string[] | null
          nome?: string
          percentual_credito?: number
          tipos_adquirente?: string[] | null
          tipos_operacao?: string[] | null
          tributo?: string
          ufs_aplicaveis?: string[] | null
          updated_at?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      crm_activity_weights: {
        Row: {
          id: string
          label: string
          type: string
          updated_at: string
          updated_by: string | null
          weight: number
        }
        Insert: {
          id?: string
          label: string
          type: string
          updated_at?: string
          updated_by?: string | null
          weight?: number
        }
        Update: {
          id?: string
          label?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
          weight?: number
        }
        Relationships: []
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
          owner_id: string | null
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
          owner_id?: string | null
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
          owner_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "crm_clients_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_clients_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_order_items: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          order_id: string
          product_external_id: string | null
          product_id: string | null
          quantidade: number | null
          raw_data: Json | null
          unidade: string | null
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          order_id: string
          product_external_id?: string | null
          product_id?: string | null
          quantidade?: number | null
          raw_data?: Json | null
          unidade?: string | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          order_id?: string
          product_external_id?: string | null
          product_id?: string | null
          quantidade?: number | null
          raw_data?: Json | null
          unidade?: string | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "crm_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "crm_products"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_orders: {
        Row: {
          client_external_id: string | null
          client_id: string | null
          created_at: string | null
          data_alteracao_erp: string | null
          data_emissao: string | null
          data_entrega: string | null
          empresa: number | null
          external_id: string
          id: string
          numero_pedido: string | null
          raw_data: Json | null
          situacao: string | null
          status: string | null
          synced_at: string | null
          tipo_pedido: string | null
          updated_at: string | null
          valor_desconto: number | null
          valor_frete: number | null
          valor_total: number | null
        }
        Insert: {
          client_external_id?: string | null
          client_id?: string | null
          created_at?: string | null
          data_alteracao_erp?: string | null
          data_emissao?: string | null
          data_entrega?: string | null
          empresa?: number | null
          external_id: string
          id?: string
          numero_pedido?: string | null
          raw_data?: Json | null
          situacao?: string | null
          status?: string | null
          synced_at?: string | null
          tipo_pedido?: string | null
          updated_at?: string | null
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_total?: number | null
        }
        Update: {
          client_external_id?: string | null
          client_id?: string | null
          created_at?: string | null
          data_alteracao_erp?: string | null
          data_emissao?: string | null
          data_entrega?: string | null
          empresa?: number | null
          external_id?: string
          id?: string
          numero_pedido?: string | null
          raw_data?: Json | null
          situacao?: string | null
          status?: string | null
          synced_at?: string | null
          tipo_pedido?: string | null
          updated_at?: string | null
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_productivity_targets: {
        Row: {
          created_at: string
          id: string
          period_type: string
          seller_id: string
          target_score: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          period_type?: string
          seller_id: string
          target_score?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          period_type?: string
          seller_id?: string
          target_score?: number
          updated_at?: string
          updated_by?: string | null
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
      customer_transfer_requests: {
        Row: {
          company_id: string
          created_at: string
          from_sales_rep_id: string
          id: string
          reason: string
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tenant_id: string
          to_sales_rep_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          from_sales_rep_id: string
          id?: string
          reason: string
          requested_by: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id: string
          to_sales_rep_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          from_sales_rep_id?: string
          id?: string
          reason?: string
          requested_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id?: string
          to_sales_rep_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_transfer_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_transfer_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_activity_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "customer_transfer_requests_from_sales_rep_id_fkey"
            columns: ["from_sales_rep_id"]
            isOneToOne: false
            referencedRelation: "sales_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_transfer_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_transfer_requests_to_sales_rep_id_fkey"
            columns: ["to_sales_rep_id"]
            isOneToOne: false
            referencedRelation: "sales_reps"
            referencedColumns: ["id"]
          },
        ]
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
          legal_entity_id: string
          lost_reason: string | null
          name: string
          notes: string | null
          owner_id: string | null
          pipeline_id: string | null
          probability: number | null
          stage: Database["public"]["Enums"]["deal_stage"]
          stagnation_reason: string | null
          tenant_id: string
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
          legal_entity_id: string
          lost_reason?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          pipeline_id?: string | null
          probability?: number | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          stagnation_reason?: string | null
          tenant_id?: string
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
          legal_entity_id?: string
          lost_reason?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          pipeline_id?: string | null
          probability?: number | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          stagnation_reason?: string | null
          tenant_id?: string
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
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_activity_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_fiscal_snapshot: {
        Row: {
          beneficios_aplicados: Json | null
          contexto_calculo: Json
          created_at: string
          documento_id: string
          documento_tipo: string
          hash_verificacao: string | null
          id: string
          item_id: string | null
          regra_id: string | null
          tributacao_aplicada: Json
        }
        Insert: {
          beneficios_aplicados?: Json | null
          contexto_calculo: Json
          created_at?: string
          documento_id: string
          documento_tipo: string
          hash_verificacao?: string | null
          id?: string
          item_id?: string | null
          regra_id?: string | null
          tributacao_aplicada: Json
        }
        Update: {
          beneficios_aplicados?: Json | null
          contexto_calculo?: Json
          created_at?: string
          documento_id?: string
          documento_tipo?: string
          hash_verificacao?: string | null
          id?: string
          item_id?: string | null
          regra_id?: string | null
          tributacao_aplicada?: Json
        }
        Relationships: [
          {
            foreignKeyName: "documento_fiscal_snapshot_regra_id_fkey"
            columns: ["regra_id"]
            isOneToOne: false
            referencedRelation: "regras_tributacao"
            referencedColumns: ["id"]
          },
        ]
      }
      economic_groups: {
        Row: {
          cnpj_root: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          owner_user_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cnpj_root?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          owner_user_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cnpj_root?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          owner_user_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "economic_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "email_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      erp_cities: {
        Row: {
          codigo_erp: number
          created_at: string
          id: string
          nome: string
          tenant_id: string
          uf: string
          updated_at: string
        }
        Insert: {
          codigo_erp: number
          created_at?: string
          id?: string
          nome: string
          tenant_id: string
          uf: string
          updated_at?: string
        }
        Update: {
          codigo_erp?: number
          created_at?: string
          id?: string
          nome?: string
          tenant_id?: string
          uf?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_cities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_clients_cache: {
        Row: {
          cnpj: string
          codigo_erp: string
          created_at: string | null
          last_seen: string | null
        }
        Insert: {
          cnpj: string
          codigo_erp: string
          created_at?: string | null
          last_seen?: string | null
        }
        Update: {
          cnpj?: string
          codigo_erp?: string
          created_at?: string | null
          last_seen?: string | null
        }
        Relationships: []
      }
      erp_products_staging: {
        Row: {
          codigo_tipo_item: number | null
          created_at: string
          data_alteracao: string | null
          erp_code: string
          error_message: string | null
          hash_data: string
          id: string
          promoted: boolean
          promoted_at: string | null
          raw_data: Json
          retry_count: number
          status: string
          tenant_id: string
        }
        Insert: {
          codigo_tipo_item?: number | null
          created_at?: string
          data_alteracao?: string | null
          erp_code: string
          error_message?: string | null
          hash_data: string
          id?: string
          promoted?: boolean
          promoted_at?: string | null
          raw_data: Json
          retry_count?: number
          status?: string
          tenant_id: string
        }
        Update: {
          codigo_tipo_item?: number | null
          created_at?: string
          data_alteracao?: string | null
          erp_code?: string
          error_message?: string | null
          hash_data?: string
          id?: string
          promoted?: boolean
          promoted_at?: string | null
          raw_data?: Json
          retry_count?: number
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_products_staging_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_sequence_logs: {
        Row: {
          created_at: string
          generated_by: string | null
          generated_value: number
          id: string
          product_id: string | null
          sequence_name: string
        }
        Insert: {
          created_at?: string
          generated_by?: string | null
          generated_value: number
          id?: string
          product_id?: string | null
          sequence_name: string
        }
        Update: {
          created_at?: string
          generated_by?: string | null
          generated_value?: number
          id?: string
          product_id?: string | null
          sequence_name?: string
        }
        Relationships: []
      }
      erp_sequences: {
        Row: {
          last_value: number
          sequence_name: string
          updated_at: string
        }
        Insert: {
          last_value?: number
          sequence_name: string
          updated_at?: string
        }
        Update: {
          last_value?: number
          sequence_name?: string
          updated_at?: string
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
      freight_type_erp_mapping: {
        Row: {
          created_at: string | null
          crm_freight_type: string
          erp_freight_code: string
          erp_freight_description: string | null
          id: string
          is_active: boolean | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          crm_freight_type: string
          erp_freight_code: string
          erp_freight_description?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          crm_freight_type?: string
          erp_freight_code?: string
          erp_freight_description?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      google_calendar_connections: {
        Row: {
          access_token_encrypted: string | null
          calendar_id: string | null
          created_at: string
          id: string
          last_sync_at: string | null
          refresh_token_encrypted: string | null
          sync_enabled: boolean | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
          webhook_channel_id: string | null
          webhook_expiration: string | null
        }
        Insert: {
          access_token_encrypted?: string | null
          calendar_id?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          refresh_token_encrypted?: string | null
          sync_enabled?: boolean | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
          webhook_channel_id?: string | null
          webhook_expiration?: string | null
        }
        Update: {
          access_token_encrypted?: string | null
          calendar_id?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          refresh_token_encrypted?: string | null
          sync_enabled?: boolean | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
          webhook_channel_id?: string | null
          webhook_expiration?: string | null
        }
        Relationships: []
      }
      google_calendar_sync_logs: {
        Row: {
          action: string
          created_at: string
          direction: string
          error_message: string | null
          google_event_id: string | null
          id: string
          metadata: Json | null
          status: string
          task_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          direction: string
          error_message?: string | null
          google_event_id?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          task_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          direction?: string
          error_message?: string | null
          google_event_id?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_sync_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      import_conflict_log: {
        Row: {
          auto_resolved: boolean | null
          created_at: string
          crm_value: string | null
          entity_id: string | null
          entity_type: string
          erp_code: string | null
          erp_value: string | null
          field_name: string
          id: string
          metadata: Json | null
          resolution: string | null
          resolution_rule: string | null
          resolved_at: string | null
          resolved_by: string | null
          tenant_id: string
        }
        Insert: {
          auto_resolved?: boolean | null
          created_at?: string
          crm_value?: string | null
          entity_id?: string | null
          entity_type: string
          erp_code?: string | null
          erp_value?: string | null
          field_name: string
          id?: string
          metadata?: Json | null
          resolution?: string | null
          resolution_rule?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          tenant_id: string
        }
        Update: {
          auto_resolved?: boolean | null
          created_at?: string
          crm_value?: string | null
          entity_id?: string | null
          entity_type?: string
          erp_code?: string | null
          erp_value?: string | null
          field_name?: string
          id?: string
          metadata?: Json | null
          resolution?: string | null
          resolution_rule?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_conflict_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      import_errors: {
        Row: {
          created_at: string
          error_message: string
          id: string
          import_log_id: string
          raw_data: Json | null
          row_number: number | null
        }
        Insert: {
          created_at?: string
          error_message: string
          id?: string
          import_log_id: string
          raw_data?: Json | null
          row_number?: number | null
        }
        Update: {
          created_at?: string
          error_message?: string
          id?: string
          import_log_id?: string
          raw_data?: Json | null
          row_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_errors_import_log_id_fkey"
            columns: ["import_log_id"]
            isOneToOne: false
            referencedRelation: "import_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_logs: {
        Row: {
          created_at: string
          error_count: number
          file_name: string
          id: string
          imported_by: string | null
          legal_entity_id: string | null
          skipped_count: number
          success_count: number
          tenant_id: string | null
          total_rows: number
          updated_count: number
        }
        Insert: {
          created_at?: string
          error_count?: number
          file_name: string
          id?: string
          imported_by?: string | null
          legal_entity_id?: string | null
          skipped_count?: number
          success_count?: number
          tenant_id?: string | null
          total_rows?: number
          updated_count?: number
        }
        Update: {
          created_at?: string
          error_count?: number
          file_name?: string
          id?: string
          imported_by?: string | null
          legal_entity_id?: string | null
          skipped_count?: number
          success_count?: number
          tenant_id?: string | null
          total_rows?: number
          updated_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_logs_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      legal_entities: {
        Row: {
          active: boolean
          address: string | null
          city: string | null
          cnpj: string
          created_at: string
          email: string | null
          erp_company_code: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          is_headquarters: boolean
          logo_url: string | null
          name: string
          phone: string | null
          regime_tributario: string | null
          state: string | null
          tenant_id: string
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          city?: string | null
          cnpj: string
          created_at?: string
          email?: string | null
          erp_company_code?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          is_headquarters?: boolean
          logo_url?: string | null
          name: string
          phone?: string | null
          regime_tributario?: string | null
          state?: string | null
          tenant_id: string
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          city?: string | null
          cnpj?: string
          created_at?: string
          email?: string | null
          erp_company_code?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          is_headquarters?: boolean
          logo_url?: string | null
          name?: string
          phone?: string | null
          regime_tributario?: string | null
          state?: string | null
          tenant_id?: string
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_entities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      ncm_codes: {
        Row: {
          aliquota_ipi_oficial: number | null
          codigo: string
          created_at: string | null
          data_fim_vigencia: string | null
          data_vigencia: string
          descricao: string
          ex_tipi: string[] | null
          id: string
          status: string
          unidade_tributaria: string | null
          updated_at: string | null
        }
        Insert: {
          aliquota_ipi_oficial?: number | null
          codigo: string
          created_at?: string | null
          data_fim_vigencia?: string | null
          data_vigencia?: string
          descricao: string
          ex_tipi?: string[] | null
          id?: string
          status?: string
          unidade_tributaria?: string | null
          updated_at?: string | null
        }
        Update: {
          aliquota_ipi_oficial?: number | null
          codigo?: string
          created_at?: string | null
          data_fim_vigencia?: string | null
          data_vigencia?: string
          descricao?: string
          ex_tipi?: string[] | null
          id?: string
          status?: string
          unidade_tributaria?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ncm_fiscal_rules: {
        Row: {
          aliquota_cofins: number | null
          aliquota_icms: number | null
          aliquota_ipi: number | null
          aliquota_pis: number | null
          created_at: string | null
          csosn: string | null
          cst_icms: string | null
          cst_pis_cofins: string | null
          id: string
          is_active: boolean | null
          ncm_id: string
          regime_tributario: Database["public"]["Enums"]["regime_tributario"]
          tem_icms_st: boolean | null
          tipo_produto:
            | Database["public"]["Enums"]["tipo_produto_fiscal"]
            | null
          uf_destino: string | null
          uf_origem: string | null
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_ipi?: number | null
          aliquota_pis?: number | null
          created_at?: string | null
          csosn?: string | null
          cst_icms?: string | null
          cst_pis_cofins?: string | null
          id?: string
          is_active?: boolean | null
          ncm_id: string
          regime_tributario: Database["public"]["Enums"]["regime_tributario"]
          tem_icms_st?: boolean | null
          tipo_produto?:
            | Database["public"]["Enums"]["tipo_produto_fiscal"]
            | null
          uf_destino?: string | null
          uf_origem?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_ipi?: number | null
          aliquota_pis?: number | null
          created_at?: string | null
          csosn?: string | null
          cst_icms?: string | null
          cst_pis_cofins?: string | null
          id?: string
          is_active?: boolean | null
          ncm_id?: string
          regime_tributario?: Database["public"]["Enums"]["regime_tributario"]
          tem_icms_st?: boolean | null
          tipo_produto?:
            | Database["public"]["Enums"]["tipo_produto_fiscal"]
            | null
          uf_destino?: string | null
          uf_origem?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ncm_fiscal_rules_ncm_id_fkey"
            columns: ["ncm_id"]
            isOneToOne: false
            referencedRelation: "ncm_codes"
            referencedColumns: ["id"]
          },
        ]
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
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          metadata: Json | null
          tenant_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          metadata?: Json | null
          tenant_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          metadata?: Json | null
          tenant_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_approval_rules: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          from_status: Database["public"]["Enums"]["order_status"]
          id: string
          is_active: boolean | null
          name: string
          required_role: string
          requires_justification: boolean | null
          sort_order: number | null
          to_status: Database["public"]["Enums"]["order_status"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          from_status: Database["public"]["Enums"]["order_status"]
          id?: string
          is_active?: boolean | null
          name: string
          required_role?: string
          requires_justification?: boolean | null
          sort_order?: number | null
          to_status: Database["public"]["Enums"]["order_status"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          from_status?: Database["public"]["Enums"]["order_status"]
          id?: string
          is_active?: boolean | null
          name?: string
          required_role?: string
          requires_justification?: boolean | null
          sort_order?: number | null
          to_status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string | null
        }
        Relationships: []
      }
      order_approvals: {
        Row: {
          approved_at: string
          approved_by: string | null
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: string
          notes: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          approved_at?: string
          approved_by?: string | null
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          notes?: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          approved_at?: string
          approved_by?: string | null
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          notes?: string | null
          order_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_approvals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
      order_erp_data: {
        Row: {
          business_unit: string | null
          carrier_code: string | null
          commission_pct: number | null
          created_at: string
          currency_code: string | null
          erp_modified_at: string | null
          erp_order_type: string | null
          erp_registered_at: string | null
          extra_data: Json | null
          id: string
          invoice_number: string | null
          market_code: string | null
          operation_type: string | null
          order_id: string
          payment_condition: string | null
          seller_code: string | null
          session_id: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          business_unit?: string | null
          carrier_code?: string | null
          commission_pct?: number | null
          created_at?: string
          currency_code?: string | null
          erp_modified_at?: string | null
          erp_order_type?: string | null
          erp_registered_at?: string | null
          extra_data?: Json | null
          id?: string
          invoice_number?: string | null
          market_code?: string | null
          operation_type?: string | null
          order_id: string
          payment_condition?: string | null
          seller_code?: string | null
          session_id?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          business_unit?: string | null
          carrier_code?: string | null
          commission_pct?: number | null
          created_at?: string
          currency_code?: string | null
          erp_modified_at?: string | null
          erp_order_type?: string | null
          erp_registered_at?: string | null
          extra_data?: Json | null
          id?: string
          invoice_number?: string | null
          market_code?: string | null
          operation_type?: string | null
          order_id?: string
          payment_condition?: string | null
          seller_code?: string | null
          session_id?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_erp_data_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_erp_data_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_erp_data: {
        Row: {
          account_code: string | null
          batch_code: string | null
          cfop: string | null
          cost_center: string | null
          cost_price: number | null
          created_at: string
          detail_code: string | null
          extra_data: Json | null
          id: string
          list_price: number | null
          order_item_id: string
          packing_list_number: string | null
          tenant_id: string
          unit_measure: string | null
          updated_at: string
        }
        Insert: {
          account_code?: string | null
          batch_code?: string | null
          cfop?: string | null
          cost_center?: string | null
          cost_price?: number | null
          created_at?: string
          detail_code?: string | null
          extra_data?: Json | null
          id?: string
          list_price?: number | null
          order_item_id: string
          packing_list_number?: string | null
          tenant_id: string
          unit_measure?: string | null
          updated_at?: string
        }
        Update: {
          account_code?: string | null
          batch_code?: string | null
          cfop?: string | null
          cost_center?: string | null
          cost_price?: number | null
          created_at?: string
          detail_code?: string | null
          extra_data?: Json | null
          id?: string
          list_price?: number | null
          order_item_id?: string
          packing_list_number?: string | null
          tenant_id?: string
          unit_measure?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_item_erp_data_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_erp_data_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          approved_at: string | null
          calculated_price_source: string | null
          commission_pct: number | null
          created_at: string
          delivery_date: string | null
          description: string
          discount_percent: number | null
          erp_item_sequence: number | null
          erp_status: string | null
          erp_synced_at: string | null
          id: string
          ipi_rate: number
          ipi_value: number
          item_date: string | null
          length: number | null
          order_id: string
          product_id: string | null
          quantity: number
          sale_type: string | null
          sort_order: number | null
          subtotal: number
          subtotal_item: number
          tenant_id: string
          thickness: number | null
          total_item: number
          unit_price: number
          width: number | null
        }
        Insert: {
          approved_at?: string | null
          calculated_price_source?: string | null
          commission_pct?: number | null
          created_at?: string
          delivery_date?: string | null
          description: string
          discount_percent?: number | null
          erp_item_sequence?: number | null
          erp_status?: string | null
          erp_synced_at?: string | null
          id?: string
          ipi_rate?: number
          ipi_value?: number
          item_date?: string | null
          length?: number | null
          order_id: string
          product_id?: string | null
          quantity?: number
          sale_type?: string | null
          sort_order?: number | null
          subtotal?: number
          subtotal_item?: number
          tenant_id?: string
          thickness?: number | null
          total_item?: number
          unit_price?: number
          width?: number | null
        }
        Update: {
          approved_at?: string | null
          calculated_price_source?: string | null
          commission_pct?: number | null
          created_at?: string
          delivery_date?: string | null
          description?: string
          discount_percent?: number | null
          erp_item_sequence?: number | null
          erp_status?: string | null
          erp_synced_at?: string | null
          id?: string
          ipi_rate?: number
          ipi_value?: number
          item_date?: string | null
          length?: number | null
          order_id?: string
          product_id?: string | null
          quantity?: number
          sale_type?: string | null
          sort_order?: number | null
          subtotal?: number
          subtotal_item?: number
          tenant_id?: string
          thickness?: number | null
          total_item?: number
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
          {
            foreignKeyName: "order_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_sync_log: {
        Row: {
          created_at: string
          direction: string
          error_message: string | null
          id: string
          order_id: string
          pedido_terceiro: number | null
          queue_item_id: string | null
          request_payload: Json | null
          response_payload: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          direction?: string
          error_message?: string | null
          id?: string
          order_id: string
          pedido_terceiro?: number | null
          queue_item_id?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          status: string
        }
        Update: {
          created_at?: string
          direction?: string
          error_message?: string | null
          id?: string
          order_id?: string
          pedido_terceiro?: number | null
          queue_item_id?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_sync_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_sync_log_queue_item_id_fkey"
            columns: ["queue_item_id"]
            isOneToOne: false
            referencedRelation: "order_sync_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      order_sync_queue: {
        Row: {
          attempt_count: number
          created_at: string
          error_message: string | null
          id: string
          max_attempts: number
          next_retry_at: string | null
          order_id: string
          pedido_terceiro: number
          processed_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          next_retry_at?: string | null
          order_id: string
          pedido_terceiro: number
          processed_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          next_retry_at?: string | null
          order_id?: string
          pedido_terceiro?: number
          processed_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_sync_queue_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_sync_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_type_erp_mapping: {
        Row: {
          created_at: string | null
          crm_order_type: string
          erp_flow_code: number
          erp_flow_description: string | null
          id: string
          is_active: boolean | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          crm_order_type: string
          erp_flow_code: number
          erp_flow_description?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          crm_order_type?: string
          erp_flow_code?: number
          erp_flow_description?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_type_erp_mapping_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          approved_at: string | null
          carrier_id: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_contact: string | null
          delivery_date: string | null
          delivery_name: string | null
          delivery_neighborhood: string | null
          delivery_number: string | null
          delivery_same_as_company: boolean | null
          delivery_state: string | null
          delivery_zip_code: string | null
          erp_last_sync_at: string | null
          erp_last_update_date: string | null
          erp_order_code: string | null
          erp_order_id: number | null
          erp_rep_code: string | null
          erp_status: string | null
          erp_sync_status: string
          erp_synced_at: string | null
          freight_type: string | null
          freight_value: number | null
          id: string
          ipi_mode: Database["public"]["Enums"]["ipi_mode"]
          legal_entity_id: string
          number: string
          observations: string | null
          order_date: string | null
          order_type: string
          origin: string
          payment_method: string | null
          payment_terms: string | null
          pedido_terceiro: number | null
          proposal_id: string | null
          sales_rep_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal_products: number
          tenant_id: string
          total_discount: number | null
          total_goods: number | null
          total_ipi: number
          total_value: number | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          approved_at?: string | null
          carrier_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_contact?: string | null
          delivery_date?: string | null
          delivery_name?: string | null
          delivery_neighborhood?: string | null
          delivery_number?: string | null
          delivery_same_as_company?: boolean | null
          delivery_state?: string | null
          delivery_zip_code?: string | null
          erp_last_sync_at?: string | null
          erp_last_update_date?: string | null
          erp_order_code?: string | null
          erp_order_id?: number | null
          erp_rep_code?: string | null
          erp_status?: string | null
          erp_sync_status?: string
          erp_synced_at?: string | null
          freight_type?: string | null
          freight_value?: number | null
          id?: string
          ipi_mode?: Database["public"]["Enums"]["ipi_mode"]
          legal_entity_id: string
          number: string
          observations?: string | null
          order_date?: string | null
          order_type?: string
          origin?: string
          payment_method?: string | null
          payment_terms?: string | null
          pedido_terceiro?: number | null
          proposal_id?: string | null
          sales_rep_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_products?: number
          tenant_id?: string
          total_discount?: number | null
          total_goods?: number | null
          total_ipi?: number
          total_value?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          approved_at?: string | null
          carrier_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_contact?: string | null
          delivery_date?: string | null
          delivery_name?: string | null
          delivery_neighborhood?: string | null
          delivery_number?: string | null
          delivery_same_as_company?: boolean | null
          delivery_state?: string | null
          delivery_zip_code?: string | null
          erp_last_sync_at?: string | null
          erp_last_update_date?: string | null
          erp_order_code?: string | null
          erp_order_id?: number | null
          erp_rep_code?: string | null
          erp_status?: string | null
          erp_sync_status?: string
          erp_synced_at?: string | null
          freight_type?: string | null
          freight_value?: number | null
          id?: string
          ipi_mode?: Database["public"]["Enums"]["ipi_mode"]
          legal_entity_id?: string
          number?: string
          observations?: string | null
          order_date?: string | null
          order_type?: string
          origin?: string
          payment_method?: string | null
          payment_terms?: string | null
          pedido_terceiro?: number | null
          proposal_id?: string | null
          sales_rep_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_products?: number
          tenant_id?: string
          total_discount?: number | null
          total_goods?: number | null
          total_ipi?: number
          total_value?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_activity_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "orders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_sales_rep_id_fkey"
            columns: ["sales_rep_id"]
            isOneToOne: false
            referencedRelation: "sales_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_method_erp_mapping: {
        Row: {
          created_at: string | null
          crm_payment_method: string
          erp_payment_code: number
          erp_payment_description: string | null
          id: string
          is_active: boolean | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          crm_payment_method: string
          erp_payment_code: number
          erp_payment_description?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          crm_payment_method?: string
          erp_payment_code?: number
          erp_payment_description?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
          allowed_roles: string[] | null
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
          allowed_roles?: string[] | null
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
          allowed_roles?: string[] | null
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
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          entity_id: string
          entity_name: string
          entity_type: string
          filter_context: Json | null
          from_sales_rep_id: string | null
          from_user_id: string | null
          id: string
          notes: string | null
          reason: string | null
          requested_by: string | null
          to_sales_rep_id: string | null
          to_user_id: string
          transfer_request_id: string | null
          transferred_at: string | null
          transferred_by: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          entity_id: string
          entity_name: string
          entity_type: string
          filter_context?: Json | null
          from_sales_rep_id?: string | null
          from_user_id?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          requested_by?: string | null
          to_sales_rep_id?: string | null
          to_user_id: string
          transfer_request_id?: string | null
          transferred_at?: string | null
          transferred_by: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          entity_id?: string
          entity_name?: string
          entity_type?: string
          filter_context?: Json | null
          from_sales_rep_id?: string | null
          from_user_id?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          requested_by?: string | null
          to_sales_rep_id?: string | null
          to_user_id?: string
          transfer_request_id?: string | null
          transferred_at?: string | null
          transferred_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_transfers_from_sales_rep_id_fkey"
            columns: ["from_sales_rep_id"]
            isOneToOne: false
            referencedRelation: "sales_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_transfers_to_sales_rep_id_fkey"
            columns: ["to_sales_rep_id"]
            isOneToOne: false
            referencedRelation: "sales_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_transfers_transfer_request_id_fkey"
            columns: ["transfer_request_id"]
            isOneToOne: false
            referencedRelation: "customer_transfer_requests"
            referencedColumns: ["id"]
          },
        ]
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
      product_classes: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
          tenant_id: string | null
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          tenant_id?: string | null
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          tenant_id?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_classes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_erp_data: {
        Row: {
          business_unit: string | null
          center_control: string | null
          commission_pct: number | null
          cost_price: number | null
          created_at: string
          erp_modified_at: string | null
          erp_price_table_code: string | null
          erp_product_type_id: number | null
          erp_registered_at: string | null
          extra_data: Json | null
          factory_code: string | null
          finance_charges_pct: number | null
          freight_pct: number | null
          freight_value: number | null
          id: string
          manufacturer_code: string | null
          packaging_pct: number | null
          packaging_weight: number | null
          parent_child_qty: number | null
          product_id: string
          purchase_converter: number | null
          purchase_unit: string | null
          purchase_warranty: number | null
          readjust_date: string | null
          readjust_pct: number | null
          sale_converter: number | null
          short_code: number | null
          tenant_id: string
          updated_at: string
          volume: number | null
        }
        Insert: {
          business_unit?: string | null
          center_control?: string | null
          commission_pct?: number | null
          cost_price?: number | null
          created_at?: string
          erp_modified_at?: string | null
          erp_price_table_code?: string | null
          erp_product_type_id?: number | null
          erp_registered_at?: string | null
          extra_data?: Json | null
          factory_code?: string | null
          finance_charges_pct?: number | null
          freight_pct?: number | null
          freight_value?: number | null
          id?: string
          manufacturer_code?: string | null
          packaging_pct?: number | null
          packaging_weight?: number | null
          parent_child_qty?: number | null
          product_id: string
          purchase_converter?: number | null
          purchase_unit?: string | null
          purchase_warranty?: number | null
          readjust_date?: string | null
          readjust_pct?: number | null
          sale_converter?: number | null
          short_code?: number | null
          tenant_id: string
          updated_at?: string
          volume?: number | null
        }
        Update: {
          business_unit?: string | null
          center_control?: string | null
          commission_pct?: number | null
          cost_price?: number | null
          created_at?: string
          erp_modified_at?: string | null
          erp_price_table_code?: string | null
          erp_product_type_id?: number | null
          erp_registered_at?: string | null
          extra_data?: Json | null
          factory_code?: string | null
          finance_charges_pct?: number | null
          freight_pct?: number | null
          freight_value?: number | null
          id?: string
          manufacturer_code?: string | null
          packaging_pct?: number | null
          packaging_weight?: number | null
          parent_child_qty?: number | null
          product_id?: string
          purchase_converter?: number | null
          purchase_unit?: string | null
          purchase_warranty?: number | null
          readjust_date?: string | null
          readjust_pct?: number | null
          sale_converter?: number | null
          short_code?: number | null
          tenant_id?: string
          updated_at?: string
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_erp_data_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_erp_data_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_erp_sync_log: {
        Row: {
          created_at: string | null
          direction: string
          erp_product_code: string | null
          erp_versao: string | null
          error_details: string | null
          id: string
          payload_sent: Json | null
          product_id: string | null
          response_received: Json | null
          status: string
        }
        Insert: {
          created_at?: string | null
          direction: string
          erp_product_code?: string | null
          erp_versao?: string | null
          error_details?: string | null
          id?: string
          payload_sent?: Json | null
          product_id?: string | null
          response_received?: Json | null
          status: string
        }
        Update: {
          created_at?: string | null
          direction?: string
          erp_product_code?: string | null
          erp_versao?: string | null
          error_details?: string | null
          id?: string
          payload_sent?: Json | null
          product_id?: string | null
          response_received?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_erp_sync_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_families: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
          tenant_id: string | null
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          tenant_id?: string | null
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          tenant_id?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_families_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_groups: {
        Row: {
          created_at: string | null
          created_by: string | null
          dimension_profile: Database["public"]["Enums"]["dimension_profile"]
          id: string
          is_active: boolean | null
          is_printed: boolean | null
          label: string
          sort_order: number | null
          tenant_id: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          dimension_profile?: Database["public"]["Enums"]["dimension_profile"]
          id?: string
          is_active?: boolean | null
          is_printed?: boolean | null
          label: string
          sort_order?: number | null
          tenant_id?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          dimension_profile?: Database["public"]["Enums"]["dimension_profile"]
          id?: string
          is_active?: boolean | null
          is_printed?: boolean | null
          label?: string
          sort_order?: number | null
          tenant_id?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_ncm_audit: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          has_billing_history: boolean | null
          id: string
          ip_address: unknown
          new_fiscal_state: Json | null
          new_ncm: string | null
          old_fiscal_state: Json | null
          old_ncm: string | null
          product_id: string
          reason: string | null
          user_agent: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          has_billing_history?: boolean | null
          id?: string
          ip_address?: unknown
          new_fiscal_state?: Json | null
          new_ncm?: string | null
          old_fiscal_state?: Json | null
          old_ncm?: string | null
          product_id: string
          reason?: string | null
          user_agent?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          has_billing_history?: boolean | null
          id?: string
          ip_address?: unknown
          new_fiscal_state?: Json | null
          new_ncm?: string | null
          old_fiscal_state?: Json | null
          old_ncm?: string | null
          product_id?: string
          reason?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_ncm_audit_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_stock: {
        Row: {
          company_id: string
          created_at: string
          estoque_maximo: number | null
          estoque_minimo: number | null
          id: string
          product_id: string
          quantidade_atual: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          estoque_maximo?: number | null
          estoque_minimo?: number | null
          id?: string
          product_id: string
          quantidade_atual?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          estoque_maximo?: number | null
          estoque_minimo?: number | null
          id?: string
          product_id?: string
          quantidade_atual?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_stock_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_subgroups: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          label: string
          sort_order: number | null
          tenant_id: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          sort_order?: number | null
          tenant_id?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          sort_order?: number | null
          tenant_id?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_subgroups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sync_log: {
        Row: {
          created_at: string
          direction: string
          erp_hash_at_sync: string | null
          error_message: string | null
          id: string
          ip_address: string | null
          product_id: string
          queue_item_id: string | null
          request_payload: Json | null
          response_payload: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          direction?: string
          erp_hash_at_sync?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          product_id: string
          queue_item_id?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          status: string
        }
        Update: {
          created_at?: string
          direction?: string
          erp_hash_at_sync?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          product_id?: string
          queue_item_id?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_sync_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_sync_log_queue_item_id_fkey"
            columns: ["queue_item_id"]
            isOneToOne: false
            referencedRelation: "product_sync_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sync_queue: {
        Row: {
          attempt_count: number | null
          created_at: string | null
          error_message: string | null
          id: string
          max_attempts: number | null
          next_retry_at: string | null
          payload: Json | null
          processed_at: string | null
          product_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          attempt_count?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          next_retry_at?: string | null
          payload?: Json | null
          processed_at?: string | null
          product_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          attempt_count?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          next_retry_at?: string | null
          payload?: Json | null
          processed_at?: string | null
          product_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_sync_queue_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_types: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          label: string
          sort_order: number | null
          tenant_id: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          sort_order?: number | null
          tenant_id?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          sort_order?: number | null
          tenant_id?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_unit_measures: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          label: string
          sort_order: number | null
          value: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          sort_order?: number | null
          value: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          sort_order?: number | null
          value?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          abc_classification: string | null
          active: boolean | null
          aliquota_cofins: number | null
          aliquota_icms: number | null
          aliquota_ipi: number | null
          aliquota_pis: number | null
          class_id: string | null
          created_at: string
          created_by: string | null
          crm_last_update_at: string | null
          csosn: string | null
          cst_icms: string | null
          cst_pis_cofins: string | null
          description: string | null
          erp_empresa: number | null
          erp_grupo: string | null
          erp_hash: string | null
          erp_last_sync_at: string | null
          erp_last_update_date: string | null
          erp_product_code: string | null
          erp_status: string | null
          erp_subgrupo: string | null
          erp_synced_at: string | null
          erp_versao: string | null
          erp_versao_codigo: string | null
          erp_versao_detalhes: string | null
          erp_versao_roteiro: number | null
          erp_versao_situacao: string | null
          family_id: string | null
          fator_kg: number | null
          fator_milheiro: number | null
          grupo_id: string | null
          id: string
          is_acabado: boolean | null
          length: number | null
          name: string
          ncm_code: string | null
          ncm_id: string | null
          ncm_validated_at: string | null
          nome_impresso: string | null
          origem_alteracao: string | null
          origem_mercadoria:
            | Database["public"]["Enums"]["origem_mercadoria"]
            | null
          pendente_envio: boolean | null
          price_cash: number | null
          price_term: number | null
          reference: string | null
          sku: string
          sku_unique: string | null
          structure_hash: string | null
          subcategory: string | null
          subgrupo_id: string | null
          tem_icms_st: boolean | null
          tenant_id: string
          thickness: number | null
          tipo_ficha: number | null
          tipo_id: string | null
          tipo_item: string | null
          tipo_produto_fiscal:
            | Database["public"]["Enums"]["tipo_produto_fiscal"]
            | null
          unit_measure: string | null
          unit_price: number | null
          unit_sale: string | null
          updated_at: string
          warranty_months: number | null
          weight: number | null
          width: number | null
        }
        Insert: {
          abc_classification?: string | null
          active?: boolean | null
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_ipi?: number | null
          aliquota_pis?: number | null
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          crm_last_update_at?: string | null
          csosn?: string | null
          cst_icms?: string | null
          cst_pis_cofins?: string | null
          description?: string | null
          erp_empresa?: number | null
          erp_grupo?: string | null
          erp_hash?: string | null
          erp_last_sync_at?: string | null
          erp_last_update_date?: string | null
          erp_product_code?: string | null
          erp_status?: string | null
          erp_subgrupo?: string | null
          erp_synced_at?: string | null
          erp_versao?: string | null
          erp_versao_codigo?: string | null
          erp_versao_detalhes?: string | null
          erp_versao_roteiro?: number | null
          erp_versao_situacao?: string | null
          family_id?: string | null
          fator_kg?: number | null
          fator_milheiro?: number | null
          grupo_id?: string | null
          id?: string
          is_acabado?: boolean | null
          length?: number | null
          name: string
          ncm_code?: string | null
          ncm_id?: string | null
          ncm_validated_at?: string | null
          nome_impresso?: string | null
          origem_alteracao?: string | null
          origem_mercadoria?:
            | Database["public"]["Enums"]["origem_mercadoria"]
            | null
          pendente_envio?: boolean | null
          price_cash?: number | null
          price_term?: number | null
          reference?: string | null
          sku: string
          sku_unique?: string | null
          structure_hash?: string | null
          subcategory?: string | null
          subgrupo_id?: string | null
          tem_icms_st?: boolean | null
          tenant_id?: string
          thickness?: number | null
          tipo_ficha?: number | null
          tipo_id?: string | null
          tipo_item?: string | null
          tipo_produto_fiscal?:
            | Database["public"]["Enums"]["tipo_produto_fiscal"]
            | null
          unit_measure?: string | null
          unit_price?: number | null
          unit_sale?: string | null
          updated_at?: string
          warranty_months?: number | null
          weight?: number | null
          width?: number | null
        }
        Update: {
          abc_classification?: string | null
          active?: boolean | null
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_ipi?: number | null
          aliquota_pis?: number | null
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          crm_last_update_at?: string | null
          csosn?: string | null
          cst_icms?: string | null
          cst_pis_cofins?: string | null
          description?: string | null
          erp_empresa?: number | null
          erp_grupo?: string | null
          erp_hash?: string | null
          erp_last_sync_at?: string | null
          erp_last_update_date?: string | null
          erp_product_code?: string | null
          erp_status?: string | null
          erp_subgrupo?: string | null
          erp_synced_at?: string | null
          erp_versao?: string | null
          erp_versao_codigo?: string | null
          erp_versao_detalhes?: string | null
          erp_versao_roteiro?: number | null
          erp_versao_situacao?: string | null
          family_id?: string | null
          fator_kg?: number | null
          fator_milheiro?: number | null
          grupo_id?: string | null
          id?: string
          is_acabado?: boolean | null
          length?: number | null
          name?: string
          ncm_code?: string | null
          ncm_id?: string | null
          ncm_validated_at?: string | null
          nome_impresso?: string | null
          origem_alteracao?: string | null
          origem_mercadoria?:
            | Database["public"]["Enums"]["origem_mercadoria"]
            | null
          pendente_envio?: boolean | null
          price_cash?: number | null
          price_term?: number | null
          reference?: string | null
          sku?: string
          sku_unique?: string | null
          structure_hash?: string | null
          subcategory?: string | null
          subgrupo_id?: string | null
          tem_icms_st?: boolean | null
          tenant_id?: string
          thickness?: number | null
          tipo_ficha?: number | null
          tipo_id?: string | null
          tipo_item?: string | null
          tipo_produto_fiscal?:
            | Database["public"]["Enums"]["tipo_produto_fiscal"]
            | null
          unit_measure?: string | null
          unit_price?: number | null
          unit_sale?: string | null
          updated_at?: string
          warranty_months?: number | null
          weight?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_products_grupo"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "product_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_products_subgrupo"
            columns: ["subgrupo_id"]
            isOneToOne: false
            referencedRelation: "product_subgroups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_products_tipo"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "product_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "product_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_ncm_id_fkey"
            columns: ["ncm_id"]
            isOneToOne: false
            referencedRelation: "ncm_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products_dedup_backup: {
        Row: {
          active: boolean | null
          backed_up_at: string
          backup_id: string
          created_at: string | null
          full_row: Json
          name: string | null
          original_id: string
          sku: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          backed_up_at?: string
          backup_id?: string
          created_at?: string | null
          full_row: Json
          name?: string | null
          original_id: string
          sku?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          backed_up_at?: string
          backup_id?: string
          created_at?: string | null
          full_row?: Json
          name?: string | null
          original_id?: string
          sku?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_legal_entity_id: string | null
          active_tenant_id: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          erp_user_code: number | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_legal_entity_id?: string | null
          active_tenant_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          erp_user_code?: number | null
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_legal_entity_id?: string | null
          active_tenant_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          erp_user_code?: number | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_legal_entity_id_fkey"
            columns: ["active_legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_active_tenant_id_fkey"
            columns: ["active_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          calculated_price_source: string | null
          created_at: string
          description: string
          discount_percent: number | null
          id: string
          ipi_rate: number
          ipi_value: number
          length: number | null
          product_id: string | null
          proposal_id: string
          quantity: number
          sort_order: number | null
          subtotal: number
          subtotal_item: number
          thickness: number | null
          total_item: number
          unit_price: number
          width: number | null
        }
        Insert: {
          calculated_price_source?: string | null
          created_at?: string
          description: string
          discount_percent?: number | null
          id?: string
          ipi_rate?: number
          ipi_value?: number
          length?: number | null
          product_id?: string | null
          proposal_id: string
          quantity?: number
          sort_order?: number | null
          subtotal?: number
          subtotal_item?: number
          thickness?: number | null
          total_item?: number
          unit_price?: number
          width?: number | null
        }
        Update: {
          calculated_price_source?: string | null
          created_at?: string
          description?: string
          discount_percent?: number | null
          id?: string
          ipi_rate?: number
          ipi_value?: number
          length?: number | null
          product_id?: string | null
          proposal_id?: string
          quantity?: number
          sort_order?: number | null
          subtotal?: number
          subtotal_item?: number
          thickness?: number | null
          total_item?: number
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
          carrier_id: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string
          delivery_address: string | null
          delivery_city: string | null
          delivery_contact: string | null
          delivery_name: string | null
          delivery_neighborhood: string | null
          delivery_number: string | null
          delivery_same_as_company: boolean | null
          delivery_state: string | null
          delivery_terms: string | null
          delivery_zip_code: string | null
          freight_type: string | null
          id: string
          ipi_mode: Database["public"]["Enums"]["ipi_mode"]
          legal_entity_id: string | null
          number: string
          observations: string | null
          payment_terms: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["proposal_status"]
          subtotal_products: number
          tenant_id: string
          total_ipi: number
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
          carrier_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id: string
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_contact?: string | null
          delivery_name?: string | null
          delivery_neighborhood?: string | null
          delivery_number?: string | null
          delivery_same_as_company?: boolean | null
          delivery_state?: string | null
          delivery_terms?: string | null
          delivery_zip_code?: string | null
          freight_type?: string | null
          id?: string
          ipi_mode?: Database["public"]["Enums"]["ipi_mode"]
          legal_entity_id?: string | null
          number: string
          observations?: string | null
          payment_terms?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          subtotal_products?: number
          tenant_id?: string
          total_ipi?: number
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
          carrier_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_contact?: string | null
          delivery_name?: string | null
          delivery_neighborhood?: string | null
          delivery_number?: string | null
          delivery_same_as_company?: boolean | null
          delivery_state?: string | null
          delivery_terms?: string | null
          delivery_zip_code?: string | null
          freight_type?: string | null
          id?: string
          ipi_mode?: Database["public"]["Enums"]["ipi_mode"]
          legal_entity_id?: string | null
          number?: string
          observations?: string | null
          payment_terms?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          subtotal_products?: number
          tenant_id?: string
          total_ipi?: number
          total_value?: number | null
          updated_at?: string
          validity_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_activity_summary"
            referencedColumns: ["company_id"]
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
          {
            foreignKeyName: "proposals_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      prospecting_results: {
        Row: {
          cidade: string | null
          cnae_descricao: string | null
          cnae_principal: string | null
          cnpj: string
          created_at: string
          data_abertura: string | null
          discarded_at: string | null
          discarded_by: string | null
          estado: string | null
          id: string
          nome_fantasia: string | null
          porte: string | null
          raw_data: Json | null
          razao_social: string | null
          saved_as_company_id: string | null
          saved_at: string | null
          saved_by: string | null
          search_id: string
          situacao_cadastral: string | null
          status: Database["public"]["Enums"]["prospecting_result_status"]
        }
        Insert: {
          cidade?: string | null
          cnae_descricao?: string | null
          cnae_principal?: string | null
          cnpj: string
          created_at?: string
          data_abertura?: string | null
          discarded_at?: string | null
          discarded_by?: string | null
          estado?: string | null
          id?: string
          nome_fantasia?: string | null
          porte?: string | null
          raw_data?: Json | null
          razao_social?: string | null
          saved_as_company_id?: string | null
          saved_at?: string | null
          saved_by?: string | null
          search_id: string
          situacao_cadastral?: string | null
          status?: Database["public"]["Enums"]["prospecting_result_status"]
        }
        Update: {
          cidade?: string | null
          cnae_descricao?: string | null
          cnae_principal?: string | null
          cnpj?: string
          created_at?: string
          data_abertura?: string | null
          discarded_at?: string | null
          discarded_by?: string | null
          estado?: string | null
          id?: string
          nome_fantasia?: string | null
          porte?: string | null
          raw_data?: Json | null
          razao_social?: string | null
          saved_as_company_id?: string | null
          saved_at?: string | null
          saved_by?: string | null
          search_id?: string
          situacao_cadastral?: string | null
          status?: Database["public"]["Enums"]["prospecting_result_status"]
        }
        Relationships: [
          {
            foreignKeyName: "prospecting_results_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "prospecting_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      prospecting_searches: {
        Row: {
          created_at: string
          filters: Json
          id: string
          results_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          results_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          results_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      regras_tributacao: {
        Row: {
          ano_vigencia_fim: number | null
          ano_vigencia_inicio: number | null
          c_class_trib:
            | Database["public"]["Enums"]["classificacao_tributaria_nfe"]
            | null
          cbs_aliquota: number | null
          cbs_aliquota_efetiva: number | null
          cbs_reducao_base: number | null
          cbs_regime_incidencia:
            | Database["public"]["Enums"]["regime_incidencia_cbs_ibs"]
            | null
          cbs_tipo_credito:
            | Database["public"]["Enums"]["tipo_geracao_credito"]
            | null
          cfop: string | null
          cfop_resultante: string
          codigo_interno: string | null
          cofins_aliquota: number | null
          cofins_cst: string | null
          created_at: string | null
          created_by: string | null
          cst_nfe: string | null
          descricao: string | null
          difal_aliquota_destino: number | null
          difal_aliquota_origem: number | null
          fcp_aliquota: number | null
          ibs_aliquota: number | null
          ibs_aliquota_efetiva: number | null
          ibs_reducao_base: number | null
          ibs_regime_incidencia:
            | Database["public"]["Enums"]["regime_incidencia_cbs_ibs"]
            | null
          ibs_reparticao_estadual: number | null
          ibs_reparticao_municipal: number | null
          ibs_tipo_credito:
            | Database["public"]["Enums"]["tipo_geracao_credito"]
            | null
          icms_aliquota: number | null
          icms_csosn: string | null
          icms_cst: string | null
          icms_mva: number | null
          icms_reducao_base: number | null
          icms_st_aliquota: number | null
          icms_st_reducao_base: number | null
          id: string
          ipi_aliquota: number | null
          ipi_cst: string | null
          ipi_enquadramento: string | null
          is_active: boolean | null
          is_aliquota: number | null
          is_aplicavel: boolean | null
          is_categoria:
            | Database["public"]["Enums"]["categoria_imposto_seletivo"]
            | null
          is_excecao_legal: string | null
          is_fallback: boolean | null
          is_produto_final: boolean | null
          iss_aliquota: number | null
          locked_at: string | null
          locked_by_document_id: string | null
          modelo_tributario:
            | Database["public"]["Enums"]["modelo_tributario"]
            | null
          ncm_code: string | null
          nome: string
          origem_mercadoria:
            | Database["public"]["Enums"]["origem_mercadoria"]
            | null
          pis_aliquota: number | null
          pis_cst: string | null
          prioridade: number | null
          regime_cliente:
            | Database["public"]["Enums"]["regime_tributario"]
            | null
          regime_empresa:
            | Database["public"]["Enums"]["regime_tributario"]
            | null
          tipo_operacao:
            | Database["public"]["Enums"]["tipo_operacao_fiscal"]
            | null
          uf_destino: string | null
          uf_origem: string | null
          updated_at: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          ano_vigencia_fim?: number | null
          ano_vigencia_inicio?: number | null
          c_class_trib?:
            | Database["public"]["Enums"]["classificacao_tributaria_nfe"]
            | null
          cbs_aliquota?: number | null
          cbs_aliquota_efetiva?: number | null
          cbs_reducao_base?: number | null
          cbs_regime_incidencia?:
            | Database["public"]["Enums"]["regime_incidencia_cbs_ibs"]
            | null
          cbs_tipo_credito?:
            | Database["public"]["Enums"]["tipo_geracao_credito"]
            | null
          cfop?: string | null
          cfop_resultante: string
          codigo_interno?: string | null
          cofins_aliquota?: number | null
          cofins_cst?: string | null
          created_at?: string | null
          created_by?: string | null
          cst_nfe?: string | null
          descricao?: string | null
          difal_aliquota_destino?: number | null
          difal_aliquota_origem?: number | null
          fcp_aliquota?: number | null
          ibs_aliquota?: number | null
          ibs_aliquota_efetiva?: number | null
          ibs_reducao_base?: number | null
          ibs_regime_incidencia?:
            | Database["public"]["Enums"]["regime_incidencia_cbs_ibs"]
            | null
          ibs_reparticao_estadual?: number | null
          ibs_reparticao_municipal?: number | null
          ibs_tipo_credito?:
            | Database["public"]["Enums"]["tipo_geracao_credito"]
            | null
          icms_aliquota?: number | null
          icms_csosn?: string | null
          icms_cst?: string | null
          icms_mva?: number | null
          icms_reducao_base?: number | null
          icms_st_aliquota?: number | null
          icms_st_reducao_base?: number | null
          id?: string
          ipi_aliquota?: number | null
          ipi_cst?: string | null
          ipi_enquadramento?: string | null
          is_active?: boolean | null
          is_aliquota?: number | null
          is_aplicavel?: boolean | null
          is_categoria?:
            | Database["public"]["Enums"]["categoria_imposto_seletivo"]
            | null
          is_excecao_legal?: string | null
          is_fallback?: boolean | null
          is_produto_final?: boolean | null
          iss_aliquota?: number | null
          locked_at?: string | null
          locked_by_document_id?: string | null
          modelo_tributario?:
            | Database["public"]["Enums"]["modelo_tributario"]
            | null
          ncm_code?: string | null
          nome: string
          origem_mercadoria?:
            | Database["public"]["Enums"]["origem_mercadoria"]
            | null
          pis_aliquota?: number | null
          pis_cst?: string | null
          prioridade?: number | null
          regime_cliente?:
            | Database["public"]["Enums"]["regime_tributario"]
            | null
          regime_empresa?:
            | Database["public"]["Enums"]["regime_tributario"]
            | null
          tipo_operacao?:
            | Database["public"]["Enums"]["tipo_operacao_fiscal"]
            | null
          uf_destino?: string | null
          uf_origem?: string | null
          updated_at?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          ano_vigencia_fim?: number | null
          ano_vigencia_inicio?: number | null
          c_class_trib?:
            | Database["public"]["Enums"]["classificacao_tributaria_nfe"]
            | null
          cbs_aliquota?: number | null
          cbs_aliquota_efetiva?: number | null
          cbs_reducao_base?: number | null
          cbs_regime_incidencia?:
            | Database["public"]["Enums"]["regime_incidencia_cbs_ibs"]
            | null
          cbs_tipo_credito?:
            | Database["public"]["Enums"]["tipo_geracao_credito"]
            | null
          cfop?: string | null
          cfop_resultante?: string
          codigo_interno?: string | null
          cofins_aliquota?: number | null
          cofins_cst?: string | null
          created_at?: string | null
          created_by?: string | null
          cst_nfe?: string | null
          descricao?: string | null
          difal_aliquota_destino?: number | null
          difal_aliquota_origem?: number | null
          fcp_aliquota?: number | null
          ibs_aliquota?: number | null
          ibs_aliquota_efetiva?: number | null
          ibs_reducao_base?: number | null
          ibs_regime_incidencia?:
            | Database["public"]["Enums"]["regime_incidencia_cbs_ibs"]
            | null
          ibs_reparticao_estadual?: number | null
          ibs_reparticao_municipal?: number | null
          ibs_tipo_credito?:
            | Database["public"]["Enums"]["tipo_geracao_credito"]
            | null
          icms_aliquota?: number | null
          icms_csosn?: string | null
          icms_cst?: string | null
          icms_mva?: number | null
          icms_reducao_base?: number | null
          icms_st_aliquota?: number | null
          icms_st_reducao_base?: number | null
          id?: string
          ipi_aliquota?: number | null
          ipi_cst?: string | null
          ipi_enquadramento?: string | null
          is_active?: boolean | null
          is_aliquota?: number | null
          is_aplicavel?: boolean | null
          is_categoria?:
            | Database["public"]["Enums"]["categoria_imposto_seletivo"]
            | null
          is_excecao_legal?: string | null
          is_fallback?: boolean | null
          is_produto_final?: boolean | null
          iss_aliquota?: number | null
          locked_at?: string | null
          locked_by_document_id?: string | null
          modelo_tributario?:
            | Database["public"]["Enums"]["modelo_tributario"]
            | null
          ncm_code?: string | null
          nome?: string
          origem_mercadoria?:
            | Database["public"]["Enums"]["origem_mercadoria"]
            | null
          pis_aliquota?: number | null
          pis_cst?: string | null
          prioridade?: number | null
          regime_cliente?:
            | Database["public"]["Enums"]["regime_tributario"]
            | null
          regime_empresa?:
            | Database["public"]["Enums"]["regime_tributario"]
            | null
          tipo_operacao?:
            | Database["public"]["Enums"]["tipo_operacao_fiscal"]
            | null
          uf_destino?: string | null
          uf_origem?: string | null
          updated_at?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      request_logs: {
        Row: {
          created_at: string
          function_name: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          function_name: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          function_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
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
      sale_type_erp_mapping: {
        Row: {
          created_at: string | null
          crm_sale_type: string
          erp_sale_type_code: number
          erp_sale_type_description: string | null
          id: string
          is_active: boolean | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          crm_sale_type: string
          erp_sale_type_code: number
          erp_sale_type_description?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          crm_sale_type?: string
          erp_sale_type_code?: number
          erp_sale_type_description?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
      sales_reps: {
        Row: {
          active: boolean | null
          created_at: string | null
          email: string | null
          erp_vendor_code: number | null
          id: string
          name: string
          phone: string | null
          tenant_id: string
          type: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          email?: string | null
          erp_vendor_code?: number | null
          id?: string
          name: string
          phone?: string | null
          tenant_id: string
          type?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          email?: string | null
          erp_vendor_code?: number | null
          id?: string
          name?: string
          phone?: string | null
          tenant_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_reps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      segmentos: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          is_active: boolean | null
          nome: string
          setor_id: string
          sort_order: number | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean | null
          nome: string
          setor_id: string
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean | null
          nome?: string
          setor_id?: string
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "segmentos_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segmentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      setores: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          is_active: boolean | null
          nome: string
          sort_order: number | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean | null
          nome: string
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean | null
          nome?: string
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "setores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      split_payment_registros: {
        Row: {
          cbs_aliquota: number | null
          cbs_base_calculo: number | null
          cbs_status: Database["public"]["Enums"]["split_payment_status"] | null
          cbs_valor: number | null
          created_at: string | null
          data_ajuste: string | null
          data_liquidacao: string | null
          data_operacao: string
          data_retencao: string | null
          documento_id: string
          documento_tipo: string
          ibs_aliquota: number | null
          ibs_base_calculo: number | null
          ibs_status: Database["public"]["Enums"]["split_payment_status"] | null
          ibs_valor: number | null
          ibs_valor_estadual: number | null
          ibs_valor_municipal: number | null
          id: string
          intermediador_cnpj: string | null
          intermediador_id: string | null
          intermediador_nome: string | null
          is_aliquota: number | null
          is_base_calculo: number | null
          is_status: Database["public"]["Enums"]["split_payment_status"] | null
          is_valor: number | null
          item_id: string | null
          updated_at: string | null
          valor_liquido_fornecedor: number
          valor_operacao: number
          valor_total_retido: number
        }
        Insert: {
          cbs_aliquota?: number | null
          cbs_base_calculo?: number | null
          cbs_status?:
            | Database["public"]["Enums"]["split_payment_status"]
            | null
          cbs_valor?: number | null
          created_at?: string | null
          data_ajuste?: string | null
          data_liquidacao?: string | null
          data_operacao?: string
          data_retencao?: string | null
          documento_id: string
          documento_tipo: string
          ibs_aliquota?: number | null
          ibs_base_calculo?: number | null
          ibs_status?:
            | Database["public"]["Enums"]["split_payment_status"]
            | null
          ibs_valor?: number | null
          ibs_valor_estadual?: number | null
          ibs_valor_municipal?: number | null
          id?: string
          intermediador_cnpj?: string | null
          intermediador_id?: string | null
          intermediador_nome?: string | null
          is_aliquota?: number | null
          is_base_calculo?: number | null
          is_status?: Database["public"]["Enums"]["split_payment_status"] | null
          is_valor?: number | null
          item_id?: string | null
          updated_at?: string | null
          valor_liquido_fornecedor: number
          valor_operacao: number
          valor_total_retido: number
        }
        Update: {
          cbs_aliquota?: number | null
          cbs_base_calculo?: number | null
          cbs_status?:
            | Database["public"]["Enums"]["split_payment_status"]
            | null
          cbs_valor?: number | null
          created_at?: string | null
          data_ajuste?: string | null
          data_liquidacao?: string | null
          data_operacao?: string
          data_retencao?: string | null
          documento_id?: string
          documento_tipo?: string
          ibs_aliquota?: number | null
          ibs_base_calculo?: number | null
          ibs_status?:
            | Database["public"]["Enums"]["split_payment_status"]
            | null
          ibs_valor?: number | null
          ibs_valor_estadual?: number | null
          ibs_valor_municipal?: number | null
          id?: string
          intermediador_cnpj?: string | null
          intermediador_id?: string | null
          intermediador_nome?: string | null
          is_aliquota?: number | null
          is_base_calculo?: number | null
          is_status?: Database["public"]["Enums"]["split_payment_status"] | null
          is_valor?: number | null
          item_id?: string | null
          updated_at?: string | null
          valor_liquido_fornecedor?: number
          valor_operacao?: number
          valor_total_retido?: number
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
      stock_movements: {
        Row: {
          company_id: string
          created_at: string
          id: string
          motivo: string | null
          product_id: string
          quantidade: number
          referencia_id: string | null
          referencia_tipo: string | null
          tenant_id: string
          tipo: Database["public"]["Enums"]["stock_movement_type"]
          usuario_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          motivo?: string | null
          product_id: string
          quantidade: number
          referencia_id?: string | null
          referencia_tipo?: string | null
          tenant_id: string
          tipo: Database["public"]["Enums"]["stock_movement_type"]
          usuario_id?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          motivo?: string | null
          product_id?: string
          quantidade?: number
          referencia_id?: string | null
          referencia_tipo?: string | null
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["stock_movement_type"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      system_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
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
          calendar_source: string | null
          company_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          description: string | null
          due_date: string | null
          due_time: string | null
          google_event_id: string | null
          id: string
          last_synced_at: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          calendar_source?: string | null
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          google_event_id?: string | null
          id?: string
          last_synced_at?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          tenant_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          calendar_source?: string | null
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          google_event_id?: string | null
          id?: string
          last_synced_at?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          tenant_id?: string
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
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_activity_summary"
            referencedColumns: ["company_id"]
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
          {
            foreignKeyName: "tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          category: string
          created_at: string
          id: string
          settings: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          settings?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          settings?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          active: boolean | null
          created_at: string
          id: string
          name: string
          settings: Json | null
          slug: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          id?: string
          name: string
          settings?: Json | null
          slug: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          id?: string
          name?: string
          settings?: Json | null
          slug?: string
        }
        Relationships: []
      }
      transicao_tributaria_parametros: {
        Row: {
          aliquota_cbs_referencia: number | null
          aliquota_ibs_estadual: number | null
          aliquota_ibs_municipal: number | null
          aliquota_ibs_referencia: number | null
          ano_referencia: number
          base_legal: string | null
          created_at: string | null
          descricao: string | null
          id: string
          is_active: boolean | null
          modelo_tributario: Database["public"]["Enums"]["modelo_tributario"]
          percentual_cbs: number
          percentual_ibs: number
          percentual_icms_iss: number
          percentual_pis_cofins: number
          updated_at: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          aliquota_cbs_referencia?: number | null
          aliquota_ibs_estadual?: number | null
          aliquota_ibs_municipal?: number | null
          aliquota_ibs_referencia?: number | null
          ano_referencia: number
          base_legal?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean | null
          modelo_tributario: Database["public"]["Enums"]["modelo_tributario"]
          percentual_cbs?: number
          percentual_ibs?: number
          percentual_icms_iss?: number
          percentual_pis_cofins?: number
          updated_at?: string | null
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          aliquota_cbs_referencia?: number | null
          aliquota_ibs_estadual?: number | null
          aliquota_ibs_municipal?: number | null
          aliquota_ibs_referencia?: number | null
          ano_referencia?: number
          base_legal?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean | null
          modelo_tributario?: Database["public"]["Enums"]["modelo_tributario"]
          percentual_cbs?: number
          percentual_ibs?: number
          percentual_icms_iss?: number
          percentual_pis_cofins?: number
          updated_at?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      user_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          performed_by: string | null
          target_user_email: string | null
          target_user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_by?: string | null
          target_user_email?: string | null
          target_user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_by?: string | null
          target_user_email?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      user_dashboard_cards: {
        Row: {
          card_key: string
          created_at: string
          enabled: boolean
          id: string
          position: number
          user_id: string
        }
        Insert: {
          card_key: string
          created_at?: string
          enabled?: boolean
          id?: string
          position?: number
          user_id: string
        }
        Update: {
          card_key?: string
          created_at?: string
          enabled?: boolean
          id?: string
          position?: number
          user_id?: string
        }
        Relationships: []
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
      user_legal_entities: {
        Row: {
          created_at: string
          id: string
          legal_entity_id: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          legal_entity_id: string
          role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          legal_entity_id?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_legal_entities_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_legal_entities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_legal_entities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_legal_entities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      user_portfolio_delegations: {
        Row: {
          active: boolean
          can_manage_companies: boolean
          can_manage_contacts: boolean
          can_manage_deals: boolean
          can_manage_orders: boolean
          can_manage_pipeline: boolean
          created_at: string
          created_by: string | null
          id: string
          manager_user_id: string
          portfolio_owner_id: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          can_manage_companies?: boolean
          can_manage_contacts?: boolean
          can_manage_deals?: boolean
          can_manage_orders?: boolean
          can_manage_pipeline?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          manager_user_id: string
          portfolio_owner_id: string
          tenant_id: string
        }
        Update: {
          active?: boolean
          can_manage_companies?: boolean
          can_manage_contacts?: boolean
          can_manage_deals?: boolean
          can_manage_orders?: boolean
          can_manage_pipeline?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          manager_user_id?: string
          portfolio_owner_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_portfolio_delegations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_portfolio_delegations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_portfolio_delegations_manager_user_id_fkey"
            columns: ["manager_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_portfolio_delegations_manager_user_id_fkey"
            columns: ["manager_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_portfolio_delegations_portfolio_owner_id_fkey"
            columns: ["portfolio_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_portfolio_delegations_portfolio_owner_id_fkey"
            columns: ["portfolio_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_portfolio_delegations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      user_sales_reps: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean | null
          sales_rep_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          sales_rep_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          sales_rep_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sales_reps_sales_rep_id_fkey"
            columns: ["sales_rep_id"]
            isOneToOne: false
            referencedRelation: "sales_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tenants: {
        Row: {
          created_at: string
          id: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tenants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "whatsapp_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_activity_summary"
            referencedColumns: ["company_id"]
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
      company_activity_summary: {
        Row: {
          active: boolean | null
          city: string | null
          cnpj: string | null
          company_created_at: string | null
          company_id: string | null
          company_name: string | null
          last_interaction_at: string | null
          last_order_at: string | null
          owner_id: string | null
          regiao: string | null
          state: string | null
          subregiao: string | null
          total_order_value: number | null
          total_orders: number | null
        }
        Relationships: []
      }
      profiles_safe: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
          phone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          phone?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          phone?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      unified_company_for_reallocation: {
        Row: {
          city: string | null
          cnpj: string | null
          company_id: string | null
          company_name: string | null
          last_interaction_at: string | null
          last_order_at: string | null
          owner_id: string | null
          regiao: string | null
          sales_rep_id: string | null
          source: string | null
          state: string | null
          subregiao: string | null
          total_order_value: number | null
          total_orders: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_kill_session: { Args: { p_session_id: string }; Returns: boolean }
      approve_transfer_request: {
        Args: { p_request_id: string; p_review_note?: string }
        Returns: Json
      }
      can_access_legal_entity: {
        Args: { p_legal_entity_id: string; p_user_id: string }
        Returns: boolean
      }
      can_manage_portfolio: {
        Args: { p_entity_type?: string; p_owner_id: string; p_user_id: string }
        Returns: boolean
      }
      can_update_credit_score: { Args: { _user_id: string }; Returns: boolean }
      check_existing_session: { Args: { p_user_id: string }; Returns: Json }
      check_pending_tasks: { Args: { p_user_id: string }; Returns: Json }
      cleanup_expired_sessions: { Args: never; Returns: number }
      cleanup_request_logs: { Args: never; Returns: undefined }
      compute_product_erp_hash: {
        Args: { p: Database["public"]["Tables"]["products"]["Row"] }
        Returns: string
      }
      create_app_session: {
        Args: {
          p_device_info?: string
          p_ip_address?: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: Json
      }
      force_replace_session: {
        Args: {
          p_device_info?: string
          p_ip_address?: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: Json
      }
      generate_pedido_terceiro: {
        Args: { order_number: string }
        Returns: number
      }
      get_active_sessions_admin: {
        Args: never
        Returns: {
          device_info: string
          expires_at: string
          ip_address: string
          last_activity_at: string
          session_id: string
          started_at: string
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      get_available_company_products: {
        Args: { p_company_id: string; p_limit?: number; p_search?: string }
        Returns: {
          active: boolean
          id: string
          is_already_ordered: boolean
          last_order_at: string
          name: string
          sku: string
          tenant_id: string
          unit_price: number
        }[]
      }
      get_available_company_products_v2: {
        Args: { p_company_id: string; p_limit?: number; p_search?: string }
        Returns: {
          active: boolean
          id: string
          is_already_ordered: boolean
          last_order_at: string
          name: string
          sku: string
          tenant_id: string
          unit_price: number
        }[]
      }
      get_bi_anomalies: {
        Args: never
        Returns: {
          action_label: string
          affected_count: number
          affected_value: number
          anomaly_type: string
          description: string
          filter_params: Json
          severity: string
          title: string
        }[]
      }
      get_companies_for_reallocation:
        | {
            Args: {
              p_limit?: number
              p_min_days_no_interaction?: number
              p_min_days_no_order?: number
              p_no_owner?: boolean
              p_offset?: number
              p_owner_id?: string
              p_regions?: string[]
              p_search?: string
              p_states?: string[]
            }
            Returns: {
              city: string
              cnpj: string
              company_id: string
              company_name: string
              days_since_interaction: number
              days_since_order: number
              last_interaction_at: string
              last_order_at: string
              owner_id: string
              owner_name: string
              regiao: string
              source: string
              state: string
              subregiao: string
              total_order_value: number
              total_orders: number
            }[]
          }
        | {
            Args: {
              p_limit?: number
              p_min_days_no_interaction?: number
              p_min_days_no_order?: number
              p_no_owner?: boolean
              p_offset?: number
              p_owner_id?: string
              p_regions?: string[]
              p_sales_rep_id?: string
              p_search?: string
              p_states?: string[]
            }
            Returns: {
              city: string
              cnpj: string
              company_id: string
              company_name: string
              days_since_interaction: number
              days_since_order: number
              last_interaction_at: string
              last_order_at: string
              owner_id: string
              owner_name: string
              regiao: string
              sales_rep_name: string
              source: string
              state: string
              subregiao: string
              total_order_value: number
              total_orders: number
            }[]
          }
      get_companies_for_reallocation_count:
        | {
            Args: {
              p_min_days_no_interaction?: number
              p_min_days_no_order?: number
              p_no_owner?: boolean
              p_owner_id?: string
              p_regions?: string[]
              p_search?: string
              p_states?: string[]
            }
            Returns: number
          }
        | {
            Args: {
              p_min_days_no_interaction?: number
              p_min_days_no_order?: number
              p_no_owner?: boolean
              p_owner_id?: string
              p_regions?: string[]
              p_sales_rep_id?: string
              p_search?: string
              p_states?: string[]
            }
            Returns: number
          }
      get_company_owner: { Args: { p_company_id: string }; Returns: string }
      get_conversion_by_stage: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          conversion_rate: number
          entered_count: number
          exited_count: number
          stage: string
          stage_order: number
        }[]
      }
      get_credito_presumido_aplicavel: {
        Args: {
          p_ncm?: string
          p_tipo_adquirente?: string
          p_tipo_operacao?: string
          p_tributo: string
          p_uf?: string
        }
        Returns: {
          codigo: string
          id: string
          nome: string
          percentual_credito: number
        }[]
      }
      get_customer_filter_options: {
        Args: never
        Returns: {
          atividades: Json[]
          cities: string[]
          industries: string[]
          segmentos: Json[]
          setores: Json[]
          states: string[]
        }[]
      }
      get_customer_last_relevant_interactions: {
        Args: { p_company_ids?: string[] }
        Returns: {
          customer_company_id: string
          interaction_source: string
          last_relevant_interaction_at: string
          legal_entity_id: string
          legal_entity_name: string
          source_record_id: string
        }[]
      }
      get_dashboard_card_metrics: { Args: never; Returns: Json }
      get_distinct_regions_for_reallocation: {
        Args: never
        Returns: {
          regiao: string
        }[]
      }
      get_distinct_states_for_reallocation: {
        Args: never
        Returns: {
          state: string
        }[]
      }
      get_group_deal_metrics_v1: {
        Args: { p_company_id: string }
        Returns: {
          counts_by_stage: Json
          total_deals: number
          total_value: number
        }[]
      }
      get_group_deal_metrics_v2: {
        Args: { p_company_id: string }
        Returns: {
          counts_by_stage: Json
          total_deals: number
          total_value: number
        }[]
      }
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
      get_lifecycle_counts: {
        Args: never
        Returns: {
          lifecycle_stage: string
          total: number
        }[]
      }
      get_module_access_type: {
        Args: { _module_key: string; _user_id: string }
        Returns: string
      }
      get_parametros_transicao: {
        Args: { p_ano: number }
        Returns: {
          aliquota_cbs_referencia: number | null
          aliquota_ibs_estadual: number | null
          aliquota_ibs_municipal: number | null
          aliquota_ibs_referencia: number | null
          ano_referencia: number
          base_legal: string | null
          created_at: string | null
          descricao: string | null
          id: string
          is_active: boolean | null
          modelo_tributario: Database["public"]["Enums"]["modelo_tributario"]
          percentual_cbs: number
          percentual_ibs: number
          percentual_icms_iss: number
          percentual_pis_cofins: number
          updated_at: string | null
          valid_from: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "transicao_tributaria_parametros"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_pipeline_health: {
        Args: {
          p_end_date?: string
          p_pipeline_id?: string
          p_start_date?: string
        }
        Returns: {
          advancement_rate: number
          avg_days_in_stage: number
          deals_over_sla: number
          sla_hours: number
          sla_violation_rate: number
          stage: string
          stage_order: number
          total_deals: number
          total_value: number
        }[]
      }
      get_portfolio_items: {
        Args: { p_entity_type?: string; p_sales_rep_id: string }
        Returns: {
          item_id: string
          item_name: string
          item_type: string
        }[]
      }
      get_portfolio_summary: {
        Args: never
        Returns: {
          companies_count: number
          contacts_count: number
          deals_count: number
          linked_user_id: string
          sales_rep_id: string
          sales_rep_name: string
          sales_rep_type: string
        }[]
      }
      get_region_by_state: { Args: { state_code: string }; Returns: string }
      get_sales_rep_name: { Args: { p_sales_rep_id: string }; Returns: string }
      get_seller_performance: {
        Args: {
          p_compare_previous?: boolean
          p_end_date?: string
          p_start_date?: string
        }
        Returns: {
          avg_cycle_days: number
          conversion_rate: number
          deals_created: number
          deals_lost: number
          deals_stalled: number
          deals_won: number
          prev_conversion_rate: number
          prev_deals_created: number
          prev_deals_won: number
          seller_id: string
          seller_name: string
          total_value_won: number
        }[]
      }
      get_seller_productivity: {
        Args: { p_end_date: string; p_seller_id?: string; p_start_date: string }
        Returns: {
          activities: number
          deal_updates: number
          efficiency_rate: number
          emails: number
          interaction_score: number
          notes: number
          orders: number
          participation_percent: number
          pipeline_conversion_rate: number
          proposal_conversion_rate: number
          proposals: number
          rank_position: number
          seller_id: string
          seller_name: string
          stage_changes: number
          tasks_completed: number
          tasks_created: number
          total_interactions: number
        }[]
      }
      get_session_idle_timeout_minutes: { Args: never; Returns: number }
      get_stalled_deals_by_seller: {
        Args: { p_min_days?: number; p_seller_id?: string }
        Returns: {
          company_name: string
          days_stalled: number
          deal_id: string
          deal_name: string
          owner_id: string
          owner_name: string
          stage: string
          value: number
        }[]
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
      get_user_tenant_ids: { Args: { p_user_id: string }; Returns: string[] }
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
      invalidate_own_session: {
        Args: { p_session_id: string }
        Returns: boolean
      }
      is_authenticated: { Args: never; Returns: boolean }
      next_erp_sequence: { Args: { p_sequence_name: string }; Returns: number }
      process_stock_movement: {
        Args: {
          p_company_id: string
          p_motivo?: string
          p_product_id: string
          p_quantidade: number
          p_referencia_id?: string
          p_referencia_tipo?: string
          p_tenant_id: string
          p_tipo: string
        }
        Returns: Json
      }
      promote_staging_products_v2: {
        Args: { p_batch_size?: number; p_tenant_id: string }
        Returns: Json
      }
      reset_orders: { Args: never; Returns: Json }
      resolve_user_for_sales_rep: {
        Args: { p_operation_context?: string; p_sales_rep_id: string }
        Returns: string
      }
      search_customers_paginated: {
        Args: {
          p_allowed_sales_rep_ids?: string[]
          p_atividade_id?: string
          p_city?: string
          p_lifecycle_stage?: string
          p_limit?: number
          p_offset?: number
          p_owner_id?: string
          p_search?: string
          p_segmento_id?: string
          p_setor_id?: string
          p_sort_dir?: string
          p_sort_field?: string
          p_state?: string
          p_status?: string
        }
        Returns: {
          active: boolean
          address: string
          atividade_id: string
          city: string
          cnpj: string
          contact_name: string
          contacts_count: number
          contribuinte_ipi: boolean
          created_at: string
          custom_fields: Json
          deals_count: number
          deals_lost_count: number
          deals_open_count: number
          deals_total_value: number
          deals_won_count: number
          email: string
          fantasia: string
          id: string
          last_interaction_at: string
          last_order_at: string
          last_relevant_interaction_at: string
          last_relevant_interaction_source: string
          last_relevant_legal_entity_id: string
          last_relevant_legal_entity_name: string
          name: string
          owner_id: string
          owner_name: string
          phone: string
          primary_contact_email: string
          primary_contact_job_title: string
          primary_contact_mobile: string
          primary_contact_name: string
          regiao: string
          segmento_id: string
          setor_id: string
          state: string
          total_count: number
        }[]
      }
      search_ncm: {
        Args: { limit_rows?: number; search_term: string }
        Returns: {
          aliquota_ipi_oficial: number
          codigo: string
          descricao: string
          id: string
          status: string
        }[]
      }
      staging_status_counts: {
        Args: { p_tenant_id?: string }
        Returns: {
          count: number
          status: string
        }[]
      }
      sync_erp_sequence_if_higher: {
        Args: { p_sequence_name: string; p_value: number }
        Returns: undefined
      }
      touch_app_session: { Args: { p_session_id: string }; Returns: boolean }
      transfer_stock: {
        Args: {
          p_from_company_id: string
          p_motivo?: string
          p_product_id: string
          p_quantidade: number
          p_tenant_id: string
          p_to_company_id: string
        }
        Returns: Json
      }
      user_has_sales_rep_access: {
        Args: { p_sales_rep_id: string; p_user_id: string }
        Returns: boolean
      }
      validate_app_session: { Args: { p_session_id: string }; Returns: Json }
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
      categoria_imposto_seletivo:
        | "bebidas_alcoolicas"
        | "bebidas_acucaradas"
        | "tabaco"
        | "veiculos"
        | "embarcacoes_aeronaves"
        | "extracao_mineral"
        | "concursos_prognosticos"
        | "nao_aplicavel"
      classificacao_tributaria_nfe:
        | "00"
        | "10"
        | "20"
        | "30"
        | "40"
        | "50"
        | "60"
        | "70"
        | "90"
      company_product_relationship_type:
        | "INTEREST"
        | "HOMOLOGATED"
        | "RECURRENT"
        | "STRATEGIC"
        | "BLACKLIST"
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
      dimension_profile: "full" | "partial" | "none"
      ipi_mode: "destacar" | "incluso" | "isento"
      lifecycle_stage:
        | "lead"
        | "prospect"
        | "customer_active"
        | "customer_inactive"
        | "customer_lost"
      modelo_tributario: "legado" | "dual_teste" | "dual_transicao" | "novo"
      order_status:
        | "pendente"
        | "em_producao"
        | "produzido"
        | "em_faturamento"
        | "faturado"
        | "entregue"
        | "cancelado"
      origem_mercadoria: "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8"
      proposal_status:
        | "rascunho"
        | "enviada"
        | "em_analise"
        | "aprovada"
        | "recusada"
        | "expirada"
      prospecting_result_status: "new" | "saved" | "discarded"
      regime_incidencia_cbs_ibs:
        | "normal"
        | "aliquota_zero"
        | "monofasico"
        | "isento"
        | "imune"
        | "suspensao"
        | "diferimento"
        | "cashback"
        | "nao_incidencia"
      regime_tributario:
        | "simples_nacional"
        | "lucro_presumido"
        | "lucro_real"
        | "mei"
      split_payment_status:
        | "estimado"
        | "retido"
        | "liquidado"
        | "ajustado"
        | "estornado"
      stock_movement_type: "entrada" | "saida" | "ajuste"
      task_priority: "baixa" | "media" | "alta" | "urgente"
      task_status: "pendente" | "em_andamento" | "concluida" | "cancelada"
      tipo_beneficio_fiscal:
        | "isencao"
        | "reducao_base"
        | "suspensao"
        | "diferimento"
        | "nao_tributado"
        | "aliquota_zero"
        | "credito_presumido"
      tipo_geracao_credito: "integral" | "parcial" | "vedado" | "presumido"
      tipo_operacao_fiscal:
        | "venda"
        | "venda_interestadual"
        | "devolucao_venda"
        | "devolucao_compra"
        | "remessa_demonstracao"
        | "retorno_demonstracao"
        | "remessa_conserto"
        | "retorno_conserto"
        | "transferencia"
        | "bonificacao"
        | "amostra_gratis"
        | "importacao"
        | "exportacao"
        | "venda_consumidor_final"
      tipo_pessoa: "PF" | "PJ"
      tipo_produto_fiscal:
        | "revenda"
        | "consumo"
        | "industrializacao"
        | "ativo_imobilizado"
      tributo_afetado:
        | "icms"
        | "icms_st"
        | "ipi"
        | "pis"
        | "cofins"
        | "iss"
        | "todos"
        | "cbs"
        | "ibs"
        | "is"
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
      categoria_imposto_seletivo: [
        "bebidas_alcoolicas",
        "bebidas_acucaradas",
        "tabaco",
        "veiculos",
        "embarcacoes_aeronaves",
        "extracao_mineral",
        "concursos_prognosticos",
        "nao_aplicavel",
      ],
      classificacao_tributaria_nfe: [
        "00",
        "10",
        "20",
        "30",
        "40",
        "50",
        "60",
        "70",
        "90",
      ],
      company_product_relationship_type: [
        "INTEREST",
        "HOMOLOGATED",
        "RECURRENT",
        "STRATEGIC",
        "BLACKLIST",
      ],
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
      dimension_profile: ["full", "partial", "none"],
      ipi_mode: ["destacar", "incluso", "isento"],
      lifecycle_stage: [
        "lead",
        "prospect",
        "customer_active",
        "customer_inactive",
        "customer_lost",
      ],
      modelo_tributario: ["legado", "dual_teste", "dual_transicao", "novo"],
      order_status: [
        "pendente",
        "em_producao",
        "produzido",
        "em_faturamento",
        "faturado",
        "entregue",
        "cancelado",
      ],
      origem_mercadoria: ["0", "1", "2", "3", "4", "5", "6", "7", "8"],
      proposal_status: [
        "rascunho",
        "enviada",
        "em_analise",
        "aprovada",
        "recusada",
        "expirada",
      ],
      prospecting_result_status: ["new", "saved", "discarded"],
      regime_incidencia_cbs_ibs: [
        "normal",
        "aliquota_zero",
        "monofasico",
        "isento",
        "imune",
        "suspensao",
        "diferimento",
        "cashback",
        "nao_incidencia",
      ],
      regime_tributario: [
        "simples_nacional",
        "lucro_presumido",
        "lucro_real",
        "mei",
      ],
      split_payment_status: [
        "estimado",
        "retido",
        "liquidado",
        "ajustado",
        "estornado",
      ],
      stock_movement_type: ["entrada", "saida", "ajuste"],
      task_priority: ["baixa", "media", "alta", "urgente"],
      task_status: ["pendente", "em_andamento", "concluida", "cancelada"],
      tipo_beneficio_fiscal: [
        "isencao",
        "reducao_base",
        "suspensao",
        "diferimento",
        "nao_tributado",
        "aliquota_zero",
        "credito_presumido",
      ],
      tipo_geracao_credito: ["integral", "parcial", "vedado", "presumido"],
      tipo_operacao_fiscal: [
        "venda",
        "venda_interestadual",
        "devolucao_venda",
        "devolucao_compra",
        "remessa_demonstracao",
        "retorno_demonstracao",
        "remessa_conserto",
        "retorno_conserto",
        "transferencia",
        "bonificacao",
        "amostra_gratis",
        "importacao",
        "exportacao",
        "venda_consumidor_final",
      ],
      tipo_pessoa: ["PF", "PJ"],
      tipo_produto_fiscal: [
        "revenda",
        "consumo",
        "industrializacao",
        "ativo_imobilizado",
      ],
      tributo_afetado: [
        "icms",
        "icms_st",
        "ipi",
        "pis",
        "cofins",
        "iss",
        "todos",
        "cbs",
        "ibs",
        "is",
      ],
    },
  },
} as const
