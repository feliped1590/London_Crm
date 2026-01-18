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
      order_items: {
        Row: {
          created_at: string
          description: string
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
          id: string
          name: string
          probability: number | null
          sort_order: number
          stage: Database["public"]["Enums"]["deal_stage"]
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          probability?: number | null
          sort_order: number
          stage: Database["public"]["Enums"]["deal_stage"]
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          probability?: number | null
          sort_order?: number
          stage?: Database["public"]["Enums"]["deal_stage"]
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
          status: Database["public"]["Enums"]["proposal_status"]
          total_value: number | null
          updated_at: string
          validity_date: string | null
        }
        Insert: {
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
          status?: Database["public"]["Enums"]["proposal_status"]
          total_value?: number | null
          updated_at?: string
          validity_date?: string | null
        }
        Update: {
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      app_role: "admin" | "vendedor" | "atendente"
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
      app_role: ["admin", "vendedor", "atendente"],
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
