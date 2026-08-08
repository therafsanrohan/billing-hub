/**
 * Supabase Database TypeScript Definitions
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      business_entities: {
        Row: {
          id: string;
          legal_name: string;
          entity_code: string;
          logo_url: string | null;
          registered_address: string;
          registration_number: string;
          tax_id: string;
          email: string;
          phone: string;
          website: string;
          payment_instructions: string;
          invoice_prefix: string;
          receipt_prefix: string;
          vat_footer: string;
          bkash_merchant: string | null;
          nagad_merchant: string | null;
          corporate_tax_rate: number;
          default_vat_rate: number;
          created_at?: string;
          updated_at?: string;
        };
        Insert: Omit<Database['public']['Tables']['business_entities']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['business_entities']['Insert']>;
      };
      invoices: {
        Row: {
          id: string;
          secure_token: string;
          invoice_number: string | null;
          status: 'draft' | 'pending_approval' | 'approved' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
          entity_id: string;
          client_id: string;
          currency: 'BDT' | 'USD';
          issue_date: string;
          payment_terms: string;
          due_date: string;
          project_name: string;
          service_period: string;
          po_number: string;
          reference_number: string;
          account_manager_id: string | null;
          discount_type: 'none' | 'percentage' | 'fixed';
          discount_value: number;
          vat_rate: number;
          vat_inclusive: boolean;
          client_note: string;
          payment_instructions: string;
          terms_conditions: string;
          internal_note: string;
          pdf_file_url: string | null;
          pdf_generated_at: string | null;
          approved_by: string | null;
          approved_at: string | null;
          created_by: string;
          organization_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Insert: Database['public']['Tables']['invoices']['Row'];
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>;
      };
      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          service_name: string;
          description: string;
          quantity: number;
          rate: number;
          amount: number;
          sort_order: number;
        };
        Insert: Database['public']['Tables']['invoice_items']['Row'];
        Update: Partial<Database['public']['Tables']['invoice_items']['Insert']>;
      };
      clients: {
        Row: {
          id: string;
          company_name: string;
          contact_person: string;
          email: string;
          phone: string;
          billing_address: string;
          country: string;
          tax_id: string | null;
          currency_preference: 'BDT' | 'USD';
          status: 'active' | 'inactive';
          organization_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Insert: Database['public']['Tables']['clients']['Row'];
        Update: Partial<Database['public']['Tables']['clients']['Insert']>;
      };
      payments: {
        Row: {
          id: string;
          invoice_id: string;
          receipt_number: string | null;
          payment_date: string;
          amount: number;
          currency: 'BDT' | 'USD';
          payment_method: string;
          transaction_reference: string;
          bank_account_id: string | null;
          notes: string;
          recorded_by: string;
          client_id: string | null;
          organization_id?: string;
          created_at?: string;
        };
        Insert: Database['public']['Tables']['payments']['Row'];
        Update: Partial<Database['public']['Tables']['payments']['Insert']>;
      };
      expenses: {
        Row: {
          id: string;
          entity_id: string;
          category: string;
          description: string;
          amount: number;
          currency: 'BDT' | 'USD';
          expense_date: string;
          recorded_by: string;
          vendor_id: string | null;
          bank_account_id: string | null;
          organization_id?: string;
          created_at?: string;
        };
        Insert: Database['public']['Tables']['expenses']['Row'];
        Update: Partial<Database['public']['Tables']['expenses']['Insert']>;
      };
    };
  };
}
